# Combined Soroban Savings Goal Vault Implementation & Stellar/Soroban Integration

---

## Part 1 – Soroban Smart Savings Goal Vault – Phase‑by‑Phase Implementation Plan

*This section is the original `SOROBAN_SAVINGS_GOAL_IMPLEMENTATION.md` content.*

# Soroban Smart Savings Goal Vault – Phase‑by‑Phase Implementation Plan

**Project:** NFJPIA – Savings Goals (S.A.V.E.)
**Deliverable:** Build and deploy a focused Soroban contract for test savings goals.

---

### Overview
The goal is to create a **Soroban smart contract** that manages savings‑goal vaults on the Stellar testnet. The contract will handle goal creation, owner authorization, contributions, target metadata, status tracking, controlled withdrawals, and emit events. Off‑chain data (receipts, merchant info, PII, etc.) will remain in the existing backend/database.

---

#### Phase 1 – Foundations & Tooling Setup
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 1.1 | Add Soroban toolchain to repo (`soroban-cli`, `cargo-xbuild`) and ensure Rust toolchain version consistency. | DevOps / Backend | `soroban --version` runs and `cargo build --target wasm32-unknown-unknown` succeeds. |
| 1.2 | Create a new Cargo workspace `soroban_savings` inside `nfjpia-project/contract/`. | Backend Engineer | `Cargo.toml` with `[workspace]` includes the contract crate. |
| 1.3 | Add CI job (GitHub Actions) to compile, lint, and run contract unit tests on every PR. | CI Engineer | Workflow badge shows *passing* on PRs. |
| 1.4 | Set up local Stellar testnet sandbox (`docker run stellar/quickstart`) and configure environment variables (`STELLAR_NETWORK=TESTNET`, `HORIZON_URL`, `FRIENDBOT_URL`). | DevOps | Local testnet reachable; `soroban contract list` works. |

---

#### Phase 2 – Contract Data Model & Basic Storage
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 2.1 | Define `GoalId` as `u128` (or `bytes`) and a `Goal` struct with minimal on‑chain fields: `owner`, `target_amount`, `target_date`, `balance`, `status`. | Backend Engineer | Rust struct compiles, `#[contracttype]` derives. |
| 2.2 | Implement storage maps using `Map<GoalId, Goal>` and `Map<Address, Vec<GoalId>>` for owner indexing. | Backend Engineer | `storage::set` / `storage::get` compile without errors. |
| 2.3 | Write unit tests for storage CRUD (create, read, update). | QA Engineer | `cargo test` passes 100% for storage layer. |

---

#### Phase 3 – Core Entry Points (Create & Contribute)
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 3.1 | Implement `create_goal(owner: Address, target_amount: i128, target_date: Option<u64>) → GoalId` (unique counter). |
| 3.2 | Implement `contribute(goal_id: GoalId, amount: i128, contributor: Address)` – validate amount, status, update balance, emit `Contribution`. |
| 3.3 | Add basic access control: only `owner` can later call `withdraw`/`cancel`. |
| 3.4 | Write comprehensive unit tests (success, insufficient funds, wrong status, overflow). |
| 3.5 | CI runs these tests on each commit. |
| Owner | Backend Engineer |
| Acceptance | All tests pass; `soroban contract invoke` works on local testnet. |

---

#### Phase 4 – Goal Lifecycle & Withdrawal Logic
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 4.1 | Implement `complete_goal(goal_id)` – transition to `Completed` when balance ≥ target or deadline passed. |
| 4.2 | Implement `withdraw(goal_id, amount)` – only owner, only when `Completed`, transfer via `pay`, emit `Withdrawal`, guard double‑withdrawal. |
| 4.3 | Implement `cancel_goal(goal_id)` – owner can cancel before completion; status → `Cancelled`. |
| 4.4 | Unit tests for each transition and edge cases. |
| Owner | Backend Engineer |
| Acceptance | Lifecycle tests pass; contract enforces correct state transitions. |

---

