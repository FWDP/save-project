# Stellar and Soroban Integration Options for SAVE

Assessment date: 2026-08-27

## Purpose and scope

This document catalogs the meaningful Stellar and Soroban integrations that fit the current SAVE project. It is a product and technical options map, not a claim that every option should be built.

The current repository contains:

- an Expo 57 / React Native client for Android, iOS, and web;
- a NestJS API;
- a Next.js admin application;
- transaction, category, and budget features;
- offline SQLite caching and Zustand state;
- SecureStore, local authentication, linking, and web-browser capabilities; and
- planned MongoDB, Redis/BullMQ, and object storage infrastructure.

This is a strong base for a non-custodial savings and payments application. The recommended first product is a Stellar account/wallet plus stablecoin payments, followed by a Soroban savings-vault contract. Running an issuer, exchange, lending product, or custodial wallet is possible but changes the legal, operational, and security scope substantially.

## Recommended product direction

| Priority | Integration | Why it fits SAVE |
| --- | --- | --- |
| P0 | Read-only Stellar portfolio and transaction import | Adds real financial data without custody or signing risk. |
| P0 | Connect or create a non-custodial account | Establishes the user's on-chain identity and balance source. |
| P0 | Send/receive XLM and selected stablecoins | Maps directly to the existing income/expense and receipt flows. |
| P0 | Sponsored account reserves and fee-bump transactions | Removes most XLM onboarding friction. |
| P1 | Anchor deposit/withdrawal and KYC flows | Lets users move between fiat and Stellar assets. |
| P1 | Soroban goal vault | Turns the current budgets/savings concept into enforceable on-chain savings rules. |
| P1 | RPC event ingestion and reconciliation | Keeps mobile, backend, and admin views consistent with final ledger state. |
| P2 | Cross-asset path payments and quotes | Allows “pay in one asset, receive another.” |
| P2 | Shared savings, allowances, and recovery policies | Adds differentiated programmable-finance features. |
| P3 | Rewards asset, DeFi, remittance operator, or custody | Valuable only after product demand and regulatory review are established. |

## Integration catalog

### 1. Accounts, wallets, and signing

| Option | User experience | SAVE implementation | Notes |
| --- | --- | --- | --- |
| Watch-only account | Paste/scan a `G...` or `C...` address and view balances/activity. | Client validates the address; backend indexes it through Stellar RPC. | Safest first integration; no signing or custody. |
| External wallet connection | User approves each transaction in a compatible wallet. | Build unsigned XDR or a SEP-7 request, deep-link to the wallet, then reconcile the submitted hash. | Best default when mobile wallet compatibility meets requirements. No secret key enters SAVE. |
| App-managed non-custodial classic account | SAVE generates/imports an Ed25519 account and signs locally. | Encrypt the secret locally, gate signing with device authentication, and never send the secret to NestJS. | Requires backup/recovery, threat modeling, device-change flows, and a security audit. SecureStore alone is not a recovery strategy. |
| Soroban smart wallet / contract account | Seedless passkey-style signing with programmable controls. | A Rust contract implements `__check_auth`; the app supplies passkey/device signatures and a relayer can submit transactions. | Strong future fit for spend limits, allowlists, recovery, session keys, and multi-factor policies. Passkey tooling must be proven on native Expo builds, not assumed from browser examples. |
| Classic multisig account | Multiple people/devices approve sensitive actions. | Configure account signers, weights, and thresholds; collect signatures before submission. | Useful for joint savings, treasury, issuer, sponsor, and admin accounts. |
| Custodial/omnibus wallet | SAVE controls funds and exposes internal user balances. | HSM/KMS signing, pooled account with muxed IDs or memos, withdrawals, reconciliation, risk controls, and compliance operations. | Not recommended for the first release. This is a materially different regulated and security-sensitive business. |
| Account recovery | User recovers after losing a key/device. | SEP-30 recovery servers for classic accounts, or contract-account recovery policies. | Design before allowing material balances; never treat email login alone as sufficient authorization to move funds. |

