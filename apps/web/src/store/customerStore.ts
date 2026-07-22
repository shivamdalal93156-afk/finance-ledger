import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { customerSchema } from '@khataclone/shared/validators'
import type { Customer } from '@khataclone/shared/types'
import type { z } from 'zod'
import { enqueueItem, generateUUID, onSyncSuccess, onSyncFailure } from '../lib/syncQueue'

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

      const client_id = generateUUID()
      const newCustomer: Customer = {
        id: client_id,
        user_id: userId,
        client_id: client_id,
        name: parseResult.data.name,
        phone: parseResult.data.phone || null,
        address: parseResult.data.address || null,
        notes: parseResult.data.notes || null,
        created_at: new Date().toISOString(),
        is_syncing: true,
      }

      set((state) => ({
        customers: [...state.customers, newCustomer].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }))

      const payload = {
        user_id: userId,
        client_id: client_id,
        name: parseResult.data.name,
        phone: parseResult.data.phone || null,
        address: parseResult.data.address || null,
        notes: parseResult.data.notes || null,
      }

      await enqueueItem('customer', payload)

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

// Listen for sync queue success events
onSyncSuccess((type, client_id, syncedData) => {
  if (type !== 'customer') return
  useCustomerStore.setState((state) => ({
    customers: state.customers
      .map((c) => {
        if (c.client_id === client_id || c.id === client_id) {
          return {
            ...c,
            ...syncedData,
            is_syncing: false,
          }
        }
        return c
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
})

// Listen for sync queue failure events (permanent errors)
onSyncFailure((type, client_id, errorMessage) => {
  if (type !== 'customer') return
  useCustomerStore.setState((state) => ({
    customers: state.customers
      .map((c) => {
        if (c.client_id === client_id || c.id === client_id) {
          return {
            ...c,
            is_syncing: false,
            is_failed: true,
            sync_error: errorMessage,
          }
        }
        return c
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
})

