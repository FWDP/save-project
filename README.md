# SAVE Project

This project includes:

- Expo mobile app for Android/iOS
- NestJS backend API
- Next.js admin dashboard
- MongoDB for primary data persistence
- Redis for cache and queues
- MinIO for object storage
- Docker Compose for local services

## Quick start

1. Install root app dependencies:

   ```bash
   npm install
   ```

2. Install backend dependencies:

   ```bash
   cd backend && npm install
   ```

3. Install admin dashboard dependencies:

   ```bash
   cd admin && npm install
   ```

4. Start local services:

   ```bash
   docker compose up -d
   ```

5. Start the backend:

   ```bash
   cd backend && npm run start:dev
   ```

6. Start the admin dashboard:

   ```bash
   cd admin && npm run dev
   ```

7. Start the Expo app:

   ```bash
   npm start
   ```

## Environment files

- Copy `backend/.env.example` to `backend/.env` and update values as needed.
- Copy `.env.example` to `.env` for the Expo app. WalletConnect values prefixed
  with `EXPO_PUBLIC_` are public app configuration, not wallet secrets.
- The admin app can use its own local `.env.local` file for API URLs and secrets.

## Stack summary

- Mobile: React Native + Expo
- Language: TypeScript
- Navigation: Expo Router
- State management: Zustand + TanStack Query
- Local storage: SQLite + SecureStore + FileSystem + Camera
- Backend: NestJS + MongoDB + Redis + BullMQ
- Object storage: MinIO / S3-compatible storage
- Web/admin: Next.js dashboard for operations and analytics

## Stellar Testnet and Soroban

SAVE uses a non-custodial architecture: the mobile app links a public Testnet address, the backend reads Horizon/RPC data and prepares unsigned XDR, and a compatible external wallet approves signatures. Secret seeds are never accepted by the API.

- Mobile route: `/stellar`
- Backend endpoints: `/stellar/network`, `/stellar/accounts`, `/stellar/payments`, `/stellar/vault`, `/stellar/transactions`
- Contract source: `contract/savings-vault`
- Contract specification and deployment: `docs/CONTRACT.md`

Run `npm run contract:test` and `npm run contract:build` before deployment. Actual Testnet deployment requires an operator-owned funded Stellar CLI identity and setting `STELLAR_VAULT_CONTRACT_ID` in `backend/.env`.

### Freighter Mobile signing

The app uses WalletConnect v2 to request `stellar_signXDR` approval from
Freighter Mobile. SEP-7 and copied unsigned XDR remain available as manual
fallbacks.

1. Create a dApp project at the [WalletConnect dashboard](https://dashboard.walletconnect.com/).
2. Copy `.env.example` to `.env` and set:

   ```dotenv
   EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID=your_public_project_id
   # Optional until SAVE has a public website:
   EXPO_PUBLIC_WALLETCONNECT_METADATA_URL=
   ```

   When omitted, the app uses the SAVE GitHub repository as temporary metadata.
   For production, set this to a public HTTPS page identifying the app and add
   the same origin to the WalletConnect project allowlist when enabled.

3. Install Freighter Mobile, import or create a dedicated **Testnet-only**
   account, and switch Freighter to Testnet. Never enter its secret seed in
   SAVE or the backend.
4. Fully restart Metro after changing `.env`:

   ```bash
   npx expo start -c
   ```

5. Open **More → Stellar Testnet → Connect Freighter Mobile**. Approve the
   WalletConnect session, create a savings goal, then fund it. Freighter shows
   the XDR approval; SAVE submits the signed XDR and displays the ledger
   confirmation and updated goal balance.

For native testing, use an Expo development build (`npm run android` or an EAS
development build). Keep the backend reachable from the phone and point the
app's API URL at the computer's LAN address rather than `localhost`.
