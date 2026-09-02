# Independent Reviewer Runbook

This runbook verifies the SAVE Stellar Testnet alpha from a clean checkout. Every command is intended to be run from the repository root unless a step says otherwise.

## Supported toolchain

| Tool | Supported version |
|---|---|
| Node.js | `22.13.1` or a newer compatible 22+ release |
| npm | `10.x` or newer |
| Rust and Cargo | stable `1.90+` |
| Stellar CLI | `27.x` |
| Docker | Current Docker Engine with Compose v2 |
| Mobile build | Expo SDK 57 / React Native 0.86 native development build |

Run `npm run env:validate` to check the installed command-line tools and local configuration before building.

## 1. Clone and install

```bash
git clone https://github.com/FWDP/save-project.git
cd save-project
npm ci
npm --prefix backend ci
npm --prefix admin ci
```

## 2. Configure without sharing secrets

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp admin/.env.example admin/.env.local
```

Set the public mobile API URL and a public WalletConnect project ID in `.env`. For local review, replace the backend's placeholder `JWT_SECRET` with a random development-only value. Do not place a Stellar secret seed, wallet recovery phrase, production credential, or deployer identity in any repository environment file.

The contract ID, Native XLM SAC ID, network passphrase, RPC URL, Horizon URL, and Wasm hash are public Testnet verification values.

```bash
npm run env:validate
```

Expected result: every required value and tool prints `ok`, followed by `Environment validation passed`.

## 3. Run the automated gate

```bash
npm run verify
```

This command fails immediately if any of these checks fail:

- environment and toolchain validation;
- mobile lint and TypeScript validation;
- backend lint, build, and Node tests;
- admin lint and production build;
- Soroban format, tests, and optimized Wasm build.

The contract build must produce:

```text
contract/target/wasm32v1-none/release/save_savings_vault.wasm
SHA-256: 0977e310e0f296e8811774ee74800367053879f809cc6ebbb49dca0816b8587f
```

## 4. Verify the deployed Testnet contract

```bash
npm run health:testnet
```

Expected result: Horizon, RPC, contract reachability, and deployed Wasm hash all print `ok`. A hash mismatch is a failure, even if the contract address exists.

## 5. Start the local services

```bash
docker compose up -d
```

Start each application in a separate terminal:

```bash
npm --prefix backend run start:dev
npm --prefix admin run dev -- --port 3001
npm start
```

With the API and admin running, verify service-to-service connectivity:

```bash
npm run health:testnet -- --services
```

You may also inspect the JSON directly:

```bash
curl http://localhost:3000/health
curl http://localhost:3001/api/health
```

The backend response must report the canonical Testnet passphrase, recent RPC and Horizon ledgers, contract ID, deployed Wasm hash, and the Native XLM SAC as the contract allowlist.

## 6. Verify an externally signed vault action

1. Fund a dedicated Testnet-only Freighter Mobile account.
2. Open **More → Stellar Testnet** in the native SAVE development build.
3. Connect the wallet; SAVE stores only its public address.
4. Create or select a tracked savings goal and prepare a vault goal.
5. Review and approve the unsigned transaction in Freighter Mobile.
6. Wait until SAVE reconciles the request to `success`.
7. Copy the transaction hash and open its Stellar Expert Testnet link.
8. Confirm the contract event and final vault state through the app or `GET /stellar/vault/events`.

The API may prepare, simulate, submit, and reconcile a transaction. It cannot sign for the user and never receives a wallet secret.

## 7. Run a negative path

The fastest deterministic negative test is already automated:

```bash
npm run contract:test
npm --prefix backend test
```

Confirm that the output includes contract rejection coverage for an unsupported SAC and backend rejection of any `assetContractId` other than the configured Native XLM SAC. The contract must also reject a zero contribution, a premature withdrawal, a duplicate terminal transition, and an action without required authorization. No rejected operation may change vault state.

For a wallet-visible retry path, prepare a transaction and reject it in Freighter. Allow the request to expire, confirm SAVE reports failure rather than ledger success, then prepare a fresh request with a new idempotency key.

## 8. Evidence checklist

- Workflow: `.github/workflows/verify.yml`
- Wasm artifact and hash from `npm run contract:build`
- Eleven passing contract tests
- Five passing backend security/asset tests
- Successful admin production build
- Successful `npm run health:testnet`
- Contract ID and deployment/upload transaction links in `docs/DELIVERABLE_4_EVIDENCE.md`
- Wallet-approved transaction hash, event, reconciled API state, and UI screenshot for the reviewer-run action
- Negative-path command output and proof that ledger state did not change

Screenshots supplement this evidence; they do not replace ledger references, test output, CI logs, or build artifacts.
