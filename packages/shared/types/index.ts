export type TransactionType = 'credit' | 'debit'

export type AttendanceStatus = 'present' | 'absent' | 'half_day'

export interface Profile {
  id: string
  business_name: string
  owner_name: string | null
  phone: string
  upi_id: string | null
  logo_url: string | null
  created_at: string
}

export interface Customer {
  id: string
  user_id: string
  client_id?: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  is_syncing?: boolean
  is_failed?: boolean
  sync_error?: string
}

export interface Transaction {
  id: string
  user_id: string
  customer_id: string
  client_id?: string
  type: TransactionType
  amount: number
  note: string | null
  entry_date: string
  is_edited: boolean
  created_at: string
  is_syncing?: boolean
  is_failed?: boolean
  sync_error?: string
}

export interface Staff {
  id: string
  user_id: string
  name: string
  phone: string | null
  salary: number | null
  join_date: string | null
  created_at: string
}

export interface Attendance {
  id: string
  staff_id: string
  date: string
  status: AttendanceStatus
}

export interface CustomerWithBalance extends Customer {
  balance: number
}

export interface SalaryPayment {
  id: string
  staff_id: string
  user_id: string
  month: number
  year: number
  amount: number
  paid_at: string
}
