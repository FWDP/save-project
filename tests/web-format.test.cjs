const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { decimalToMinor, filters } = require("./load-typescript.cjs")(
  path.join(__dirname, "../web/src/lib/format.ts"),
);
test("web money parsing uses exact centavos and rejects silent rounding", () => {
  for (const [input, cents] of [
    ["0.01", 1],
    ["1.1", 110],
    ["1250.50", 125050],
    ["9999999999.99", 999999999999],
  ])
    assert.equal(decimalToMinor(input), cents);
  for (const input of [
    "0",
    "-1",
    "1.001",
    "1e3",
    "NaN",
    "10000000000",
    "1,000.00",
    "",
  ])
    assert.throws(() => decimalToMinor(input));
});
test("web filters preserve supported URL values without copying unknown parameters", () => {
  const query = filters({
    month: "2026-09",
    search: "coffee & lunch",
    type: "expense",
    page: "2",
    ownerId: "someone-else",
  });
  assert.equal(query.get("month"), "2026-09");
  assert.equal(query.get("search"), "coffee & lunch");
  assert.equal(query.has("ownerId"), false);
  assert.match(
    filters({ month: "2026-13" }).get("month"),
    /^\d{4}-(0[1-9]|1[0-2])$/,
  );
});
const load = require("./load-typescript.cjs");
const { CURRENCIES, currencyDigits, currencyName, minorToDecimal } = load(
  path.join(__dirname, "../web/src/lib/currency.ts"),
);
const { money } = load(path.join(__dirname, "../web/src/lib/format.ts"));
test("currency amounts round-trip for zero, two and three decimal places", () => {
  for (const [currency, decimal, minor] of [
    ["TWD", "123.45", 12345],
    ["CNY", "123.45", 12345],
    ["KRW", "12345", 12345],
    ["JPY", "500", 500],
    ["KWD", "1.234", 1234],
    ["BHD", "0.001", 1],
  ]) {
    assert.equal(decimalToMinor(decimal, currency), minor);
    assert.equal(minorToDecimal(minor, currency), decimal);
    assert.ok(money(minor, currency).includes(currency));
  }
  assert.throws(() => decimalToMinor("1.5", "KRW"));
  assert.throws(() => decimalToMinor("1.001", "CNY"));
  assert.throws(() => decimalToMinor("1.0001", "KWD"));
  assert.throws(() => decimalToMinor("1", "XXX"));
  assert.equal(currencyDigits("TWD"), 2);
  assert.equal(currencyDigits("KRW"), 0);
  assert.match(currencyName("TWD"), /NTD/);
});
test("Web and API currency allowlists stay aligned", () => {
  const { SUPPORTED_CURRENCIES } = load(
    path.join(__dirname, "../backend/src/workspaces/currencies.ts"),
  );
  assert.deepEqual([...CURRENCIES], [...SUPPORTED_CURRENCIES]);
  for (const code of CURRENCIES)
    assert.equal(
      decimalToMinor(minorToDecimal(999999999999, code), code),
      999999999999,
    );
});
test('transaction action uses the verified workspace currency, ignoring form overrides', async () => {
  const calls = [];
  const api = async (url, options) => { calls.push({url,options}); return { currency: 'KRW' }; };
  const { saveTransaction } = load(path.join(__dirname, '../web/src/app/workspaces/actions.ts'), {
    'next/navigation': { redirect: () => {}, unstable_rethrow: () => {} },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/api': { api },
    '@/lib/format': { decimalToMinor },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ workspaceId: '507f1f77bcf86cd799439011', amount: '1.25', currency: 'USD', date: '2026-09-23' })) form.set(key, value);
  const result = await saveTransaction({}, form);
  assert.match(result.error, /KRW/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options, undefined);
});
