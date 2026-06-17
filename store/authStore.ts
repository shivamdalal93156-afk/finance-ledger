import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../lib/shared/types'
import { useAccountStore } from './accountStore'
import AsyncStorage from '@react-native-async-storage/async-storage'

const saveAccountHelper = (session: Session | null, profile: Profile | null) => {
  if (session && profile) {
    const avatar = (profile.business_name || profile.owner_name || session.user.email || '?')
      .charAt(0)
      .toUpperCase()
    useAccountStore.getState().saveAccount({
      userId: session.user.id,
      email: session.user.email || '',
      profileName: profile.owner_name || '',
      businessName: profile.business_name || '',
      avatarLetter: avatar,
      session: JSON.stringify(session)
    })
  }
}

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

let isFetchingProfile = false

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: false,
  isProfileChecked: false,

  setSession: (session) => {
    console.log('[AUTH] setSession called, userId:', session?.user?.id)
    if (!session) {
      set({ session: null, profile: null, isLoading: false })
      return
    }

    const prevSession = get().session
    const isProfileChecked = get().isProfileChecked
    
    set({ session })
    if (session.user.id !== prevSession?.user?.id || !isProfileChecked) {
      console.log('[AUTH] isFetchingProfile:', isFetchingProfile)
      if (isFetchingProfile) {
        return
      }
      isFetchingProfile = true
      console.log('[AUTH] fetchProfile starting')
      set({ isLoading: true })
      const profileTimeout = setTimeout(() => {
        set({ isLoading: false })
      }, 5000)

      get().fetchProfile(session.user.id)
        .then((profile) => {
          clearTimeout(profileTimeout)
          console.log('[AUTH] fetchProfile result:', JSON.stringify(profile))
          console.log('[AUTH] isLoading set to false')
          if (get().session?.user?.id === session.user.id) {
            set({ profile, isLoading: false, isProfileChecked: true })
            saveAccountHelper(session, profile)
            // Load linked accounts into accountStore
            const phone = session.user.email?.replace('u', '').replace('@khataclone.dev', '') || ''

            const loadLinked = async () => {
              try {
                const mainPhone = await AsyncStorage.getItem('main_device_phone') || phone
                const { data: linked } = await supabase
                  .from('linked_accounts')
                  .select('*')
                  .eq('device_phone', mainPhone)

                if (linked && linked.length > 0) {
                  const { useAccountStore } = require('./accountStore')
                  for (const acc of linked) {
                    await useAccountStore.getState().saveAccount({
                      userId: acc.user_id,
                      email: acc.email,
                      profileName: acc.owner_name || acc.business_name,
                      businessName: acc.business_name,
                      avatarLetter: (acc.owner_name || acc.business_name || 'A')[0].toUpperCase(),
                      session: ''
                    })
                  }
                }
              } catch (err) {
                console.error('[AUTH] loadLinked error:', err)
              }
            }
            loadLinked()
          }
        })
        .catch(() => {
          clearTimeout(profileTimeout)
          console.log('[AUTH] fetchProfile result: null (error)')
          console.log('[AUTH] isLoading set to false')
          if (get().session?.user?.id === session.user.id) {
            set({ profile: null, isLoading: false, isProfileChecked: true })
          }
        })
        .finally(() => {
          clearTimeout(profileTimeout)
          isFetchingProfile = false
        })
    } else {
      set({ isLoading: false })
    }
  },

  setProfile: (profile) => {
    set({ profile, isProfileChecked: true })
    saveAccountHelper(get().session, profile)
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      console.log('[PROFILE] Fetching for userId:', userId)
      console.log('[PROFILE] Result:', JSON.stringify(data))
      console.log('[PROFILE] Error:', JSON.stringify(error))

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
