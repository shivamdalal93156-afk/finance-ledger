# KhataClone

A Khatabook-style digital ledger for small business owners — track credit (gave) and debit (received) per customer.

**Platforms:** Web (React + Vite) · Mobile (Expo + React Native)

## Monorepo structure

```
apps/web/          → React + Vite + Tailwind
apps/mobile/       → Expo + NativeWind + Expo Router
packages/shared/   → Shared types, Zod validators, utils
supabase/          → SQL migrations + seed data
```

## Prerequisites

- Node.js 20+
- npm 10+
- [Supabase](https://supabase.com) project (create in Step 2)

## Setup

```bash
# Install all workspace dependencies
npm install

# Web — copy env template and add your Supabase keys
cp apps/web/.env.example apps/web/.env

# Mobile — copy env template and add your Supabase keys
cp apps/mobile/.env.example apps/mobile/.env
```

## Development

```bash
# Web (http://localhost:5173)
npm run dev:web

# Mobile (Expo Go / emulator)
npm run dev:mobile
```

## Build

```bash
npm run build:web
```

## Database migrations (Step 2)

Migration file: `supabase/migrations/20240605000000_initial_schema.sql`

**Option A — Supabase Dashboard (easiest)**

1. Open your project → **SQL Editor** → **New query**
2. Paste the full contents of the migration file
3. Click **Run**
4. Confirm tables appear under **Table Editor**: `profiles`, `customers`, `transactions`, `staff`, `attendance`

**Option B — Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Architecture

See [KHATABOOK_CLONE_MASTER_DOC.md](./KHATABOOK_CLONE_MASTER_DOC.md) for the full architecture, schema, and phase plan.

### Current progress

- [x] **Step 1** — Project setup (monorepo, web, mobile, shared package)
- [x] **Step 2** — Database migrations written (run on Supabase — see below)
- [ ] **Step 3** — Phone OTP auth + business profile
- [ ] **Step 4** — Customer CRUD
- [ ] **Step 5** — Ledger entries
