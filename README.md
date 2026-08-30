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
- The Expo app can use environment variables as needed later for secure config.
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
