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
function workspaceModel(role = "owner") {
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
          kind: "personal",
          currency: "PHP",
          timezone: "Asia/Manila",
          members: [{ userId: "alice", status: "active", role }],
        }),
      };
    },
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
      (await new WorkspacesService(workspaceModel(), {}).get(workspaceId)).role,
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
    new WorkspacesService(model, {}).create({
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
      new WorkspacesService(workspaceModel("member"), model).getTransaction(
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
      new WorkspacesService(workspaceModel("viewer"), {}).createTransaction(
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
    const service = new WorkspacesService(workspaceModel("member"), model);
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
      new WorkspacesService(model, {}).create({
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
