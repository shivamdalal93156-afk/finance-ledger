# KhataClone Mobile — Khatabook UI Implementation Plan

## Phase 1 — Color Theme Update
Change all colors to match Khatabook:
- Primary: #1a3c6e (dark navy blue)
- Secondary: #0d47a1
- Accent: #1565c0
- Background: #f5f7fa
- Text primary: #1a1a1a
- Text secondary: #666666
- Success/Credit: #2e7d32 (dark green)
- Danger/Debit: #c62828 (dark red)

Files to update:
- apps/mobile/global.css — update all color variables
- apps/mobile/nativewind-env.d.ts — if color tokens defined here

## Phase 2 — Calendar Picker Replacement
Replace the current scroll-based CustomDatePicker (Day/Month/Year columns) 
with a grid calendar picker matching Khatabook style.

New calendar features:
- Month grid view (S M T W T F S columns)
- Previous/Next month navigation arrows
- Selected date highlighted in dark blue circle
- Today's date highlighted differently
- Header shows: "Month Year" (e.g. "June 2026")
- OK, CANCEL, REMOVE buttons at bottom
- White modal on dark overlay background

Files to update:
- apps/mobile/app/customer/[id].tsx — From Date, To Date pickers
- apps/mobile/app/customer/add-entry.tsx — Entry Date picker

## Phase 3 — PDF Reports Screen
Create new screen matching Khatabook Reports exactly.

### Screen: Reports List (apps/mobile/app/reports/index.tsx)
- Dark blue header "View Reports"
- Tab bar: All | Customer | Bills | GST | Day-wise (scrollable)
- Default tab: Customer
- Customer section shows:
  1. "Customer Transactions report" — Summary of all customer transactions
  2. "Customer list pdf" — List of all Customers
- Each item has icon + title + subtitle + arrow chevron
- Light grey background

### Screen: Customer Transactions Report (apps/mobile/app/reports/customer-transactions.tsx)
Matching Khatabook exactly:
- Dark blue header "View Report" with back arrow
- START DATE and END DATE buttons with calendar icon
- When tapped — grid calendar picker opens
- Search bar + ALL dropdown filter
- Results show:
  - Net Balance (red if debit, green if credit)
  - Total entries count
  - YOU GAVE / YOU GOT columns
  - Each row: Customer name, date, amount
- DOWNLOAD button at bottom (dark blue, full width)
- PDF generated with:
  - Header: phone number + Khatabook logo style
  - Title: Account Statement
  - Date range shown
  - Table: Date | Name | Details | Debit(-) | Credit(+)
  - Grand Total row
  - Footer: Report Generated timestamp

### Screen: Customer List PDF (apps/mobile/app/reports/customer-list.tsx)  
- List of all customers with balance
- DOWNLOAD button generates PDF

## Phase 4 — Dashboard Reports Button
Add "View Reports" button/link on dashboard screen linking to reports screen.

## Implementation Order
1. Phase 2 (Calendar) — standalone, no dependencies
2. Phase 3 (Reports screens) — new files, no risk to existing code
3. Phase 1 (Colors) — last, after everything works
4. Phase 4 (Dashboard link) — quick addition

## Libraries Needed
- expo-print — for PDF generation
- expo-sharing — for sharing/downloading PDF
- expo-file-system — for saving PDF

Install command:
npx expo install expo-print expo-sharing expo-file-system
