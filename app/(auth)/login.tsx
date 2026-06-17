import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { useLocalSearchParams, useRouter } from 'expo-router'

export default function LoginScreen() {
  const router = useRouter()
  const { addingNewAccount } = useLocalSearchParams<{ addingNewAccount?: string }>()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!phoneNumber.trim() || !password.trim()) {
      Alert.alert('Error', 'Phone number aur password dono bharo.')
      return
    }

    setLoading(true)

    try {
      // Clean phone number (digits only, last 10 digits)
      const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        Alert.alert('Validation Error', 'Enter a valid 10-digit Indian mobile number.')
        setLoading(false)
        return
      }

      // Check against hardcoded password
      const correctPassword = process.env.EXPO_PUBLIC_APP_PASSWORD || 'Khatabook2026'
      console.log('ENV PASSWORD:', process.env.EXPO_PUBLIC_APP_PASSWORD)
      console.log('CORRECT PASSWORD:', correctPassword)
      console.log('ENTERED PASSWORD:', password)
      if (password !== correctPassword) {
        Alert.alert('Authentication Error', 'Incorrect password / passcode.')
        setLoading(false)
        return
      }

      const email = `u${cleanPhone}@khataclone.dev`
      console.log('[LOGIN] Password check passed')
      console.log('[LOGIN] Attempting supabase signIn:', email)

      // Check if phone number has been registered in local caching
      let registeredPhones: string[] = []
      try {
        const stored = await AsyncStorage.getItem('registered_phones')
        if (stored) {
          registeredPhones = JSON.parse(stored)
        }
      } catch (err) {
        console.error('Error parsing registered_phones:', err)
      }

      const isRegistered = registeredPhones.includes(cleanPhone)

      if (isRegistered) {
        // If cached as registered, only try sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: correctPassword,
        })
        console.log('[LOGIN] SignIn error:', JSON.stringify(signInError))
        if (!signInError) {
          console.log('[LOGIN] SignIn success')
        }
        if (signInError) throw signInError
      } else {
        // Not cached as registered -> Try to sign in first
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: correctPassword,
        })
        console.log('[LOGIN] SignIn error:', JSON.stringify(signInError))
        if (!signInError) {
          console.log('[LOGIN] SignIn success')
        }

        if (signInError) {
          // If sign in fails, we sign up
          if (
            signInError.message.toLowerCase().includes('invalid login credentials') ||
            signInError.message.toLowerCase().includes('user not found') ||
            signInError.status === 400 ||
            signInError.status === 412
          ) {
            console.log('[LOGIN] SignUp triggered')
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password: correctPassword,
              options: {
                emailRedirectTo: undefined,
                data: {},
              },
            })
            console.log('[LOGIN] SignUp error:', JSON.stringify(signUpError))
            console.log('[LOGIN] SignUp session exists:', !!signUpData?.session)

            if (signUpError) {
              throw signUpError
            }

            // Save cleanPhone to cached registered_phones in AsyncStorage
            if (!registeredPhones.includes(cleanPhone)) {
              registeredPhones.push(cleanPhone)
              await AsyncStorage.setItem('registered_phones', JSON.stringify(registeredPhones))
            }

            // If signup didn't log them in automatically, try signing in again
            if (!signUpData.session) {
              const { error: retryError } = await supabase.auth.signInWithPassword({
                email,
                password: correctPassword,
              })
              if (retryError) throw retryError
            }
          } else {
            throw signInError
          }
        } else {
          // Sign in succeeded, ensure it's saved in local caching
          if (!registeredPhones.includes(cleanPhone)) {
            registeredPhones.push(cleanPhone)
            await AsyncStorage.setItem('registered_phones', JSON.stringify(registeredPhones))
          }
        }
      }

      await AsyncStorage.setItem('main_device_phone', cleanPhone)

      // After setSession is called successfully, clear old registered_phones cache
      await AsyncStorage.removeItem('registered_phones')

      // Successful login/signup triggers _layout auth listener
      if (addingNewAccount === 'true') {
        router.replace('/(tabs)')
      }
    } catch (err: any) {
      console.error('[handleLogin] Error:', err)
      Alert.alert('Error', err.message || 'Failed to authenticate. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 py-12">
            
            {/* Header / Brand Card */}
            <View className="w-full bg-primary rounded-3xl p-8 mb-8 shadow-lg relative overflow-hidden">
              <View className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 rounded-full blur-2xl"></View>
              <Text className="text-white text-3xl font-black tracking-tight">KhataClone</Text>
              <Text className="text-white/80 text-sm font-medium mt-1">
                Digital Ledger for Small Businesses
              </Text>
            </View>

            {/* Input Form Card */}
            <View className="w-full bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm">
              <Text className="text-neutral-900 text-lg font-bold mb-1">Get Started</Text>
              <Text className="text-text-secondary text-xs mb-6">
                Enter your phone number and login passcode to sign in or register.
              </Text>

              <Text className="text-text-primary text-sm font-semibold mb-2">Phone Number</Text>
              <View className="flex-row rounded-2xl border border-neutral-200 focus-within:border-primary overflow-hidden mb-5 bg-neutral-50">
                <View className="bg-neutral-100 px-4 items-center justify-center border-r border-neutral-200">
                  <Text className="text-text-secondary font-bold text-base">+91</Text>
                </View>
                <TextInput
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Enter 10-digit number"
                  className="flex-1 px-4 py-4 text-text-primary font-semibold text-base outline-none"
                  editable={!loading}
                />
              </View>

              <Text className="text-text-primary text-sm font-semibold mb-2">Password / Passcode</Text>
              <TextInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50 mb-6"
                editable={!loading}
              />

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                  loading ? 'bg-neutral-300 shadow-none' : 'bg-primary'
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base tracking-wide">Login / Register</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {loading && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <ActivityIndicator size='large' color='#1a73e8' />
        </View>
      )}
    </SafeAreaView>
  )
}
