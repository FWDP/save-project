# Stellar Architecture Decisions

## MVP decisions

- Network: Stellar Testnet only. Every signature is bound to `Test SDF Network ; September 2015`.
- Wallet model: watch-only account plus external-wallet approval through SEP-7. SAVE does not generate, import, transmit, log, or store secret seeds.
- Asset allowlist: native XLM through its Testnet Stellar Asset Contract. Both the backend and the vault constructor enforce the same exact SAC ID; other assets are rejected before simulation and by the contract.
- Data sources: Horizon for classic accounts/payments; Stellar RPC for Soroban simulation, submission, transaction status, contract reads, and events.
- Amount representation: classic payment inputs are validated decimal strings with at most seven fractional digits; Soroban values are atomic-unit decimal strings converted to `bigint` server-side.
- Private data: receipt content, merchant/category labels, user profile data, and goal names remain off-chain. The vault contains only owner, asset, target amount/date, balance, status, and ID.
- Submission: backend prepares and simulates XDR; the external wallet signs. Signed XDR may then be submitted to the backend, which reconciles by transaction hash.
- Fees: simulated Soroban fees above `STELLAR_MAX_SOROBAN_FEE` are rejected before signing.
- SEP-7 callback: each prepared request may include a unique callback URL. The backend accepts form-encoded signed XDR only when its transaction body hash exactly matches the prepared request, then submits and reconciles it.
- Request provenance: a dedicated integrity key may sign SEP-7 URIs only when a public `STELLAR_ORIGIN_DOMAIN` is configured and publishes the matching `URI_REQUEST_SIGNING_KEY` from `/.well-known/stellar.toml`. This key never signs user transactions.

## Trust boundaries

```text
Mobile app ── public address / unsigned intent ──> SAVE API
     │                                                │
     │ SEP-7 unsigned XDR                             ├── Horizon (classic read/submit)
     ▼                                                └── Stellar RPC (simulate/events/status)
External wallet ── explicit user approval/signature ──> Stellar Testnet
```

The API treats addresses, callbacks, XDR, RPC data, and wallet responses as untrusted. Validation pipes reject unknown DTO fields, signed XDR is decoded against the Testnet passphrase, and an empty signature set is rejected. The API can prepare, simulate, submit, and reconcile transactions, but it cannot sign for a user. Signed transaction body hashes must match the stored prepared request; Stellar sequence rules reject replayed envelopes.

## Persistence and reconciliation

- `StellarAccount`: linked public address and last sync time.
- `StellarSigningRequest`: idempotency key, unsigned XDR, action, status, and transaction hash.
- `StellarContractEvent`: unique RPC event ID, contract, ledger, transaction hash, topics, and value.
- Event polling uses the RPC cursor and idempotent MongoDB upserts. It is disabled until a valid vault contract ID is configured.

## Deliberate non-goals for this release

Mainnet, local key custody, sponsor/relayer keys, fee bumps, reserve sponsorship, stablecoin trustlines, anchors/KYC, path payments, DeFi, rewards, smart-wallet recovery, and shared vaults are not enabled. They remain separate, threat-modeled phases; enabling them requires infrastructure, wallet compatibility, compliance decisions, and credentials not present in this repository.

## Failure behavior

- Offline mobile data is never represented as ledger-final.
- RPC/Horizon failure returns an unavailable status instead of inventing balances.
- Duplicate prepare requests return the prior signing request by idempotency key.
- Prepared transaction hashes are deterministic before signing, allowing reconciliation even when a wallet submits directly instead of using the callback.
- Expired approvals become explicit failed requests with a fresh-retry action; an idempotency key cannot be reused for a different source or action.
- Contract submission is `pending` until RPC reports final success or failure.
- Contract cancellation refunds the complete vault balance atomically before marking the goal cancelled.
