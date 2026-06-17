import React, { useState, useEffect } from 'react'
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
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCustomerStore } from '../../store/customerStore'
import { customerSchema } from '../../lib/shared/validators'

export default function EditCustomerScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { customers, updateCustomer } = useCustomerStore()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const customer = customers.find((c) => c.id === id)

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setPhone(customer.phone ? customer.phone.replace(/^\+91/, '') : '')
      setAddress(customer.address || '')
      setNotes(customer.notes || '')
    } else {
      Alert.alert('Error', 'Customer not found')
      router.back()
    }
  }, [customer])

  const handleSubmit = async () => {
    if (!name.trim() || !id) return

    setLoading(true)

    const inputData = {
      name,
      phone: phone ? `+91${phone}` : undefined,
      address: address || undefined,
      notes: notes || undefined,
    }

    try {
      // Validate inputs using Zod schema
      const parseResult = customerSchema.safeParse(inputData)
      if (!parseResult.success) {
        Alert.alert('Validation Error', parseResult.error.errors[0]?.message || 'Invalid customer info')
        setLoading(false)
        return
      }

      const validatedCustomer = parseResult.data

      const updated = await updateCustomer(id, validatedCustomer)
      if (updated) {
        router.back()
      } else {
        Alert.alert('Error', useCustomerStore.getState().error || 'Failed to update details')
      }
    } catch (err: any) {
      console.error('[updateCustomer]', err)
      Alert.alert('Error', err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'left', 'right']}>
      {/* Header bar */}
      <View className="bg-white px-6 py-4 flex-row items-center border-b border-neutral-200 shadow-sm">
        <TouchableOpacity onPress={() => router.back()} disabled={loading} className="p-2 -ml-2 mr-3">
          <Text className="text-text-primary font-bold text-base">⬅️</Text>
        </TouchableOpacity>
        <Text className="text-neutral-900 font-bold text-lg">Edit Details</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm space-y-5">
            
            {/* Customer Name */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">
                Customer Name <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter full name"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                editable={!loading}
              />
            </View>

            {/* Phone Number */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Phone Number</Text>
              <View className="flex-row rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50 focus-within:border-primary">
                <View className="bg-neutral-100 px-4 items-center justify-center border-r border-neutral-200">
                  <Text className="text-text-secondary font-bold text-base">+91</Text>
                </View>
                <TextInput
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="99999 99999"
                  className="flex-1 px-4 py-4 text-text-primary font-semibold text-base outline-none"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Address */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Address</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Enter shop or residence address"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                editable={!loading}
              />
            </View>

            {/* Notes */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. wholesale client, prompt payments"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50 min-h-[100px]"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !name.trim()}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                loading || !name.trim() ? 'bg-neutral-300 shadow-none' : 'bg-primary'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base tracking-wide">Save Changes</Text>
              )}
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
