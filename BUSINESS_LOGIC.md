# KhataClone — Business Logic & Edge Cases
> Give this to Windsurf at the start of Step 5 (Ledger Entries).
> These are real-world cases that MUST be handled correctly.

---

## CORE CONCEPT (never confuse this)

| Term | Meaning | Color |
|---|---|---|
| `credit` | You GAVE money/goods to customer (they owe YOU) | 🔴 Red |
| `debit` | Customer PAID you (reduces what they owe) | 🟢 Green |
| `balance > 0` | Customer owes you money | Show in red |
| `balance = 0` | All settled | Show green checkmark |
| `balance < 0` | You over-received (rare, you owe customer) | Show in orange |

---

## TRANSACTION CASES — ALL MUST WORK

### Case 1: Fresh customer, first borrow
- Customer has zero history
- Owner records a credit (gave ₹500)
- Balance becomes ₹500 (customer owes)
- ✅ Simple — just insert transaction

### Case 2: Customer pays back partially
- Balance was ₹500
- Owner records debit ₹200 (received)
- Balance becomes ₹300
- ✅ Running balance recalculated from all transactions

### Case 3: Customer pays back fully (settled)
- Balance was ₹300
- Owner records debit ₹300
- Balance becomes ₹0
- ✅ Show "Settled" badge on customer card
- ✅ Do NOT delete the transaction history

### Case 4: Customer borrows again after settling
- Balance was ₹0
- Customer takes goods again → owner records credit ₹800
- Balance becomes ₹800
- ✅ Normal — just a new credit transaction
- ✅ Full history still visible (old settled + new debt)

### Case 5: Customer overpays
- Balance was ₹200
- Customer pays ₹300 (overpaid ₹100)
- Balance becomes -₹100 (you owe them)
- ✅ Show negative balance in orange
- ✅ Label: "You owe ₹100 to [customer]"

### Case 6: Multiple borrows before any payment
- Day 1: credit ₹500
- Day 3: credit ₹200
- Day 7: credit ₹100
- Balance = ₹800
- ✅ Show all 3 entries in history
- ✅ Running balance shown per entry

### Case 7: Mixed history (multiple cycles)
- Borrow ₹500 → pay ₹500 → borrow ₹300 → pay ₹100 → borrow ₹200
- Balance = ₹400
- ✅ Full history visible, correct final balance
- ✅ Never reset/delete history between cycles

### Case 8: Account/customer deleted
- Owner deletes a customer
- ✅ Soft delete preferred (add `deleted_at` column, filter in queries)
- ✅ OR cascade delete (simpler — master doc uses this via FK ON DELETE CASCADE)
- ✅ If cascade: warn owner "This will delete all transaction history for [name]"
- ✅ Confirmation dialog required before delete

### Case 9: Editing a transaction
- Owner made a mistake (wrong amount)
- ✅ Allow edit of amount and note only
- ✅ Do NOT allow changing transaction type (credit↔debit) — delete and re-add instead
- ✅ Show "edited" indicator on modified entries

### Case 10: Adding transaction with past date
- Owner forgot to record something from 3 days ago
- ✅ Allow selecting any past date (not future)
- ✅ Sort transaction history by `entry_date`, not `created_at`
- ✅ Balance is always calculated from ALL transactions regardless of entry date

---

## BALANCE CALCULATION RULE

**Always calculate balance from ALL transactions — never store balance as a column.**

```typescript
// CORRECT — always recalculate
function getBalance(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => {
    return t.type === 'credit' ? sum + t.amount : sum - t.amount
  }, 0)
}

// WRONG — never do this
// UPDATE customers SET balance = balance + amount  ← race conditions, drift
```

---

## UI RULES FOR LEDGER

- Show transactions newest first (latest entry_date at top)
- Each row shows: date | note | amount (red for credit, green for debit)
- Running balance shown at top of customer page (big, prominent)
- "Settled" green badge when balance = 0
- Entry count shown: "23 entries"
- Empty state: "No transactions yet. Tap + to add first entry."

---

## CUSTOMER LIST RULES

- Sort by: highest balance first (most urgent to collect)
- Show balance on each customer card
- Settled customers (balance=0) go to bottom of list
- Search by customer name
- Total outstanding shown at top (sum of all positive balances)

---

## WHATSAPP REMINDER RULES

- Only show "Send Reminder" button if balance > 0
- If balance = 0, show "Settled ✓" instead
- If balance < 0, show "You owe them" — no reminder button
- Message format:
  ```
  Hi [Name], aapka [BusinessName] mein ₹[amount] baaki hai.
  Kripya jaldi bhugtan karein. Dhanyawad! 🙏
  ```

---

## EDGE CASES TO NEVER FORGET

| Scenario | Handle How |
|---|---|
| Customer has no phone number | Hide WhatsApp button, show "No phone added" |
| Amount entered as 0 | Validate — reject, show "Amount must be greater than 0" |
| Amount entered as negative | Validate — reject |
| Very large amount (₹99,99,999) | Allow, format with Indian number system (₹99,99,999) |
| Duplicate entry (same amount, same day) | Allow — owner may have given goods twice |
| Network failure during save | Show error toast, do NOT navigate away, let user retry |
| Session expired mid-use | Catch Supabase auth error, redirect to login gracefully |
| Two devices logged in same account | Supabase handles session — last write wins, no conflict |

---

## INDIAN NUMBER FORMAT

Always display amounts in Indian format:
```typescript
function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}
// ₹1,00,000 not ₹100,000
```

---

*Add this file to project root as `BUSINESS_LOGIC.md`*
*Reference it in every Step 4, 5, 6 session with Windsurf.*
