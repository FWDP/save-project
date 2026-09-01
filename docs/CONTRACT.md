# SAVE Savings Vault Contract

## Scope

`save-savings-vault` is a deliberately small, Testnet-first Soroban contract. It accepts approved Stellar Asset Contract tokens, holds them per savings goal, enforces owner authorization for lifecycle actions, and emits indexable events. Names, receipts, merchant information, account profiles, and all other private metadata stay off-chain.

## Interface

| Function | Authorization | Result |
|---|---|---|
| `__constructor(allowed_asset)` | deployer | Sets the immutable SAC allowlist for this deployment. |
| `allowed_asset()` | none | Reads the configured SAC allowlist. |
| `create_goal(owner, asset, target_amount, target_date)` | owner | Creates an active goal and returns its `u128` ID. |
| `contribute(goal_id, contributor, amount)` | contributor | Transfers SAC tokens into the vault and updates exact balance. |
| `complete_goal(goal_id)` | permissionless | Completes when target is reached or optional Unix deadline has passed. |
| `withdraw(goal_id, amount)` | owner | Transfers tokens from a completed goal to its owner. |
| `cancel_goal(goal_id)` | owner | Cancels an active goal and atomically refunds its full balance. |
| `get_goal(goal_id)` | none | Reads one goal. |
| `list_goals(owner)` | none | Reads goals indexed to an owner. |

Amounts are atomic `i128` token units, never floating-point values. `target_date` is a Unix timestamp used as a condition only; contract storage TTL is extended separately and is not used as a clock.

## Events

The typed ABI contains `GoalCreated`, `Contribution`, `GoalCompleted`, `Withdrawal`, and `GoalCancelled`. Backend ingestion uses Stellar RPC `getEvents`; Horizon is used only for classic account/payment history.

## Build and test

```bash
npm run contract:test
npm run contract:build
```

The Wasm output is `contract/target/wasm32v1-none/release/save_savings_vault.wasm`.

## Testnet deployment

The project currently uses this dedicated Testnet deployment:

| Setting | Value |
|---|---|
| Vault contract | `CDYPVKFWSPHKGDHZ77M2T2TZPCS3LVXDFJDH5PERL5HTUNVFYSTB7AG3` |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Wasm SHA-256 | `0977e310e0f296e8811774ee74800367053879f809cc6ebbb49dca0816b8587f` |
| Wasm upload transaction | `abc82c9d19b4d187a8faae2e8651eeed0fbb26484444911886e8ff849153046b` |
| Deployment transaction | `85a94fe0360cc955bcedfbcd496fb0c26e2a21799582a3f92e26d8e7f1715587` |

This deployment preserves the reviewed lifecycle, fixes first-time-owner reads, and configures
the Native XLM SAC as an immutable constructor allowlist. The prior Testnet deployments remain
available for their historical Deliverables 1–2 transactions.

Both IDs are public network identifiers, not credentials. They are configured in
`backend/.env.example`; production and Mainnet must use separately reviewed deployments.

Reviewer evidence for the deployed sample goal and controlled contributions is recorded in
[`DELIVERABLES_1_2_TEST_REPORT.md`](./DELIVERABLES_1_2_TEST_REPORT.md).

No application or backend secret is required for normal operation. Deployment is an explicit operator action:

```bash
stellar keys generate save-deployer --network testnet --fund
stellar contract deploy \
  --wasm contract/target/wasm32v1-none/release/save_savings_vault.wasm \
  --source save-deployer \
  --network testnet \
  -- --allowed-asset CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

Record the returned `C…` address as `STELLAR_VAULT_CONTRACT_ID` and the release artifact SHA-256 as `STELLAR_VAULT_WASM_HASH`. Do not commit the deployer seed or local Stellar CLI identity directory. Run `npm run health:testnet` to verify the deployed code and address.

## Withdrawal and cancellation rules

- Only the stored goal owner can withdraw.
- Partial withdrawals are supported only while the goal is `Completed` and cannot exceed its remaining balance.
- Active and cancelled goals cannot be withdrawn.
- Cancelling an active goal atomically refunds its entire balance to the owner, zeros the balance, and marks the goal `Cancelled`.
- A completed or cancelled goal cannot be cancelled again or receive additional contributions.

## Security review

- Every token debit from a user is preceded by `require_auth`.
- Goal creation rejects every asset except the immutable deployment allowlist.
- Withdrawal and cancellation require the stored owner.
- Checked arithmetic prevents contribution overflow.
- Status transitions prevent contribution after completion/cancellation and withdrawal before completion.
- Cancellation refunds funds instead of trapping them.
- Token transfer and state mutation execute atomically.
- Persistent and instance storage TTLs are extended on access.
- Backend simulation enforces a maximum fee before external-wallet signing.
- Backend never accepts or stores secret seeds.

Before Mainnet: independent audit, invariant/property testing, asset and contract allowlists, upgrade/pause decision, recovery drills, sponsor/relayer separation, and legal review are mandatory.
