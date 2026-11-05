// Creates optional-sync storage without reading or uploading device finances.
// Defaults to a rollback rehearsal. Pass --apply to install the schema.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const root = path.resolve(__dirname, '../..');
const config = Object.assign({}, ...['.env', 'backend/.env'].map(file => path.join(root, file)).filter(fs.existsSync).map(file => parseEnv(fs.readFileSync(file, 'utf8'))), process.env);
const sql = fs.readFileSync(path.join(__dirname, '../supabase/004_optional_finance_sync.sql'), 'utf8').replace(/^begin;$/m, '').replace(/^commit;$/m, '');
(async () => {
  const client = new Client({ connectionString: config.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect(); await client.query('begin');
    await client.query("set local lock_timeout='10s'");
    await client.query(sql);
    const row = (await client.query("select relrowsecurity from pg_class where oid = 'public.finance_sync_snapshots'::regclass")).rows[0];
    if (!row?.relrowsecurity) throw new Error('RLS check failed');
    const apply = process.argv.includes('--apply');
    await client.query(apply ? 'commit' : 'rollback');
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'rehearsal rolled back', schemaReady: true, rowLevelSecurity: true, financialRecordsUploaded: 0 }));
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('Optional sync migration failed; transaction rolled back.', error.code || 'Check database availability.');
    process.exitCode = 1;
  } finally { await client.end(); }
})();
