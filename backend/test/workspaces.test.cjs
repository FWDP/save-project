const test = require("node:test");
const assert = require("node:assert/strict");
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

function workspace(id = workspaceId, role = "owner", kind = "business", currency = "PHP") {
  return {
    id,
    name: "Workspace",
    kind,
    owner_id: "alice",
    client_mutation_id: "workspace-key",
    currency,
    timezone: "Asia/Manila",
    role,
    member_count: 1,
    members: { alice: { role, status: "active" } },
  };
}

function database({ workspaces = [workspace()], query = async () => ({ rows: [] }), transaction } = {}) {
  return {
    async query(sql, values = []) {
      if (sql.includes("from public.workspaces w")) {
        if (sql.includes("where w.id = $1")) {
          const row = workspaces.find(item => item.id === values[0]);
          const member = row?.members?.[values[1]];
          return { rows: member?.status === "active" ? [{ ...row, role: member.role }] : [] };
        }
        return { rows: workspaces.filter(item => item.members?.[values[0]]?.status === "active").map(item => ({ ...item, role: item.members[values[0]].role })) };
      }
      return query(sql, values);
    },
    async transaction(operation) {
      if (transaction) return transaction(operation);
      throw new Error("Unexpected transaction");
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

function service(db = database(), personal = personalTransactionService()) {
  return new WorkspacesService(db, personal);
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
  await actor("alice", async () => assert.equal((await service().get(workspaceId)).role, "owner"));
  await actor("bob", async () => assert.rejects(service().get(workspaceId), { status: 404 }));
});

test("personal workspace creation is an idempotent owner-scoped upsert with fixed initial membership", async () => {
  let insertedWorkspace;
  const db = database({
    workspaces: [workspace(workspaceId, "owner", "personal")],
    transaction: async operation => operation({
      query: async (sql, values) => {
        if (sql.startsWith("insert into public.workspaces")) {
          assert.match(sql, /on conflict \(owner_id\) where kind = 'personal'/);
          assert.equal(values[2], "alice");
          assert.equal(values[3], "request-1");
          insertedWorkspace = { ...workspace(workspaceId, "owner", "personal"), name: values[1] };
          return { rows: [] };
        }
        if (sql.startsWith("select * from public.workspaces")) return { rows: [insertedWorkspace] };
        if (sql.startsWith("insert into public.workspace_members")) {
          assert.deepEqual(values, [workspaceId, "alice"]);
          return { rows: [] };
        }
        throw new Error("Unexpected SQL");
      },
    }),
  });
  await actor("alice", () => service(db).create({
    name: "My finances",
    kind: "personal",
    ownerId: "bob",
    clientMutationId: "request-1",
    members: [{ userId: "bob", role: "owner" }],
  }));
});

test("known transaction ID cannot cross workspace or creator visibility boundary", async () => {
  const db = database({
    workspaces: [workspace(workspaceId, "member")],
    query: async (sql, values) => {
      assert.match(sql, /from public\.workspace_transactions/);
      assert.deepEqual(values, [recordId, workspaceId, "alice"]);
      return { rows: [] };
    },
  });
  await actor("alice", () => assert.rejects(service(db).getTransaction(workspaceId, recordId), { status: 404 }));
});

test("viewer cannot create a record even with a valid workspace ID", async () => {
  await actor("alice", () => assert.rejects(
    service(database({ workspaces: [workspace(workspaceId, "viewer")] })).createTransaction(workspaceId, {}),
    { status: 403 },
  ));
});

test("concurrent edits and deletes include expected revision and reject stale versions", async () => {
  const db = database({
    workspaces: [workspace(workspaceId, "member")],
    query: async (sql, values) => {
      assert.equal(values[0], recordId);
      assert.equal(values[1], workspaceId);
      assert.equal(values[2], 3);
      if (sql.startsWith("update")) {
        assert.equal(values.at(-1), "alice");
        assert.ok(sql.includes("revision = revision + 1"));
      } else {
        assert.equal(values[3], "alice");
        assert.ok(sql.startsWith("delete from public.workspace_transactions"));
      }
      return { rows: [] };
    },
  });
  await actor("alice", async () => {
    const workspaces = service(db);
    await assert.rejects(workspaces.editTransaction(workspaceId, recordId, {
      revision: 3,
      clientMutationId: "record-key",
      type: "expense",
      amountMinor: 100,
      date: "2026-09-23",
      description: "Lunch",
      category: "Food",
    }), { status: 409 });
    await assert.rejects(workspaces.deleteTransaction(workspaceId, recordId, 3), { status: 409 });
  });
});

test("aggregate summary and pagination use the same workspace and filter", async () => {
  const calls = [];
  const db = database({
    workspaces: [workspace(workspaceId, "member")],
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("select id, workspace_id")) {
        assert.match(sql, /created_by = \$2/);
        assert.match(sql, /date >= \$3/);
        assert.match(sql, /position\(\$5 in lower\(description\)\)/);
        assert.equal(values[1], "alice");
        assert.equal(values.at(-2), 25);
        assert.equal(values.at(-1), 25);
        return { rows: [] };
      }
      if (sql.startsWith("select count(*)")) return { rows: [{ count: 30, income_minor: "10000", expense_minor: "3500" }] };
      return { rows: [] };
    },
  });
  await actor("alice", async () => {
    const data = await service(db).listTransactions(workspaceId, {
      month: "2026-09",
      page: 2,
      search: "coffee.*",
    });
    assert.equal(data.summary.balanceMinor, 6500);
    assert.equal(data.total, 30);
    assert.equal(calls.length, 3);
  });
});

