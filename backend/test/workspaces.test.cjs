const test = require("node:test");
const assert = require("node:assert/strict");
const { Types } = require("mongoose");
const { WorkspacesService } = require("../dist/workspaces/workspaces.service");
const {
  assertWrite,
  visibleTransactions,
  validateRecord,
  escapeSearch,
} = require("../dist/workspaces/workspaces.policy");
const { authContext } = require("../dist/auth/auth-context");
const { AuthGuard } = require("../dist/auth/auth.guard");
const workspaceId = "507f1f77bcf86cd799439011";
const recordId = "507f191e810c19729de860ea";
const actor = (id, fn) => authContext.run({ userId: id }, fn);
function workspaceModel(role = "owner", kind = "business", currency = "PHP") {
  return {
    findOne(filter) {
      assert.equal(filter._id, workspaceId);
      assert.deepEqual(filter.members, {
        $elemMatch: { userId: "alice", status: "active" },
      });
      return {
        lean: async () => ({
          _id: new Types.ObjectId(workspaceId),
          name: "Personal",
          ownerId: "alice",
          kind,
          currency,
          timezone: "Asia/Manila",
          members: [{ userId: "alice", status: "active", role }],
        }),
      };
    },
  };
}
function personalTransactionService(overrides = {}) {
  return {
    findAll: async () => [],
    findOne: async () => ({}),
    create: async () => ({}),
    update: async () => ({}),
    remove: async () => ({ deleted: true }),
    importWorkspaceTransaction: async () => {},
    ...overrides,
  };
}
test("workspace endpoints cannot be accessed without a verified bearer token", async () => {
  for (const path of ["/workspaces", `/workspaces/${workspaceId}/transactions`])
    await assert.rejects(
      new AuthGuard().canActivate({
        switchToHttp: () => ({ getRequest: () => ({ path, headers: {} }) }),
      }),
      { status: 401 },
    );
});
test("role matrix restricts writes and member visibility", () => {
  for (const role of ["owner", "admin", "finance", "member"])
    assert.doesNotThrow(() => assertWrite(role));
  assert.throws(() => assertWrite("viewer"), { status: 403 });
  assert.deepEqual(visibleTransactions("business", "alice", "member"), {
    workspaceId: "business",
    createdBy: "alice",
  });
  for (const role of ["owner", "admin", "finance", "viewer"])
    assert.deepEqual(visibleTransactions("business", "alice", role), {
      workspaceId: "business",
    });
});
test("workspace access checks active membership, not caller-supplied ownership", async () => {
  await actor("alice", async () =>
    assert.equal(
      (
        await new WorkspacesService(
          workspaceModel(),
          {},
          personalTransactionService(),
        ).get(workspaceId)
      ).role,
      "owner",
    ),
  );
  await actor("bob", async () =>
    assert.rejects(
      new WorkspacesService(
        {
          findOne: (filter) => {
            assert.deepEqual(filter.members, {
              $elemMatch: { userId: "bob", status: "active" },
            });
            return { lean: async () => null };
          },
        },
        {},
        personalTransactionService(),
      ).get(workspaceId),
      { status: 404 },
    ),
  );
});
test("personal workspace creation is an idempotent owner-scoped upsert with fixed initial membership", async () => {
  const model = {
    findOneAndUpdate(filter, update, options) {
      assert.deepEqual(filter, { ownerId: "alice", kind: "personal" });
      assert.equal(options.upsert, true);
      assert.deepEqual(update.$setOnInsert.members, [
        { userId: "alice", role: "owner", status: "active" },
      ]);
      assert.equal(update.$setOnInsert.ownerId, "alice");
      return {
        lean: async () => ({
          ...update.$setOnInsert,
          _id: new Types.ObjectId(workspaceId),
        }),
      };
    },
  };
  await actor("alice", () =>
    new WorkspacesService(model, {}, personalTransactionService()).create({
      name: "My finances",
      kind: "personal",
      ownerId: "bob",
      clientMutationId: "request-1",
      members: [{ userId: "bob", role: "owner" }],
    }),
  );
});
test("known transaction ID cannot cross workspace or creator visibility boundary", async () => {
  const model = {
    findOne(filter) {
      assert.deepEqual(filter, {
        _id: recordId,
        workspaceId,
        createdBy: "alice",
      });
      return { lean: async () => null };
    },
  };
  await actor("alice", () =>
    assert.rejects(
      new WorkspacesService(
        workspaceModel("member"),
        model,
        personalTransactionService(),
      ).getTransaction(
        workspaceId,
        recordId,
      ),
      { status: 404 },
    ),
  );
});
test("viewer cannot create a record even with a valid workspace ID", async () => {
  await actor("alice", () =>
    assert.rejects(
      new WorkspacesService(
        workspaceModel("viewer"),
        {},
        personalTransactionService(),
      ).createTransaction(
        workspaceId,
        {},
      ),
      { status: 403 },
    ),
  );
});
test("concurrent edits and deletes include expected revision and reject stale versions", async () => {
  const model = {
    findOneAndUpdate(filter, update) {
      assert.equal(filter.revision, 3);
      assert.equal(filter.workspaceId, workspaceId);
      assert.equal(filter.createdBy, "alice");
      assert.deepEqual(update.$inc, { revision: 1 });
      return { lean: async () => null };
    },
    findOneAndDelete(filter) {
      assert.equal(filter.revision, 3);
      assert.equal(filter.workspaceId, workspaceId);
      return { lean: async () => null };
    },
  };
  await actor("alice", async () => {
    const service = new WorkspacesService(
      workspaceModel("member"),
      model,
      personalTransactionService(),
    );
    await assert.rejects(
      service.editTransaction(workspaceId, recordId, {
        revision: 3,
        clientMutationId: "record-key",
        date: "2026-09-23",
        description: "Lunch",
        category: "Food",
        amountMinor: 100,
      }),
      { status: 409 },
    );
    await assert.rejects(service.deleteTransaction(workspaceId, recordId, 3), {
      status: 409,
    });
  });
});
test("aggregate summary and pagination use the same workspace and filter", async () => {
  let expected;
  const model = {
    find(filter) {
      expected = filter;
      return {
        sort: () => ({
          skip: (skip) => {
            assert.equal(skip, 25);
            return { limit: () => ({ lean: async () => [] }) };
          },
        }),
      };
    },
    aggregate(pipeline) {
      assert.deepEqual(pipeline[0].$match, expected);
      return Promise.resolve([
        {
          totals: [{ count: 30, incomeMinor: 10000, expenseMinor: 3500 }],
          categories: [],
        },
      ]);
    },
  };
  await actor("alice", async () => {
    const data = await new WorkspacesService(
      workspaceModel("member"),
      model,
      personalTransactionService(),
    ).listTransactions(workspaceId, {
      month: "2026-09",
      page: 2,
      search: "coffee.*",
    });
    assert.equal(data.summary.balanceMinor, 6500);
    assert.equal(data.total, 30);
    assert.equal(expected.workspaceId, workspaceId);
    assert.equal(expected.createdBy, "alice");
    assert.equal(expected.$or[0].description.$regex, "coffee\\.\\*");
  });
});
test("personal PHP workspaces migrate old Web records and report the shared Mobile dataset", async () => {
  const migrated = [];
  let marked = false;
  const oldWebRecord = {
    _id: new Types.ObjectId(recordId),
    clientMutationId: "web-record-1",
    createdBy: "alice",
    type: "expense",
    amountMinor: 1250,
    description: "Coffee shop",
    category: "Food",
    merchant: "Cafe",
    date: "2026-09-12",
  };
  const workspaceTransactions = {
    find(filter) {
      assert.deepEqual(filter, {
        workspaceId,
        createdBy: "alice",
        sharedWithMobile: { $ne: true },
      });
      return {
        sort: () => ({ lean: async () => [oldWebRecord] }),
      };
    },
    updateOne(filter, update) {
      assert.equal(String(filter._id), recordId);
      assert.equal(update.$set.sharedWithMobile, true);
      marked = true;
      return Promise.resolve({});
    },
  };
  const personal = personalTransactionService({
    importWorkspaceTransaction: async (record) => migrated.push(record),
    findAll: async () => [
      {
        id: recordId,
        userId: "alice",
        clientMutationId: "web-record-1",
        type: "expense",
        amount: 12.5,
        description: "Coffee shop",
        category: "Food",
        merchant: "Cafe",
        date: "2026-09-12",
        revision: 1,
      },
      {
        id: "507f1f77bcf86cd799439012",
        userId: "alice",
        type: "income",
        amount: 50,
        description: "Pay",
        category: "Income",
        date: "2026-09-11",
        revision: 2,
      },
      {
        id: "507f1f77bcf86cd799439013",
        userId: "alice",
        type: "expense",
        amount: 80,
        description: "Other month",
        category: "Food",
        date: "2026-08-12",
        revision: 1,
      },
    ],
  });
  await actor("alice", async () => {
    const data = await new WorkspacesService(
      workspaceModel("owner", "personal"),
      workspaceTransactions,
      personal,
    ).listTransactions(workspaceId, {
      month: "2026-09",
      search: "coffee",
    });
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].id, recordId);
    assert.equal(migrated[0].amountMinor, 1250);
    assert.equal(marked, true);
    assert.equal(data.total, 1);
    assert.equal(data.summary.expenseMinor, 1250);
    assert.equal(data.items[0].workspaceId, workspaceId);
    assert.equal(data.items[0].revision, 1);
    assert.deepEqual(data.categories, [
      { name: "Food", amountMinor: 1250, count: 1 },
    ]);
  });
});
test("personal Web writes use the same PHP records as Mobile", async () => {
  let created;
  const workspaceTransactions = {
    find: () => ({ sort: () => ({ lean: async () => [] }) }),
  };
  const personal = personalTransactionService({
    create: async (record) => {
      created = record;
      return {
        id: recordId,
        userId: "alice",
        ...record,
        revision: 1,
      };
    },
  });
  await actor("alice", async () => {
    const transaction = await new WorkspacesService(
      workspaceModel("owner", "personal"),
      workspaceTransactions,
      personal,
    ).createTransaction(workspaceId, {
      clientMutationId: "web-create-1",
      type: "expense",
      amountMinor: 1234,
      description: "Lunch",
      category: "Food",
      merchant: "Cafe",
      date: "2026-09-12",
    });
    assert.equal(created.amount, 12.34);
    assert.equal(created.userId, "alice");
    assert.equal(transaction.id, recordId);
    assert.equal(transaction.amountMinor, 1234);
  });
});
test("invalid calendar dates and empty labels cannot be persisted", () => {
  assert.throws(
    () =>
      validateRecord({
        date: "2026-02-30",
        description: "Lunch",
        category: "Food",
      }),
    { status: 400 },
  );
  assert.throws(
    () =>
      validateRecord({
        date: "2026-09-01",
        description: " ",
        category: "Food",
      }),
    { status: 400 },
  );
  assert.doesNotThrow(() =>
    validateRecord({
      date: "2024-02-29",
      description: "Lunch",
      category: "Food",
    }),
  );
  assert.equal(escapeSearch("$100 (cash)"), "\\$100 \\(cash\\)");
});
test("new personal workspaces reject currencies Mobile cannot represent", async () => {
  await actor("alice", async () =>
    assert.rejects(
      new WorkspacesService({}, {}, personalTransactionService()).create({
        name: "Personal",
        kind: "personal",
        currency: "USD",
        clientMutationId: "personal-usd",
      }),
      { status: 400 },
    ),
  );
});
test("workspace currency defaults to PHP and supports TWD, CNY and KRW at creation", async () => {
  for (const currency of [undefined, "TWD", "CNY", "KRW"]) {
    const model = {
      findOneAndUpdate(filter, update) {
        assert.equal(update.$setOnInsert.currency, currency ?? "PHP");
        return {
          lean: async () => ({
            ...update.$setOnInsert,
            _id: new Types.ObjectId(workspaceId),
          }),
        };
      },
    };
    await actor("alice", () =>
      new WorkspacesService(model, {}, personalTransactionService()).create({
        name: "Currency test",
        kind: "business",
        clientMutationId: "currency-test",
        currency,
      }),
    );
  }
});
test("currency validation rejects unknown codes and workspace currency is immutable", async () => {
  const { validate } = require("class-validator");
  const { CreateWorkspaceDto } = require("../dist/workspaces/workspaces.dto");
  const { WorkspaceSchema } = require("../dist/workspaces/workspace.schema");
  for (const currency of ["TWD", "CNY", "KRW", "USD"])
    assert.equal(
      (
        await validate(
          Object.assign(new CreateWorkspaceDto(), {
            name: "Test",
            kind: "business",
            clientMutationId: "test-currency",
            currency,
          }),
        )
      ).length,
      0,
    );
  const errors = await validate(
    Object.assign(new CreateWorkspaceDto(), {
      name: "Test",
      kind: "business",
      clientMutationId: "test-currency",
      currency: "NTD",
    }),
  );
  assert.ok(errors.some((e) => e.property === "currency"));
  assert.equal(WorkspaceSchema.path("currency").options.immutable, true);
});

