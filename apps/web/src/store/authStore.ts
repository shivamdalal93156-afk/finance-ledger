import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@khataclone/shared/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  isProfileChecked: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  fetchProfile: (userId: string) => Promise<Profile | null>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  isProfileChecked: false,

  setSession: (session) => {
    const prevSession = get().session
    
    if (session) {
      set({ session })
      if (session.user.id !== prevSession?.user?.id) {
        set({ isLoading: true })
        get().fetchProfile(session.user.id)
          .then((profile) => {
            set({ profile, isLoading: false, isProfileChecked: true })
          })
          .catch(() => {
            set({ profile: null, isLoading: false, isProfileChecked: true })
          })
      } else {
        set({ isLoading: false })
      }
    } else {
      set({ session: null, profile: null, isLoading: false, isProfileChecked: false })
    }
  },

  setProfile: (profile) => set({ profile, isProfileChecked: true }),

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[fetchProfile] Error fetching profile:', error)
        return null
      }
      return data as Profile | null
    } catch (err) {
      console.error('[fetchProfile] Unexpected error:', err)
      return null
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    await supabase.auth.signOut()
    set({ session: null, profile: null, isLoading: false, isProfileChecked: false })
  },
}))