#### Phase 5 – Event Emission & Off‑Chain Integration
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 5.1 | Define events: `GoalCreated`, `Contribution`, `GoalCompleted`, `Withdrawal`, `GoalCancelled`. |
| 5.2 | Emit events via `env::emit_event` in each entry point. |
| 5.3 | Add a small off‑chain listener (Node/TS) that subscribes to Horizon testnet streaming and persists events to MongoDB. |
| 5.4 | Backend API fetches goal state via RPC and merges with off‑chain receipt data. |
| Owner | Full‑stack Engineer |
| Acceptance | Events appear in Horizon stream; backend can query on‑chain state and combine with DB models. |

---

#### Phase 6 – Testnet Deployment & Verification
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 6.1 | Build contract WASM (`cargo build --target wasm32-unknown-unknown --release`). |
| 6.2 | Deploy to Stellar **testnet** (`soroban contract deploy …`). Record contract address. |
| 6.3 | Integration test suite: create goal, multiple contributions, status checks, withdrawal. |
| 6.4 | CI runs integration test against fresh testnet (Docker quickstart). |
| 6.5 | Document deployment steps & contract address in `README.md`. |
| Owner | DevOps / Backend Engineer |
| Acceptance | Contract deployed, integration tests pass, README reproducible. |

---

#### Phase 7 – UI/UX Front‑End Hook‑up (Optional MVP)
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 7.1 | Add React page `/savings/soroban` using existing design system (Heroicons, typography tokens). |
| 7.2 | Connect frontend to backend proxy for Soroban RPC calls. |
| 7.3 | Show real‑time transaction status via Horizon events. |
| 7.4 | Follow NFJPIA visual standards (icons, button colors, typography). |
| Owner | Front‑end Engineer |
| Acceptance | User can create a goal, fund it with a real Stellar testnet transaction, UI reflects on‑chain state. |

---

#### Phase 8 – Documentation, Security Review & Release
| Step | Description | Owner | Acceptance Criteria |
|------|-------------|-------|----------------------|
| 8.1 | Write contract docs (`docs/CONTRACT.md`). |
| 8.2 | Conduct lightweight security audit (re‑entrancy, overflow, auth). |
| 8.3 | Add audit logs to backend actions (NFJPIA audit middleware). |
| 8.4 | Tag release candidate (`v0.1-soroban`), publish contract address & ABI. |
| Owner | Security Engineer / Lead Developer |
| Acceptance | Docs merged, audit sign‑off, release tag created. |

---

### Summary Timeline (4 weeks)
| Week | Focus |
|------|-------|
| 1 | Phase 1 & 2 – environment, data model, storage basics |
| 2 | Phase 3 – core entry points & unit tests |
| 3 | Phase 4 & 5 – lifecycle, events, off‑chain integration |
| 4 | Phase 6 – testnet deployment, integration tests; optional Phase 7 UI |
| End | Phase 8 – docs, security review, release |

---

**Next Steps**
1. Verify repository structure (create `contract/` folder if missing).
2. Assign owners for each phase.
3. Kick off Phase 1 by adding the Soroban toolchain.

---

## Part 2 – Stellar and Soroban Integration Options for SAVE
*This section is the original `STELLAR_SOROBAN_INTEGRATIONS.md` content.*

# Stellar and Soroban Integration Options for SAVE

## Assessment date: 2026-08-27

### Purpose and scope
This document catalogs the meaningful Stellar and Soroban integrations that fit the current SAVE project. It is a product and technical options map, not a claim that every option should be built.

#### Current repository includes
- Expo 57 / React Native client (Android, iOS, web)
- NestJS API
- Next.js admin app
- Transaction, category, budget features
- Offline SQLite caching and Zustand state
- SecureStore, local authentication, linking, web‑browser capabilities
- Planned MongoDB, Redis/BullMQ, object storage

