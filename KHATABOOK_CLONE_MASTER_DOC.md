# 📒 KhataClone — Master Architecture & Vibe Code Context Document
> **Read this entire document before writing a single line of code.**
> This document is the single source of truth. Every AI session, every new feature, every bug fix — start here.

---

## 1. PROJECT OVERVIEW

**App Name:** KhataClone (rename as needed)
**What it is:** A digital ledger app for small business owners to track money given (credit) and received (debit) from customers — like Khatabook.
**Target Users:** Shopkeepers, freelancers, small traders in India
**Platforms:** Web (React + Vite) + Mobile (React Native via Expo)
**Language:** TypeScript everywhere. No JavaScript files.

---

## 2. CORE FEATURES (Build in this exact order)

### Phase 1 — Foundation (Build First)
1. Auth — Phone OTP login (no email/password)
2. Business Profile — name, logo, UPI ID
3. Customer List — add/edit/delete customers
4. Ledger Entries — record "gave" (credit) and "received" (debit) per customer

### Phase 2 — Reminders & Reporting
5. Payment Reminders — WhatsApp deep link (free, no API needed — explained below)
6. Dashboard — total outstanding, who owes most, recent activity
7. Transaction History — filter by customer, date range

### Phase 3 — Advanced
8. Staff & Payroll — add staff, mark attendance, pay salary
9. PDF/Share Statement — generate and share customer statement
10. WhatsApp Entry Sync (future) — webhook that parses WhatsApp messages to auto-add entries

> ⚠️ DO NOT build Phase 2 or 3 until Phase 1 is fully working and tested.

---

## 3. TECH STACK

### Frontend — Web
| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Fast, easy to deploy |
| Language | TypeScript | Type safety, no runtime surprises |
| Styling | Tailwind CSS | Utility-first, consistent |
| State | Zustand | Simple, no boilerplate |
| Forms | React Hook Form + Zod | Validation without pain |
| Routing | React Router v6 | Standard |
| HTTP | Native fetch / React Query | No extra deps needed |

### Frontend — Mobile
| Layer | Choice | Reason |
|---|---|---|
| Framework | Expo (React Native) | Easiest to build + deploy, no Xcode hell |
| Language | TypeScript | Same as web |
| Styling | NativeWind (Tailwind for RN) | Consistent with web |
| State | Zustand (shared logic) | Same store logic as web |
| Navigation | Expo Router | File-based, simple |

### Backend
| Layer | Choice | Reason |
|---|---|---|
| Platform | Supabase | Postgres DB + Auth + Storage + Realtime, free tier, easy self-host |
| Auth | Supabase Auth (Phone OTP via Twilio) | Free for small scale |
| Database | PostgreSQL (via Supabase) | Relational, perfect for ledgers |
| Storage | Supabase Storage | Profile pics, business logos |
| Hosting (Web) | Vercel (free) | Auto-deploy from Git |
| Hosting (Backend) | Supabase cloud (free) OR self-host via Docker | Simple |

### Notifications
| Channel | Method | Cost |
|---|---|---|
| WhatsApp Reminder | WhatsApp deep link (`wa.me/91XXXXXXXXXX?text=...`) | **FREE — no API needed** |
| SMS (future) | Fast2SMS (cheapest in India) | Pay-per-use |

> ✅ WhatsApp deep link approach: When user taps "Send Reminder", app opens WhatsApp with pre-filled message. No API key. No cost. Works on both web and mobile.

---

## 4. FOLDER STRUCTURE

```
khataclone/
├── apps/
│   ├── web/                        # React + Vite web app
│   │   ├── src/
│   │   │   ├── components/         # Reusable UI components
│   │   │   ├── pages/              # Route-level pages
│   │   │   ├── store/              # Zustand stores
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   ├── lib/                # Supabase client, utils
│   │   │   ├── types/              # Shared TypeScript types
│   │   │   └── main.tsx
│   │   ├── .env.example            # Template — never commit .env
│   │   └── vite.config.ts
│   │
│   └── mobile/                     # Expo React Native app
│       ├── app/                    # Expo Router pages
│       ├── components/
│       ├── store/                  # Same Zustand logic as web
│       ├── lib/
│       └── app.json
│
├── packages/
│   └── shared/                     # Shared types, utils, validation schemas
│       ├── types/
│       └── validators/             # Zod schemas used by both web + mobile
│
├── supabase/
│   ├── migrations/                 # SQL migration files
│   └── seed.sql                    # Dev seed data
│
├── .env.example                    # Root env template
├── .gitignore
└── README.md
```

