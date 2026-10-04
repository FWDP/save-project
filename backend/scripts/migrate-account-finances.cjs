// Defaults to a rollback-only rehearsal. Pass --apply during the service cutover.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const root = path.resolve(__dirname, '../..');
const config = Object.assign({}, ...[path.join(root,'.env'), path.join(root,'backend/.env')].filter(fs.existsSync).map(file => parseEnv(fs.readFileSync(file,'utf8'))), process.env);
const sql = fs.readFileSync(path.join(__dirname,'../supabase/003_account_finances.sql'),'utf8').replace(/^begin;$/m,'').replace(/^commit;$/m,'');
(async () => {
 const client = new Client({connectionString:config.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:8000});
 try {
  await client.connect(); await client.query('begin');
  await client.query("set local lock_timeout='10s'");
  const before = (await client.query('select count(*)::int count from public.transactions')).rows[0].count;
  await client.query(sql);
  const after = (await client.query('select count(*)::int count from public.transactions')).rows[0].count;
  await client.query(sql); // Prove a rerun cannot duplicate or resurrect archived records.
  const repeated = (await client.query('select count(*)::int count from public.transactions')).rows[0].count;
  if (repeated !== after) throw new Error('Migration is not idempotent');
  const apply = process.argv.includes('--apply');
  await client.query(apply ? 'commit' : 'rollback');
  console.log(JSON.stringify({mode:apply?'applied':'dry-run rolled back',before,after,imported:after-before,idempotent:true}));
 } catch (error) {
  await client.query('rollback').catch(()=>{});
  // Never echo a database connection string or raw record values.
  console.error('Account migration failed; no changes committed.', error.code || 'Check migration preconditions.');
  process.exitCode=1;
 } finally { await client.end(); }
})();
