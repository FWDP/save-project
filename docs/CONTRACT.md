# SAVE Savings Vault Contract

## Scope

`save-savings-vault` is a deliberately small, Testnet-first Soroban contract. It accepts approved Stellar Asset Contract tokens, holds them per savings goal, enforces owner authorization for lifecycle actions, and emits indexable events. Names, receipts, merchant information, account profiles, and all other private metadata stay off-chain.

## Interface

| Function | Authorization | Result |
|---|---|---|
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
| Vault contract | `CALFEOYNTNJYB5HTUPYHHFHMNNYLYEBOCV43Z73J54G3CQNSH5VCNP7H` |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Wasm SHA-256 | `3c6be5dbf17042fcf1041b7a66c7a1f90a4f95233139246ab12cd7eb44bc40ef` |
| Deployed | 2026-08-31 |

This deployment fixes first-time-owner reads so `list_goals` returns an empty list instead of
attempting to extend a nonexistent storage key. The prior Testnet deployment remains available
for its historical Deliverables 1–2 evidence and sample goal.

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
  --network testnet
```

Record the returned `C…` address as `STELLAR_VAULT_CONTRACT_ID` in the backend environment. Do not commit the deployer seed or local Stellar CLI identity directory. Verify the deployed Wasm hash and source before allowing material Testnet balances.

## Security review

- Every token debit from a user is preceded by `require_auth`.
- Withdrawal and cancellation require the stored owner.
- Checked arithmetic prevents contribution overflow.
- Status transitions prevent contribution after completion/cancellation and withdrawal before completion.
- Cancellation refunds funds instead of trapping them.
- Token transfer and state mutation execute atomically.
- Persistent and instance storage TTLs are extended on access.
- Backend simulation enforces a maximum fee before external-wallet signing.
- Backend never accepts or stores secret seeds.

Before Mainnet: independent audit, invariant/property testing, asset and contract allowlists, upgrade/pause decision, recovery drills, sponsor/relayer separation, and legal review are mandatory.
