
# Project Setup

## Backend (NestJS)
- **Port**: 3000
- **Database**: PostgreSQL (Prisma)
- **Auth**: JWT (Access/Refresh), RBAC (Admin/User)
- **Features**: Rate Limiting, Soft Delete, Task Management

### Setup
1. `npm install`
2. `npx prisma generate`
3. `npx prisma db push`
4. `npm run start:dev`

## Frontend (React + Vite)
- **Port**: 5173
- **Credentials**: Register a new user. Default role is USER. Admin role can be assigned in DB.
- **Styling**: TailwindCSS with premium glassmorphism design.

### Setup
1. `cd client`
2. `npm install`
3. `npm run dev`

## Notes
- Ensure your database is running. Check `.env` for `DATABASE_URL`.
- Since we downgraded to Prisma 5 for stability, ensure your `DATABASE_URL` uses `postgresql://` protocol.