test("personal PHP workspaces migrate old Web records and report the shared Mobile dataset", async () => {
  const migrated = [];
  let marked = false;
  const oldWebRecord = {
    id: recordId,
    workspace_id: workspaceId,
    created_by: "alice",
    client_mutation_id: "web-record-1",
    type: "expense",
    amount_minor: "1250",
    description: "Coffee shop",
    category: "Food",
    merchant: "Cafe",
    date: "2026-09-12",
    revision: 1,
  };
  const db = database({
    workspaces: [workspace(workspaceId, "owner", "personal")],
    query: async (sql, values) => {
      if (sql.startsWith("select id, workspace_id")) {
        assert.match(sql, /shared_with_mobile = false/);
        assert.deepEqual(values, [workspaceId, "alice"]);
        return { rows: [oldWebRecord] };
      }
      if (sql.startsWith("update public.workspace_transactions")) {
        assert.deepEqual(values, [recordId, workspaceId, "alice"]);
        marked = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
  });
  const personal = personalTransactionService({
    importWorkspaceTransaction: async row => migrated.push(row),
    findAll: async () => [
      { id: recordId, userId: "alice", clientMutationId: "web-record-1", type: "expense", amount: 12.5, description: "Coffee shop", category: "Food", merchant: "Cafe", date: "2026-09-12", revision: 1 },
      { id: "507f1f77bcf86cd799439012", userId: "alice", type: "income", amount: 50, description: "Pay", category: "Income", date: "2026-09-11", revision: 2 },
      { id: "507f1f77bcf86cd799439013", userId: "alice", type: "expense", amount: 80, description: "Other month", category: "Food", date: "2026-08-12", revision: 1 },
    ],
  });
  await actor("alice", async () => {
    const data = await service(db, personal).listTransactions(workspaceId, { month: "2026-09", search: "coffee" });
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].id, recordId);
    assert.equal(migrated[0].amountMinor, 1250);
    assert.equal(marked, true);
    assert.equal(data.total, 1);
    assert.equal(data.summary.expenseMinor, 1250);
    assert.equal(data.items[0].workspaceId, workspaceId);
    assert.deepEqual(data.categories, [{ name: "Food", amountMinor: 1250, count: 1 }]);
  });
});

