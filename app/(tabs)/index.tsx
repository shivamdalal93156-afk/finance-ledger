import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useCustomerStore } from '../../store/customerStore'
import { useTransactionStore } from '../../store/transactionStore'
import { calculateBalance, sendWhatsAppReminder } from '../../lib/shared/utils'
import { useAccountStore, SavedAccount } from '../../store/accountStore'
import { supabase } from '../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function DashboardScreen() {
  const router = useRouter()
  const { profile, session, signOut, setSession } = useAuthStore()
  const { customers, isLoading: isCustomersLoading, fetchCustomers } = useCustomerStore()
  const { transactions, isLoading: isTxLoading, fetchAllUserTransactions } = useTransactionStore()

  const { savedAccounts, loadAccounts, removeAccount, saveAccount } = useAccountStore()
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (session?.user?.id) {
      fetchCustomers()
      fetchAllUserTransactions()
    }
  }, [session?.user?.id, fetchCustomers, fetchAllUserTransactions])

  const handleSwitchAccount = async (account: SavedAccount) => {
    try {
      const password = process.env.EXPO_PUBLIC_APP_PASSWORD || 'Khatabook2026'
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password,
      })
      if (error) throw error
      setIsAccountModalOpen(false)
    } catch (e: any) {
      console.error('[switchAccount] Error:', e.message)
      Alert.alert('Switch Failed', e.message)
    }
  }

  const handleRemoveAccount = async (userId: string) => {
    try {
      // Remove from Supabase linked_accounts
      const mainPhone = await AsyncStorage.getItem('main_device_phone') || ''
      await supabase
        .from('linked_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('device_phone', mainPhone)
      
      // Remove from local accountStore
      await useAccountStore.getState().removeAccount(userId)
    } catch (err) {
      console.error('Remove account error:', err)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchCustomers(), fetchAllUserTransactions()])
    setRefreshing(false)
  }

  // Calculate balances in memory
  const customersWithBalance = customers.map((c) => {
    const customerTx = transactions[c.id] || []
    const balance = calculateBalance(customerTx)
    return { ...c, balance }
  })

  // Group metrics
  const totalReceivable = customersWithBalance
    .filter((c) => c.balance > 0)
    .reduce((sum, c) => sum + c.balance, 0)

  const totalPayable = customersWithBalance
    .filter((c) => c.balance < 0)
    .reduce((sum, c) => sum + Math.abs(c.balance), 0)

  const netBalance = totalReceivable - totalPayable

  const formatINR = (amount: number) => {
    const parts = Math.abs(amount).toFixed(0).split('')
    let result = parts.splice(-3).join('')
    while (parts.length > 0) result = parts.splice(-2).join('') + ',' + result
    return 'Rs.' + result
  }

  // Sort: balance > 0 (highest first) -> balance < 0 (most negative first) -> balance = 0 (alphabetical)
  const sortedCustomers = [...customersWithBalance].sort((a, b) => {
    const getGroup = (bal: number) => {
      if (bal > 0) return 1
      if (bal < 0) return 2
      return 3
    }
    const groupA = getGroup(a.balance)
    const groupB = getGroup(b.balance)

    if (groupA !== groupB) {
      return groupA - groupB
    }

    if (groupA === 1) {
      return b.balance - a.balance
    }
    if (groupA === 2) {
      return a.balance - b.balance
    }
    return a.name.localeCompare(b.name)
  })

  const filteredCustomers = sortedCustomers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Top Debtors list (up to 3)
  const topDebtors = customersWithBalance
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)

  // Recent Activity across all customers (up to 5)
  const allTx = Object.values(transactions).flat()
  const recentTx = allTx
    .sort((a, b) => {
      const dateDiff = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      if (dateDiff !== 0) return dateDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 5)

  const isLoading = isCustomersLoading || isTxLoading

  const handleDebtorReminder = async (phone: string, name: string, balance: number) => {
    const storeName = profile?.business_name || 'My Store'
    const url = sendWhatsAppReminder(phone, name, balance, storeName)
    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Error', 'WhatsApp is not installed on this device.')
      }
    } catch (err) {
      console.error('[quickReminder]', err)
      Alert.alert('Error', 'Could not open reminder link.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'left', 'right']}>
      {/* Navbar Header */}
      <View className="bg-white px-6 py-4 flex-row items-center justify-between border-b border-neutral-200 shadow-sm">
        <TouchableOpacity
          onPress={() => setIsAccountModalOpen(true)}
          className="flex-row items-center active:scale-95"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md">
            <Text className="text-white font-extrabold text-lg">
              {profile?.business_name?.charAt(0).toUpperCase() || 'K'}
            </Text>
          </View>
          <View className="ml-3">
            <Text className="text-neutral-900 font-bold text-base leading-tight">
              {profile?.business_name || 'My Business'} ▾
            </Text>
            {profile?.owner_name && (
              <Text className="text-text-secondary text-[10px] mt-0.5">Owner: {profile.owner_name}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View className="flex-row items-center">
          <TouchableOpacity
            style={{ backgroundColor: '#1a3c6e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 }}
            onPress={() => router.push('/reports' as any)}
          >
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>📊 Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={signOut}
            className="border border-neutral-200 bg-white px-4 py-2 rounded-xl active:scale-95"
          >
            <Text className="text-text-secondary font-bold text-xs">Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Metrics Box */}
        <View className="px-6 pt-5">
          <View className="flex-row justify-between mb-5 space-x-3">
            <View className="flex-1 bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <Text className="text-text-secondary text-[9px] font-bold uppercase">YOU GET</Text>
              <Text className="text-danger font-black text-lg mt-0.5">{formatINR(totalReceivable)}</Text>
            </View>

            <View className="flex-1 bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs">
              <Text className="text-text-secondary text-[9px] font-bold uppercase">YOU PAY</Text>
              <Text className="text-success font-black text-lg mt-0.5">{formatINR(totalPayable)}</Text>
            </View>

            <View className={`flex-1 border rounded-2xl p-4 shadow-xs ${
              netBalance > 0
                ? 'bg-danger/5 border-danger/10'
                : netBalance < 0
                ? 'bg-amber-500/5 border-amber-500/10'
                : 'bg-neutral-900 border-neutral-800'
            }`}>
              <Text className={`text-[9px] font-bold ${netBalance === 0 ? 'text-white/75' : netBalance > 0 ? 'text-danger' : 'text-amber-600'}`}>
                NET BAL
              </Text>
              <Text className={`font-black text-lg mt-0.5 ${netBalance === 0 ? 'text-white' : netBalance > 0 ? 'text-danger' : 'text-amber-600'}`}>
                {netBalance < 0 ? '-' : ''}
                {formatINR(Math.abs(netBalance))}
              </Text>
            </View>
          </View>
        </View>

        {isLoading && !refreshing ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#1a73e8" />
            <Text className="text-text-secondary font-bold text-xs mt-3">Loading dashboard...</Text>
          </View>
        ) : (
          <View className="space-y-6">
            
            {/* Top Debtors widget */}
            {topDebtors.length > 0 && (
              <View className="px-6">
                <Text className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider mb-3">
                  Top Debtors
                </Text>
                <View className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-xs divide-y divide-neutral-100">
                  {topDebtors.map((debtor) => (
                    <View key={debtor.id} className="flex-row items-center justify-between p-4">
                      <View className="flex-1 pr-3">
                        <Text className="text-neutral-900 font-bold text-sm">{debtor.name}</Text>
                        <Text className="text-danger font-extrabold text-xs mt-0.5">{formatINR(debtor.balance)}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => router.push(`/customer/${debtor.id}`)}
                          className="px-3 py-2 border border-neutral-200 rounded-lg active:scale-95 mr-2"
                        >
                          <Text className="text-text-secondary font-bold text-[10px]">Open</Text>
                        </TouchableOpacity>
                        {debtor.phone && (
                          <TouchableOpacity
                            onPress={() => handleDebtorReminder(debtor.phone!, debtor.name, debtor.balance)}
                            className="p-2 bg-success/15 rounded-lg active:scale-95"
                          >
                            <Text className="text-success text-xs font-bold">💬</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Recent Activity widget */}
            {recentTx.length > 0 && (
              <View className="px-6">
                <Text className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider mb-3">
                  Recent Activity
                </Text>
                <View className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-xs divide-y divide-neutral-100">
                  {recentTx.map((tx) => {
                    const matchedCustomer = customers.find((c) => c.id === tx.customer_id)
                    const isCredit = tx.type === 'credit'
                    const shortDate = (() => {
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                      const d = new Date(tx.entry_date)
                      if (isNaN(d.getTime())) return ''
                      const day = String(d.getDate()).padStart(2, '0')
                      const month = months[d.getMonth()]
                      return `${day} ${month}`
                    })()
                    return (
                      <TouchableOpacity
                        key={tx.id}
                        onPress={() => router.push(`/customer/${tx.customer_id}`)}
                        className="p-4 active:bg-neutral-50"
                      >
                        <View className="flex-row justify-between items-start">
                          <Text className="font-bold text-xs text-neutral-900 flex-1 pr-2 truncate">
                            {matchedCustomer?.name || 'Customer'}
                          </Text>
                          <Text className="text-[9px] text-text-secondary font-semibold">{shortDate}</Text>
                        </View>
                        
                        <View className="flex-row justify-between items-center mt-1.5">
                          <Text className="text-[10px] text-text-secondary flex-1 pr-3 truncate">
                            {tx.note || (isCredit ? 'Gave credit' : 'Received paid')}
                          </Text>
                          {isCredit ? (
                            <Text className="text-xs font-extrabold text-danger">-{formatINR(tx.amount)}</Text>
                          ) : (
                            <Text className="text-xs font-extrabold text-success">+{formatINR(tx.amount)}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Customer Directory */}
            <View className="px-6">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider">
                  Customer Ledger List
                </Text>
                <Text className="text-[10px] font-bold text-text-secondary">
                  {filteredCustomers.length} total
                </Text>
              </View>

              {/* Action row */}
              <View className="flex-row gap-3 items-center mb-4">
                <View className="flex-1 bg-white border border-neutral-200 rounded-2xl px-4 py-3 flex-row items-center focus-within:border-primary">
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search ledger list..."
                    className="flex-1 text-text-primary font-semibold text-xs outline-none"
                  />
                </View>

                <TouchableOpacity
                  onPress={() => router.push('/customer/new')}
                  className="bg-primary px-4 py-3.5 rounded-2xl flex-row items-center justify-center shadow-md active:scale-95"
                >
                  <Text className="text-white font-bold text-xs">➕ Add</Text>
                </TouchableOpacity>
              </View>

              {filteredCustomers.length === 0 ? (
                <View className="items-center justify-center py-12 bg-white border border-neutral-100 rounded-3xl shadow-sm px-6">
                  <Text className="text-2xl">👥</Text>
                  <Text className="text-neutral-900 font-bold text-sm mt-3 text-center">
                    {searchQuery ? 'No matching names' : 'No records found'}
                  </Text>
                </View>
              ) : (
                <View className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-xs">
                  {filteredCustomers.map((customer, idx) => {
                    const isOwed = customer.balance > 0
                    const isPaying = customer.balance < 0
                    return (
                      <TouchableOpacity
                        key={customer.id}
                        onPress={() => router.push(`/customer/${customer.id}`)}
                        className={`flex-row items-center justify-between px-5 py-4 active:bg-neutral-50 ${
                          idx > 0 ? 'border-t border-neutral-100' : ''
                        }`}
                      >
                        <View className="flex-row items-center">
                          <View className={`h-9 w-9 items-center justify-center rounded-xl ${
                            isOwed
                              ? 'bg-danger/10'
                              : isPaying
                              ? 'bg-amber-500/10'
                              : 'bg-neutral-100'
                          }`}>
                            <Text className={`font-bold text-sm ${
                              isOwed
                                ? 'text-danger'
                                : isPaying
                                ? 'text-amber-600'
                                : 'text-primary'
                            }`}>
                              {customer.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="ml-3">
                            <Text className="text-neutral-900 font-bold text-sm">{customer.name}</Text>
                            <Text className="text-text-secondary text-[9px] mt-0.5">
                              {customer.phone ? `+91 ${customer.phone.replace(/^\+91/, '')}` : 'No phone'}
                            </Text>
                          </View>
                        </View>

                        <View className="items-end">
                          {isOwed ? (
                            <>
                              <Text className="text-danger font-extrabold text-sm">{formatINR(customer.balance)}</Text>
                              <Text className="text-danger text-[8px] font-bold mt-0.5">Owes You ↑</Text>
                            </>
                          ) : isPaying ? (
                            <>
                              <Text className="text-amber-600 font-extrabold text-sm">{formatINR(Math.abs(customer.balance))}</Text>
                              <Text className="text-amber-600 text-[8px] font-bold mt-0.5">You Owe ↓</Text>
                            </>
                          ) : (
                            <>
                              <Text className="text-text-secondary font-extrabold text-sm">₹0</Text>
                              <Text className="text-success text-[8px] font-bold mt-0.5">Settled ✓</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>

          </View>
        )}
      </ScrollView>

      {/* Account Switcher Modal */}
      <Modal
        visible={isAccountModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAccountModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View className="w-full bg-white rounded-t-3xl border-t border-neutral-200 px-6 py-6 pb-12">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-neutral-900 font-extrabold text-lg">Switch Account</Text>
              <TouchableOpacity onPress={() => setIsAccountModalOpen(false)} className="p-1">
                <Text className="text-neutral-400 font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[300px] mb-6">
              {savedAccounts.map((account) => {
                const isActive = account.userId === session?.user?.id
                return (
                  <View
                    key={account.userId}
                    className={`flex-row items-center justify-between p-3.5 rounded-2xl mb-2.5 border ${
                      isActive
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-neutral-50 border-neutral-100'
                    }`}
                  >
                    <TouchableOpacity
                      onPress={() => handleSwitchAccount(account)}
                      className="flex-row items-center flex-1"
                    >
                      <View className={`h-10 w-10 items-center justify-center rounded-xl shadow-sm ${
                        isActive ? 'bg-primary' : 'bg-neutral-300'
                      }`}>
                        <Text className="text-white font-extrabold text-base">
                          {account.avatarLetter}
                        </Text>
                      </View>
                      <View className="ml-3.5 flex-1">
                        <Text className="text-neutral-900 font-bold text-sm leading-snug">
                          {account.businessName || 'My Business'}
                        </Text>
                        <Text className="text-text-secondary text-[10px]">
                          Owner: {account.profileName || 'No Owner'} • {account.email}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View className="flex-row items-center">
                      {isActive && (
                        <Text className="text-primary font-black text-sm mr-2">✓</Text>
                      )}
                      {!isActive && (
                        <TouchableOpacity
                          onPress={() => handleRemoveAccount(account.userId)}
                          className="p-2 bg-danger/5 border border-danger/10 rounded-xl"
                        >
                          <Text className="text-danger text-[10px] font-bold">🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setIsAccountModalOpen(false)
                router.push('/(auth)/setup-profile?newAccount=true')
              }}
              className="w-full py-4 rounded-2xl bg-primary items-center justify-center shadow-md active:scale-95"
            >
              <Text className="text-white font-bold text-sm tracking-wide">➕ Add Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