Relevant standards and guides: [wallet overview](https://developers.stellar.org/docs/build/apps/overview), [Wallet SDK](https://developers.stellar.org/docs/build/apps/wallet), [smart wallets](https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets), [multisig](https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig), and [active SEPs, including SEP-30](https://developers.stellar.org/docs/learn/fundamentals/stellar-ecosystem-proposals).

### 2. Network data and portfolio features

SAVE can add:

- XLM, issued-asset, and contract-token balances;
- trustlines and authorization status;
- pending, successful, and failed on-chain transactions;
- payment, transfer, mint, burn, clawback, and contract events;
- claimable balances;
- active offers and liquidity-pool positions;
- account signers, thresholds, sponsorships, and reserve requirements;
- Soroban contract state and savings-vault positions;
- transaction explorer links and human-readable operation details; and
- cost-basis or fiat-value reporting when paired with a separate trusted price source.

Use Stellar RPC for live state, contract simulation/submission, recent transactions, and filtered events. RPC's recent transaction retention is limited, so the backend should persist normalized events and cursors. Use Hubble or Galexie for historical analytics rather than treating a public endpoint as the permanent accounting database. Horizon should be limited to integrations that still require its parsed resources, because Stellar marks it as nearing end-of-life. See the official [API comparison](https://developers.stellar.org/docs/data/apis) and [unified payment-event guide](https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-payments).

### 3. Payments and money movement

| Integration | Application to SAVE |
| --- | --- |
| Native XLM payments | Send, receive, request, and record XLM. |
| Issued-asset payments | Support selected stablecoins or other assets after validating code and issuer together. |
| Contract-account payments | Transfer Stellar assets between classic `G...` and contract `C...` addresses through the Stellar Asset Contract (SAC). |
| Payment requests | Produce QR codes and deep links for a prefilled destination, asset, amount, memo, or callback. SEP-7 supports delegated signing and payment requests. |
| Contacts and aliases | Save verified addresses locally/server-side; optionally resolve human-readable addresses through SEP-2 federation. |
| Pooled account routing | Use muxed accounts or memos to associate inbound funds with a user when operating a shared account. Enforce memo requirements where an exchange/anchor requires them. |
| Claimable balances | Send an asset before a recipient has a trustline, add time predicates, or create time-bounded gifts/rewards. Include a reclaim path to avoid permanent unclaimed entries. |
| Batched payments | Bundle up to the protocol's allowed operation count in a classic transaction for reimbursements or distributions. Smart-contract transactions have different one-operation constraints. |
| Fee sponsorship | Pay users' network fees using fee-bump transactions without taking control of their funds. |
| Reserve sponsorship | Sponsor account creation, trustlines, signers, offers, and other reserve-bearing entries. |
| Merchant/receipt matching | Attach a stable internal reference using a memo where appropriate, then reconcile the chain event with the scanned receipt. Never place private receipt details on-chain. |

References: [send and receive payments](https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-payments), [SEP-7](https://developers.stellar.org/docs/build/apps/wallet/sep7), [claimable balances](https://developers.stellar.org/docs/build/guides/transactions/claimable-balances), [sponsored reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves), and [fee-bump transactions](https://developers.stellar.org/docs/build/guides/transactions/fee-bump-transactions).

### 4. Fiat on/off-ramps, KYC, and remittances

SAVE can consume an existing anchor rather than becoming one:

- SEP-1: discover an anchor and its supported assets from `stellar.toml`;
- SEP-10: authenticate a classic Stellar account to the anchor;
- SEP-45: authenticate a contract account to an anchor;
- SEP-12/SEP-9: collect and update required KYC fields;
- SEP-24: open a hosted interactive deposit or withdrawal flow;
- SEP-6: implement programmatic deposits and withdrawals;
- SEP-38: show indicative or firm conversion quotes; and
- SEP-31: participate in cross-border payment flows where the provider relationships and compliance model support it.

The current `expo-web-browser`, `expo-linking`, and `saveproject` custom scheme can handle hosted-flow callbacks. Production should also configure HTTPS universal/app links and use development builds for realistic callback tests. The [Expo 57 Linking API](https://docs.expo.dev/versions/v57.0.0/sdk/linking/) warns that Expo Go URLs are not stable for authorization callbacks. Anchor support is described by the [Wallet SDK guide](https://developers.stellar.org/docs/build/apps/wallet/intro) and [Anchor Platform](https://developers.stellar.org/docs/platforms/anchor-platform).

Becoming an anchor is also technically possible: the existing Docker/NestJS stack could run a business server beside Stellar Anchor Platform and implement KYC, quote, transaction-status, settlement, and callback endpoints. That option requires banking/payment partners, liquidity, sanctions and AML controls, data-retention policies, incident response, and jurisdiction-specific legal review. It should be treated as a separate program, not an ordinary app feature.

### 5. Asset conversion and liquidity

| Integration | What SAVE could expose | Risk/constraint |
| --- | --- | --- |
| Path payment | User spends XLM while the recipient receives a stablecoin, or vice versa. | Quote expiration, slippage bounds, trustlines, and route availability must be shown before signing. |
| SDEX order | Buy/sell assets with limit offers and show open-order status. | Asset verification, thin liquidity, price impact, and user education. |
| Liquidity-pool deposit/withdrawal | Track or manage LP positions. | Impermanent loss, reserve requirements, and financial-product disclosures. |
| Soroban DEX/DeFi adapter | Route swaps or deposits to reviewed third-party contracts. | Contract, oracle, liquidity, upgrade, and governance risk; use allowlisted contract IDs by network. |

Classic path payments can route through the Stellar decentralized exchange and protocol liquidity pools. See [path payments](https://developers.stellar.org/docs/build/guides/transactions/path-payments) and [Stellar liquidity](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools).

### 6. Soroban savings and finance contracts

These are the most relevant custom-contract opportunities for SAVE:

| Contract feature | Core behavior | Suggested priority |
| --- | --- | --- |
| Goal vault | Deposit XLM or an approved SAC asset toward a named goal; withdraw under defined owner and deadline rules. | P1 |
| Time-locked savings | Prevent ordinary withdrawal until a timestamp/ledger deadline, with a clearly defined emergency path. | P1 |
| Shared savings pot | Multiple members contribute; withdrawal requires threshold or role-based approval. | P2 |
| Envelope vaults | Keep auditable balances for categories or goals while assets remain in contract custody. | P2 |
| Allowance/spending policy | Permit a capped amount per period, recipient allowlist, or dual approval. | P2; often best as a smart-wallet policy. |
| Milestone escrow | Release funds after payer/payee approval, deadline, or an authorized arbiter decision. | P2 |
| Matching contribution | Sponsor matches eligible deposits up to a cap. | P2 |
| Rewards distribution | Distribute an existing Stellar asset for savings streaks or program participation. | P2/P3 |
| Round-up aggregation | Accumulate computed round-ups and periodically deposit them into a goal. | P2; computation and triggering remain off-chain. |
| Recurring contribution | Store a schedule/allowance and let an authorized keeper submit due contributions. | P2; contracts do not initiate transactions by themselves. |
| Conditional disbursement | Release funds based on approved attestations or oracle data. | P3; oracle trust must be explicit. |
| Group lending / rotating savings | Contributions and scheduled payouts for a savings circle. | P3; high contract, default, identity, and regulatory risk. |
| DeFi yield adapter | Deposit eligible assets into a reviewed lending/liquidity protocol and account for shares/yield. | P3; do not advertise principal safety or fixed yield. |
| Governance | Member voting over shared treasury rules or upgrades. | P3. |
| Proof/attestation | Publish a hash or minimal event proving a milestone or approved record. | Optional; never publish personal finance data. |

Soroban contracts are Rust programs compiled to Wasm. They can authorize both account and contract addresses and can interact with Stellar assets through the SAC, but they cannot directly invoke the SDEX, claimable-balance, or sponsorship operations. Those classic operations must be composed outside the contract in separately authorized transactions. See the [Soroban overview](https://developers.stellar.org/docs/build/smart-contracts/overview), [contract authorization](https://developers.stellar.org/docs/build/guides/auth/contract-authorization), and [SAC documentation](https://developers.stellar.org/docs/tokens/stellar-asset-contract).

### 7. Assets and tokens

SAVE has four possible levels of token integration:

1. **Display and transfer existing assets.** This is the recommended baseline. Maintain a reviewed allowlist keyed by `(network, asset code, issuer)` or contract ID.
2. **Use existing assets in a vault.** Deploy/use their built-in SAC and accept only configured token contract IDs.
3. **Issue a SAVE rewards asset.** A classic Stellar asset is normally preferable for a transferable loyalty/reward unit because it gains wallet, exchange, anchor, and SAC compatibility. Publish complete metadata in `/.well-known/stellar.toml`, separate issuer and distribution accounts, and protect issuer authority with cold/multisig controls.
4. **Build a SEP-41 contract token or regulated token.** Do this only when protocol assets cannot express the required behavior. Custom tokens add contract and interoperability work; regulated/RWA tokens add identity, transfer restriction, clawback, disclosure, reserve, and legal obligations.

Stellar explicitly recommends a protocol-issued asset plus SAC when it is sufficient. See [asset and contract-token comparison](https://developers.stellar.org/docs/tokens), [issuing an asset](https://developers.stellar.org/docs/tokens/how-to-issue-an-asset), [publishing asset information](https://developers.stellar.org/docs/tokens/publishing-asset-info), and the [token interface](https://developers.stellar.org/docs/tokens/token-interface).

### 8. Authentication and identity protocols

Possible additions include:

- wallet ownership login using SEP-10 for classic accounts or SEP-45 for contract accounts;
- an app session linked to one or more Stellar addresses;
- KYC state and anchor customer IDs without putting PII on-chain;
- federation names for easier addressing;
- verified domain and asset/service discovery through SEP-1;
- regulated-asset approval flows (SEP-8) where required; and
- account/address identicons (SEP-33) to reduce address-selection mistakes.

Wallet authentication proves control of an address; it does not prove a legal identity. Keep the current app user ID distinct from account address, KYC customer ID, and device credential.

### 9. Admin, reconciliation, and operations

The Next.js admin and NestJS backend can support:

- per-network contract and asset allowlists;
- sponsor account balance/reserve/fee monitoring;
- transaction submission queue and idempotent retries;
- RPC cursor checkpoints and reprocessing;
- ledger-confirmation and failed-transaction reconciliation;
- unmatched deposit, memo, receipt, and internal-record review;
- vault totals and contract-event dashboards;
- anchor transaction and KYC status support tools;
- signer/threshold and issuer/distribution-account monitoring;
- suspicious activity and velocity alerts;
- contract Wasm hash, deployment, upgrade, and TTL tracking; and
- audit exports that distinguish on-chain facts from editable app metadata.

Redis/BullMQ is suitable for polling, retry, and reconciliation work, but MongoDB should contain durable idempotency records and the last processed ledger/cursor. A queue acknowledgement is not evidence of ledger finality.

## Proposed architecture

| Layer | Responsibility |
| --- | --- |
| Expo app | Address management, balance views, transaction review, local signing or wallet handoff, biometric confirmation, QR/deep links, anchor browser flows, and offline read cache. |
| NestJS API | User/address associations, policies, unsigned transaction preparation, fee sponsorship, RPC access, event normalization, idempotency, anchor callbacks, and notifications. |
| Soroban contracts | Minimal enforceable vault, escrow, shared-control, or smart-wallet rules; token custody only where the product requires it. |
| MongoDB | Users, linked accounts, app metadata, normalized operations/events, reconciliation state, anchor references, and audit records. |
| Redis/BullMQ | Event polling, retryable submissions, reconciliation, quote expiry, notification, and TTL-maintenance jobs. |
| Next.js admin | Contract/asset configuration, exception handling, sponsor health, reconciliation, compliance status, and audit views. |
| Stellar RPC | Current ledger state, simulation, submission, recent transaction lookup, and events. |
| Hubble/Galexie or managed indexer | Long-range historical and analytical data when required. |

## Required data-model changes

The existing `ApiTransaction` is an app finance record and is not sufficient as a blockchain transaction. Preserve it, but add separate entities such as:

- `StellarAccount`: user ID, network, address, account kind, label, custody mode, and verification status;
- `Asset`: network, type, code, issuer or contract ID, decimals, home domain, and allowlist status;
- `LedgerTransaction`: hash, envelope/result XDR references, source, ledger, timestamps, fee, status, and paging cursor;
- `LedgerOperation` / `ContractEvent`: operation/event type, source, destination, asset, exact decimal amount, contract ID, topics, and raw reference;
- `SigningRequest`: unsigned XDR, network passphrase, summary, expiration, nonce/idempotency key, signer set, and status;
- `VaultPosition`: contract ID, owner, asset contract ID, deposited/withdrawn amounts, goal, deadline, and state;
- `AnchorTransaction`: SEP type, anchor domain, external ID, status, quote ID, KYC customer ID, and sanitized callback data; and
- `ChainLink`: relationship between a user-entered income/expense record and one or more ledger operations/events.

Never store Stellar amounts in JavaScript `number` or MongoDB floating-point fields. Preserve the network's exact decimal string/integer representation and format only at the UI boundary. A ledger transaction may contain multiple operations, while one finance record may match multiple ledger events, so do not overload the current single `id/type/amount` record.

## Expo 57 integration notes

- The installed `expo-secure-store` is appropriate for small encrypted values, tokens, or a wrapped-key reference, but secrets need an explicit backup/recovery design. Review the exact [Expo 57 SecureStore API](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).
- The installed `expo-local-authentication` can gate signing; Face ID requires a development build and its iOS permission configuration. See [Expo 57 LocalAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/).
- The existing custom scheme supports callbacks, but production wallet/anchor flows should add verified universal/app links and strict route/parameter validation. See [Expo 57 Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/).
- `expo-web-browser` can host SEP-24/KYC flows, returning through the configured link. Never assume browser success means an on-chain transfer succeeded; reconcile with the anchor and ledger.
- `@stellar/stellar-sdk` officially targets browser and Node.js environments. React Native compatibility and any required crypto/Buffer polyfills must be validated in an Expo development build before choosing client-side signing. A backend-only SDK integration avoids native bundling issues but cannot provide non-custodial signing by itself. See [Stellar client SDKs](https://developers.stellar.org/docs/tools/sdks/client-sdks).
- The TypeScript Wallet SDK covers common wallet and anchor flows; use lower-level SDK/RPC calls for advanced operations and Soroban. Validate its native runtime behavior in this exact Expo/React Native version before adopting it.

## Security, privacy, and correctness requirements

- Default to Testnet until end-to-end reconciliation, recovery, and failure handling are proven.
- Make the selected network unmistakable and bind every signature to the expected network passphrase.
- Never send a user secret seed, decrypted key, passkey private material, or recovery secret to the backend or logs in a non-custodial design.
- Show a decoded transaction summary—asset and issuer/contract, amount, destination, memo, contract, function, arguments, and maximum fee—before signing.
- Simulate Soroban transactions immediately before signing and enforce resource-fee and expiration bounds.
- Treat all deep links, wallet callbacks, anchor responses, RPC responses, and contract events as untrusted input.
- Use destination, asset, issuer/contract, and network allowlists where a feature does not require arbitrary values.
- Use idempotency keys and reconcile by transaction hash, ledger, operation/event identity, and cursor. Never mark a payment final from a client callback alone.
- Keep PII, receipt images, budget names, notes, categories, and KYC documents off-chain. Store only minimal public identifiers or commitments when essential.
- Separate sponsor, relayer, issuer, distribution, admin, and operational keys. Protect privileged keys with HSM/KMS or cold multisig; never place them in the mobile bundle or ordinary environment files.
- Audit any contract that can custody or control value. Use property/fuzz tests, invariant tests, Testnet deployments, reproducible Wasm builds, verified source, upgrade controls, and an incident/pausing strategy appropriate to the custody model.
- Plan contract storage TTL and restoration. TTL expiry is not a safe deadline mechanism, and extending/restoring state costs fees. See [Soroban storage guidance](https://developers.stellar.org/docs/build/guides/storage/storage-strategies).
- Obtain legal review before custody, fiat ramps, rewards with monetary value, swaps, yield, lending, pooled funds, remittances, securities/RWAs, or operation in regulated jurisdictions.

## Known limitations and non-goals

- Soroban contracts do not execute on a timer and cannot initiate a transaction. Recurring deposits require a user, relayer, or keeper to submit an authorized invocation.
- A Soroban contract cannot directly operate the classic SDEX, claimable balances, or sponsorships. The client/backend must build the relevant classic transactions.
- Blockchain data is public; encryption elsewhere does not make an on-chain amount, address, or event private.
- A Stellar address is not a verified person, and a confirmed transaction is not automatically a correctly categorized income/expense record.
- On-chain balances do not provide historical fiat prices, tax lots, merchant identity, or exchange-rate truth. Those require separate data and accounting policies.
- Offline mode can display cached data and queue intent, but it cannot truthfully confirm sequence numbers, simulation results, quotes, fees, or finality until reconnected.
- “Stablecoin” does not guarantee redemption, price stability, liquidity, or regulatory availability. SAVE must verify issuers and communicate asset-specific risks.
- Smart-contract programmability does not remove custody, consumer-protection, tax, sanctions, AML, or securities obligations.

## Delivery roadmap

### Phase 0 — Decisions and proof of compatibility

1. Choose non-custodial external wallet, app-managed key, smart wallet, or watch-only scope.
2. Choose Testnet asset allowlist and a managed/public RPC provider.
3. Prove `@stellar/stellar-sdk`, Wallet SDK, required polyfills, deep links, SecureStore, and biometric confirmation in Android/iOS development builds and web.
4. Define exact amount, network, account, ledger-event, and idempotency models.
5. Write threat, custody, recovery, compliance, and privacy decisions before handling value.

### Phase 1 — Read-only vertical slice

1. Link a Testnet address.
2. Import balances and payment events through RPC.
3. Store cursors and normalized ledger data in the backend.
4. Display explorer-verifiable activity and link it to optional SAVE categories.
5. Add admin reconciliation and RPC-health views.

### Phase 2 — Payments

1. Build, decode, review, sign, submit, and reconcile Testnet payments.
2. Add receive/request QR and deep-link flows.
3. Add fee-bump and reserve sponsorship with strict quotas.
4. Add trustline and claimable-balance handling for one reviewed stablecoin.
5. Test timeout, duplicate submission, sequence conflict, fee surge, bad memo, wrong network, and callback spoofing cases.

### Phase 3 — Fiat access

1. Integrate one reviewed test anchor using SEP-1/10/12/24/38.
2. Handle browser callbacks, anchor status, ledger status, and cancellation independently.
3. Add production KYC/privacy/legal controls before any Mainnet launch.

### Phase 4 — Goal vault

1. Specify owner, asset, deposit, withdrawal, deadline, emergency, upgrade, fee, and TTL invariants.
2. Implement and test the minimal Rust contract.
3. Generate typed client bindings, simulate every invocation, and index contract events.
4. Audit, deploy to Testnet, verify Wasm/source, and complete failure/recovery drills before Mainnet.

### Phase 5 — Optional expansion

Add shared savings, smart-wallet policies, path payments, recovery, rewards, remittances, or reviewed DeFi adapters only in response to a validated product need. Each should receive its own threat model and go/no-go review.

## Final recommendation

Build the first release as a non-custodial, Testnet-first wallet companion: watch/link an account, import balances and payments via RPC, send and request a reviewed asset with external or locally protected signing, sponsor fees/reserves, and reconcile every action through the backend. Then add one deliberately small Soroban goal-vault contract. This path reuses nearly every existing part of SAVE while keeping custody, contract, and regulatory risk bounded.