### Recommended product direction
| Priority | Integration | Why it fits SAVE |
|---|---|---|
| P0 | Read-only Stellar portfolio & transaction import | Adds real financial data without custody or signing risk. |
| P0 | Connect or create a non‑custodial account | Establishes on‑chain identity and balance source. |
| P0 | Send/receive XLM and selected stablecoins | Maps directly to existing income/expense flows. |
| P0 | Sponsored account reserves & fee‑bump transactions | Removes most XLM onboarding friction. |
| P1 | Anchor deposit/withdrawal & KYC flows | Enables fiat‑on/off‑ramps. |
| P1 | Soroban goal vault | Enforces on‑chain savings rules. |
| P1 | RPC event ingestion & reconciliation | Keeps views consistent with ledger state. |
| P2 | Cross‑asset path payments & quotes | Pay in one asset, receive another. |
| P2 | Shared savings, allowances, recovery policies | Adds programmable‑finance features. |
| P3 | Rewards asset, DeFi, remittance operator, custody | Valuable after demand & regulatory review. |

### Integration catalog (selected excerpts)
#### 1. Accounts, wallets, and signing
| Option | User experience | SAVE implementation | Notes |
|---|---|---|---|
| Watch‑only account | Paste/scan address, view balances. | Client validates; backend indexes via Stellar RPC. | Safest first integration; no signing. |
| External wallet connection | User approves each tx in compatible wallet. | Build unsigned XDR/SEP‑7 request, deep‑link, reconcile hash. | Default when mobile wallet compatibility OK. |
| App‑managed non‑custodial classic account | SAVE generates/imports Ed25519 key, signs locally. | Encrypt secret, gate signing with device auth, never send secret to backend. | Requires backup/recovery, threat modelling. |
| Soroban smart wallet / contract account | Seedless passkey‑style signing with programmable controls. | Rust contract implements `__check_auth`; app supplies signatures; relayer submits. | Future‑fit for spend limits, allowlists, recovery. |
| Classic multisig account | Multiple signers approve actions. | Configure signers/thresholds, collect signatures before submission. | Useful for joint savings, treasury, issuer, sponsor. |
| Custodial/omnibus wallet | SAVE controls funds, exposes internal balances. | HSM/KMS signing, pooled account with muxed IDs/memos, withdrawals, reconciliation. | Not recommended for first release (regulated). |
| Account recovery | User recovers after losing key/device. | SEP‑30 recovery servers for classic accounts, or contract‑account recovery policies. | Design before allowing material balances. |

#### 2. Network data and portfolio features
- XLM, issued‑asset, contract‑token balances
- Trustlines, pending/failed txs, payment/transfer/mint/burn events
- Claimable balances, offers, liquidity‑pool positions
- Soroban contract state & vault positions
- Explorer links, cost‑basis reporting (with price source)
- Use Stellar RPC for live state; persist normalized events; Hubble/Galexie for historical analytics.

#### 3. Payments and money movement
| Integration | Application to SAVE |
|---|---|
| Native XLM payments | Send, receive, request, record XLM. |
| Issued‑asset payments | Support selected stablecoins after validation. |
| Contract‑account payments | Transfer between classic `G…` and contract `C…` via SAC. |
| Payment requests | QR codes & deep links (SEP‑7). |
| Contacts & aliases | Save verified addresses, resolve via SEP‑2 federation. |
| Pooled account routing | Use muxed accounts or memos for shared account funds. |
| Claimable balances | Send before trustline, add time predicates. |
| Batched payments | Bundle operations for reimbursements. |
| Fee sponsorship | Pay users' fees via fee‑bump without custody. |
| Reserve sponsorship | Sponsor account creation, trustlines, offers, etc. |
| Merchant/receipt matching | Attach memo for internal reference; never place private receipt data on‑chain. |

#### 4. Fiat on/off‑ramps, KYC, and remittances
- Use existing anchor (SEP‑1, SEP‑10, SEP‑45, SEP‑12/9, SEP‑24, SEP‑6, SEP‑38, SEP‑31) instead of building one.
- Expo linking & web‑browser handle hosted‑flow callbacks.
- Becoming an anchor requires banking partners, AML, legal review – treat as separate program.

