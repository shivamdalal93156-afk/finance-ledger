import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, Modal, StyleSheet
} from 'react-native'

interface CalendarPickerProps {
  visible: boolean
  title?: string
  selectedDate?: string // YYYY-MM-DD
  onConfirm: (date: string) => void
  onCancel: () => void
  onRemove?: () => void
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPicker({
  visible, title = 'Select Date', selectedDate, onConfirm, onCancel, onRemove
}: CalendarPickerProps) {
  const today = new Date()
  const initDate = selectedDate ? new Date(selectedDate) : today

  const [viewYear, setViewYear] = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth())
  const [pickedDate, setPickedDate] = useState<Date>(initDate)

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleConfirm = () => {
    const y = pickedDate.getFullYear()
    const m = String(pickedDate.getMonth() + 1).padStart(2, '0')
    const d = String(pickedDate.getDate()).padStart(2, '0')
    onConfirm(`${y}-${m}-${d}`)
  }

  const isSelected = (day: number) =>
    pickedDate.getFullYear() === viewYear &&
    pickedDate.getMonth() === viewMonth &&
    pickedDate.getDate() === day

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day

  const totalDays = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]

  return (
    <Modal visible={visible} transparent animationType='fade'>
      <View style={s.overlay}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerYear}>{viewYear}</Text>
            <Text style={s.headerDate}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][pickedDate.getDay()]}, {MONTHS[pickedDate.getMonth()].slice(0,3)} {pickedDate.getDate()}
            </Text>
          </View>

          {/* Month navigation */}
          <View style={s.nav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Text style={s.navArrow}>{'‹'}</Text>
            </TouchableOpacity>
            <Text style={s.navTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <Text style={s.navArrow}>{'›'}</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.dayRow}>
            {DAYS.map((d, i) => (
              <Text key={i} style={s.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Date grid */}
          <View style={s.grid}>
            {cells.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={s.cell}
                disabled={!day}
                onPress={() => day && setPickedDate(new Date(viewYear, viewMonth, day))}
              >
                {day ? (
                  <View style={[
                    s.dateCircle,
                    isSelected(day) && s.selectedCircle,
                    !isSelected(day) && isToday(day) && s.todayCircle
                  ]}>
                    <Text style={[
                      s.dateText,
                      isSelected(day) && s.selectedText,
                      !isSelected(day) && isToday(day) && s.todayText
                    ]}>{day}</Text>
                  </View>
                ) : <View style={s.cell} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Buttons */}
          <View style={s.buttons}>
            {onRemove && (
              <TouchableOpacity onPress={onRemove}>
                <Text style={s.removeBtn}>REMOVE</Text>
              </TouchableOpacity>
            )}
            <View style={s.rightBtns}>
              <TouchableOpacity onPress={onCancel} style={s.cancelBtn}>
                <Text style={s.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={s.okBtn}>
                <Text style={s.okText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const PRIMARY = '#1a3c6e'

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: 'white', borderRadius: 4, width: '90%', overflow: 'hidden' },
  header: { backgroundColor: PRIMARY, padding: 16 },
  headerYear: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  headerDate: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 24, color: '#555' },
  navTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  dayRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 12, color: '#888', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8 },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  selectedCircle: { backgroundColor: PRIMARY },
  todayCircle: { borderWidth: 1, borderColor: PRIMARY },
  dateText: { fontSize: 13, color: '#333' },
  selectedText: { color: 'white', fontWeight: 'bold' },
  todayText: { color: PRIMARY, fontWeight: 'bold' },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  rightBtns: { flexDirection: 'row', gap: 16 },
  removeBtn: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  cancelBtn: { padding: 8 },
  cancelText: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  okBtn: { padding: 8 },
  okText: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
})
