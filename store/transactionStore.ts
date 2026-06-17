import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { transactionSchema } from '../lib/shared/validators'
import type { Transaction } from '../lib/shared/types'
import type { z } from 'zod'

type TransactionInput = z.infer<typeof transactionSchema>

interface TransactionState {
  transactions: Record<string, Transaction[]> // customerId -> Transaction[]
  isLoading: boolean
  error: string | null
  fetchTransactions: (customerId: string) => Promise<void>
  fetchAllUserTransactions: () => Promise<void>
  addTransaction: (
    customerId: string,
    input: TransactionInput
  ) => Promise<Transaction | null>
  updateTransaction: (
    id: string,
    customerId: string,
    input: { amount: number; note?: string }
  ) => Promise<Transaction | null>
  deleteTransaction: (id: string, customerId: string) => Promise<boolean>
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: {},
  isLoading: false,
  error: null,

  fetchTransactions: async (customerId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      set((state) => ({
        transactions: {
          ...state.transactions,
          [customerId]: data as Transaction[],
        },
        isLoading: false,
      }))
    } catch (err: any) {
      console.error('[fetchTransactions] Error:', err)
      set({ error: err.message || 'Failed to load transactions', isLoading: false })
    }
  },

  fetchAllUserTransactions: async () => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) return

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const grouped: Record<string, Transaction[]> = {}
      const allTx = data as Transaction[]
      allTx.forEach((tx) => {
        if (!grouped[tx.customer_id]) {
          grouped[tx.customer_id] = []
        }
        grouped[tx.customer_id].push(tx)
      })

      set({ transactions: grouped, isLoading: false })
    } catch (err: any) {
      console.error('[fetchAllUserTransactions] Error:', err)
      set({ error: err.message || 'Failed to load all transactions', isLoading: false })
    }
  },

  addTransaction: async (customerId, input) => {
    const userId = useAuthStore.getState().session?.user?.id
    if (!userId) {
      set({ error: 'User not authenticated' })
      return null
    }

    set({ isLoading: true, error: null })
    try {
      const parseResult = transactionSchema.safeParse(input)
      if (!parseResult.success) {
        throw new Error(parseResult.error.errors[0]?.message || 'Invalid transaction details')
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          customer_id: customerId,
          type: parseResult.data.type,
          amount: parseResult.data.amount,
          note: parseResult.data.note || null,
          entry_date: parseResult.data.entry_date || new Date().toISOString().split('T')[0],
          is_edited: false,
        })
        .select()
        .single()

      if (error) throw error

      const newTx = data as Transaction
      set((state) => {
        const customerTx = state.transactions[customerId] || []
        const updatedTx = [newTx, ...customerTx].sort((a, b) => {
          const dateDiff = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
          if (dateDiff !== 0) return dateDiff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        return {
          transactions: {
            ...state.transactions,
            [customerId]: updatedTx,
          },
          isLoading: false,
        }
      })

      return newTx
    } catch (err: any) {
      console.error('[addTransaction] Error:', err)
      set({ error: err.message || 'Failed to add transaction', isLoading: false })
      return null
    }
  },

  updateTransaction: async (id, customerId, input) => {
    set({ isLoading: true, error: null })
    try {
      if (input.amount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({
          amount: input.amount,
          note: input.note || null,
          is_edited: true,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      const updatedTx = data as Transaction
      set((state) => {
        const customerTx = state.transactions[customerId] || []
        const updatedList = customerTx.map((t) => (t.id === id ? updatedTx : t))

        return {
          transactions: {
            ...state.transactions,
            [customerId]: updatedList,
          },
          isLoading: false,
        }
      })

      return updatedTx
    } catch (err: any) {
      console.error('[updateTransaction] Error:', err)
      set({ error: err.message || 'Failed to update transaction', isLoading: false })
      return null
    }
  },

  deleteTransaction: async (id, customerId) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error

      set((state) => {
        const customerTx = state.transactions[customerId] || []
        const updatedList = customerTx.filter((t) => t.id !== id)

        return {
          transactions: {
            ...state.transactions,
            [customerId]: updatedList,
          },
          isLoading: false,
        }
      })

      return true
    } catch (err: any) {
      console.error('[deleteTransaction] Error:', err)
      set({ error: err.message || 'Failed to delete transaction', isLoading: false })
      return false
    }
  },
}))