#### 5. Asset conversion and liquidity
| Integration | What SAVE could expose | Risk/constraint |
|---|---|---|
| Path payment | User pays XLM, recipient receives stablecoin (or vice versa). | Quote expiry, slippage, trustlines, route availability. |
| SDEX order | Buy/sell assets, show order status. | Asset verification, thin liquidity, price impact. |
| Liquidity‑pool deposit/withdrawal | Track/manage LP positions. | Impermanent loss, reserve requirements. |
| Soroban DEX/DeFi adapter | Route swaps/deposits to reviewed contracts. | Contract/oracle liquidity risk; allowlist contract IDs. |

#### 6. Soroban savings and finance contracts (most relevant)
| Contract feature | Core behavior | Suggested priority |
|---|---|---|
| Goal vault | Deposit XLM or approved SAC asset toward a named goal; withdraw under defined rules. | P1 |
| Time‑locked savings | Prevent withdrawal until timestamp/ledger deadline. | P1 |
| Shared savings pot | Multiple members contribute; withdrawal requires threshold/role approval. | P2 |
| Envelope vaults | Auditable balances for categories/goals while assets stay in contract custody. | P2 |
| Allowance/spending policy | Capped amount per period, recipient allowlist, dual approval. | P2 |
| Milestone escrow | Release funds after payer/payee approval, deadline, or arbiter decision. | P2 |
| Matching contribution | Sponsor matches deposits up to a cap. | P2 |
| Rewards distribution | Distribute existing Stellar asset for streaks or participation. | P2/P3 |
| Round‑up aggregation | Accumulate round‑ups, periodically deposit into a goal. | P2 (off‑chain computation) |
| Recurring contribution | Store schedule/allowance; keeper submits due contributions. | P2 (contract cannot initiate) |
| Conditional disbursement | Release based on attestations or oracle data. | P3 (oracle trust) |
| Group lending / rotating savings | Savings circle contributions/payouts. | P3 (regulatory risk) |
| DeFi yield adapter | Deposit assets into lending/liquidity protocol, track shares/yield. | P3 (no fixed yield guarantee) |
| Governance | Voting over shared treasury rules or upgrades. | P3 |
| Proof/attestation | Publish hash/minimal event proving milestone. | Optional (no personal data) |

*Soroban contracts are Rust → Wasm; they can authorize accounts & contracts, interact via SAC, but cannot directly invoke SDEX, claimable‑balance, or sponsorship – those must be composed externally.*

#### 7. Assets and tokens
1. Display & transfer existing assets (allowlist).
2. Use existing assets in a vault (SAC).
3. Issue a SAVE rewards asset (classic Stellar asset, with issuer & distribution accounts, cold/multisig controls).
4. Build a SEP‑41 contract token or regulated token only if needed.

#### 8. Authentication and identity protocols
- SEP‑10 (classic) or SEP‑45 (contract) for wallet login.
- App session linked to Stellar addresses.
- KYC without putting PII on‑chain.
- Federation names, SEP‑1 domain discovery, SEP‑8 regulated‑asset approval, SEP‑33 identicons.

#### 9. Admin, reconciliation, and operations
- Per‑network contract & asset allowlists.
- Sponsor account balance/reserve/fee monitoring.
- Transaction submission queue, idempotent retries.
- RPC cursor checkpoints, ledger confirmation, failed‑tx reconciliation.
- Vault totals & contract‑event dashboards.
- Anchor transaction & KYC status tools.
- Signer/threshold & issuer monitoring.
- Suspicious activity alerts.
- Contract Wasm hash, deployment, upgrade, TTL tracking.
- Audit exports distinguishing on‑chain facts from app metadata.

#### Required data‑model changes (high‑level)
- `StellarAccount`, `Asset`, `LedgerTransaction`, `LedgerOperation`/`ContractEvent`, `SigningRequest`, `VaultPosition`, `AnchorTransaction`, `ChainLink` etc.
- Store amounts as exact integer/string representation, never JavaScript `number`.

#### Expo 57 integration notes
- `expo-secure-store` appropriate for small encrypted values; design backup/recovery.
- `expo-local-authentication` for signing gating (Face ID needs dev build).
- Custom scheme for callbacks; production should add universal/app links.
- `@stellar/stellar-sdk` compatibility with React Native – validate polyfills or use backend‑only signing.
- `stellar-wallet-sdk` for common wallet/anchor flows; lower‑level SDK/RPC for advanced ops & Soroban.

