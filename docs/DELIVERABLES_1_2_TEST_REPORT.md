# Deliverables 1–2 Test Report

Source scope: [S.A.V.E. Instawards Statement of Work](https://docs.google.com/document/d/1MNAtfmaTvSXxTdJkjGg4FwTJSKF_efkiQA666VXEjTM/edit)

Network: Stellar Testnet  
Evidence deployment: `CAJOBHJQORFRFFWN4X5LKLQIURQJNQFABQG6L452SWCFPAPDIWLRILYG`  
Native XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`  
Verified Wasm hash: `774d426c6165e362bc14930abd04152fbaf3bd9e13a1d8522d6942c99e1bf1a6`

Current app deployment: `CDYPVKFWSPHKGDHZ77M2T2TZPCS3LVXDFJDH5PERL5HTUNVFYSTB7AG3`

Current Wasm hash: `0977e310e0f296e8811774ee74800367053879f809cc6ebbb49dca0816b8587f`.
It preserves the reviewed lifecycle, fixes empty first-owner reads, and immutably allowlists the
Native XLM SAC; the regression suite now contains eleven contract tests. The transactions below
remain historical evidence from the earlier compatible Testnet deployment.

## Deliverable 1 — Stellar Testnet Savings Funding Flow

| Acceptance item | Implementation and evidence |
|---|---|
| Controlled Testnet account/wallet | Watch-only public account in SAVE; transaction approval remains in a SEP-7 external wallet. No user secret reaches the app or API. |
| Designated test asset | Native Testnet XLM through its Stellar Asset Contract. Mobile amounts are entered as XLM and converted exactly to seven-decimal atomic units. |
| Real goal contribution | `contribute` transfers XLM SAC tokens from the authenticated contributor into the deployed vault. No mocked balance update is used. |
| Transaction status | The API stores the deterministic transaction hash at preparation, accepts a SEP-7 signed-XDR callback, verifies the signed body matches the prepared XDR, submits it, and reconciles `prepared`, `pending`, `success`, or `failed`. |
| Failure and retry | Invalid zero contributions fail during simulation with contract error `#2` (`InvalidAmount`) and do not change state. Expired wallet approvals surface a fresh-retry action in the app. |
| Explorer references | Transaction cards and goal event cards link directly to Stellar Expert Testnet proof. |

### Controlled contribution evidence

Sample goal `1` targets `0.3 XLM` (`3,000,000` atomic units).

1. Goal creation: [2c1d2b…9576](https://stellar.expert/explorer/testnet/tx/2c1d2b8210a9a00dd7b95b0999f01945973a28702f07a7156f89c68afa759576)
2. Contribution `0.1 XLM`: [3b9fdb…cfeb](https://stellar.expert/explorer/testnet/tx/3b9fdb087e71fb0e33e228c0f5f853af4e417d10142176ef920486d00cadcfeb)
3. Contribution `0.2 XLM`: [ddc102…bc9f](https://stellar.expert/explorer/testnet/tx/ddc102e0abfc62df0ddcdfa67260fd1de5b2823c143cad9ab8ffbd1f2199bc9f)
4. Controlled failure: a zero-amount contribution was rejected during simulation with `VaultError::InvalidAmount`; no transaction was submitted and the balance remained `0.3 XLM`.
5. Valid retry `0.01 XLM`: [b524b0…b9e0](https://stellar.expert/explorer/testnet/tx/b524b0cb1a40ba55c13f0ba8e635fa1c5c6ad975563df647c585a24f3418b9e0)
6. App-equivalent prepare/sign/callback/status flow, withdrawing `0.01 XLM`: [4ec369…bfcc](https://stellar.expert/explorer/testnet/tx/4ec369a69f32eb022ec0fe7a78e60d2d0cc6b2dd0abdf84a0a42df988830bfcc)

The last transaction was prepared by `POST /stellar/vault/prepare`, signed externally, returned as form-encoded XDR to the SEP-7 callback, submitted by the API, and reconciled to `success` through `GET /stellar/signing-requests/:idempotencyKey`.

## Deliverable 2 — Soroban Smart Savings Goal Vault

| Acceptance item | Implementation and evidence |
|---|---|
| Goal creation and metadata | Owner, SAC asset, target amount, optional Unix target date, balance, status, and numeric ID. |
| Owner/contributor authorization | `require_auth` protects goal creation, contributions, withdrawal, and cancellation. |
| Controlled release | Completion requires target or deadline; withdrawal requires completed status and owner authorization; cancellation atomically refunds the full active balance. |
| Invalid/duplicate transitions | Invalid amounts, premature completion/withdrawal, contribution after cancellation, duplicate completion, and duplicate cancellation are rejected. |
| Events | Typed `GoalCreated`, `Contribution`, `GoalCompleted`, `Withdrawal`, and `GoalCancelled` events are indexed by the API and linked to explorer proof. |
| Privacy boundary | Only minimum goal and token state is on-chain. Receipts, merchants, income, TIN, budgets, and PII remain off-chain. |
| Tests and deployment | Eleven Rust contract tests pass; the deployed Testnet Wasm hash matches the local release build. |

Sample goal completion: [f99595…df29](https://stellar.expert/explorer/testnet/tx/f99595d542fb4cb98ee67c00a560494687073a938d696f697aaabea23e58df29). The goal completed with `3,100,000` atomic units before the callback-path withdrawal test.

## Repeatable verification

```bash
npm run contract:test
npm run contract:build
cd backend && npm test
cd .. && npx tsc --noEmit
```

Runtime checks:

```bash
curl http://localhost:3000/stellar/network
curl http://localhost:3000/.well-known/stellar.toml
curl http://localhost:3000/stellar/vault/goals/GCH4EU75Q77NF2BEB4W2QFMM5MCTJ5DIJGZVEPRRT6OWEXREOBEOQQMF
```

## Security and deployment notes

- This scope is Testnet-only; it does not enable Mainnet, real-value custody, fiat ramps, yield, KYC/AML, or private records on-chain.
- `STELLAR_INTEGRITY_SIGNER_SECRET_FILE` signs SEP-7 request provenance only. It never signs user transactions.
- Request provenance signing remains disabled until `STELLAR_ORIGIN_DOMAIN` is set to a public HTTPS domain serving `/.well-known/stellar.toml`. The local API still exposes the configured public signing key for verification.
- The local callback base URL must be reachable from the test wallet. Production callback URLs require HTTPS.
