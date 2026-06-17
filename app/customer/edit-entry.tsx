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
import { useTransactionStore } from '../../store/transactionStore'

export default function EditEntryScreen() {
  const router = useRouter()
  const { txId, customerId } = useLocalSearchParams<{
    txId: string
    customerId: string
  }>()

  const { transactions, updateTransaction, deleteTransaction } = useTransactionStore()

  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const txList = (customerId ? transactions[customerId] : []) || []
  const tx = txList.find((t) => t.id === txId)

  useEffect(() => {
    if (tx) {
      setAmountStr(tx.amount.toString())
      setNote(tx.note || '')
    } else {
      Alert.alert('Error', 'Transaction entry not found')
      router.back()
    }
  }, [tx])

  if (!tx) return null

  const isCredit = tx.type === 'credit'

  const handleSubmit = async () => {
    if (!amountStr.trim() || !txId || !customerId) return

    setLoading(true)

    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Amount must be greater than 0')
      setLoading(false)
      return
    }

    try {
      const updated = await updateTransaction(txId, customerId, {
        amount,
        note: note || undefined,
      })

      if (updated) {
        router.back()
      } else {
        Alert.alert('Error', useTransactionStore.getState().error || 'Failed to update transaction')
      }
    } catch (err: any) {
      console.error('[updateTransaction]', err)
      Alert.alert('Error', err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = () => {
    if (!txId || !customerId) return

    Alert.alert(
      'Delete Entry?',
      'Are you sure you want to delete this transaction entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const success = await deleteTransaction(txId, customerId)
            setLoading(false)
            if (success) {
              router.back()
            } else {
              Alert.alert('Error', 'Failed to delete transaction')
            }
          },
        },
      ]
    )
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
          Transaction Options
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm space-y-5">
            
            {/* Type (Locked) */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Type (Locked)</Text>
              <TextInput
                value={isCredit ? 'You Gave (Credit) 🔴' : 'You Received (Debit) 🟢'}
                editable={false}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-secondary font-bold bg-neutral-100"
              />
            </View>

            {/* Amount */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">
                Amount (₹) <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                keyboardType="numeric"
                value={amountStr}
                onChangeText={(val) => setAmountStr(val.replace(/[^\d.]/g, ''))}
                placeholder="Enter amount"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-extrabold text-2xl bg-neutral-50"
                editable={!loading}
              />
            </View>

            {/* Note */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Description / Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Enter description"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-primary font-semibold bg-neutral-50"
                editable={!loading}
              />
            </View>

            {/* Entry Date (Locked) */}
            <View>
              <Text className="text-text-primary text-sm font-semibold mb-2">Entry Date (Locked)</Text>
              <TextInput
                value={tx.entry_date}
                editable={false}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-text-secondary font-semibold bg-neutral-100"
              />
              <Text className="text-[9px] text-text-secondary mt-1 ml-1 leading-relaxed">
                *To change dates or transaction type, delete this record and log a new entry.
              </Text>
            </View>

            {/* Action Row */}
            <View className="flex-row space-x-3 pt-4 border-t border-neutral-100">
              <TouchableOpacity
                onPress={handleDelete}
                disabled={loading}
                className="flex-1 bg-danger/10 border border-danger/20 py-4 rounded-2xl items-center justify-center mr-2"
              >
                {loading ? (
                  <ActivityIndicator color="#ea4335" />
                ) : (
                  <Text className="text-danger font-extrabold text-sm">🗑️ Delete</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading || !amountStr.trim()}
                className={`flex-2 py-4 rounded-2xl items-center justify-center shadow-md ${
                  loading || !amountStr.trim() ? 'bg-neutral-300 shadow-none' : 'bg-primary shadow-primary/10'
                }`}
              >
                <Text className="text-white font-bold text-sm">Save Changes</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