test("personal Web writes use the same PHP records as Mobile", async () => {
  let created;
  const db = database({
    workspaces: [workspace(workspaceId, "owner", "personal")],
    query: async () => ({ rows: [] }),
  });
  const personal = personalTransactionService({
    create: async row => {
      created = row;
      return { id: recordId, userId: "alice", ...row, revision: 1 };
    },
  });
  await actor("alice", async () => {
    const row = await service(db, personal).createTransaction(workspaceId, {
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
    assert.equal(row.id, recordId);
    assert.equal(row.amountMinor, 1234);
  });
});

test("invalid calendar dates and empty labels cannot be persisted", () => {
  assert.throws(() => validateRecord({ date: "2026-02-30", description: "Lunch", category: "Food" }), { status: 400 });
  assert.throws(() => validateRecord({ date: "2026-09-01", description: " ", category: "Food" }), { status: 400 });
  assert.doesNotThrow(() => validateRecord({ date: "2024-02-29", description: "Lunch", category: "Food" }));
  assert.equal(escapeSearch("$100 (cash)"), "\\$100 \\(cash\\)");
});

test("new personal workspaces reject currencies Mobile cannot represent", async () => {
  await actor("alice", async () => assert.rejects(
    service({}, personalTransactionService()).create({ name: "Personal", kind: "personal", currency: "USD", clientMutationId: "personal-usd" }),
    { status: 400 },
  ));
});

test("workspace currency defaults to PHP and supports TWD, CNY and KRW at creation", async () => {
  for (const currency of [undefined, "TWD", "CNY", "KRW"]) {
    let created;
    const db = database({
      workspaces: [workspace(workspaceId, "owner", "business", currency ?? "PHP")],
      transaction: async operation => operation({
        query: async (sql, values) => {
          if (sql.startsWith("insert into public.workspaces")) {
            assert.equal(values[4], currency ?? "PHP");
            created = { ...workspace(workspaceId, "owner", "business", currency ?? "PHP"), name: values[1] };
            return { rows: [] };
          }
          if (sql.startsWith("select * from public.workspaces")) return { rows: [created] };
          return { rows: [] };
        },
      }),
    });
    await actor("alice", () => service(db).create({ name: "Currency test", kind: "business", clientMutationId: "currency-test", currency }));
  }
});

test("currency validation rejects unknown codes and workspace currency is immutable", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { validate } = require("class-validator");
  const { CreateWorkspaceDto } = require("../dist/workspaces/workspaces.dto");
  for (const currency of ["TWD", "CNY", "KRW", "USD"])
    assert.equal((await validate(Object.assign(new CreateWorkspaceDto(), { name: "Test", kind: "business", clientMutationId: "test-currency", currency }))).length, 0);
  const errors = await validate(Object.assign(new CreateWorkspaceDto(), { name: "Test", kind: "business", clientMutationId: "test-currency", currency: "NTD" }));
  assert.ok(errors.some(error => error.property === "currency"));
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/002_constraints.sql"), "utf8");
  assert.match(migration, /new\.currency is distinct from old\.currency/);
  assert.match(migration, /before update on public\.workspaces/);
});

test("existing workspace memberships are identical for Web and Mobile and isolated per account", async () => {
  const rows = [
    workspace("507f1f77bcf86cd799439011", "owner", "personal"),
    workspace("507f1f77bcf86cd799439012", "owner", "business", "USD"),
    workspace("507f1f77bcf86cd799439013", "owner", "personal"),
    workspace("507f1f77bcf86cd799439014", "owner", "business"),
  ];
  rows[1].members.bob = { role: "finance", status: "active" };
  rows[2].members = { bob: { role: "owner", status: "active" }, alice: { role: "viewer", status: "suspended" } };
  rows[3].members = { carol: { role: "owner", status: "active" } };
  const db = database({ workspaces: rows });
  const workspaces = service(db);
  const [aliceWeb, bobMobile, aliceMobile] = await Promise.all([
    actor("alice", () => workspaces.list()),
    actor("bob", () => workspaces.list()),
    actor("alice", () => workspaces.list()),
  ]);
  assert.deepEqual(aliceWeb, aliceMobile);
  assert.deepEqual(aliceMobile.map(row => row.id), rows.slice(0, 2).map(row => row.id));
  assert.deepEqual(bobMobile.map(row => row.id), rows.slice(1, 3).map(row => row.id));
  assert.equal(aliceMobile[1].role, "owner");
  assert.equal(bobMobile[0].role, "finance");
  assert.deepEqual(await actor("new-account", () => workspaces.list()), []);
  rows[1].members.bob.status = "suspended";
  assert.deepEqual((await actor("bob", () => workspaces.list())).map(row => row.id), [rows[2].id]);
  rows[3].members.bob = { role: "viewer", status: "active" };
  assert.deepEqual((await actor("bob", () => workspaces.list())).map(row => row.id), [rows[2].id, rows[3].id]);
});