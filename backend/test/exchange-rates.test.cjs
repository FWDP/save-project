const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ExchangeRatesService,
  convertMinor,
} = require("../dist/workspaces/exchange-rates.service");
const {
  WorkspacesController,
} = require("../dist/workspaces/workspaces.controller");
const now = () => new Date().toISOString();
const body = (rate = 32, asOf = now()) => ({
  meta: { last_updated_at: asOf },
  data: {
    TWD: { code: "TWD", value: rate },
    KRW: { code: "KRW", value: 1300 },
  },
});
async function fixture(fn, response = body()) {
  const originalFetch = global.fetch;
  const originalKey = process.env.CURRENCYAPI_KEY;
  let count = 0;
  process.env.CURRENCYAPI_KEY = "test-only";
  global.fetch = async (url, options) => {
    count++;
    assert.equal(new URL(url).hostname, "api.currencyapi.com");
    assert.equal(options.headers.apikey, "test-only");
    return { ok: true, json: async () => response };
  };
  try {
    await fn(new ExchangeRatesService(), () => count);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.CURRENCYAPI_KEY;
    else process.env.CURRENCYAPI_KEY = originalKey;
  }
}
test("conversions respect decimal precision and round half away from zero", () => {
  assert.equal(convertMinor(100, "USD", "TWD", 32.5), 3250);
  assert.equal(convertMinor(100, "USD", "KRW", 1300.5), 1301);
  assert.equal(convertMinor(-100, "USD", "KRW", 1300.5), -1301);
  assert.equal(convertMinor(100, "USD", "KWD", 0.3075), 308);
  assert.equal(convertMinor(1, "JPY", "USD", 0.00675), 1);
  assert.equal(convertMinor(100000, "USD", "TWD", 1e-3), 100);
  for (const rate of [NaN, 0, -1, Infinity])
    assert.throws(() => convertMinor(100, "USD", "TWD", rate));
  assert.throws(() => convertMinor(Number.MAX_SAFE_INTEGER, "USD", "TWD", 100));
});
test("provider data is cached for a minute and concurrent requests are coalesced", async () => {
  await fixture(async (service, count) => {
    const [a, b] = await Promise.all([
      service.quote("USD", "TWD"),
      service.quote("USD", "KRW"),
    ]);
    assert.equal(a.rate, 32);
    assert.equal(b.rate, 1300);
    assert.equal(count(), 1);
    await service.quote("USD", "TWD");
    assert.equal(count(), 1);
    assert.equal(a.provider, "CurrencyAPI");
    assert.ok(Date.parse(a.expiresAt) > Date.now());
  });
});
test("stale, future, missing and invalid rates never become live conversions", async () => {
  for (const response of [
    body(32, new Date(Date.now() - 3600000).toISOString()),
    body(32, new Date(Date.now() + 3600000).toISOString()),
    body(-1),
    body("32"),
    { meta: { last_updated_at: now() }, data: {} },
    { data: {} },
  ])
    await fixture(async (service) => {
      await assert.rejects(service.quote("USD", "TWD"), { status: 503 });
    }, response);
});
test("provider failure is retryable and does not reveal credentials or serve a made-up rate", async () => {
  await fixture(async (service, count) => {
    global.fetch = async () => {
      throw new Error("secret-key-do-not-echo");
    };
    await assert.rejects(
      service.quote("USD", "TWD"),
      (e) => e.status === 503 && !e.message.includes("secret-key"),
    );
    await assert.rejects(service.quote("USD", "TWD"), { status: 503 });
  });
});
test("same currency needs no provider and missing configuration fails closed", async () => {
  await fixture(async (service, count) => {
    delete process.env.CURRENCYAPI_KEY;
    assert.equal((await service.quote("PHP", "PHP")).rate, 1);
    assert.equal(count(), 0);
    await assert.rejects(service.quote("PHP", "TWD"), { status: 503 });
    await assert.rejects(service.quote("PHP", "NTD"), { status: 400 });
  });
});
test("converted reports authorize before accessing rates and preserve filtered scope", async () => {
  const query = { month: "2026-09", target: "KRW", search: "coffee" };
  const data = {
    total: 2,
    summary: { incomeMinor: 100, expenseMinor: 50 },
    categories: [{ name: "Food", amountMinor: 50, count: 1 }],
  };
  const controller = new WorkspacesController(
    {
      get: async () => ({ currency: "USD" }),
      listTransactions: async (id, q) => {
        assert.equal(id, "workspace");
        assert.equal(q, query);
        return data;
      },
    },
    { quote: async (base, target) => ({ base, target, rate: 1300.5 }) },
  );
  const result = await controller.convertedReport("workspace", query);
  assert.equal(result.summary.incomeMinor, 1301);
  assert.equal(result.summary.expenseMinor, 650);
  assert.equal(result.summary.balanceMinor, 651);
  let fetched = false;
  const denied = new WorkspacesController(
    {
      get: async () => {
        throw new Error("denied");
      },
    },
    {
      quote: async () => {
        fetched = true;
      },
    },
  );
  await assert.rejects(denied.convertedReport("private", query));
  assert.equal(fetched, false);
});
