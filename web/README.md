# SAVE Web

The customer Web app lives separately from Expo mobile and the `admin/` prototype. It supports email/password, Google and email-link authentication; personal/business workspace creation and switching; shared personal PHP transactions, categories, monthly budgets and savings trackers; business-isolated transactions; period/search/type filters; pagination; transaction editing/deletion with revision checks; overview aggregates; reports and summary CSV export.

## Run locally

1. `npm --prefix web ci`
2. Copy `web/.env.example` to `web/.env.local` and configure the same Supabase project as the backend.
3. Set `SAVE_WEB_URL=http://localhost:3002` and `SAVE_API_URL=http://localhost:3000` locally. Use HTTPS deployment URLs in production.
4. Allow `http://localhost:3002/auth/callback` in Supabase's redirect allowlist. Configure Google and SMTP/email templates as described in `../docs/AUTH_SETUP.md`.
5. Configure `SUPABASE_DB_URL` in `backend/.env` and start the NestJS API: `npm --prefix backend run start:dev`.
6. Run `npm run auth:check` from the root to verify the Web/API project and enabled providers. See [Google and email setup](../docs/AUTH_SETUP.md#enable-save-web-locally).
7. From the repository root run `npm run web:dev`, then visit `http://localhost:3002`.

An unconfigured sign-in page explains availability and disables sign-in controls. There are no fake accounts or automatic financial seed records. Server-rendered pages and mutations use verified Supabase sessions, HttpOnly cookies, server actions and server-only API calls. The backend independently verifies bearer identity and workspace membership. Auth cookies and personalized responses must not be cached publicly.

## Data boundaries

The API is `/workspaces` with nested `/workspaces/:id/transactions` routes. Workspaces contain authoritative active/suspended memberships. Owners receive the owner role through creation; request bodies cannot supply membership or ownership. Personal-workspace uniqueness and create mutation IDs are enforced by Supabase Postgres constraints. Amounts use integer minor units with currency-specific precision. Transaction updates/deletes compare a revision and reject stale writes.

Personal PHP finance data is shared with SAVE Mobile. Personal workspace transaction endpoints use the same owner-scoped transaction records as Mobile; existing personal Web transaction records are copied idempotently on first access and retained in `workspace_transactions` with a migration marker. No records are deleted. Categories, budgets and savings goals use the same owner-scoped APIs as Mobile. Business transactions remain isolated in `workspace_transactions`; business workspaces do not expose personal budgets, categories or savings goals.

New personal workspaces are PHP-only because Mobile records personal finance amounts in PHP. Existing personal workspaces in another currency remain Web-only and display a warning; their amounts are not converted or relabeled. Business workspaces retain the supported multi-currency options.

This release supports business record tracking, not an approval workflow. Roles are enforced by the API, but member invitations and role administration are not yet exposed. Members can view/edit their own records, viewers cannot write, and owners/admins/finance roles can manage records in their workspace. The API does not allow self-service role escalation.

Still to implement: invitations, approvals/audit trail, private receipt upload, full transaction exports/import jobs, recurring schedules, and booking foreign-currency transactions with stored historical rates. Stellar signing and vault management remain Mobile workflows.

## Checks

- `npm run web:lint`
- `npm run web:typecheck`
- `npm run web:build`
- `npm --prefix backend test`
- `npm test` (includes Web amount and URL-filter tests)

Provider-dependent end-to-end qualification requires configured Supabase Auth and Postgres services. Browser fixture tests, if used, are separate from live-provider verification.

### Verification of this slice

Production build, Web/backend source lint, backend test suites and finance utility tests pass. A Chromium session against isolated local auth/API fixtures verified password sign-in, HttpOnly session cookies, personal/business creation and switching, transaction create/edit/delete, summary CSV and a 390px mobile viewport with no page overflow or browser runtime errors. These fixtures do not verify Google/email delivery, live Postgres constraints, or provider outages. Live-service integration and accessibility qualification remain release gates.

## Supported workspace currencies

Business workspaces can choose from PHP, USD, EUR, GBP, JPY, CNY, TWD (New Taiwan dollar / NTD), HKD, SGD, AUD, CAD, CHF, NZD, INR, KRW, AED, SAR, THB, MYR, IDR, VND, KWD and BHD. Personal workspaces use PHP so records remain correctly shared with Mobile.

A workspace uses one fixed currency. Transactions, summaries, forms and CSV exports use that currency and its minor-unit precision. JPY/KRW/VND accept whole units; KWD/BHD accept three decimals; the other supported currencies accept two. Excess decimals are rejected rather than rounded. Currency codes are displayed to distinguish currencies with similar symbols.

Currency cannot be changed after creation, so stored amounts cannot accidentally be relabeled as another currency. Reports can display a current-rate conversion estimate; original records and their workspace currency remain unchanged. Existing non-PHP personal workspaces are not automatically converted.

## Live exchange-rate conversion

In **Reports → Live currency conversion**, select the target currency. SAVE converts all filtered income/expense totals and can export a converted summary. The view refreshes every 60 seconds while open and displays the provider timestamp. CSV exports obtain a fresh eligible quote at download time, include the source/target currencies, rate and timestamp, and can differ from an earlier on-screen estimate.

Set `CURRENCYAPI_KEY` in `backend/.env`, then restart the API. Use a CurrencyAPI subscription providing minute-level updates. Its free plan updates daily and does not meet this feature's freshness requirement: https://currencyapi.com/docs/latest . The key stays on the API server.

Rates older than five minutes, future timestamps beyond clock tolerance, missing currencies, provider outages and quota failures stop conversion with an explicit error. No daily-rate fallback or invented rate is used. During market closures a provider may retain its last timestamp; this strict freshness policy may make conversion unavailable until fresh data resumes.

Amounts use decimal rational arithmetic, rounded to the target currency's minor unit. Net balance is converted income minus converted expenses, so the displayed totals reconcile. Category totals are rounded independently and may differ slightly from the overall expense total. Conversions are indicative current-rate estimates, including when viewing past months; they are not historical accounting restatements or executable bank quotes. Bank spreads and fees are not included. Transaction storage remains in the workspace currency; foreign-currency booking and locked transaction-date rates are follow-up work.

Validation: conversion arithmetic/cache/freshness/access tests, production build and lint pass. Isolated browser checks cover target selection, refresh, timestamp display, converted CSV metadata and outage recovery. A live configured-provider check confirmed TWD/CNY/KRW coverage but returned an older daily timestamp, which the freshness gate rejected. Minute-level provider access is still required to activate live conversions.

## SAVE Mobile data sync

Personal transaction, category, budget and savings-goal changes made on Web use the same authenticated API records read by Mobile. The Mobile finance provider refreshes transactions, categories and budgets every 30 seconds while active and when returning to the foreground. Savings goals refresh on the same cadence, when the Mobile savings screen opens or returns to the foreground, and when manually refreshed.

The first request to a PHP personal workspace also copies any pre-existing workspace transactions to the owner's Mobile transaction collection using the original transaction IDs and mutation IDs. The copy is idempotent and the original records remain available; backend state marks completed imports to avoid rescanning them. This migration is additive, not a currency conversion. Web budget spending is calculated from the same personal transaction records used by Mobile.
