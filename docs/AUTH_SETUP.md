# SAVE authentication setup

The app now uses Supabase Auth for email/password, Google, and email magic links. MongoDB remains the financial-record database; Supabase is used for identity only. Provider configuration is not included in the repository and has not been performed by this change.

## Enable SAVE Web locally

The root `.env` belongs to Expo. Next.js reads `web/.env.local`; the API reads `backend/.env`. Restart both processes after changing configuration.

1. In Supabase, create/select your project. In its Connect/API settings, copy the Project URL and **publishable key** (a legacy anon key also works). Put both into `web/.env.local` and `backend/.env` as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Use the same project in both. Do not use a secret/service-role key.
2. Set `SAVE_WEB_URL=http://localhost:3002` and `SAVE_API_URL=http://localhost:3000` in `web/.env.local`.
3. In Supabase Authentication → URL Configuration, set the local Site URL to `http://localhost:3002` and allow both `http://localhost:3002/auth/callback` and `http://localhost:3002/auth/callback?next=reset-password`. For a shared production project, retain its production Site URL and add the localhost callback entries for local development.
4. In Google Cloud's Google Auth Platform, configure Branding, Audience and Data Access for basic email/profile. If the app is External and in Testing, add your Google account as a test user. Create an OAuth client of type **Web application**. Register the exact Supabase callback displayed in its Google provider settings: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. This is different from SAVE's `/auth/callback` URL. Register your application origin as `http://localhost:3002` if Google asks for authorized JavaScript origins.
5. In Supabase Authentication → Sign In / Providers → Google, enable Google and enter the Google client ID and client secret. Keep that secret in the provider dashboard; SAVE does not need it in its environment files.
6. Enable Email in Supabase. Leave the default `{{ .ConfirmationURL }}` links in confirmation, magic-link and recovery templates for the implemented PKCE callback flow. Open these links in the browser that requested them. Configure SMTP for production email delivery.
7. Run `npm run auth:check`. It checks configuration consistency and the public provider settings endpoint without printing keys or sending email. Then start the API with `npm --prefix backend run start:dev` and Web with `npm run web:dev`.
8. Open `http://localhost:3002/sign-in`, click Google, approve consent and return to workspace creation. Also verify registration/confirmation, email/password, email link, password reset and sign-out. A reachable MongoDB database is required for workspaces after successful sign-in.

Common errors: `redirect_uri_mismatch` means Google's redirect URI must match the Supabase callback exactly; “provider is not enabled” requires enabling Google in Supabase; an expired SAVE callback needs a fresh sign-in attempt in the original browser. Avoid switching between `localhost` and `127.0.0.1` during PKCE sign-in because their cookies differ.

Provider setup reference: [Supabase Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Configure the provider

1. Create or select a Supabase project. Set its public URL and publishable key in the two environment files below. Never put a service-role key in the client.
2. Enable email/password authentication, email confirmations, and magic links. Configure production SMTP, email templates, provider rate limits, and abuse protections before public launch.
3. Configure the Google provider using credentials from the Google Cloud project. Register the Supabase OAuth callback URL displayed in its dashboard with Google.
4. Allow SAVE callback URLs in Supabase's redirect allowlist: `saveproject:///auth/callback` for the native development build and the exact deployed `/auth/callback` URL for browser builds. Verify the actual `Linking.createURL('/auth/callback')` result for each native build configuration. Do not use an unrestricted production wildcard.
5. PKCE email links must be opened on the same device/browser that requested them. The app displays this instruction after sending an email. Expired or reused links should lead back to sign-in.
6. Rebuild the native development client after installing the new `expo-sharing` native dependency. Restart Metro after environment changes.

Root `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

`backend/.env`:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-public-key
SAVE_DEMO_MODE=false
```

The API verifies bearer tokens with the configured provider's `/auth/v1/user` endpoint. A missing/invalid session fails closed. Provider outages return a retryable service error. Private records are filtered by the verified user's ID; a body `userId` cannot override it. The `/users` administrative API additionally requires a trusted provider `app_metadata.role` of `admin`, provisioned by an operator. Users cannot grant themselves this role through onboarding.

## Existing data and compatibility

- Legacy `usr_2` demo transactions/budgets and ownerless categories/goals are **not automatically assigned** to a new account. Back up the database before an explicit operator-reviewed ownership migration; otherwise new accounts begin empty.
- The finance services no longer seed demo data or fall back to volatile memory on database errors. `SAVE_DEMO_MODE` only controls legacy users-service seeding/fallback and should stay false.
- Wallet public-ledger reads and verified-signature callbacks remain public. Preparing a request linked to a private savings tracker requires authentication and tracker ownership. A tracker is bound to its wallet address before preparation; ledger reconciliation updates through a wallet-filtered internal method.
- Public savings CRUD cannot set ledger proof, on-chain funded balance or completion status. Those values come from reconciliation.
- Native snapshots and pending writes are partitioned by account. Sign-out clears loaded state and snapshots; pending uploads remain partitioned by account to avoid losing an unsent transaction. They resume only for the same verified user. This is persistence, not an encrypted-database implementation.
- Browser preview uses account-specific localStorage, not Expo SQLite's WebAssembly implementation. It is not the planned Web product's durable multi-tab sync design.
- The existing `admin/` UI is a static prototype; it is not a working authenticated business or admin client.

## Required live qualification

With configured provider credentials and a reachable database, verify:

- Email registration/confirmation, password sign-in, sign-out, expired session, Google approval/cancellation, magic-link cold start and expired/reused links.
- Account A cannot read/edit/delete Account B's records, including directly addressed IDs.
- Sign-out during a refresh/upload cannot populate Account B's screen or upload A's queue under B's identity.
- Force a network disconnect after server commit but before response: retry the same transaction mutation ID and confirm exactly one server record.
- Kill and restart the app with queued records, reconnect, and confirm pending labels disappear only after acknowledgment.
- Capture a receipt, restart the app, and open the persisted image. Files currently remain device-local.
- Complete a Stellar Testnet linked-goal lifecycle with the external wallet and verify backend reconciliation. The contract itself has not changed.

References: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Supabase identity verification](https://supabase.com/docs/reference/javascript/auth-getuser), [Expo SDK 57 WebBrowser](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/).