---

## 5. DATABASE SCHEMA

### Table: `users`
Managed by Supabase Auth. Extended via `profiles`.

### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT UNIQUE NOT NULL,
  upi_id TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `customers`
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `transactions`
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  -- credit = you gave money/goods to customer (they owe you)
  -- debit  = customer paid you (reduces what they owe)
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `staff`
```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  salary NUMERIC(10, 2),
  join_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `attendance`
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day')),
  UNIQUE(staff_id, date)
);
```

### Row Level Security (RLS) — REQUIRED ON ALL TABLES
```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy pattern (repeat for each table)
CREATE POLICY "Users can only access their own data"
ON customers FOR ALL
USING (auth.uid() = user_id);
```

> ⚠️ RLS MUST be enabled before going live. Never skip this.

---

## 6. ENVIRONMENT VARIABLES

### Web (`apps/web/.env`)
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Rules — NEVER BREAK THESE
- ❌ NEVER hardcode any API key, secret, or URL in source code
- ❌ NEVER commit `.env` files to Git
- ✅ ALWAYS use environment variables accessed via `import.meta.env.VITE_*` (web) or `process.env.EXPO_PUBLIC_*` (mobile)
- ✅ ALWAYS have a `.env.example` with placeholder values checked into Git
- ✅ Add `.env` to `.gitignore` on day one

---

## 7. SUPABASE CLIENT SETUP

### Web (`apps/web/src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Mobile (`apps/mobile/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

---

## 8. AUTH FLOW

1. User enters phone number → Supabase sends OTP via SMS
2. User enters OTP → Supabase returns session
3. On first login → redirect to "Setup Business Profile" page
4. On subsequent logins → redirect to Dashboard
5. Session is stored in `localStorage` (web) / `AsyncStorage` (mobile) by Supabase automatically

```typescript
// Send OTP
const { error } = await supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })

// Verify OTP
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+91XXXXXXXXXX',
  token: '123456',
  type: 'sms'
})
```

---

## 9. WHATSAPP REMINDER (FREE METHOD)

No API needed. Generate a deep link and open it:

```typescript
export function sendWhatsAppReminder(phone: string, customerName: string, amount: number, businessName: string) {
  const message = encodeURIComponent(
    `Hi ${customerName}, you have an outstanding balance of ₹${amount} with ${businessName}. Please clear it at your earliest. Thank you! 🙏`
  )
  const url = `https://wa.me/91${phone}?text=${message}`
  window.open(url, '_blank') // web
  // For mobile: use Linking.openURL(url) from expo-linking
}
```

> This opens WhatsApp on the user's device with the message pre-filled. User hits Send. Done. Free forever.

---

## 10. KEY BUSINESS LOGIC

### Calculate Customer Balance
```typescript
// Positive balance = customer owes you money
// Negative balance = you owe customer (overpaid)
export function calculateBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => {
    return t.type === 'credit' ? acc + t.amount : acc - t.amount
  }, 0)
}
```

### Dashboard Summary
```typescript
// Total you are owed across all customers
const totalReceivable = customers
  .filter(c => c.balance > 0)
  .reduce((sum, c) => sum + c.balance, 0)

// Total you owe (rare, but handle it)
const totalPayable = customers
  .filter(c => c.balance < 0)
  .reduce((sum, c) => sum + Math.abs(c.balance), 0)
