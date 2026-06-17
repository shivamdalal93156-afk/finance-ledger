import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface CustomerBalance {
  id: string
  name: string
  phone: string | null
  credit: number
  debit: number
}

export default function CustomerListPDF() {
  const router = useRouter()
  const { session, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<CustomerBalance[]>([])

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return
      try {
        const { data: custs } = await supabase
          .from('customers')
          .select('id, name, phone')
          .eq('user_id', session.user.id)
          .order('name')

        if (!custs) return

        const { data: txns } = await supabase
          .from('transactions')
          .select('customer_id, amount, type')
          .eq('user_id', session.user.id)

        const balMap: Record<string, { credit: number; debit: number }> = {}
        txns?.forEach((t: any) => {
          if (!balMap[t.customer_id]) balMap[t.customer_id] = { credit: 0, debit: 0 }
          if (t.type === 'credit') balMap[t.customer_id].credit += t.amount
          else balMap[t.customer_id].debit += t.amount
        })

        setCustomers(custs.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          credit: balMap[c.id]?.credit || 0,
          debit: balMap[c.id]?.debit || 0,
        })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const downloadPDF = async () => {
    const rows_html = customers.map(c => {
      const net = c.credit - c.debit
      return `
        <tr>
          <td>${c.name}</td>
          <td>${c.phone || '-'}</td>
          <td style="color:#2e7d32">₹${c.credit}</td>
          <td style="color:#c62828">₹${c.debit}</td>
          <td style="color:${net >= 0 ? '#2e7d32' : '#c62828'};font-weight:bold">
            ${net >= 0 ? '+' : '-'}₹${Math.abs(net)}
          </td>
        </tr>
      `
    }).join('')

    const html = `
      <html><head><style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        h2 { color: #1a3c6e; }
        .meta { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a3c6e; color: white; padding: 8px; text-align: left; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 20px; color: #aaa; font-size: 10px; }
      </style></head><body>
        <h2>Customer List</h2>
        <div class="meta">
          <b>${profile?.business_name || ''}</b><br/>
          Total Customers: ${customers.length}
        </div>
        <table>
          <tr><th>Name</th><th>Phone</th><th>Credit (+)</th><th>Debit (-)</th><th>Net Balance</th></tr>
          ${rows_html}
        </table>
        <div class="footer">Report generated on ${new Date().toLocaleString('en-IN')}</div>
      </body></html>
    `

    try {
      const fileName = `CustomerList_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      await Sharing.shareAsync(uri, { 
        mimeType: 'application/pdf', 
        dialogTitle: 'Open or Save PDF',
        UTI: 'com.adobe.pdf'
      })
    } catch (err: any) {
      Alert.alert('Error', 'Could not generate PDF: ' + err.message)
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Customer List PDF</Text>
      </View>

      {loading ? (
        <ActivityIndicator size='large' color='#1a3c6e' style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={s.list}>
          {customers.map(c => {
            const net = c.credit - c.debit
            return (
              <View key={c.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{c.name}</Text>
                  {c.phone ? <Text style={s.rowPhone}>{c.phone}</Text> : null}
                </View>
                <Text style={[s.rowBal, { color: net >= 0 ? '#2e7d32' : '#c62828' }]}>
                  {net >= 0 ? '+' : '-'}₹{Math.abs(net)}
                </Text>
              </View>
            )
          })}
          {customers.length === 0 && (
            <Text style={s.empty}>No customers found</Text>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={s.downloadBtn} onPress={downloadPDF}>
        <Text style={s.downloadText}>⬇ DOWNLOAD PDF</Text>
      </TouchableOpacity>
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
  list: { flex: 1, padding: 12 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 8, padding: 14, marginBottom: 8, elevation: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowPhone: { fontSize: 12, color: '#888', marginTop: 2 },
  rowBal: { fontSize: 16, fontWeight: 'bold' },
  downloadBtn: { backgroundColor: PRIMARY, margin: 12, borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  downloadText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
})
