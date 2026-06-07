# KhataClone — Windsurf/Antigravity Handoff Document
> Paste this ENTIRE file as your FIRST message in Windsurf before asking anything.
> Do not skip any section.

---

## WHO YOU ARE AND WHAT WE ARE BUILDING

You are helping me build **KhataClone** — a Khatabook-style digital ledger app for small Indian business owners to track credit (gave money/goods) and debit (received payment) per customer.

**Platforms:** Web (React + Vite) + Mobile (Expo React Native)
**Language:** TypeScript everywhere. No `.js` files, no `any` types.
**Full architecture is in:** `KHATABOOK_CLONE_MASTER_DOC.md` — read it before doing anything.

---

## CURRENT PROJECT STATUS

| Step | Status |
|---|---|
| Step 1 — Monorepo scaffold (Vite web + Expo mobile + shared package) | ✅ DONE |
| Step 2 — Supabase DB migrations + RLS policies | ✅ DONE |
| Step 3 — Phone OTP auth + business profile | ⏳ NOT STARTED — start here |

---

## WHAT HAS BEEN BUILT SO FAR

### Folder structure (already exists on disk)
```
Khatabook/
├── apps/
│   ├── web/          React 19 + Vite + Tailwind v3 + React Router + Zustand + React Query
│   └── mobile/       Expo 56 + Expo Router + NativeWind + Zustand
├── packages/
│   └── shared/       Zod validators, TypeScript types, utils (balance calc, WhatsApp link, currency)
├── supabase/
│   ├── migrations/   20240605000000_initial_schema.sql (already run on Supabase)
│   └── seed.sql
├── .env.example
├── .gitignore
└── KHATABOOK_CLONE_MASTER_DOC.md
```

### Database (already live on Supabase)
These 5 tables exist with RLS enabled:
- `profiles` — extends auth.users, stores business name, phone, UPI ID, logo
- `customers` — belongs to a user, has name + phone
- `transactions` — credit/debit entries per customer
- `staff` — employees of the business owner
- `attendance` — daily attendance per staff member

### Supabase client (already set up)
- Web: `apps/web/src/lib/supabase.ts` — uses `import.meta.env.VITE_SUPABASE_*`
- Mobile: `apps/mobile/lib/supabase.ts` — uses `process.env.EXPO_PUBLIC_*` + AsyncStorage

### Env files (already configured, keys in place)
- `apps/web/.env` — has real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- `apps/mobile/.env` — has real EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
- Both `.env` files are gitignored ✅

---

## STEP 3 — WHAT YOU NEED TO BUILD NOW

### Goal
Build phone OTP authentication and first-time business profile setup.

### Flow
1. App opens → check if user session exists
2. No session → show **Phone Login Screen**
   - Input: phone number (Indian format, auto-prefix +91)
   - Button: "Send OTP"
   - Calls: `supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })`
3. OTP sent → show **OTP Verify Screen**
   - Input: 6-digit OTP
   - Button: "Verify"
   - Calls: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
4. OTP verified → check if `profiles` row exists for this user
   - No profile → redirect to **Setup Business Profile Screen**
   - Profile exists → redirect to **Dashboard** (placeholder for now)
5. **Setup Business Profile Screen**
   - Fields: Business Name (required), Owner Name, UPI ID
   - On submit → INSERT into `profiles` table
   - Redirect to Dashboard after save

### Files to create/modify

**Web (`apps/web/src/`):**
- `pages/LoginPage.tsx` — phone input + OTP verify (two states in one page)
- `pages/SetupProfilePage.tsx` — business profile form
- `pages/DashboardPage.tsx` — placeholder only ("Dashboard coming in Step 6")
- `store/authStore.ts` — Zustand store for session + profile state
- `hooks/useAuth.ts` — hook that wraps Supabase auth calls
- Update `App.tsx` / router to handle auth redirects

**Mobile (`apps/mobile/app/`):**
- `(auth)/login.tsx` — phone + OTP screens
- `(auth)/setup-profile.tsx` — business profile form
- `(tabs)/index.tsx` — placeholder dashboard
- `store/authStore.ts` — same logic as web store
- Update `app/_layout.tsx` to redirect based on auth state

---

## HARD RULES — NEVER BREAK THESE

1. ❌ NEVER hardcode any API key, URL, or secret in source code
2. ❌ NEVER use `any` TypeScript type
3. ❌ NEVER skip RLS — it's already enabled, don't disable it
4. ❌ NEVER use the `service_role` key on the client
5. ❌ NEVER build Step 4+ until Step 3 is fully working
6. ✅ ALWAYS validate user inputs with Zod before any DB call
7. ✅ ALWAYS handle Supabase errors — never swallow silently
8. ✅ ALWAYS show user-friendly error messages (toast/alert)
9. ✅ Phone numbers stored as `+91XXXXXXXXXX` format in DB
10. ✅ Ask before making any architectural decision not in the master doc

---

## DESIGN TOKENS (use these exact values)

```
Primary blue:   #1a73e8
Success green:  #34a853
Danger red:     #ea4335
Neutral bg:     #f8f9fa
Text primary:   #202124
Text secondary: #5f6368
```

- Credit entries (gave) → red
- Debit entries (received) → green
- All amounts → ₹ prefix
- Dates → DD MMM YYYY format

---

## HOW TO RUN THE PROJECT

```bash
# From project root
npm install

# Web (http://localhost:5173)
npm run dev:web

# Mobile (Expo Go)
npm run dev:mobile
```

---

## WHAT TO DO WHEN YOU START

1. Read `KHATABOOK_CLONE_MASTER_DOC.md` fully
2. Read this handoff document fully
3. Confirm you understand the current state
4. Ask me if anything is unclear BEFORE writing code
5. Then build Step 3 as described above

---

## AFTER STEP 3 IS DONE

Reply with a summary of what was built and any issues found.
Next steps in order: Step 4 (Customer CRUD) → Step 5 (Ledger entries) → Step 6 (Dashboard)

---

*Handoff created: June 2026*
