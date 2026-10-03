const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

function loadEnvironment() {
  const values = { ...process.env };
  for (const file of [path.resolve('backend/.env'), path.resolve('.env')]) {
    try {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const separator = line.indexOf('=');
        if (separator < 1 || line.trimStart().startsWith('#')) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'")))
          value = value.slice(1, -1);
        if (!values[key]) values[key] = value;
      }
    } catch {}
  }
  return values;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const objectId = value => String(value?._id ?? value ?? '');
const json = value => JSON.stringify(value ?? null);
const timestamp = value => value instanceof Date ? value : value ? new Date(value) : new Date();
const records = new Map();
const quarantined = [];
const totals = {};

function keep(table, sql, values) {
  if (!records.has(table)) records.set(table, []);
  records.get(table).push({ sql, values });
}

function quarantine(collection, row, ownerReference, reason) {
  quarantined.push({
    sql: `insert into public.mongo_migration_quarantine (source_collection, source_id, owner_reference, reason, document)
          values ($1, $2, $3, $4, $5::jsonb)
          on conflict (source_collection, source_id) do nothing`,
    values: [collection, objectId(row), ownerReference == null ? null : String(ownerReference), reason, json(row)],
  });
}

async function readSource(mongo) {
  const db = mongo.db();
  const sourceUsers = await db.collection('users').find({}).toArray();
  const authResult = await pgPool.query(
    'select id::text as id, lower(email) as email from auth.users where email is not null',
  );
  const authByEmail = new Map(authResult.rows.map(row => [row.email, row.id]));
  const authIds = new Set(authResult.rows.map(row => row.id));
  const legacyOwnerMap = new Map();
  for (const user of sourceUsers) {
    const authId = authByEmail.get(String(user.email ?? '').trim().toLowerCase());
    if (authId) legacyOwnerMap.set(String(user._id), authId);
    const id = String(user._id);
    keep('user_profiles',
      `insert into public.user_profiles (legacy_id, auth_user_id, name, email, role, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict (legacy_id) do nothing`,
      [id, authId ?? null, user.name ?? 'SAVE User', String(user.email ?? '').trim().toLowerCase(), user.role ?? 'user', timestamp(user.createdAt), timestamp(user.updatedAt ?? user.createdAt)],
    );
  }
  const owner = value => {
    const id = String(value ?? '');
    if (authIds.has(id)) return id;
    return legacyOwnerMap.get(id) ?? null;
  };
  const load = async name => db.collection(name).find({}).toArray();

  for (const row of await load('transactions')) {
    const userId = owner(row.userId);
    if (!userId) {
      quarantine('transactions', row, row.userId, row.userId ? 'owner_not_mapped_to_auth_user' : 'owner_missing');
      continue;
    }
    keep('transactions',
      `insert into public.transactions (id, user_id, client_mutation_id, type, amount, category, description, date, revision, status, merchant, tags, recurring, receipt_uri, custom_fields, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17) on conflict (id) do nothing`,
      [objectId(row), userId, row.clientMutationId ?? null, row.type, row.amount, row.category, row.description, row.date, row.revision ?? 1, row.status ?? 'pending', row.merchant ?? null, row.tags ?? [], row.recurring ?? false, row.receiptUri ?? null, row.customFields == null ? null : json(row.customFields), timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const row of await load('categories')) {
    const userId = owner(row.userId);
    if (!userId) {
      quarantine('categories', row, row.userId, row.userId ? 'owner_not_mapped_to_auth_user' : 'owner_missing');
      continue;
    }
    keep('categories',
      `insert into public.categories (id, user_id, name, type, color, replaces_built_in_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
      [objectId(row), userId, row.name, row.type, row.color ?? '#6366F1', row.replacesBuiltInId ?? null, timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const row of await load('budgets')) {
    const userId = owner(row.userId);
    if (!userId) {
      quarantine('budgets', row, row.userId, row.userId ? 'owner_not_mapped_to_auth_user' : 'owner_missing');
      continue;
    }
    keep('budgets',
      `insert into public.budgets (id, user_id, category, budget_limit, spent, period, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
      [objectId(row), userId, row.category, row.limit, row.spent ?? 0, row.period ?? 'monthly', timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const row of await load('savingsgoals')) {
    const userId = owner(row.userId);
    if (!userId) {
      quarantine('savingsgoals', row, row.userId, row.userId ? 'owner_not_mapped_to_auth_user' : 'owner_missing');
      continue;
    }
    keep('savings_goals',
      `insert into public.savings_goals (id, user_id, name, target_amount, funded_amount, target_date, asset, status, network, owner_address, contract_id, vault_goal_id, transaction_hash, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) on conflict (id) do nothing`,
      [objectId(row), userId, row.name, row.targetAmount, row.fundedAmount ?? 0, row.targetDate ?? null, row.asset ?? 'XLM', row.status ?? 'draft', row.network ?? 'testnet', row.ownerAddress ?? null, row.contractId ?? null, row.vaultGoalId ?? null, row.transactionHash ?? null, timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  const workspaceIds = new Set();
  for (const row of await load('workspaces')) {
    const ownerId = owner(row.ownerId);
    const members = (row.members ?? []).map(member => ({ ...member, userId: owner(member.userId) }));
    if (!ownerId || members.length === 0 || members.some(member => !member.userId)) {
      quarantine('workspaces', row, row.ownerId, 'workspace_owner_or_member_not_mapped_to_auth_user');
      continue;
    }
    const id = objectId(row);
    workspaceIds.add(id);
    keep('workspaces',
      `insert into public.workspaces (id, name, kind, owner_id, client_mutation_id, currency, timezone, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (id) do nothing`,
      [id, row.name, row.kind, ownerId, row.clientMutationId, row.currency ?? 'PHP', row.timezone ?? 'Asia/Manila', timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
    for (const member of members) {
      keep('workspace_members',
        `insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, $3, $4) on conflict (workspace_id, user_id) do nothing`,
        [id, member.userId, member.role, member.status],
      );
    }
  }

  for (const row of await load('workspace_transactions')) {
    const createdBy = owner(row.createdBy);
    const workspaceId = String(row.workspaceId ?? '');
    if (!createdBy || !workspaceIds.has(workspaceId)) {
      quarantine('workspace_transactions', row, row.createdBy, !createdBy ? 'creator_not_mapped_to_auth_user' : 'workspace_not_migrated');
      continue;
    }
    keep('workspace_transactions',
      `insert into public.workspace_transactions (id, workspace_id, created_by, client_mutation_id, type, amount_minor, description, category, merchant, date, revision, shared_with_mobile, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) on conflict (id) do nothing`,
      [objectId(row), workspaceId, createdBy, row.clientMutationId, row.type, row.amountMinor, row.description, row.category, row.merchant ?? '', row.date, row.revision ?? 1, row.sharedWithMobile ?? false, timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const row of await load('stellaraccounts')) {
    keep('stellar_accounts',
      `insert into public.stellar_accounts (address, network, signing_mode, last_synced_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6) on conflict (address) do nothing`,
      [row.address, row.network ?? 'testnet', row.signingMode ?? 'watch-only', row.lastSyncedAt ?? null, timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const row of await load('stellarsigningrequests')) {
    keep('stellar_signing_requests',
      `insert into public.stellar_signing_requests (idempotency_key, kind, action, source, unsigned_xdr, status, hash, fee, savings_goal_id, goal_id, error, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) on conflict (idempotency_key) do nothing`,
      [row.idempotencyKey, row.kind, row.action, row.source, row.unsignedXdr, row.status, row.hash ?? null, row.fee ?? null, row.savingsGoalId ?? null, row.goalId ?? null, row.error ?? null, timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const row of await load('stellarcontractevents')) {
    keep('stellar_contract_events',
      `insert into public.stellar_contract_events (event_id, contract_id, ledger, transaction_hash, ledger_closed_at, topics, value, successful, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10) on conflict (event_id) do nothing`,
      [row.eventId, row.contractId, row.ledger, row.transactionHash, row.ledgerClosedAt ?? null, json(row.topics ?? []), json(row.value), row.successful ?? true, timestamp(row.createdAt), timestamp(row.updatedAt ?? row.createdAt)],
    );
  }

  for (const [table, rows] of records) totals[table] = rows.length;
  totals.mongo_migration_quarantine = quarantined.length;
  totals.mongo_users_matched_to_auth = legacyOwnerMap.size;
  return { db, sourceUsers, authIds, workspaceIds };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const frozen = process.argv.includes('--confirm-source-frozen');
  if (apply && !frozen) throw new Error('--apply requires --confirm-source-frozen after writes to Mongo-backed apps are paused.');
  const env = loadEnvironment();
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required to read the Mongo source.');
  const connectionString = env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL is required for the Supabase target.');
  const mongo = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  pgPool = new Pool({ connectionString, max: 2, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await mongo.connect();
    const targetTables = ['user_profiles', 'transactions', 'categories', 'budgets', 'savings_goals', 'workspaces', 'workspace_members', 'workspace_transactions', 'stellar_accounts', 'stellar_signing_requests', 'stellar_contract_events', 'mongo_migration_quarantine'];
    const schema = await pgPool.query(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`,
      [targetTables],
    );
    const present = new Set(schema.rows.map(row => row.table_name));
    const missing = targetTables.filter(table => !present.has(table));
    if (missing.length) throw new Error(`Apply backend/supabase/001_initial_schema.sql first; missing ${missing.length} target tables.`);
    const inventory = await readSource(mongo);
    const targetCounts = await pgPool.query(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`,
      [targetTables],
    );
    if (apply) {
      const client = await pgPool.connect();
      try {
        await client.query('begin');
        for (const table of targetCounts.rows.map(row => row.table_name)) {
          const count = await client.query(`select count(*)::int as count from public.${table}`);
          if (count.rows[0].count > 0) throw new Error(`Target table ${table} is not empty; refusing import.`);
        }
        for (const batch of records.values()) for (const item of batch) await client.query(item.sql, item.values);
        for (const item of quarantined) await client.query(item.sql, item.values);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', destinationSchemaReady: true, authUsers: inventory.authIds.size, mongoProfiles: inventory.sourceUsers.length, plannedRows: totals, quarantineByReason: quarantined.reduce((result, row) => { const reason = row.values[3]; result[reason] = (result[reason] ?? 0) + 1; return result; }, {}), targetWasRequiredEmpty: true }));
  } finally {
    await mongo.close();
    await pgPool.end();
  }
}

let pgPool;
main().catch(error => {
  console.error(`Mongo to Supabase migration stopped: ${error.message}`);
  process.exitCode = 1;
});