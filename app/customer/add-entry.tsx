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
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTransactionStore } from '../../store/transactionStore'
import { transactionSchema } from '../../lib/shared/validators'

import CalendarPicker from '../../components/CalendarPicker'

function formatToDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-') // ["YYYY", "MM", "DD"]
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return dateStr
}

export default function AddEntryScreen() {
  const router = useRouter()
  const { customerId, type } = useLocalSearchParams<{
    customerId: string
    type: 'credit' | 'debit'
  }>()

  const { addTransaction } = useTransactionStore()

  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const isCredit = type === 'credit'

  const handleSubmit = async () => {
    if (!amountStr.trim() || !customerId || !type) return

    setLoading(true)

    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Amount must be greater than 0')
      setLoading(false)
      return
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(entryDate)) {
      Alert.alert('Invalid Date', 'Date must be in YYYY-MM-DD format')
      setLoading(false)
      return
    }



    try {
      // Validate with shared Zod schema
      const parseResult = transactionSchema.safeParse({
        type,
        amount,
        note: note || undefined,
        entry_date: entryDate,
      })

      if (!parseResult.success) {
        Alert.alert('Validation Error', parseResult.error.errors[0]?.message || 'Invalid details')
        setLoading(false)
        return
      }

      const success = await addTransaction(customerId, parseResult.data)
      if (success) {
        router.back()
      } else {
        Alert.alert('Error', useTransactionStore.getState().error || 'Failed to save transaction')
      }
    } catch (err: any) {
      console.error('[addTransaction]', err)
      Alert.alert('Error', err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'left', 'right']}>
      {/* Header bar */}
      <View className={`px-6 py-4 flex-row items-center border-b border-neutral-200 shadow-sm ${
        isCredit ? 'bg-danger/10 border-danger/10' : 'bg-success/10 border-success/10'
      }`}>
        <TouchableOpacity onPress={() => router.back()} disabled={loading} className="p-2 -ml-2 mr-3">
          <Text className="text-text-primary font-bold text-base">⬅️</Text>
        </TouchableOpacity>
        <Text className={`font-extrabold text-lg ${isCredit ? 'text-danger' : 'text-success'}`}>
          {isCredit ? 'You Gave (Credit) 🔴' : 'You Received (Debit) 🟢'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm space-y-5">
            
            {/* Amount */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">
                Amount (₹) <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                keyboardType="numeric"
                value={amountStr}
                onChangeText={(val) => setAmountStr(val.replace(/[^\d.]/g, ''))}
                placeholder="Enter amount (e.g. 500)"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-extrabold text-2xl bg-neutral-50"
                editable={!loading}
                autoFocus
              />
            </View>

            {/* Note / Description */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Description / Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. 2kg rice, sugar packets"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                editable={!loading}
              />
            </View>

            {/* Entry Date */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Entry Date (DD-MM-YYYY)</Text>
              <View className="flex-row items-center space-x-2 bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-1">
                <TextInput
                  value={formatToDisplay(entryDate)}
                  onChangeText={(text) => {
                    const regex = /^\d{2}-\d{2}-\d{4}$/;
                    if (regex.test(text)) {
                      const parts = text.split('-');
                      setEntryDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                  }}
                  placeholder="DD-MM-YYYY"
                  className="flex-1 py-3 text-text-primary font-semibold bg-transparent text-base"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  disabled={loading}
                  className="p-2 bg-neutral-100 rounded-xl active:scale-95"
                >
                  <Text className="text-lg">📅</Text>
                </TouchableOpacity>
              </View>
              {showDatePicker && (
                <CalendarPicker
                  visible={showDatePicker}
                  selectedDate={entryDate}
                  onCancel={() => setShowDatePicker(false)}
                  onConfirm={(date) => {

                    setEntryDate(date)
                    setShowDatePicker(false)
                  }}
                  onRemove={() => {
                    setEntryDate('')
                    setShowDatePicker(false)
                  }}
                />
              )}
              <Text className="text-[10px] text-text-secondary mt-2 ml-1">
                Leave as is for today's entry, or select/enter past date in DD-MM-YYYY format.
              </Text>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !amountStr.trim()}
              className={`w-full py-4 rounded-2xl items-center justify-center shadow-md ${
                loading || !amountStr.trim()
                  ? 'bg-neutral-300 shadow-none'
                  : isCredit
                  ? 'bg-danger shadow-danger/10'
                  : 'bg-success shadow-success/10'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base tracking-wide">Save Entry</Text>
              )}
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
