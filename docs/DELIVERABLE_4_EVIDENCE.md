# Deliverable 4 — Toolchain, CI, and Reviewer Verification

Scope: reproducible verification for the SAVE Stellar Testnet alpha across the Expo mobile app, NestJS API, Next.js admin app, and Soroban vault.

## Deployment evidence

| Item | Evidence |
|---|---|
| Network | Stellar Testnet — `Test SDF Network ; September 2015` |
| Vault contract | [`CDYPVK…7AG3`](https://stellar.expert/explorer/testnet/contract/CDYPVKFWSPHKGDHZ77M2T2TZPCS3LVXDFJDH5PERL5HTUNVFYSTB7AG3) |
| Native XLM SAC allowlist | [`CDLZFC…CYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |
| Wasm SHA-256 | `0977e310e0f296e8811774ee74800367053879f809cc6ebbb49dca0816b8587f` |
| Wasm upload | [`abc82c…046b`](https://stellar.expert/explorer/testnet/tx/abc82c9d19b4d187a8faae2e8651eeed0fbb26484444911886e8ff849153046b) |
| Contract deployment | [`85a94f…5587`](https://stellar.expert/explorer/testnet/tx/85a94fe0360cc955bcedfbcd496fb0c26e2a21799582a3f92e26d8e7f1715587) |

The immutable constructor allowlist is readable through `allowed_asset`. Goal creation fails with `VaultError::UnsupportedAsset` when the requested SAC differs.

## Automated verification

The GitHub Actions workflow at `.github/workflows/verify.yml` runs these independent jobs:

| Job | Commands and artifacts | Failure condition |
|---|---|---|
| Environment | `npm run env:validate -- --examples --skip-tools` | Unsafe/missing example configuration or wrong Testnet constants |
| Mobile | `npm run lint`, `npm run typecheck`, `npm run backend:lint` | Any lint error or TypeScript error |
| Backend | `npm --prefix backend test` | Build failure or Node test failure |
| Admin | `npm --prefix admin run lint`, `npm --prefix admin run build` | Lint, type, or production build failure |
| Contract | Rust format, test, Clippy, and release build | Formatting, warning, test, or Wasm build failure |
| Contract artifact | `save_savings_vault.wasm` | Artifact missing after build |
| Scheduled/manual health | `npm run health:testnet` | Horizon/RPC failure, contract unavailable, or Wasm mismatch |

CI run history becomes available at `https://github.com/FWDP/save-project/actions/workflows/verify.yml` after the workflow is pushed to GitHub. Local verification uses the same commands and is documented in `REVIEWER_RUNBOOK.md`.

## Verified local results

- Mobile lint: passed.
- Mobile TypeScript validation: passed.
- Backend lint/build: passed.
- Backend tests: five security, signed-XDR, network-binding, and asset-allowlist tests passed.
- Admin production build: passed.
- Soroban contract: eleven tests passed.
- Optimized Wasm build: passed with the hash above.
- Live Testnet health: Horizon, RPC, contract fetch, and deployed Wasm consistency passed.

## Contract test coverage

The eleven-test suite covers:

- authenticated creation and contribution;
- authorization failure;
- invalid amounts and lifecycle transitions;
- cancellation and atomic full-balance refund;
- completed-goal partial withdrawal by the owner;
- target-date validation and deadline completion;
- isolated owner indexing;
- instance TTL extension;
- unsupported-token rejection;
- empty first-time owner reads;
- contribution balance and token transfer accounting.

Duplicate prepared API requests are deduplicated by idempotency key. A key cannot be reused for another source or action. Signed-XDR substitution is rejected by comparing the signed transaction body hash with the prepared request, while Stellar account sequence rules reject replayed transaction envelopes.

## Health and trust-boundary evidence

- `scripts/validate-env.mjs` verifies supported tools, required configuration, the canonical Testnet passphrase, public contract identifiers, and the absence of Stellar secret seeds.
- `scripts/health-check.mjs` verifies Horizon, RPC, contract reachability, and exact deployed Wasm consistency; `--services` adds backend and admin connectivity.
- `GET /health` reports backend and deployed Stellar status.
- `GET /api/health` in the admin app confirms it can reach the backend health endpoint.
- The backend may prepare, simulate, submit signed XDR, and reconcile ledger state. It cannot sign user transactions, does not possess private keys, rejects empty signatures, rejects signed-body substitution, and binds transaction hashes to the Testnet passphrase.

## Withdrawal semantics

Only the stored goal owner may withdraw. Partial withdrawals are supported, but only after the goal is `Completed`. The owner may make multiple withdrawals up to the remaining balance. Active and cancelled goals cannot be withdrawn. Cancelling an active goal atomically sends its entire balance to the owner, sets the balance to zero, and changes the status to `Cancelled`; a cancelled goal cannot be cancelled or funded again.

## Reviewer procedure

Follow [`REVIEWER_RUNBOOK.md`](./REVIEWER_RUNBOOK.md) for the clean-checkout sequence, exact commands, expected outputs, live wallet flow, and negative-path verification.
