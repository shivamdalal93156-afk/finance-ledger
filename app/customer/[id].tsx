import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  Platform,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCustomerStore } from '../../store/customerStore'
import { useTransactionStore } from '../../store/transactionStore'
import { useAuthStore } from '../../store/authStore'
import { sendWhatsAppReminder } from '../../lib/shared/utils'

import CalendarPicker from '../../components/CalendarPicker'

function formatToDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-') // ["YYYY", "MM", "DD"]
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return dateStr
}

function formatINRMobile(amount: number): string {
  const parts = Math.abs(amount).toFixed(0).split('')
  // manual Indian comma insertion
  let result = parts.splice(-3).join('')
  while (parts.length > 0) result = parts.splice(-2).join('') + ',' + result
  return 'Rs.' + result
}

function formatShortDate(dateVal: string | Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

export default function CustomerDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { customers, deleteCustomer } = useCustomerStore()
  const { profile } = useAuthStore()
  const {
    transactions,
    fetchTransactions,
    isLoading: isTxLoading,
  } = useTransactionStore()

  // Date range filter state
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [showFromPicker, setShowFromPicker] = useState(false)
  const [showToPicker, setShowToPicker] = useState(false)

  const customer = customers.find((c) => c.id === id)

  useEffect(() => {
    if (id) {
      fetchTransactions(id)
    }
  }, [id])

  if (!customer) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center">
        <Text className="text-text-secondary font-bold text-base">Customer details not found</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          className="mt-4 bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Go to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer?',
      `Are you sure you want to delete ${customer.name}?\n\nThis will delete all transaction history for ${customer.name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteCustomer(customer.id)
            if (success) {
              router.replace('/(tabs)')
            } else {
              Alert.alert('Error', 'Failed to delete customer')
            }
          },
        },
      ]
    )
  }

  // Calculate Running Balances chronologically (oldest to newest)
  const txList = (id ? transactions[id] : []) || []
  const sortedChrono = [...txList].sort((a, b) => {
    const dateDiff = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    if (dateDiff !== 0) return dateDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  let currentBalance = 0
  const chronoWithBalances = sortedChrono.map((t) => {
    currentBalance = t.type === 'credit' ? currentBalance + t.amount : currentBalance - t.amount
    return { ...t, runningBalance: currentBalance }
  })

  // Display newest first
  const displayTransactions = [...chronoWithBalances].reverse()
  const balance = currentBalance

  // Filter visible transactions to the applied date range
  const filteredTransactions = displayTransactions.filter((tx) => {
    if (appliedFrom && tx.entry_date < appliedFrom) return false
    if (appliedTo && tx.entry_date > appliedTo) return false
    return true
  })

  // Period metrics calculations
  const totalGaveForPeriod = filteredTransactions
    .filter((tx) => tx.type === 'credit')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalReceivedForPeriod = filteredTransactions
    .filter((tx) => tx.type === 'debit')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const netForPeriod = totalGaveForPeriod - totalReceivedForPeriod

  const formattedPhone = customer.phone
    ? `+91 ${customer.phone.replace(/^\+91/, '')}`
    : 'No phone number'

  const dateAdded = formatShortDate(customer.created_at)

  const handleSendReminder = async () => {
    if (!customer.phone) return
    const businessName = profile?.business_name || 'My Store'
    const url = sendWhatsAppReminder(customer.phone, customer.name, balance, businessName)
    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Error', 'WhatsApp is not installed or links are not supported on this device.')
      }
    } catch (err) {
      console.error('[whatsappReminder]', err)
      Alert.alert('Error', 'Could not open WhatsApp reminder link.')
    }
  }

  const handleSendSMSReminder = async () => {
    if (!customer.phone) return
    const businessName = profile?.business_name || 'My Store'
    const cleanPhone = customer.phone.replace(/\D/g, '').replace(/^91/, '')
    const message = `Hi ${customer.name}, aapka ${businessName} mein ${formatINRMobile(balance)} baaki hai. Kripya jaldi settlement karein. Dhanyawad! 🙏`
    const smsUrl = `sms:+91${cleanPhone}?body=${encodeURIComponent(message)}`
    try {
      const supported = await Linking.canOpenURL(smsUrl)
      if (supported) {
        await Linking.openURL(smsUrl)
      } else {
        Alert.alert('Error', 'SMS is not supported on this device.')
      }
    } catch (err) {
      console.error('[smsReminder]', err)
      Alert.alert('Error', 'Could not open SMS reminder.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'left', 'right']}>
      {/* Header bar */}
      <View className="bg-white px-6 py-4 flex-row items-center justify-between border-b border-neutral-200 shadow-sm">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="p-2 -ml-2 mr-3">
            <Text className="text-text-primary font-bold text-base">⬅️</Text>
          </TouchableOpacity>
          <View className={`h-10 w-10 items-center justify-center rounded-xl ${
            balance > 0
              ? 'bg-danger/10'
              : balance < 0
              ? 'bg-amber-500/10'
              : 'bg-neutral-100'
          }`}>
            <Text className={`font-extrabold text-lg ${
              balance > 0
                ? 'text-danger'
                : balance < 0
                ? 'text-amber-600'
                : 'text-primary'
            }`}>
              {customer.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="ml-3">
            <Text className="text-neutral-900 font-bold text-base leading-tight">
              {customer.name}
            </Text>
            <Text className="text-text-secondary text-[10px] mt-0.5">{formattedPhone}</Text>
          </View>
        </View>

        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/customer/edit', params: { id } })}
            className="border border-neutral-200 bg-white px-4 py-2 rounded-xl active:scale-95 mr-2"
          >
            <Text className="text-text-secondary font-bold text-xs">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            className="bg-danger/10 border border-danger/20 px-4 py-2 rounded-xl active:scale-95"
          >
            <Text className="text-danger font-bold text-xs">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 100 }} className="flex-1">
        {/* Metric summary */}
        <View className={`border rounded-3xl p-5 shadow-xs flex-row justify-between items-center mb-6 ${
          balance > 0
            ? 'bg-danger/5 border-danger/10'
            : balance < 0
            ? 'bg-amber-500/5 border-amber-500/10'
            : 'bg-success/5 border-success/10'
        }`}>
          <View className="flex-1 pr-2">
            <Text className="text-text-secondary text-[10px] font-bold">NET LEDGER BALANCE</Text>
            <Text className={`font-black text-xl mt-1 ${
              balance > 0
                ? 'text-danger'
                : balance < 0
                ? 'text-amber-600'
                : 'text-success'
            }`}>
              {balance > 0
                ? `You Get: ${formatINRMobile(balance)}`
                : balance < 0
                ? `You Give: ${formatINRMobile(Math.abs(balance))}`
                : 'All Settled ✓'}
            </Text>
          </View>

          <View className="flex-row items-center space-x-1.5">
            {balance > 0 && (
              <>
                <TouchableOpacity
                  onPress={handleSendSMSReminder}
                  disabled={!customer.phone}
                  className={`px-2.5 py-2 rounded-xl flex-row items-center justify-center active:scale-95 ${
                    customer.phone ? 'bg-slate-600' : 'bg-neutral-200'
                  }`}
                >
                  <Text className={`font-bold text-[10px] ${customer.phone ? 'text-white' : 'text-text-secondary'}`}>
                    {customer.phone ? '📱 SMS' : 'No Phone'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSendReminder}
                  disabled={!customer.phone}
                  className={`px-2.5 py-2 rounded-xl flex-row items-center justify-center active:scale-95 ${
                    customer.phone ? 'bg-success' : 'bg-neutral-200'
                  }`}
                >
                  <Text className={`font-bold text-[10px] ${customer.phone ? 'text-white' : 'text-text-secondary'}`}>
                    {customer.phone ? '💬 WhatsApp' : 'No Phone'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {balance === 0 && (
              <View className="bg-success/20 border border-success/20 px-3 py-1 rounded-full">
                <Text className="text-success text-[10px] font-bold">Settled</Text>
              </View>
            )}
            {balance < 0 && (
              <View className="bg-amber-500/20 border border-amber-500/20 px-3 py-1 rounded-full">
                <Text className="text-amber-600 text-[10px] font-bold">We Owe</Text>
              </View>
            )}
          </View>
        </View>

        {/* Customer Information detail card */}
        <View className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs space-y-4 mb-6">
          <Text className="text-neutral-900 font-bold text-sm border-b border-neutral-100 pb-2">
            Details
          </Text>

          <View>
            <Text className="text-text-secondary text-[10px] font-semibold uppercase">Address</Text>
            <Text className="text-text-primary text-sm font-semibold mt-1">
              {customer.address || 'No address added'}
            </Text>
          </View>

          <View>
            <Text className="text-text-secondary text-[10px] font-semibold uppercase">Notes</Text>
            <Text className="text-text-primary text-sm font-semibold mt-1">
              {customer.notes || 'No notes added'}
            </Text>
          </View>

          <View>
            <Text className="text-text-secondary text-[10px] font-semibold uppercase">Added On</Text>
            <Text className="text-text-primary text-sm font-semibold mt-1">{dateAdded}</Text>
          </View>
        </View>

        {/* Date Range Filter Panel */}
        <View className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs mb-6">
          <Text className="font-bold text-xs text-neutral-900 uppercase tracking-wider mb-3">
            Date Range Filter
          </Text>
          
          <View className="flex-row space-x-3 mb-3">
            <View className="flex-1">
              <Text className="text-text-secondary text-[10px] font-bold uppercase mb-1">From Date</Text>
              <View className="flex-row items-center space-x-1 bg-neutral-50 border border-neutral-200 rounded-xl px-2">
                <TextInput
                  value={formatToDisplay(filterFrom)}
                  onChangeText={(text) => {
                    const regex = /^\d{2}-\d{2}-\d{4}$/;
                    if (regex.test(text)) {
                      const parts = text.split('-');
                      setFilterFrom(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else if (text === '') {
                      setFilterFrom('');
                    }
                  }}
                  placeholder="DD-MM-YYYY"
                  className="flex-1 py-2 text-xs text-text-primary font-semibold bg-transparent"
                />
                <TouchableOpacity
                  onPress={() => setShowFromPicker(true)}
                  className="p-1"
                >
                  <Text className="text-sm">📅</Text>
                </TouchableOpacity>
              </View>
              {showFromPicker && (
                <CalendarPicker
                  visible={showFromPicker}
                  selectedDate={filterFrom}
                  onCancel={() => setShowFromPicker(false)}
                  onConfirm={(date) => {
                    setFilterFrom(date)
                    setShowFromPicker(false)
                  }}
                  onRemove={() => {
                    setFilterFrom('')
                    setShowFromPicker(false)
                  }}
                />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-text-secondary text-[10px] font-bold uppercase mb-1">To Date</Text>
              <View className="flex-row items-center space-x-1 bg-neutral-50 border border-neutral-200 rounded-xl px-2">
                <TextInput
                  value={formatToDisplay(filterTo)}
                  onChangeText={(text) => {
                    const regex = /^\d{2}-\d{2}-\d{4}$/;
                    if (regex.test(text)) {
                      const parts = text.split('-');
                      setFilterTo(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else if (text === '') {
                      setFilterTo('');
                    }
                  }}
                  placeholder="DD-MM-YYYY"
                  className="flex-1 py-2 text-xs text-text-primary font-semibold bg-transparent"
                />
                <TouchableOpacity
                  onPress={() => setShowToPicker(true)}
                  className="p-1"
                >
                  <Text className="text-sm">📅</Text>
                </TouchableOpacity>
              </View>
              {showToPicker && (
                <CalendarPicker
                  visible={showToPicker}
                  selectedDate={filterTo}
                  onCancel={() => setShowToPicker(false)}
                  onConfirm={(date) => {
                    setFilterTo(date)
                    setShowToPicker(false)
                  }}
                  onRemove={() => {
                    setFilterTo('')
                    setShowToPicker(false)
                  }}
                />
              )}
            </View>
          </View>

          <View className="flex-row items-center space-x-3 justify-end">
            {(appliedFrom || appliedTo || filterFrom || filterTo) && (
              <TouchableOpacity
                onPress={() => {
                  setFilterFrom('')
                  setFilterTo('')
                  setAppliedFrom('')
                  setAppliedTo('')
                }}
                className="px-3 py-2"
              >
                <Text className="text-text-secondary font-bold text-xs underline">Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setAppliedFrom(filterFrom)
                setAppliedTo(filterTo)
              }}
              className="bg-primary px-4 py-2 rounded-xl active:scale-95 shadow-sm"
            >
              <Text className="text-white font-bold text-xs">Apply Filter</Text>
            </TouchableOpacity>
          </View>

          {/* Period Summary Box */}
          {(appliedFrom || appliedTo) && (
            <View className="mt-4 pt-4 border-t border-neutral-100 flex-row justify-between space-x-2">
              <View className="flex-1 bg-neutral-50 border border-neutral-100 rounded-xl p-2.5 items-center">
                <Text className="text-[8px] font-bold text-text-secondary uppercase">Total Gave</Text>
                <Text className="text-xs font-black text-danger mt-0.5">{formatINRMobile(totalGaveForPeriod)}</Text>
              </View>
              <View className="flex-1 bg-neutral-50 border border-neutral-100 rounded-xl p-2.5 items-center">
                <Text className="text-[8px] font-bold text-text-secondary uppercase">Total Recv</Text>
                <Text className="text-xs font-black text-success mt-0.5">{formatINRMobile(totalReceivedForPeriod)}</Text>
              </View>
              <View className={`flex-1 border rounded-xl p-2.5 items-center ${
                netForPeriod > 0
                  ? 'bg-danger/5 border-danger/10 text-danger'
                  : netForPeriod < 0
                  ? 'bg-success/5 border-success/10 text-success'
                  : 'bg-neutral-50 border-neutral-100 text-text-secondary'
              }`}>
                <Text className="text-[8px] font-bold uppercase opacity-80">Net Bal</Text>
                <Text className="text-xs font-black mt-0.5">
                  {netForPeriod < 0 ? '-' : ''}
                  {formatINRMobile(Math.abs(netForPeriod))}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Ledger logs */}
        <View className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-xs">
          <View className="px-5 py-4 border-b border-neutral-200 flex-row justify-between items-center bg-neutral-50">
            <Text className="font-bold text-xs text-neutral-900 uppercase tracking-wider">
              Ledger Entries
            </Text>
            <Text className="text-xs font-bold text-text-secondary">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          {isTxLoading && txList.length === 0 ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="small" color="#1a73e8" />
              <Text className="text-text-secondary font-bold text-xs mt-3">Loading entries...</Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View className="py-12 items-center justify-center px-6">
              <Text className="text-3xl">📖</Text>
              <Text className="text-neutral-900 font-bold text-sm mt-3 text-center">
                No entries recorded
              </Text>
              <Text className="text-text-secondary text-xs text-center mt-2 leading-relaxed max-w-[200px]">
                Tap GAVE or RECEIVED below to add transaction entries.
              </Text>
            </View>
          ) : (
            <View>
              {filteredTransactions.map((tx, idx) => {
                const isCredit = tx.type === 'credit'
                const txDateFormatted = formatShortDate(tx.entry_date)
                return (
                  <TouchableOpacity
                    key={tx.id}
                    onPress={() =>
                      router.push({
                        pathname: '/customer/edit-entry',
                        params: { txId: tx.id, customerId: id },
                      })
                    }
                    className={`flex-row items-center justify-between px-5 py-4 active:bg-neutral-50 ${
                      idx > 0 ? 'border-t border-neutral-100' : ''
                    }`}
                  >
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center">
                        <Text className="text-text-secondary text-[10px] font-semibold">{txDateFormatted}</Text>
                        {tx.is_edited && (
                          <View className="bg-neutral-200 px-1 rounded ml-1.5">
                            <Text className="text-text-secondary text-[7px] font-bold">EDITED</Text>
                          </View>
                        )}
                      </View>
                      <Text className="font-semibold text-sm text-neutral-900 mt-1 leading-snug">
                        {tx.note || (isCredit ? 'Credit entry' : 'Received payment')}
                      </Text>
                    </View>

                    <View className="flex-row items-center space-x-4">
                      {/* Amount column */}
                      <View className="w-18 items-end">
                        {isCredit ? (
                          <Text className="font-extrabold text-danger text-sm">-{formatINRMobile(tx.amount)}</Text>
                        ) : (
                          <Text className="font-extrabold text-success text-sm">+{formatINRMobile(tx.amount)}</Text>
                        )}
                      </View>

                      {/* Running balance column */}
                      <View className="w-22 border-l border-neutral-100 pl-3 items-end">
                        <Text className="text-[9px] font-bold text-text-secondary">Balance</Text>
                        <Text className={`text-[10px] font-extrabold mt-0.5 ${
                          tx.runningBalance > 0
                            ? 'text-danger'
                            : tx.runningBalance < 0
                            ? 'text-amber-600'
                            : 'text-success'
                        }`}>
                          {tx.runningBalance > 0 ? 'Owes ' : tx.runningBalance < 0 ? 'Give ' : ''}
                          {formatINRMobile(Math.abs(tx.runningBalance))}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Gave/Received buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-6 py-4 flex-row space-x-3 shadow-xl">
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/customer/add-entry', params: { customerId: id, type: 'credit' } })}
          className="flex-1 bg-danger py-4 rounded-xl items-center justify-center shadow-md active:scale-[0.98] mr-2"
        >
          <Text className="text-white font-extrabold text-xs tracking-wider">🔴 GAVE (CREDIT)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/customer/add-entry', params: { customerId: id, type: 'debit' } })}
          className="flex-1 bg-success py-4 rounded-xl items-center justify-center shadow-md active:scale-[0.98]"
        >
          <Text className="text-white font-extrabold text-xs tracking-wider">🟢 RECEIVED (DEBIT)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
