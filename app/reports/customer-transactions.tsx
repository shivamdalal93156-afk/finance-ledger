import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import CalendarPicker from '../../components/CalendarPicker'

interface TxnRow {
  customerName: string
  date: string
  amount: number
  type: 'credit' | 'debit'
  note: string | null
}

export default function CustomerTransactionsReport() {
  const router = useRouter()
  const { session, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<TxnRow[]>([])
  const [search, setSearch] = useState('')

  const today = new Date()
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(todayStr)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  const formatDisplay = (d: string) => {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${day} ${months[parseInt(m) - 1]} ${y}`
  }

  const fetchData = async () => {
    if (!session?.user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, note, entry_date, customers(name)')
        .eq('user_id', session.user.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: false })

      if (error) throw error

      const mapped: TxnRow[] = (data || []).map((t: any) => ({
        customerName: t.customers?.name || 'Unknown',
        date: t.entry_date,
        amount: t.amount,
        type: t.type,
        note: t.note,
      }))
      setRows(mapped)
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [startDate, endDate])

  const filtered = rows.filter(r =>
    r.customerName.toLowerCase().includes(search.toLowerCase())
  )

  const totalCredit = filtered.reduce((s, r) => r.type === 'credit' ? s + r.amount : s, 0)
  const totalDebit = filtered.reduce((s, r) => r.type === 'debit' ? s + r.amount : s, 0)
  const net = totalCredit - totalDebit

  const downloadPDF = async () => {
    const rows_html = filtered.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.customerName}</td>
        <td>${r.note || '-'}</td>
        <td style="color:#c62828">${r.type === 'debit' ? '₹' + r.amount : ''}</td>
        <td style="color:#2e7d32">${r.type === 'credit' ? '₹' + r.amount : ''}</td>
      </tr>
    `).join('')

    const html = `
      <html><head><style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        h2 { color: #1a3c6e; }
        .meta { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a3c6e; color: white; padding: 8px; text-align: left; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #f9f9f9; }
        .total { font-weight: bold; background: #f0f4ff; }
        .footer { margin-top: 20px; color: #aaa; font-size: 10px; }
      </style></head><body>
        <h2>Account Statement</h2>
        <div class="meta">
          <b>${profile?.business_name || ''}</b><br/>
          Period: ${formatDisplay(startDate)} to ${formatDisplay(endDate)}<br/>
          Total Entries: ${filtered.length}
        </div>
        <table>
          <tr><th>Date</th><th>Name</th><th>Details</th><th>Debit (-)</th><th>Credit (+)</th></tr>
          ${rows_html}
          <tr class="total">
            <td colspan="3">Grand Total</td>
            <td style="color:#c62828">₹${totalDebit}</td>
            <td style="color:#2e7d32">₹${totalCredit}</td>
          </tr>
        </table>
        <div class="footer">Report generated on ${new Date().toLocaleString('en-IN')}</div>
      </body></html>
    `

    try {
      const fileName = `Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`
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
        <Text style={s.headerTitle}>View Report</Text>
      </View>

      <View style={s.dateRow}>
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowStartPicker(true)}>
          <Text style={s.dateBtnLabel}>START DATE</Text>
          <Text style={s.dateBtnValue}>📅 {formatDisplay(startDate)}</Text>
        </TouchableOpacity>
        <View style={s.dateDivider} />
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowEndPicker(true)}>
          <Text style={s.dateBtnLabel}>END DATE</Text>
          <Text style={s.dateBtnValue}>📅 {formatDisplay(endDate)}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder='Search customer...'
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={s.summary}>
        <View style={s.sumBox}>
          <Text style={s.sumLabel}>YOU GOT</Text>
          <Text style={[s.sumAmt, { color: '#2e7d32' }]}>₹{totalCredit}</Text>
        </View>
        <View style={s.sumBox}>
          <Text style={s.sumLabel}>YOU GAVE</Text>
          <Text style={[s.sumAmt, { color: '#c62828' }]}>₹{totalDebit}</Text>
        </View>
        <View style={s.sumBox}>
          <Text style={s.sumLabel}>NET BAL</Text>
          <Text style={[s.sumAmt, { color: net >= 0 ? '#2e7d32' : '#c62828' }]}>₹{Math.abs(net)}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size='large' color='#1a3c6e' style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={s.list}>
          {filtered.length === 0 ? (
            <Text style={s.empty}>No transactions found</Text>
          ) : filtered.map((r, i) => (
            <View key={i} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{r.customerName}</Text>
                <Text style={s.rowDate}>{formatDisplay(r.date)}</Text>
                {r.note ? <Text style={s.rowNote}>{r.note}</Text> : null}
              </View>
              <Text style={[s.rowAmt, { color: r.type === 'credit' ? '#2e7d32' : '#c62828' }]}>
                {r.type === 'credit' ? '+' : '-'}₹{r.amount}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={s.downloadBtn} onPress={downloadPDF}>
        <Text style={s.downloadText}>⬇ DOWNLOAD</Text>
      </TouchableOpacity>

      <CalendarPicker
        visible={showStartPicker}
        selectedDate={startDate}
        onConfirm={d => { setStartDate(d); setShowStartPicker(false) }}
        onCancel={() => setShowStartPicker(false)}
      />
      <CalendarPicker
        visible={showEndPicker}
        selectedDate={endDate}
        onConfirm={d => { setEndDate(d); setShowEndPicker(false) }}
        onCancel={() => setShowEndPicker(false)}
      />
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
  dateRow: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
  dateBtn: { flex: 1, padding: 14 },
  dateBtnLabel: { fontSize: 10, color: '#888', fontWeight: '700', letterSpacing: 0.5 },
  dateBtnValue: { fontSize: 13, color: PRIMARY, fontWeight: '600', marginTop: 4 },
  dateDivider: { width: 1, backgroundColor: '#eee', marginVertical: 10 },
  searchRow: { backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  summary: { flexDirection: 'row', backgroundColor: 'white', marginVertical: 8, marginHorizontal: 12, borderRadius: 8, padding: 12, elevation: 1 },
  sumBox: { flex: 1, alignItems: 'center' },
  sumLabel: { fontSize: 10, color: '#888', fontWeight: '700' },
  sumAmt: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  list: { flex: 1, paddingHorizontal: 12 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 8, padding: 14, marginBottom: 8, elevation: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowDate: { fontSize: 11, color: '#888', marginTop: 2 },
  rowNote: { fontSize: 11, color: '#aaa', marginTop: 1 },
  rowAmt: { fontSize: 16, fontWeight: 'bold' },
  downloadBtn: { backgroundColor: PRIMARY, margin: 12, borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  downloadText: { color: 'white', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },
})
