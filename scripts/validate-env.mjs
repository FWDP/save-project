import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const TESTNET_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const args = new Set(process.argv.slice(2));
const examplesOnly = args.has('--examples');
const skipTools = args.has('--skip-tools');
const failures = [];
const warnings = [];

function parseEnv(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

function selectedPath(localPath, examplePath) {
  if (!examplesOnly && existsSync(localPath)) return localPath;
  return examplePath;
}

function requireValue(values, key, source) {
  if (!values[key]) failures.push(`${source}: ${key} is required`);
}

function checkUrl(values, key, source, { allowBlank = false } = {}) {
  const value = values[key];
  if (!value && allowBlank) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  } catch {
    failures.push(`${source}: ${key} must be an HTTP(S) URL`);
  }
}

function commandVersion(command, commandArgs, pattern, label) {
  try {
    const value = execFileSync(command, commandArgs, { encoding: 'utf8' }).trim();
    if (!pattern.test(value)) failures.push(`${label}: unsupported version (${value})`);
    else console.log(`ok  ${label}: ${value.split('\n')[0]}`);
  } catch (error) {
    if (error?.code === 'EPERM') warnings.push(`${label}: version probe blocked by the current sandbox`);
    else failures.push(`${label}: command not found`);
  }
}

const rootPath = selectedPath(resolve('.env'), resolve('.env.example'));
const backendPath = selectedPath(resolve('backend/.env'), resolve('backend/.env.example'));
const adminPath = selectedPath(resolve('admin/.env.local'), resolve('admin/.env.example'));

for (const path of [rootPath, backendPath, adminPath]) {
  if (!existsSync(path)) failures.push(`${path}: file not found`);
}

if (!failures.length) {
  const mobile = parseEnv(rootPath);
  const backend = parseEnv(backendPath);
  const admin = parseEnv(adminPath);

  checkUrl(mobile, 'EXPO_PUBLIC_API_URL', rootPath, { allowBlank: examplesOnly });
  if (!examplesOnly) requireValue(mobile, 'EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID', rootPath);
  checkUrl(admin, 'SAVE_API_URL', adminPath);

  requireValue(backend, 'MONGODB_URI', backendPath);
  requireValue(backend, 'REDIS_URI', backendPath);
  checkUrl(backend, 'STELLAR_HORIZON_URL', backendPath);
  checkUrl(backend, 'STELLAR_RPC_URL', backendPath);
  checkUrl(backend, 'STELLAR_CALLBACK_BASE_URL', backendPath);

  if (backend.STELLAR_NETWORK !== 'TESTNET') failures.push(`${backendPath}: STELLAR_NETWORK must be TESTNET`);
  if (backend.STELLAR_NETWORK_PASSPHRASE !== TESTNET_PASSPHRASE) {
    failures.push(`${backendPath}: STELLAR_NETWORK_PASSPHRASE must be the canonical Testnet passphrase`);
  }
  if (backend.STELLAR_XLM_SAC_ID !== TESTNET_XLM_SAC) {
    failures.push(`${backendPath}: STELLAR_XLM_SAC_ID must be the Native XLM Testnet SAC`);
  }
  if (!/^C[A-Z2-7]{55}$/.test(backend.STELLAR_VAULT_CONTRACT_ID ?? '')) {
    failures.push(`${backendPath}: STELLAR_VAULT_CONTRACT_ID must be a contract strkey`);
  }
  if (!/^[a-f0-9]{64}$/i.test(backend.STELLAR_VAULT_WASM_HASH ?? '')) {
    failures.push(`${backendPath}: STELLAR_VAULT_WASM_HASH must be a 64-character SHA-256 hash`);
  }
  if ([rootPath, backendPath, adminPath].some((path) => /(^|[^A-Z2-7])S[A-Z2-7]{55}([^A-Z2-7]|$)/m.test(readFileSync(path, 'utf8')))) {
    failures.push('Environment files must never contain a Stellar secret seed');
  }
  if ((backend.JWT_SECRET ?? '').includes('replace_with') && !examplesOnly) {
    warnings.push(`${backendPath}: replace JWT_SECRET before any shared or production-like deployment`);
  }
}

if (!skipTools) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) failures.push(`Node.js 22.13+ is required (found ${process.version})`);
  else console.log(`ok  Node.js: ${process.version}`);
  commandVersion('npm', ['--version'], /^(1[0-9]|[2-9]\d)\./, 'npm 10+');
  commandVersion('rustc', ['--version'], /^rustc 1\.(9[0-9]|[1-9]\d{2})\./, 'Rust stable 1.90+');
  commandVersion('cargo', ['--version'], /^cargo 1\.(9[0-9]|[1-9]\d{2})\./, 'Cargo 1.90+');
  commandVersion('stellar', ['--version'], /^stellar 27\./, 'Stellar CLI 27.x');
}

for (const warning of warnings) console.warn(`warn ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`fail ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`ok  Environment validation passed (${examplesOnly ? 'examples' : 'local configuration'})`);
}
