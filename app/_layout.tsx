import '../global.css'
import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useAccountStore } from '../store/accountStore'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments() as string[]
  const { session, profile, setSession, isLoading } = useAuthStore()
  const [appReady, setAppReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAppReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (_event === 'TOKEN_REFRESHED' && session) {
        useAccountStore.getState().updateAccountSession(session.user.id, JSON.stringify(session))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!appReady) return
    if (isLoading) return

    const inAuth = segments[0] === '(auth)'
    const inTabs = segments[0] === '(tabs)'
    const inCustomer = segments[0] === 'customer'
    const inReports = segments[0] === 'reports'
    const onSetupProfile = inAuth && segments[1] === 'setup-profile'

    if (onSetupProfile) return

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login')
    } else if (!profile) {
      if (!inAuth) router.replace('/(auth)/setup-profile')
    } else {
      if (!inTabs && !inCustomer && !inReports) router.replace('/(tabs)')
    }
  }, [appReady, isLoading, session, profile, segments])

  if (!appReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size='large' color='#1a73e8' />
      </View>
    )
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/setup-profile" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="customer/[id]" />
        <Stack.Screen name="customer/new" />
        <Stack.Screen name="customer/edit" />
        <Stack.Screen name="customer/add-entry" />
        <Stack.Screen name="customer/edit-entry" />
        <Stack.Screen name="reports/index" />
        <Stack.Screen name="reports/customer-transactions" />
        <Stack.Screen name="reports/customer-list" />
      </Stack>
      <StatusBar style='auto' />
    </>
  )
}