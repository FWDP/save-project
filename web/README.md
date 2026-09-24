# SAVE Web

The customer Web app lives separately from Expo mobile and the `admin/` prototype. This first implementation supports email/password, Google and email-link authentication; personal/business workspace creation and switching; workspace-isolated transactions; period/search/type filters; pagination; transaction editing/deletion with revision checks; overview aggregates; reports and summary CSV export.

## Run locally

1. `npm --prefix web ci`
2. Copy `web/.env.example` to `web/.env.local` and configure the same Supabase project as the backend.
3. Set `SAVE_WEB_URL=http://localhost:3002` and `SAVE_API_URL=http://localhost:3000` locally. Use HTTPS deployment URLs in production.
4. Allow `http://localhost:3002/auth/callback` in Supabase's redirect allowlist. Configure Google and SMTP/email templates as described in `../docs/AUTH_SETUP.md`.
5. Start MongoDB and the NestJS API: `npm --prefix backend run start:dev`.
6. Run `npm run auth:check` from the root to verify the Web/API project and enabled providers. See [Google and email setup](../docs/AUTH_SETUP.md#enable-save-web-locally).
7. From the repository root run `npm run web:dev`, then visit `http://localhost:3002`.

An unconfigured sign-in page explains availability and disables sign-in controls. There are no fake accounts or automatic financial seed records. Server-rendered pages and mutations use verified Supabase sessions, HttpOnly cookies, server actions and server-only API calls. The backend independently verifies bearer identity and workspace membership. Auth cookies and personalized responses must not be cached publicly.

## Data boundaries

The new API is `/workspaces` with nested `/workspaces/:id/transactions` routes. Workspaces contain authoritative active/suspended memberships. Owners receive the owner role through creation; request bodies cannot supply membership or ownership. Personal-workspace uniqueness and create mutation IDs are enforced by MongoDB indexes. Amounts use integer minor units with currency-specific precision. Transaction updates/deletes compare a revision and reject stale writes.

Workspace records live in a separate `workspace_transactions` collection. Existing mobile user-scoped records are left intact and **are not yet shared or migrated** into Web workspaces. Do not assume changing a workspace is just a view over the mobile database. The migration decision and follow-up work are documented in the implementation plan.

This release supports business record tracking, not an approval workflow. Roles are enforced by the API, but member invitations and role administration are not yet exposed. Members can view/edit their own records, viewers cannot write, and owners/admins/finance roles can manage records in their workspace. The API does not allow self-service role escalation.

Still to implement: approved migration/shared mobile workspace model, invitations, approvals/audit trail, budgets, savings, private receipt upload, full transaction exports/import jobs, recurring schedules, and booking foreign-currency transactions with stored historical rates. Only implemented destinations are included in navigation.

## Checks

- `npm run web:lint`
- `npm run web:typecheck`
- `npm run web:build`
- `npm --prefix backend test`
- `npm test` (includes Web amount and URL-filter tests)

Provider-dependent end-to-end qualification requires configured Supabase and MongoDB services. Browser fixture tests, if used, are separate from live-provider verification.

### Verification of this slice

Production build, Web/backend source lint, backend test suites and finance utility tests pass. A Chromium session against isolated local auth/API fixtures verified password sign-in, HttpOnly session cookies, personal/business creation and switching, transaction create/edit/delete, summary CSV and a 390px mobile viewport with no page overflow or browser runtime errors. These fixtures do not verify Google/email delivery, real MongoDB indexes, or provider outages. Live-service integration and accessibility qualification remain release gates.

## Supported workspace currencies

Choose the currency when creating a personal or business workspace: PHP, USD, EUR, GBP, JPY, CNY, TWD (New Taiwan dollar / NTD), HKD, SGD, AUD, CAD, CHF, NZD, INR, KRW, AED, SAR, THB, MYR, IDR, VND, KWD and BHD.

A workspace uses one fixed currency. Transactions, summaries, forms and CSV exports use that currency and its minor-unit precision. JPY/KRW/VND accept whole units; KWD/BHD accept three decimals; the other supported currencies accept two. Excess decimals are rejected rather than rounded. Currency codes are displayed to distinguish currencies with similar symbols.

Existing workspaces remain PHP. Currency cannot be changed after creation, so stored amounts cannot accidentally be relabeled as another currency. Reports can display a current-rate conversion estimate; original records and their workspace currency remain unchanged. Native mobile currency support and a shared-data migration remain separate follow-up work.

## Live exchange-rate conversion

In **Reports → Live currency conversion**, select the target currency. SAVE converts all filtered income/expense totals and can export a converted summary. The view refreshes every 60 seconds while open and displays the provider timestamp. CSV exports obtain a fresh eligible quote at download time, include the source/target currencies, rate and timestamp, and can differ from an earlier on-screen estimate.

Set `CURRENCYAPI_KEY` in `backend/.env`, then restart the API. Use a CurrencyAPI subscription providing minute-level updates. Its free plan updates daily and does not meet this feature's freshness requirement: https://currencyapi.com/docs/latest . The key stays on the API server.

Rates older than five minutes, future timestamps beyond clock tolerance, missing currencies, provider outages and quota failures stop conversion with an explicit error. No daily-rate fallback or invented rate is used. During market closures a provider may retain its last timestamp; this strict freshness policy may make conversion unavailable until fresh data resumes.

Amounts use decimal rational arithmetic, rounded to the target currency's minor unit. Net balance is converted income minus converted expenses, so the displayed totals reconcile. Category totals are rounded independently and may differ slightly from the overall expense total. Conversions are indicative current-rate estimates, including when viewing past months; they are not historical accounting restatements or executable bank quotes. Bank spreads and fees are not included. Transaction storage remains in the workspace currency; foreign-currency booking and locked transaction-date rates are follow-up work.

Validation: conversion arithmetic/cache/freshness/access tests, production build and lint pass. Isolated browser checks cover target selection, refresh, timestamp display, converted CSV metadata and outage recovery. A live configured-provider check confirmed TWD/CNY/KRW coverage but returned an older daily timestamp, which the freshness gate rejected. Minute-level provider access is still required to activate live conversions.
