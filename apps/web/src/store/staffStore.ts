import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import type { Staff, Attendance, AttendanceStatus, SalaryPayment } from '@khataclone/shared/types'

interface StaffState {
  staff: Staff[]
  attendance: Record<string, Record<string, Attendance>> // date -> { staffId -> Attendance }
  salaryPayments: Record<string, SalaryPayment[]> // staffId -> SalaryPayment[]
  isLoading: boolean
  error: string | null
  fetchStaff: () => Promise<void>
  addStaff: (
    name: string,
    phone?: string,
    salary?: number,
    joinDate?: string
  ) => Promise<Staff | null>
  updateStaff: (
    id: string,
    updates: {
      name: string
      phone?: string
      salary?: number
      joinDate?: string
    }
  ) => Promise<Staff | null>
  deleteStaff: (id: string) => Promise<boolean>
  fetchAttendance: (date: string) => Promise<void>
  fetchEmployeeAttendance: (staffId: string) => Promise<void>
  markAttendance: (
    staffId: string,
    date: string,
    status: AttendanceStatus
  ) => Promise<Attendance | null>
  fetchSalaryPayments: (staffId: string) => Promise<void>
  paySalary: (
    staffId: string,
    month: number,
    year: number,
    amount: number
  ) => Promise<SalaryPayment | null>
}

export const useStaffStore = create<StaffState>((set) => ({
  staff: [],
  attendance: {},
  salaryPayments: {},
  isLoading: false,
  error: null,

  fetchStaff: async () => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) {
      set({ error: 'User not authenticated' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })

      if (error) throw error

      set({ staff: data as Staff[], isLoading: false })
    } catch (err: any) {
      console.error('[fetchStaff] Error:', err)
      set({ error: err.message || 'Failed to load staff list', isLoading: false })
    }
  },

  addStaff: async (name, phone, salary, joinDate) => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) {
      set({ error: 'User not authenticated' })
      return null
    }

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({
          user_id: userId,
          name,
          phone: phone || null,
          salary: salary || null,
          join_date: joinDate || null,
        })
        .select()
        .single()

      if (error) throw error

      const newStaff = data as Staff
      set((state) => ({
        staff: [...state.staff, newStaff].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }))

      return newStaff
    } catch (err: any) {
      console.error('[addStaff] Error:', err)
      set({ error: err.message || 'Failed to add employee', isLoading: false })
      return null
    }
  },

  updateStaff: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('staff')
        .update({
          name: updates.name,
          phone: updates.phone || null,
          salary: updates.salary !== undefined ? updates.salary : null,
          join_date: updates.joinDate || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      const updated = data as Staff
      set((state) => ({
        staff: state.staff.map((s) => (s.id === id ? updated : s)),
        isLoading: false,
      }))
      return updated
    } catch (err: any) {
      console.error('[updateStaff] Error:', err)
      set({ error: err.message || 'Failed to update employee details', isLoading: false })
      return null
    }
  },

  deleteStaff: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)

      if (error) throw error

      set((state) => ({
        staff: state.staff.filter((s) => s.id !== id),
        isLoading: false,
      }))

      return true
    } catch (err: any) {
      console.error('[deleteStaff] Error:', err)
      set({ error: err.message || 'Failed to delete employee', isLoading: false })
      return false
    }
  },

  fetchAttendance: async (date) => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) return

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, staff!inner(*)')
        .eq('date', date)
        .eq('staff.user_id', userId)

      if (error) throw error

      const dayMap: Record<string, Attendance> = {}
      const rows = data as (Attendance & { staff: Staff })[]
      rows.forEach((row) => {
        dayMap[row.staff_id] = {
          id: row.id,
          staff_id: row.staff_id,
          date: row.date,
          status: row.status,
        }
      })

      set((state) => ({
        attendance: {
          ...state.attendance,
          [date]: dayMap,
        },
        isLoading: false,
      }))
    } catch (err: any) {
      console.error('[fetchAttendance] Error:', err)
      set({ error: err.message || 'Failed to load attendance records', isLoading: false })
    }
  },

  markAttendance: async (staffId, date, status) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('attendance')
        .upsert(
          { staff_id: staffId, date, status },
          { onConflict: 'staff_id,date' }
        )
        .select()
        .single()

      if (error) throw error

      const newRecord = data as Attendance
      set((state) => {
        const dayMap = state.attendance[date] || {}
        return {
          attendance: {
            ...state.attendance,
            [date]: {
              ...dayMap,
              [staffId]: newRecord,
            },
          },
          isLoading: false,
        }
      })

      return newRecord
    } catch (err: any) {
      console.error('[markAttendance] Error:', err)
      set({ error: err.message || 'Failed to record attendance', isLoading: false })
      return null
    }
  },

  fetchEmployeeAttendance: async (staffId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staffId)

      if (error) throw error

      const rows = data as Attendance[]
      set((state) => {
        const newAttendance = { ...state.attendance }
        rows.forEach((row) => {
          if (!newAttendance[row.date]) {
            newAttendance[row.date] = {}
          }
          newAttendance[row.date][staffId] = row
        })
        return {
          attendance: newAttendance,
          isLoading: false,
        }
      })
    } catch (err: any) {
      console.error('[fetchEmployeeAttendance] Error:', err)
      set({ error: err.message || 'Failed to load employee attendance history', isLoading: false })
    }
  },

  fetchSalaryPayments: async (staffId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('staff_id', staffId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (error) throw error

      set((state) => ({
        salaryPayments: {
          ...state.salaryPayments,
          [staffId]: data as SalaryPayment[],
        },
        isLoading: false,
      }))
    } catch (err: any) {
      console.error('[fetchSalaryPayments] Error:', err)
      set({ error: err.message || 'Failed to load salary payments history', isLoading: false })
    }
  },

  paySalary: async (staffId, month, year, amount) => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) {
      set({ error: 'User not authenticated' })
      return null
    }

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .insert({
          staff_id: staffId,
          user_id: userId,
          month,
          year,
          amount,
        })
        .select()
        .single()

      if (error) throw error

      const newPayment = data as SalaryPayment
      set((state) => {
        const payments = state.salaryPayments[staffId] || []
        return {
          salaryPayments: {
            ...state.salaryPayments,
            [staffId]: [newPayment, ...payments].sort((a, b) => {
              if (b.year !== a.year) return b.year - a.year
              return b.month - a.month
            }),
          },
          isLoading: false,
        }
      })

      return newPayment
    } catch (err: any) {
      console.error('[paySalary] Error:', err)
      set({ error: err.message || 'Failed to record salary payment', isLoading: false })
      return null
    }
  },
}))
