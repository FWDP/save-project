// Remove financial records across all accounts; preserve authentication and profiles.
// Defaults to a rollback rehearsal. Use --apply for the requested testing reset.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const root = path.resolve(__dirname, '../..');
const config = Object.assign({}, ...['.env', 'backend/.env'].map(file => path.join(root, file)).filter(fs.existsSync).map(file => parseEnv(fs.readFileSync(file, 'utf8'))), process.env);
const tables = ['finance_sync_snapshots', 'transactions', 'workspace_transactions', 'budgets', 'categories', 'savings_goals', 'stellar_signing_requests', 'stellar_contract_events', 'stellar_accounts'];
const quarantineCollections = ['transactions', 'categories', 'budgets', 'savingsgoals', 'savings_goals', 'savingsGoals', 'stellaraccounts', 'stellar_accounts', 'stellarsigningrequests', 'stellar_signing_requests', 'stellarcontractevents', 'stellar_contract_events', 'workspacetransactions', 'workspace_transactions'];
(async () => {
  const client = new Client({ connectionString: config.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query('begin');
    await client.query("set local lock_timeout = '10s'");
    await client.query(`lock table ${tables.map(table => `public.${table}`).join(', ')}, public.mongo_migration_quarantine in share row exclusive mode`);
    const identities = async () => (await client.query('select (select count(*)::int from auth.users) as accounts, (select count(*)::int from public.user_profiles) as profiles')).rows[0];
    const beforeAccounts = await identities();
    const deleted = {};
    for (const table of tables) deleted[table] = (await client.query(`delete from public.${table}`)).rowCount;
    deleted.quarantinedFinances = (await client.query('delete from public.mongo_migration_quarantine where source_collection = any($1::text[])', [quarantineCollections])).rowCount;
    for (const table of tables) {
      const result = await client.query(`select count(*)::int as count from public.${table}`);
      if (result.rows[0].count !== 0) throw new Error('Financial reset verification failed');
    }
    const afterAccounts = await identities();
    if (JSON.stringify(beforeAccounts) !== JSON.stringify(afterAccounts)) throw new Error('Account preservation check failed');
    const applied = process.argv.includes('--apply');
    await client.query(applied ? 'commit' : 'rollback');
    console.log(JSON.stringify({ mode: applied ? 'applied' : 'rehearsal rolled back', deleted, preserved: afterAccounts, verifiedFinancialTablesEmpty: true }));
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('Financial reset failed; transaction rolled back.', error.code || 'Check reset verification.');
    process.exitCode = 1;
  } finally { await client.end(); }
})();
