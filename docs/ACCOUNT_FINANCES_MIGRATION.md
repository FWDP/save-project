# Account-owned finances

SAVE Mobile and SAVE Web now use the authenticated account's transactions,
budgets, categories and savings goals directly. No workspace creation, membership,
selection or workspace ID is needed. PHP remains the stored currency; report
conversion is an estimate and never rewrites saved amounts.

Mobile uses `/transactions`, `/budgets`, `/categories` and `/savings-goals`.
Web uses those same write endpoints and the account-scoped `/ledger/transactions`
and `/ledger/reports/converted` read endpoints. The verified Supabase identity
controls every query. Forms and query parameters cannot select another account.

Web URLs are `/overview`, `/transactions`, `/budgets`, `/categories`, `/savings`,
`/reports` and `/settings`. Old `/w/:id/...` and workspace-creation links redirect
to account pages. The old ID does not grant access to records. Workspace API
controllers are removed; previously installed Mobile builds must be updated.

## Cutover

1. Build and test Mobile, Web and the backend.
2. Rehearse with `node backend/scripts/migrate-account-finances.cjs`. This runs
   SQL twice inside a transaction, verifies idempotency, then rolls back.
3. Stop the old backend to prevent legacy workspace writes during migration.
4. Run `node backend/scripts/migrate-account-finances.cjs --apply`.
5. Start the new backend and Web builds. Reload Expo and rebuild installed APKs.

`003_account_finances.sql` copies only unshared PHP workspace transactions to
account storage using the verified workspace owner. IDs, centavos, dates,
revisions and timestamps are preserved. Imported mutation keys are namespaced to
avoid collisions between legacy workspaces. Already-shared rows are not replayed:
subsequent account edits and deletions remain authoritative. The migration aborts
for shared ownership, non-PHP records, or conflicting IDs rather than guessing.

The old tables remain as an archive; no workspace, membership or transaction is
deleted. Do not reactivate legacy writers after cutover, as the archive will no
longer track new account edits. The migration is additive but switching clients
back to the legacy application would require a separate reconciliation.

The dry run on October 4, 2026 found two owner-only PHP workspaces, eight legacy
records, and six existing account records. It imported the remaining two and
verified a repeat run creates no duplicates.

Cutover was applied on October 4, 2026. The account service returned six records
for the former Peetah owner and two for the other owner, with ownership verified
for every returned record. Web and backend services were restarted successfully.

The GCP deployment was also updated: project `fwdp-474100`, VM
`fwdp-server-instance`, zone `asia-southeast1-c`. It uses the same database;
its migration check found eight account records and imported zero additional
rows. The staged backend suite passed 40 tests and the Web production build
passed before switching `save-backend`, `save-web` and `save-expo`.

The previous GCP source and application builds are retained at
`/var/www/html/save-project/deployment/account-finances-backup-20261003T221309Z`.
Public checks confirmed `/api/ledger/transactions` requires sign-in (401),
`/overview` redirects unauthenticated users to sign-in, old workspace links
redirect to `/overview`, and `/api/workspaces` is retired (404).

The final remote Android bundle smoke test was blocked by the tool approval
reviewer's usage limit. No device-level sign-in verification has been performed.

The local offline Android export subsequently passed: 2,514 modules bundled
successfully. Output: `/tmp/save-account-mobile-export`. This validates bundling,
but does not replace testing a signed-in session on an Android device.
