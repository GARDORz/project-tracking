# Project Tracking

## Stack

- `frontend/` — Vite + React + TypeScript + Tailwind CSS + React Router
- `backend/` — Fastify + TypeScript + Prisma + PostgreSQL, JWT auth (access + refresh)

## Setup

1. Start PostgreSQL: `docker-compose up -d`
2. Backend:
   ```
   cd backend
   cp .env.example .env
   npm install
   npm run prisma:migrate
   npm run dev
   ```
3. Frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```

Frontend dev server proxies `/api` requests to `http://localhost:3001`.
