import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

const reports = [
  {
    id: 'customer-transactions',
    title: 'Customer Transactions report',
    subtitle: 'Summary of all customer transactions',
    icon: '📊',
  },
  {
    id: 'customer-list',
    title: 'Customer list pdf',
    subtitle: 'List of all your customers with balance',
    icon: '👥',
  },
]

export default function ReportsScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>View Reports</Text>
      </View>

      <ScrollView style={s.body}>
        <Text style={s.sectionLabel}>Customer</Text>
        {reports.map(r => (
          <TouchableOpacity
            key={r.id}
            style={s.item}
            onPress={() => router.push(`/reports/${r.id}` as any)}
          >
            <Text style={s.itemIcon}>{r.icon}</Text>
            <View style={s.itemText}>
              <Text style={s.itemTitle}>{r.title}</Text>
              <Text style={s.itemSubtitle}>{r.subtitle}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const PRIMARY = '#1a3c6e'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { marginRight: 12 },
  backArrow: { color: 'white', fontSize: 22 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  body: { flex: 1, padding: 16 },
  sectionLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 8, padding: 16, marginBottom: 10, elevation: 1 },
  itemIcon: { fontSize: 24, marginRight: 14 },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  itemSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  chevron: { fontSize: 20, color: '#aaa' },
})
