import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

export interface SavedAccount {
  userId: string
  email: string
  profileName: string
  businessName: string
  avatarLetter: string
  session: string // JSON stringified session
}

interface AccountStore {
  savedAccounts: SavedAccount[]
  loadAccounts: () => Promise<void>
  saveAccount: (account: SavedAccount) => Promise<void>
  removeAccount: (userId: string) => Promise<void>
  updateAccountSession: (userId: string, sessionStr: string) => Promise<void>
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  savedAccounts: [],
  loadAccounts: async () => {
    try {
      const raw = await AsyncStorage.getItem('saved_accounts')
      const accounts = raw ? JSON.parse(raw) : []
      set({ savedAccounts: accounts })
    } catch (err) {
      console.error('[loadAccounts] Error loading accounts:', err)
      set({ savedAccounts: [] })
    }
  },
  saveAccount: async (account) => {
    try {
      const current = get().savedAccounts
      const filtered = current.filter(a => a.userId !== account.userId)
      const updated = [...filtered, account]
      await AsyncStorage.setItem('saved_accounts', JSON.stringify(updated))
      set({ savedAccounts: updated })
    } catch (err) {
      console.error('[saveAccount] Error saving account:', err)
    }
  },
  removeAccount: async (userId) => {
    try {
      const updated = get().savedAccounts.filter(a => a.userId !== userId)
      await AsyncStorage.setItem('saved_accounts', JSON.stringify(updated))
      set({ savedAccounts: updated })
    } catch (err) {
      console.error('[removeAccount] Error removing account:', err)
    }
  },
  updateAccountSession: async (userId, sessionStr) => {
    try {
      const current = get().savedAccounts
      const updated = current.map(a =>
        a.userId === userId ? { ...a, session: sessionStr } : a
      )
      await AsyncStorage.setItem('saved_accounts', JSON.stringify(updated))
      set({ savedAccounts: updated })
    } catch (err) {
      console.error('[updateAccountSession] Error:', err)
    }
  }
}))
