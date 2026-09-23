# Mobile improvements — implementation and qualification

Implemented in this working tree on 2026-09-23. This is a substantial application foundation update, not a declaration of production readiness.

## Implemented

- Shared selected month across dashboard, transaction list, monthly budgets and report periods; local-date helpers avoid UTC month-boundary shifts.
- Monthly totals and counts, cents-preserving calculations, actual overspend percentages, remaining amounts, aggregated merchants and recent transactions before detailed charts.
- Mobile date-grouped virtualized transactions, search/type filtering, actual sort controls, detail/edit/delete actions, and direct transaction creation from the dashboard.
- Date picker for transaction creation and savings targets. Larger supporting labels/controls and clearer empty/retry/pending states.
- Monthly budget category selection, duplicate checks, editing, deletion and over-budget-first ordering. Weekly limits are explicitly excluded from monthly totals.
- Savings trackers and linked Testnet vaults separated into views; goal creation moved up, unsupported USDC choice removed, and receipt/scanning copy no longer claims nonexistent OCR.
- Photo/file receipts copied into the native document directory and previewed on transaction details. They remain device-local, not uploaded cross-device assets.
- Supabase SDK integration for password, Google and magic-link authentication, protected routes, verified backend bearer identity, user-scoped finance CRUD, trusted admin role checks and account-partitioned cache/outbox storage.
- Finance services no longer return demo data for empty lists or report successful volatile-memory writes during database failures.
- SQLite pending transaction outbox, owner-checked upload, backend mutation-ID uniqueness/upsert, retained queue after a lost response, and pending-upload labels. Outbox upload is triggered after creation and on refresh/foreground/periodic sync.
- Browser-specific cache/outbox adapter, eliminating the Expo SQLite WebAssembly build dependency for the existing browser preview.
- Coherent refresh snapshots, stale-refresh rejection after local mutations, last-success timestamp preservation and request timeouts.
- Real CSV/JSON file exports; CSV multiline/quote handling and formula neutralization; import preview, matching-record skips, sequential restore with progress retention, missing categories/budgets restored while preserving existing limits.
- Destructive bulk deletion reports partial completion and only removes server-acknowledged records from the local view.

## Automated validation

- Mobile TypeScript check.
- Expo frontend lint and backend lint.
- NestJS build.
- 12 frontend/domain regression tests: month/date/money calculations, merchant aggregation, CSV validation/duplicates, interrupted upload, account change during upload and partial upload recovery.
- 6 backend regression tests: authentication requirements, trusted identity/admin checks, owner-scoped reads/updates, empty lists, database failure and idempotent creation.
- 5 existing Stellar signing/allowlist tests.
- Expo browser static export, including all 24 routes.
- `git diff --check`.

Tests for service behavior use controlled model/provider doubles. They do not replace integration tests against a real MongoDB instance and configured hosted authentication provider.

## Remaining qualification and next work

1. Configure Supabase, Google and email delivery using `AUTH_SETUP.md`; real email/Google flows have not been exercised in this environment. Missing configuration deliberately leaves sign-in unavailable instead of entering a fake account.
2. Perform physical-device visual/accessibility testing and rebuild the native client for the added sharing module. No Android device was attached during this implementation.
3. Run the live two-account, interrupted-network and Stellar linked-goal checks in the auth setup guide. The contract itself was not modified or redeployed.
4. Review legacy ownership migration. Existing `usr_2`/ownerless demo records do not appear in new accounts and are not silently reassigned.
5. Receipts are not yet uploaded to object storage; exports contain records/receipt references but not receipt binaries. Vault metadata in a backup is reference material, not restorable proof of funds.
6. Full light-theme design, a consolidated icon system, advanced filter sheets, OCR and recurring schedules remain future enhancements. Current recurring state is a label, not an automatic scheduler.
7. The Expo Web adapter uses localStorage and requires further multi-tab/offline-conflict work before becoming a production offline Web client. The dedicated Web implementation is planned separately.

The next product implementation is documented in `SAVE_WEB_IMPLEMENTATION_PLAN.md`: personal and business workspaces, role enforcement, invitations, approvals, server sessions, receipt storage and phased acceptance criteria.