```

---

## 11. UI DESIGN SYSTEM

### Colors
```css
--primary: #1a73e8;        /* Blue — trust, finance */
--primary-dark: #1557b0;
--success: #34a853;        /* Green — received/paid */
--danger: #ea4335;         /* Red — owed/credit given */
--neutral-50: #f8f9fa;
--neutral-900: #1a1a2e;
--text-primary: #202124;
--text-secondary: #5f6368;
```

### Key UI Rules
- Credit entries (gave money) → show in **red** with ↑ arrow
- Debit entries (received money) → show in **green** with ↓ arrow
- Positive balance = customer owes → show in red
- Zero balance = settled → show green checkmark
- All amounts prefixed with ₹
- Dates in `DD MMM YYYY` format (e.g. 05 Jun 2026)
- Phone numbers always stored with country code: `+91XXXXXXXXXX`

---

## 12. SECURITY CHECKLIST

Before every deployment, verify:
- [ ] RLS enabled on all Supabase tables
- [ ] No API keys in source code
- [ ] `.env` in `.gitignore`
- [ ] Supabase anon key is the **anon** key, not the **service_role** key
- [ ] Service role key NEVER used on client side — only in trusted server functions
- [ ] All user inputs validated with Zod before DB write
- [ ] Phone numbers sanitized (strip spaces, dashes, +91 prefix handling)
- [ ] No `console.log` with sensitive data in production builds

---

## 13. ERROR HANDLING RULES

- Every Supabase call must check for `error` and handle it
- Never swallow errors silently
- Show user-friendly toast/snackbar messages — not raw error objects
- Log errors to console in dev, silence in prod

```typescript
const { data, error } = await supabase.from('customers').insert(newCustomer)
if (error) {
  console.error('[addCustomer]', error)
  toast.error('Could not add customer. Please try again.')
  return
}
```

---

## 14. DEPLOYMENT PLAN

### Web
1. Push to GitHub
2. Connect repo to Vercel
3. Add env vars in Vercel dashboard
4. Deploy — done

### Mobile
1. `eas build --platform android` (Expo EAS — free tier available)
2. Download APK and test
3. For Play Store: `eas submit`

### Supabase
- Use Supabase cloud free tier to start
- For self-hosting: Supabase has an official Docker Compose setup
- Run migrations via: `supabase db push`

---

## 15. DEVELOPMENT PHASES — STEP BY STEP

### Step 1 — Project Setup
```bash
# Monorepo setup
mkdir khataclone && cd khataclone
npm init -y
# Create apps/web with Vite + React + TS
npm create vite@latest apps/web -- --template react-ts
# Create apps/mobile with Expo
npx create-expo-app apps/mobile --template blank-typescript
# Setup Supabase project at supabase.com
# Create supabase/migrations/ folder
```

### Step 2 — Database
- Write and run all SQL from Section 5
- Enable RLS on all tables
- Test with Supabase Table Editor

### Step 3 — Auth
- Build phone OTP screen
- Build "Setup Profile" screen (shown once after first login)
- Test login → profile → dashboard redirect

### Step 4 — Customer CRUD
- Customer list page
- Add customer form
- Customer detail page (empty ledger for now)

### Step 5 — Ledger Entries
- Add "gave" (credit) entry form
- Add "received" (debit) entry form
- Show transaction list per customer
- Show balance per customer

### Step 6 — Dashboard
- Total receivable/payable cards
- Recent transactions list
- Top debtors list

### Step 7 — WhatsApp Reminder
- "Send Reminder" button on customer page
- Use deep link method from Section 9

### Step 8 — Polish
- Loading states on all async operations
- Empty states (no customers, no transactions)
- Pull-to-refresh on mobile
- Offline indicator

---

## 16. WHAT TO SAY TO AI (CURSOR / LOVABLE PROMPT TEMPLATE)

When starting a new session, paste this:

> "I am building KhataClone, a Khatabook-style ledger app. Read KHATABOOK_CLONE_MASTER_DOC.md for full context. We are currently on [PHASE X / STEP Y]. Do NOT invent your own architecture — follow the document exactly. Do NOT hardcode any API keys or secrets. Use TypeScript strictly. Ask me before making any architectural decisions not covered in the document."

---

## 17. KNOWN PITFALLS — DO NOT DO THESE

| ❌ Don't | ✅ Do instead |
|---|---|
| Hardcode Supabase URL in code | Use env variables |
| Use `service_role` key on client | Use `anon` key on client only |
| Skip RLS "for now" | Enable RLS from day one |
| Mix `credit`/`debit` meaning | Follow Section 10 definitions exactly |
| Store phone without country code | Always store as `+91XXXXXXXXXX` |
| Use `any` TypeScript type | Define proper types in `packages/shared/types` |
| Build Phase 2 before Phase 1 works | Follow phase order strictly |
| Use WhatsApp Business API (paid) | Use free deep link method |
| Put logic in components | Put logic in hooks/store/lib |

---

## 18. FUTURE FEATURES (DO NOT BUILD NOW)

- WhatsApp bot integration (messages auto-add to ledger via webhook)
- Multi-language UI (Hindi, Tamil, Telugu etc.)
- GST invoice generation
- UPI payment integration
- Bank statement import
- Web dashboard for customers to view their own balance

---

*Last updated: June 2026 | Version 1.0*
