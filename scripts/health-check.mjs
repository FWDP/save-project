import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org';
const TESTNET_RPC_URL = 'https://soroban-testnet.stellar.org';
const includeServices = process.argv.includes('--services');

function parseEnv(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

async function checkedJson(name, url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  const body = await response.json();
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  console.log(`ok  ${name}`);
  return body;
}

function localServiceOrigin(value, fallback) {
  const url = new URL(value ?? fallback);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Service health checks only accept local HTTP endpoints');
  }
  return url.origin;
}

const envPath = existsSync(resolve('backend/.env')) ? resolve('backend/.env') : resolve('backend/.env.example');
const env = parseEnv(envPath);
if (env.STELLAR_NETWORK !== 'TESTNET' || env.STELLAR_NETWORK_PASSPHRASE !== TESTNET_PASSPHRASE) {
  throw new Error('Health checks are locked to the canonical Stellar Testnet configuration');
}
if (env.STELLAR_HORIZON_URL !== TESTNET_HORIZON_URL || env.STELLAR_RPC_URL !== TESTNET_RPC_URL) {
  throw new Error('Health checks require the canonical Stellar Testnet Horizon and RPC endpoints');
}

const rpcCall = async (method) => {
  const response = await checkedJson(`RPC ${method}`, TESTNET_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method }),
  });
  if (response.error) throw new Error(`RPC ${method}: ${response.error.message}`);
  return response.result;
};

await checkedJson('Horizon Testnet', TESTNET_HORIZON_URL);
const network = await rpcCall('getNetwork');
await rpcCall('getLatestLedger');
if ((network.passphrase ?? network.networkPassphrase) !== TESTNET_PASSPHRASE) {
  throw new Error('RPC returned an unexpected network passphrase');
}

const deployedWasm = execFileSync('stellar', [
  'contract', 'fetch',
  '--id', env.STELLAR_VAULT_CONTRACT_ID,
  '--rpc-url', TESTNET_RPC_URL,
  '--network-passphrase', TESTNET_PASSPHRASE,
]);
const deployedHash = createHash('sha256').update(deployedWasm).digest('hex');
if (deployedHash !== env.STELLAR_VAULT_WASM_HASH) {
  throw new Error(`Deployed Wasm hash mismatch: expected ${env.STELLAR_VAULT_WASM_HASH}, received ${deployedHash}`);
}
console.log(`ok  Vault contract reachable: ${env.STELLAR_VAULT_CONTRACT_ID}`);
console.log(`ok  Deployed Wasm hash: ${deployedHash}`);

if (includeServices) {
  const backendUrl = localServiceOrigin(process.env.SAVE_API_URL, 'http://localhost:3000');
  const adminUrl = localServiceOrigin(process.env.SAVE_ADMIN_URL, 'http://localhost:3001');
  await checkedJson('SAVE API health', `${backendUrl}/health`);
  await checkedJson('SAVE admin health', `${adminUrl}/api/health`);
}

console.log('ok  Stellar Testnet health verification passed');
