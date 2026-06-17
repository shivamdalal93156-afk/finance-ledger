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
import { useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function SetupProfileScreen() {
  const { newAccount } = useLocalSearchParams()
  const router = useRouter()
  const isNewAccount = newAccount === 'true'

  const { session, setProfile } = useAuthStore()

  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(false)

  const phone = session?.user?.phone || session?.user?.email?.split('@')[0]?.replace('user_', '').replace(/^u/, '') || ''
  const handleSubmit = async () => {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Business name bharo.')
      return
    }
    setLoading(true)

    try {
      if (isNewAccount) {
        // Generate unique identifier for this sub-account
        const timestamp = Date.now()
        const fakePhone = `9${timestamp.toString().slice(-9)}`
        const email = `u${fakePhone}@khataclone.dev`
        const password = process.env.EXPO_PUBLIC_APP_PASSWORD || 'Khatabook2026'

        // Sign up new account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        const newUserId = signUpData.user?.id
        if (!newUserId) throw new Error('User creation failed')

        // Create profile using new user id directly — don't rely on getSession
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: newUserId,
            business_name: businessName.trim(),
            owner_name: ownerName.trim() || null,
            phone: `+91${fakePhone}`,
            upi_id: null,
          })
          .select()
          .single()

        if (profileError) throw profileError

        // Get main account phone
        const mainPhone = await AsyncStorage.getItem('main_device_phone') || 
          session?.user?.email?.replace('u','').replace('@khataclone.dev','') || ''

        const { error: linkError } = await supabase
          .from('linked_accounts')
          .insert({
            device_phone: mainPhone,
            business_name: businessName.trim(),
            owner_name: ownerName.trim() || null,
            user_id: newUserId,
            email: email,  // add this line
          })

        if (linkError) throw linkError

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError

        // Fetch and set the new profile
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newUserId)
          .single()

        if (newProfile) {
          useAuthStore.getState().setProfile(newProfile)
        }

        router.replace('/(tabs)')

      } else {
        // Existing flow for first time setup
        if (!session?.user?.id) throw new Error('Session expired')
        const { data, error: dbError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            business_name: businessName.trim(),
            owner_name: ownerName.trim() || null,
            phone,
            upi_id: upiId || null,
          })
          .select()
          .single()

        if (dbError) throw dbError
        setProfile(data)
      }
    } catch (err: any) {
      console.error('[setupProfile]', err)
      Alert.alert('Error', err.message || 'Failed to save. Please try again.')
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
          <View className="flex-1 justify-center px-6 py-8">
            
            {/* Header */}
            <View className="w-full bg-primary rounded-3xl p-6 mb-6 shadow-md relative overflow-hidden">
              <View className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 rounded-full blur-2xl"></View>
              <Text className="text-white text-2xl font-bold tracking-tight">
                {isNewAccount ? 'Add New Account' : 'Business Setup'}
              </Text>
              <Text className="text-white/80 text-xs font-medium mt-1">
                {isNewAccount ? 'Enter details to create a new business account' : 'Enter your business details to start record keeping'}
              </Text>
            </View>

            {/* Profile Card */}
            <View className="w-full bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm space-y-5">
              
              {/* Business Name */}
              <View>
                <Text className="text-text-primary text-sm font-semibold mb-2">
                  Business Name <Text className="text-danger">*</Text>
                </Text>
                <TextInput
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="e.g. Ramesh Kirana Store"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                  editable={!loading}
                />
              </View>

              {/* Owner Name */}
              <View>
                <Text className="text-text-primary text-sm font-semibold mb-2">Owner Name</Text>
                <TextInput
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                  editable={!loading}
                />
              </View>

              {/* UPI ID */}
              {!isNewAccount && (
                <View>
                  <Text className="text-text-primary text-sm font-semibold mb-2">UPI ID (for payments)</Text>
                  <TextInput
                    value={upiId}
                    onChangeText={upiId => setUpiId(upiId.trim())}
                    placeholder="e.g. name@okaxis"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                    editable={!loading}
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Phone (read-only) */}
              {!isNewAccount && (
                <View>
                  <Text className="text-text-primary text-sm font-semibold mb-2">Phone Number</Text>
                  <TextInput
                    value={phone}
                    editable={false}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-secondary font-semibold bg-neutral-100"
                  />
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading || !businessName.trim()}
                className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                  loading || !businessName.trim() ? 'bg-neutral-300 shadow-none' : 'bg-primary'
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base tracking-wide">
                    {isNewAccount ? 'Create Account' : 'Create Profile'}
                  </Text>
                )}
              </TouchableOpacity>

            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