#### Security, privacy, and correctness requirements
- Default to Testnet until proven.
- Bind signatures to network passphrase.
- Never send secret seed or PII to backend or logs.
- Show decoded transaction summary before signing.
- Simulate Soroban tx before signing; enforce fee/resource bounds.
- Treat all external input (deep links, callbacks, RPC) as untrusted.
- Use allowlists for destinations, assets, contracts.
- Idempotency keys; reconcile via transaction hash, ledger, operation/event IDs.
- Keep PII, receipt images, budget names, KYC docs off‑chain.
- Separate sponsor, relayer, issuer, distribution, admin keys; protect with HSM/KMS.
- Audit contracts (property/fuzz tests, invariants, Testnet deploys, source verification, upgrade controls, pause strategy).
- Plan storage TTL & restoration; TTL not safe for deadline.
- Legal review before custody, fiat ramps, rewards, swaps, lending, pooled funds, securities, etc.

#### Known limitations and non‑goals
- Soroban cannot initiate transactions; recurring deposits need user/relayer.
- Cannot directly operate classic SDEX, claimable balances, sponsorships.
- On‑chain data is public; encryption elsewhere does not make it private.
- Stellar address ≠ verified person.
- On‑chain balances lack fiat price, tax lots, merchant identity.
- Offline mode cannot confirm ledger finality.
- Stablecoin does not guarantee redemption or regulatory compliance.
- Smart‑contract programmability does not remove custody, consumer‑protection, tax, AML, securities obligations.

#### Delivery roadmap (phases)
**Phase 0 — Decisions & proof of compatibility**
1. Choose wallet model (watch‑only, external, app‑managed, smart‑wallet).
2. Choose Testnet asset allowlist & RPC provider.
3. Prove `@stellar/stellar-sdk`, Wallet SDK, polyfills, deep links, SecureStore, biometric confirmation on Android/iOS/web.
4. Define amount, network, account, ledger‑event, idempotency models.
5. Write threat, custody, recovery, compliance decisions.

**Phase 1 — Read‑only vertical slice**
1. Link a Testnet address.
2. Import balances & payment events via RPC.
3. Store cursors & normalized ledger data in backend.
4. Display explorer‑verified activity linked to optional SAVE categories.
5. Add admin reconciliation & RPC‑health views.

**Phase 2 — Payments**
1. Build, decode, review, sign, submit, reconcile Testnet payments.
2. Add receive/request QR & deep‑link flows.
3. Add fee‑bump & reserve sponsorship with quotas.
4. Add trustline & claimable‑balance handling for one stablecoin.
5. Test timeout, duplicate submission, sequence conflict, fee surge, bad memo, wrong network, callback spoofing.

**Phase 3 — Fiat access**
1. Integrate one test anchor (SEP‑1/10/12/24/38).
2. Handle browser callbacks, anchor status, ledger status, cancellation.
3. Add production KYC/privacy/legal controls before Mainnet.

**Phase 4 — Goal vault**
1. Specify owner, asset, deposit, withdrawal, deadline, emergency, upgrade, fee, TTL invariants.
2. Implement & test minimal Rust contract.
3. Generate typed client bindings, simulate invocations, index contract events.
4. Audit, deploy to Testnet, verify Wasm/source, complete failure/recovery drills before Mainnet.

**Phase 5 — Optional expansion**
- Add shared savings, smart‑wallet policies, path payments, recovery, rewards, remittances, DeFi adapters as needed, each with threat model & go/no‑go review.

### Final recommendation
Build the first release as a non‑custodial, Testnet‑first wallet companion: watch/link an account, import balances/payments via RPC, send/request a reviewed asset with external or locally protected signing, sponsor fees/reserves, reconcile every action through backend. Then add a deliberately small Soroban goal‑vault contract. This path reuses existing SAVE components while keeping custody, contract, and regulatory risk bounded.

---

*End of combined document.*