test("existing workspace memberships are identical for Web and Mobile and isolated per account", async () => {
  const rows = [
    { _id: new Types.ObjectId(), name: 'Existing personal', kind: 'personal', currency: 'PHP', timezone: 'Asia/Manila', ownerId: 'alice', members: [{ userId: 'alice', role: 'owner', status: 'active' }] },
    { _id: new Types.ObjectId(), name: 'Existing shared business', kind: 'business', currency: 'USD', timezone: 'Asia/Manila', ownerId: 'alice', members: [{ userId: 'alice', role: 'owner', status: 'active' }, { userId: 'bob', role: 'finance', status: 'active' }] },
    { _id: new Types.ObjectId(), name: 'Other personal', kind: 'personal', currency: 'PHP', timezone: 'Asia/Manila', ownerId: 'bob', members: [{ userId: 'bob', role: 'owner', status: 'active' }, { userId: 'alice', role: 'viewer', status: 'suspended' }] },
    { _id: new Types.ObjectId(), name: 'Unrelated', kind: 'business', currency: 'PHP', timezone: 'Asia/Manila', ownerId: 'carol', members: [{ userId: 'carol', role: 'owner', status: 'active' }] },
  ];
  const service = new WorkspacesService({
    find(filter) {
      const { userId, status } = filter.members.$elemMatch;
      assert.equal(status, 'active');
      return { sort: () => ({ lean: async () => rows.filter(row => row.members.some(member => member.userId === userId && member.status === status)) }) };
    },
  }, {}, personalTransactionService());
  const [aliceWeb, bobMobile, aliceMobile] = await Promise.all([
    actor('alice', () => service.list()), actor('bob', () => service.list()), actor('alice', () => service.list()),
  ]);
  assert.deepEqual(aliceWeb, aliceMobile);
  assert.deepEqual(aliceMobile.map(row => row.id), rows.slice(0, 2).map(row => String(row._id)));
  assert.deepEqual(bobMobile.map(row => row.id), rows.slice(1, 3).map(row => String(row._id)));
  assert.equal(aliceMobile[1].role, 'owner');
  assert.equal(bobMobile[0].role, 'finance');
  assert.deepEqual(await actor('new-account', () => service.list()), []);
  rows[1].members[1].status = 'suspended';
  assert.deepEqual((await actor('bob', () => service.list())).map(row => row.id), [String(rows[2]._id)]);
  rows[3].members.push({ userId: 'bob', role: 'viewer', status: 'active' });
  assert.deepEqual((await actor('bob', () => service.list())).map(row => row.id), [String(rows[2]._id), String(rows[3]._id)]);
});
