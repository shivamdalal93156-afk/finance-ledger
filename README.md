# Finance Ledger (KhataClone)

A Khatabook-style digital ledger for small business owners to track credit, debit, customers, and staff attendance/salary.

**Platforms:** Web (React + Vite) · Mobile (Expo + React Native) · Telegram Bot (Node.js)

## Monorepo Structure

```text
apps/
  web/             # React + Vite + Tailwind web app
  mobile/          # Expo + NativeWind + Expo Router mobile app
bot/               # Telegram bot for account status & undo helpers
packages/
  shared/          # Shared types, Zod validators, and utilities
supabase/          # SQL migrations and seed data
```

## Prerequisites

- Node.js 20+
- npm 10+
- A [Supabase](https://supabase.com) project

## Setup

1. Install workspace dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables from the templates:
   ```bash
   cp apps/web/.env.example apps/web/.env
   cp bot/.env.example bot/.env
   ```
   Fill in your Supabase URL/keys, `BOT_TOKEN`, and `AUTHORIZED_CHAT_ID` in the `.env` files.

## Development

```bash
# Web (http://localhost:5173)
npm run dev:web

# Mobile (Expo)
npm run dev:mobile

# Telegram Bot
cd bot && npm install && npm start
```

## Build

```bash
npm run build:web
```

## Database Migrations

Migrations live in `supabase/migrations/`. Apply them via the Supabase SQL Editor or Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```
