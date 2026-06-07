import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { customerSchema } from '@khataclone/shared/validators'
import type { Customer } from '@khataclone/shared/types'
import type { z } from 'zod'

type CustomerInput = z.infer<typeof customerSchema>

interface CustomerState {
  customers: Customer[]
  isLoading: boolean
  error: string | null
  fetchCustomers: () => Promise<void>
  addCustomer: (input: CustomerInput) => Promise<Customer | null>
  updateCustomer: (id: string, input: CustomerInput) => Promise<Customer | null>
  deleteCustomer: (id: string) => Promise<boolean>
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetchCustomers: async () => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) {
      set({ error: 'User not authenticated' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })

      if (error) throw error

      set({ customers: data as Customer[], isLoading: false })
    } catch (err: any) {
      console.error('[fetchCustomers] Error:', err)
      set({ error: err.message || 'Failed to load customers', isLoading: false })
    }
  },

  addCustomer: async (input) => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) {
      set({ error: 'User not authenticated' })
      return null
    }

    set({ isLoading: true, error: null })
    try {
      const parseResult = customerSchema.safeParse(input)
      if (!parseResult.success) {
        throw new Error(parseResult.error.errors[0]?.message || 'Invalid customer details')
      }

      const { data, error } = await supabase
        .from('customers')
        .insert({
          user_id: userId,
          name: parseResult.data.name,
          phone: parseResult.data.phone || null,
          address: parseResult.data.address || null,
          notes: parseResult.data.notes || null,
        })
        .select()
        .single()

      if (error) throw error

      const newCustomer = data as Customer
      set((state) => ({
        customers: [...state.customers, newCustomer].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }))

      return newCustomer
    } catch (err: any) {
      console.error('[addCustomer] Error:', err)
      set({ error: err.message || 'Failed to add customer', isLoading: false })
      return null
    }
  },

  updateCustomer: async (id, input) => {
    set({ isLoading: true, error: null })
    try {
      const parseResult = customerSchema.safeParse(input)
      if (!parseResult.success) {
        throw new Error(parseResult.error.errors[0]?.message || 'Invalid customer details')
      }

      const { data, error } = await supabase
        .from('customers')
        .update({
          name: parseResult.data.name,
          phone: parseResult.data.phone || null,
          address: parseResult.data.address || null,
          notes: parseResult.data.notes || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      const updatedCustomer = data as Customer
      set((state) => ({
        customers: state.customers
          .map((c) => (c.id === id ? updatedCustomer : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }))

      return updatedCustomer
    } catch (err: any) {
      console.error('[updateCustomer] Error:', err)
      set({ error: err.message || 'Failed to update customer', isLoading: false })
      return null
    }
  },

  deleteCustomer: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error

      set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
        isLoading: false,
      }))

      return true
    } catch (err: any) {
      console.error('[deleteCustomer] Error:', err)
      set({ error: err.message || 'Failed to delete customer', isLoading: false })
      return false
    }
  },
}))
