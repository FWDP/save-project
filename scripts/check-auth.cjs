// Read-only diagnostics: never log credentials, tokens, or provider responses.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv: parse } = require('node:util');
const root = path.resolve(__dirname, '..');
function env(files) {
  return Object.assign({}, ...files.map(file => {
    const full = path.join(root, file);
    return fs.existsSync(full) ? parse(fs.readFileSync(full, 'utf8')) : {};
  }), process.env);
}
async function main() {
  const web = env(['web/.env', 'web/.env.local']);
  const backend = env(['backend/.env']);
  let failed = false;
  const check = (ok, text) => { console.log(`${ok ? 'OK' : 'FIX'}: ${text}`); if (!ok) failed = true; };
  for (const [label, config] of [['Web', web], ['API', backend]]) {
    check(Boolean(config.SUPABASE_URL), `${label}: SUPABASE_URL is configured`);
    check(Boolean(config.SUPABASE_PUBLISHABLE_KEY), `${label}: SUPABASE_PUBLISHABLE_KEY is configured`);
  }
  check(Boolean(web.SUPABASE_URL) && web.SUPABASE_URL.replace(/\/$/, '') === backend.SUPABASE_URL?.replace(/\/$/, ''), 'Web and API use the same Supabase project');
  const site = web.SAVE_WEB_URL || 'http://localhost:3002';
  try {
    const url = new URL(site);
    check(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/', 'SAVE_WEB_URL is an HTTP(S) origin');
    if (!url.username && !url.password) console.log(`Supabase redirect allowlist: ${url.origin}/auth/callback and ${url.origin}/auth/callback?next=reset-password`);
  } catch { check(false, 'SAVE_WEB_URL must be a valid origin'); }
  if (web.SUPABASE_URL && web.SUPABASE_PUBLISHABLE_KEY) {
    try {
      const url = new URL(web.SUPABASE_URL);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
      const response = await fetch(`${url.origin}/auth/v1/settings`, {headers: {apikey: web.SUPABASE_PUBLISHABLE_KEY}, signal: AbortSignal.timeout(8000)});
      check(response.ok, 'Supabase accepts the project URL and public key');
      if (response.ok) {
        const settings = await response.json();
        check(settings.external?.google === true, 'Google provider is enabled');
        check(settings.external?.email === true, 'Email provider is enabled');
        console.log(`Google Cloud authorized redirect URI: ${url.origin}/auth/v1/callback`);
      }
    } catch { check(false, 'Supabase settings are reachable; check URL and network'); }
  }
  console.log('This check does not log in, send email, or change provider settings. A real browser sign-in is still required.');
  process.exitCode = failed ? 1 : 0;
}
main().catch(() => { console.error('Auth diagnostics failed. Check local configuration.'); process.exitCode = 1; });
