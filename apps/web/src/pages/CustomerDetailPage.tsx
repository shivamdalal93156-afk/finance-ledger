import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCustomerStore } from '../store/customerStore'
import { useTransactionStore } from '../store/transactionStore'
import { useAuthStore } from '../store/authStore'
import { sendWhatsAppReminder } from '@khataclone/shared/utils'
import type { Transaction } from '@khataclone/shared/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const getLocalDateString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { customers, updateCustomer, deleteCustomer, fetchCustomers } = useCustomerStore()
  const { profile } = useAuthStore()
  const {
    transactions,
    isLoading: isTxLoading,
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactionStore()

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false)
  const [txModalType, setTxModalType] = useState<'credit' | 'debit'>('credit')
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false)

  // Edit Customer Form State
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add Transaction Form State
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txDate, setTxDate] = useState(getLocalDateString())
  const [txError, setTxError] = useState<string | null>(null)

  // Edit Transaction Form State
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [editTxAmount, setEditTxAmount] = useState('')
  const [editTxNote, setEditTxNote] = useState('')
  const [editTxError, setEditTxError] = useState<string | null>(null)
  const [editTxType, setEditTxType] = useState<'credit' | 'debit'>('credit')
  const [editTxDate, setEditTxDate] = useState('')

  // Date range filter state
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  // Find the customer
  const customer = customers.find((c) => c.id === id)

  useEffect(() => {
    if (customers.length === 0) {
      fetchCustomers()
    }
    if (id) {
      fetchTransactions(id)
    }
  }, [id, customers.length, fetchCustomers, fetchTransactions])

  // Initialize edit customer form
  useEffect(() => {
    if (customer) {
      setEditName(customer.name)
      setEditPhone(customer.phone ? customer.phone.replace(/^\+91/, '') : '')
      setEditAddress(customer.address || '')
      setEditNotes(customer.notes || '')
    }
  }, [customer, isEditModalOpen])

  if (!customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
        <p className="mt-3 text-sm text-text-secondary font-bold">Loading customer details...</p>
      </div>
    )
  }

  // Handle Customer Actions
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setEditError(null)
    setIsSubmitting(true)

    try {
      const updated = await updateCustomer(id, {
        name: editName,
        phone: editPhone ? `+91${editPhone}` : undefined,
        address: editAddress || undefined,
        notes: editNotes || undefined,
      })

      if (updated) {
        setIsEditModalOpen(false)
      } else {
        setEditError(useCustomerStore.getState().error || 'Failed to update customer')
      }
    } catch (err: any) {
      setEditError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!id) return
    setIsSubmitting(true)

    try {
      const deleted = await deleteCustomer(id)
      if (deleted) {
        navigate('/')
      } else {
        alert(useCustomerStore.getState().error || 'Failed to delete customer')
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Transaction Actions
  const handleOpenAddTxModal = (type: 'credit' | 'debit') => {
    setTxModalType(type)
    setTxAmount('')
    setTxNote('')
    setTxDate(getLocalDateString())
    setTxError(null)
    setIsAddTxModalOpen(true)
  }

  const handleAddTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setTxError(null)
    setIsSubmitting(true)

    const amount = parseFloat(txAmount)
    if (isNaN(amount) || amount <= 0) {
      setTxError('Amount must be greater than 0')
      setIsSubmitting(false)
      return
    }

    try {
      const newTx = await addTransaction(id, {
        type: txModalType,
        amount,
        note: txNote || undefined,
        entry_date: txDate,
      })

      if (newTx) {
        setIsAddTxModalOpen(false)
      } else {
        setTxError(useTransactionStore.getState().error || 'Failed to record transaction')
      }
    } catch (err: any) {
      setTxError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEditTxModal = (tx: Transaction) => {
    setSelectedTxId(tx.id)
    setEditTxAmount(tx.amount.toString())
    setEditTxNote(tx.note || '')
    setEditTxType(tx.type)
    setEditTxDate(tx.entry_date)
    setEditTxError(null)
    setIsEditTxModalOpen(true)
  }

  const handleEditTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !selectedTxId) return
    setEditTxError(null)
    setIsSubmitting(true)

    const amount = parseFloat(editTxAmount)
    if (isNaN(amount) || amount <= 0) {
      setEditTxError('Amount must be greater than 0')
      setIsSubmitting(false)
      return
    }

    try {
      const updated = await updateTransaction(selectedTxId, id, {
        amount,
        note: editTxNote || undefined,
      })

      if (updated) {
        setIsEditTxModalOpen(false)
      } else {
        setEditTxError(useTransactionStore.getState().error || 'Failed to update transaction')
      }
    } catch (err: any) {
      setEditTxError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTxSubmit = async () => {
    if (!id || !selectedTxId) return
    if (!confirm('Are you sure you want to delete this transaction entry? This cannot be undone.')) return
    setIsSubmitting(true)

    try {
      const success = await deleteTransaction(selectedTxId, id)
      if (success) {
        setIsEditTxModalOpen(false)
      } else {
        alert(useTransactionStore.getState().error || 'Failed to delete transaction')
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
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

  const dateAdded = new Date(customer.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleSendReminder = () => {
    if (!customer.phone) return
    const businessName = profile?.business_name || 'My Store'
    const link = sendWhatsAppReminder(customer.phone, customer.name, balance, businessName)
    window.open(link, '_blank')
  }

  const handleSendSMSReminder = () => {
    if (!customer.phone) return
    const businessName = profile?.business_name || 'My Store'
    const cleanPhone = customer.phone.replace(/\D/g, '').replace(/^91/, '')
    const message = `Hi ${customer.name}, aapka ${businessName} mein ${formatINR(balance)} baaki hai. Kripya jaldi settlement karein. Dhanyawad! 🙏`
    const smsUrl = `sms:+91${cleanPhone}?body=${encodeURIComponent(message)}`
    window.open(smsUrl)
  }

  const handleDownloadStatement = () => {
    if (!customer) return

    const cleanASCII = (str: string): string => {
      if (!str) return ''
      const withRs = str.replace(/₹/g, 'Rs. ')
      return withRs.replace(/[^\x20-\x7E]/g, '')
    }

    const formatPDFAmount = (amount: number): string => {
      const formattedNumber = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
      return `Rs. ${formattedNumber}`
    }

    const formatPDFDate = (dateVal: string | Date): string => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const d = new Date(dateVal)
      if (isNaN(d.getTime())) return ''
      const day = String(d.getDate()).padStart(2, '0')
      const month = months[d.getMonth()]
      const year = d.getFullYear()
      return `${day} ${month} ${year}`
    }

    const doc = new jsPDF()
    const businessPhone = profile?.phone ? `+91 ${profile.phone.replace(/^\+91/, '')}` : ''

    // 1. TOP BAR
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(cleanASCII(businessPhone), 14, 20)

    // Ledger icon (small blue rectangle) and app name
    doc.setFillColor(26, 115, 232)
    doc.rect(168, 16.5, 3.5, 4.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(26, 115, 232)
    doc.text('KhataClone', 196, 20, { align: 'right' })

    // Thin divider line below
    doc.setDrawColor(220)
    doc.setLineWidth(0.5)
    doc.line(14, 25, 196, 25)

    // 2. TITLE (centered)
    let periodStr = 'All Time'
    if (appliedFrom || appliedTo) {
      const fromStr = appliedFrom ? formatPDFDate(appliedFrom) : 'Beginning'
      const toStr = appliedTo ? formatPDFDate(appliedTo) : 'Today'
      periodStr = `${fromStr} - ${toStr}`
    } else if (filteredTransactions.length > 0) {
      const fromStr = formatPDFDate(filteredTransactions[filteredTransactions.length - 1].entry_date)
      const toStr = formatPDFDate(filteredTransactions[0].entry_date)
      periodStr = `${fromStr} - ${toStr}`
    } else {
      periodStr = `${formatPDFDate(new Date())} - ${formatPDFDate(new Date())}`
    }

    let yPos = 37
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text(`${cleanASCII(customer.name)} Statement`, 105, yPos, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`(${periodStr})`, 105, yPos + 6, { align: 'center' })

    yPos += 14

    // 3. SUMMARY BOX (4 columns with border)
    doc.setDrawColor(200)
    doc.setLineWidth(0.5)
    doc.rect(14, yPos, 182, 22)

    // Vertical column divider lines
    doc.line(14 + 45.5, yPos, 14 + 45.5, yPos + 22)
    doc.line(14 + 91, yPos, 14 + 91, yPos + 22)
    doc.line(14 + 136.5, yPos, 14 + 136.5, yPos + 22)

    // Column Labels
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text('Opening Balance', 36.75, yPos + 7, { align: 'center' })
    doc.text('Total Debit(-)', 82.25, yPos + 7, { align: 'center' })
    doc.text('Total Credit(+)', 127.75, yPos + 7, { align: 'center' })
    doc.text('Net Balance', 173.25, yPos + 7, { align: 'center' })

    // Column Values
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(60)
    doc.text('Rs. 0.00', 36.75, yPos + 15, { align: 'center' })
    doc.text(formatPDFAmount(totalGaveForPeriod), 82.25, yPos + 15, { align: 'center' })
    doc.text(formatPDFAmount(totalReceivedForPeriod), 127.75, yPos + 15, { align: 'center' })

    // Net Balance with Dr/Cr and center label
    if (netForPeriod > 0) {
      doc.setTextColor(220, 38, 38) // red
      doc.text(`${formatPDFAmount(netForPeriod)} Dr`, 173.25, yPos + 13, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text(`(${cleanASCII(customer.name)} will give)`, 173.25, yPos + 19, { align: 'center' })
    } else if (netForPeriod < 0) {
      doc.setTextColor(22, 163, 74) // green [22,163,74]
      doc.text(`${formatPDFAmount(Math.abs(netForPeriod))} Cr`, 173.25, yPos + 13, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text(`(${cleanASCII(customer.name)} will get)`, 173.25, yPos + 19, { align: 'center' })
    } else {
      doc.setTextColor(120)
      doc.text('Rs. 0.00', 173.25, yPos + 13, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text('(Settled)', 173.25, yPos + 19, { align: 'center' })
    }

    yPos += 30

    // 4. ENTRY COUNT
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`No. of Entries: ${filteredTransactions.length} (All)`, 14, yPos)

    yPos += 5

    // 5. TRANSACTION TABLE
    const statementTxs = [...filteredTransactions].reverse()

    const bodyRows: any[][] = [
      ['', '(Opening Balance: 0.00)', '', '', 'Rs. 0.00']
    ]

    statementTxs.forEach((tx) => {
      const entryDate = new Date(tx.entry_date)
      const createdAt = new Date(tx.created_at)
      const datePart = formatPDFDate(entryDate)
      
      let hours = createdAt.getHours()
      const minutes = String(createdAt.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12
      hours = hours ? hours : 12
      const timePart = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
      const txDateStr = `${datePart}, ${timePart}`

      const isCredit = tx.type === 'credit'
      const description = cleanASCII(tx.note || (isCredit ? 'Credit entry' : 'Received payment'))
      const gaveVal = isCredit ? formatPDFAmount(tx.amount) : ''
      const receivedVal = !isCredit ? formatPDFAmount(tx.amount) : ''
      
      const suffix = tx.runningBalance > 0 ? ' Dr' : tx.runningBalance < 0 ? ' Cr' : ''
      const balanceVal = `${formatPDFAmount(Math.abs(tx.runningBalance))}${suffix}`

      bodyRows.push([txDateStr, description, gaveVal, receivedVal, balanceVal])
    })

    const finalNetSuffix = netForPeriod > 0 ? ' Dr' : netForPeriod < 0 ? ' Cr' : ''
    const finalNetBalanceVal = `${formatPDFAmount(Math.abs(netForPeriod))}${finalNetSuffix}`

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Details', 'Debit(-)', 'Credit(+)', 'Balance']],
      body: bodyRows,
      foot: [['', 'Total', formatPDFAmount(totalGaveForPeriod), formatPDFAmount(totalReceivedForPeriod), finalNetBalanceVal]],
      theme: 'striped',
      headStyles: {
        fillColor: [26, 115, 232],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 32, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 36, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.section === 'body') {
          // If first row (Opening Balance row), draw in grey
          if (data.row.index === 0) {
            data.cell.styles.textColor = [150, 150, 150]
            return
          }

          if (data.column.index === 2 && data.cell.text[0] !== '') {
            data.cell.styles.textColor = [220, 38, 38] // bold red
            data.cell.styles.fontStyle = 'bold'
          }
          else if (data.column.index === 3 && data.cell.text[0] !== '') {
            data.cell.styles.textColor = [22, 163, 74] // bold green
            data.cell.styles.fontStyle = 'bold'
          }
          else if (data.column.index === 4 && data.cell.text[0] !== '') {
            if (data.cell.text[0].includes('Dr')) {
              data.cell.styles.textColor = [220, 38, 38] // red for Dr
            } else if (data.cell.text[0].includes('Cr')) {
              data.cell.styles.textColor = [22, 163, 74] // green for Cr
            }
            data.cell.styles.fontStyle = 'bold'
          }
        } else if (data.row.section === 'foot') {
          if (data.column.index === 2) {
            data.cell.styles.textColor = [220, 38, 38]
          } else if (data.column.index === 3) {
            data.cell.styles.textColor = [22, 163, 74]
          } else if (data.column.index === 4) {
            if (data.cell.text[0].includes('Dr')) {
              data.cell.styles.textColor = [220, 38, 38]
            } else if (data.cell.text[0].includes('Cr')) {
              data.cell.styles.textColor = [22, 163, 74]
            }
          }
        }
      },
      margin: { top: 15, bottom: 20 },
    })

    // 6. FOOTER
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(140)
      
      const formatPDFDateYY = (dateVal: Date): string => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const d = new Date(dateVal)
        if (isNaN(d.getTime())) return ''
        const day = String(d.getDate()).padStart(2, '0')
        const month = months[d.getMonth()]
        const year = String(d.getFullYear()).slice(-2)
        return `${day} ${month} ${year}`
      }
      
      const formatPDFTimeOnly = (dateVal: Date): string => {
        const d = new Date(dateVal)
        let hours = d.getHours()
        const minutes = String(d.getMinutes()).padStart(2, '0')
        const ampm = hours >= 12 ? 'PM' : 'AM'
        hours = hours % 12
        hours = hours ? hours : 12
        const hoursStr = String(hours).padStart(2, '0')
        return `${hoursStr}:${minutes} ${ampm}`
      }

      const generatedOnStr = `Report Generated: ${formatPDFTimeOnly(new Date())} | ${formatPDFDateYY(new Date())}`

      doc.setDrawColor(230)
      doc.setLineWidth(0.5)
      doc.line(14, 282, 196, 282)
      
      doc.text(generatedOnStr, 14, 288)
      doc.text(`Page ${i} of ${pageCount}`, 196, 288, { align: 'right' })
    }

    const dateStr = new Date().toLocaleDateString('en-CA')
    doc.save(`Statement_${cleanASCII(customer.name).replace(/\s+/g, '_')}_${dateStr}.pdf`)
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-text-primary pb-20">
      {/* Header */}
      <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              ⬅️
            </button>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-lg ${
              balance > 0
                ? 'bg-danger/10 text-danger'
                : balance < 0
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-neutral-100 text-primary'
            }`}>
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">
                {customer.name}
              </h1>
              <p className="text-xs text-text-secondary">{formattedPhone}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadStatement}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors active:scale-95 flex items-center space-x-1.5"
            >
              <span>📄</span>
              <span>Download Statement</span>
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors active:scale-95"
            >
              Edit Info
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/25 transition-colors active:scale-95"
            >
              Delete Customer
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-8 md:grid-cols-3">
        
        {/* Info card */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
              Customer Details
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Name</p>
                <p className="text-sm font-semibold mt-1">{customer.name}</p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Phone</p>
                <p className="text-sm font-semibold mt-1">{formattedPhone}</p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Address</p>
                <p className="text-sm font-semibold mt-1">
                  {customer.address || <span className="text-text-secondary italic">No address added</span>}
                </p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Notes</p>
                <p className="text-sm font-semibold mt-1">
                  {customer.notes || <span className="text-text-secondary italic">No notes added</span>}
                </p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Added On</p>
                <p className="text-sm font-semibold mt-1">{dateAdded}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger logs */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Outstanding Balance Banner */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-3xl border p-6 shadow-sm ${
            balance > 0
              ? 'bg-danger/5 text-danger border-danger/10'
              : balance < 0
              ? 'bg-amber-500/5 border-amber-500/10 text-amber-600'
              : 'bg-success/5 border-success/10 text-success'
          }`}>
            <div>
              <p className="text-xs font-bold uppercase opacity-80">Net Balance</p>
              <h2 className="text-[2.5rem] font-black mt-1 leading-tight">
                {balance > 0
                  ? `You will get: ${formatINR(balance)}`
                  : balance < 0
                  ? `You will give: ${formatINR(Math.abs(balance))}`
                  : 'All Settled ✓'}
              </h2>
            </div>
            
            <div className="mt-4 sm:mt-0 flex flex-wrap gap-2 items-center">
              {balance > 0 ? (
                <>
                  <button
                    onClick={handleSendSMSReminder}
                    disabled={!customer.phone}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 ${
                      customer.phone
                        ? 'bg-slate-600 hover:bg-slate-700 text-white shadow-slate-600/10'
                        : 'bg-neutral-200 text-text-secondary cursor-not-allowed shadow-none'
                    }`}
                  >
                    <span>📱</span>
                    <span>{customer.phone ? 'SMS Reminder' : 'No phone'}</span>
                  </button>

                  <button
                    onClick={handleSendReminder}
                    disabled={!customer.phone}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 ${
                      customer.phone
                        ? 'bg-success hover:bg-success/90 text-white shadow-success/10'
                        : 'bg-neutral-200 text-text-secondary cursor-not-allowed shadow-none'
                    }`}
                  >
                    <span>💬</span>
                    <span>{customer.phone ? 'WhatsApp Reminder' : 'No phone'}</span>
                  </button>
                </>
              ) : balance === 0 ? (
                <button
                  disabled
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-success/20 border border-success/30 text-success cursor-not-allowed"
                >
                  Settled ✓
                </button>
              ) : null}
            </div>
          </div>

          {/* Ledger History List */}
          <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
              <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                Transaction History
              </h3>
              <span className="text-xs font-bold text-text-secondary">
                {txList.length} {txList.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {/* Date Range Filter Panel */}
            <div className="border-b border-neutral-200 bg-neutral-50/50 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none text-xs font-semibold text-text-primary bg-white focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none text-xs font-semibold text-text-primary bg-white focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center gap-3 sm:mb-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedFrom(filterFrom)
                      setAppliedTo(filterTo)
                    }}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-xs transition-colors active:scale-95"
                  >
                    Apply Filter
                  </button>

                  {(appliedFrom || appliedTo || filterFrom || filterTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterFrom('')
                        setFilterTo('')
                        setAppliedFrom('')
                        setAppliedTo('')
                      }}
                      className="text-xs font-bold text-text-secondary hover:text-primary transition-colors underline decoration-dotted"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Period Summary */}
              {(appliedFrom || appliedTo) && (
                <div className="pt-3 border-t border-neutral-200/60 grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-xl bg-neutral-100/50 p-2.5 border border-neutral-200/30">
                    <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Total Gave</p>
                    <p className="text-sm font-black text-danger mt-0.5">{formatINR(totalGaveForPeriod)}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-100/50 p-2.5 border border-neutral-200/30">
                    <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Total Received</p>
                    <p className="text-sm font-black text-success mt-0.5">{formatINR(totalReceivedForPeriod)}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 border ${
                    netForPeriod > 0
                      ? 'bg-danger/5 text-danger border-danger/10'
                      : netForPeriod < 0
                      ? 'bg-success/5 text-success border-success/10'
                      : 'bg-neutral-100/50 text-text-secondary border-neutral-200/30'
                  }`}>
                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-85">Net for Period</p>
                    <p className="text-sm font-black mt-0.5">
                      {netForPeriod < 0 ? '-' : ''}
                      {formatINR(Math.abs(netForPeriod))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isTxLoading && txList.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
                <p className="mt-3 text-sm text-text-secondary font-bold">Loading entries...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-3xl text-neutral-400">
                  📖
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-900">
                  {appliedFrom || appliedTo ? 'No transactions in this period' : 'No transactions recorded'}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-xs text-text-secondary leading-relaxed">
                  {appliedFrom || appliedTo
                    ? 'Try adjusting From / To date range limits.'
                    : 'Record gave (credit) or received (debit) transactions using the buttons below to populate ledger records.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredTransactions.map((tx) => {
                  const isCredit = tx.type === 'credit'
                  const txDate = new Date(tx.entry_date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                  const txTime = new Date(tx.created_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })
                  const txDateFormatted = `${txDate}, ${txTime}`
                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleOpenEditTxModal(tx)}
                      className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center space-x-2">
                          <p className="text-[0.75rem] text-neutral-500 font-medium">{txDateFormatted}</p>
                          {tx.is_edited && (
                            <span className="bg-neutral-200 text-text-secondary text-[8px] font-bold px-1.5 py-0.5 rounded">
                              EDITED
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-neutral-900 mt-1 truncate">
                          {tx.note || (isCredit ? 'Credit entry' : 'Received payment')}
                        </p>
                      </div>

                      <div className="text-right flex items-center space-x-6">
                        {/* Transaction Amount */}
                        <div className="w-24">
                          {isCredit ? (
                            <p className="font-extrabold text-danger">-{formatINR(tx.amount)}</p>
                          ) : (
                            <p className="font-extrabold text-success">+{formatINR(tx.amount)}</p>
                          )}
                        </div>

                        {/* Running Balance */}
                        <div className="w-28 text-right border-l border-neutral-200 pl-4">
                          <p className="text-xs font-bold text-text-secondary">Balance</p>
                          <p className={`text-xs font-black mt-0.5 ${
                            tx.runningBalance > 0
                              ? 'text-danger'
                              : tx.runningBalance < 0
                              ? 'text-amber-600'
                              : 'text-success'
                          }`}>
                            {tx.runningBalance > 0 ? 'Owes ' : tx.runningBalance < 0 ? 'Give ' : ''}
                            {formatINR(Math.abs(tx.runningBalance))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-200 bg-white px-6 py-4 shadow-xl">
        <div className="mx-auto flex max-w-5xl space-x-4">
          <button
            onClick={() => handleOpenAddTxModal('credit')}
            className="flex-1 h-[56px] rounded-xl bg-danger hover:bg-danger/90 text-white font-extrabold tracking-wider shadow-md active:scale-[0.98] flex items-center justify-center text-base"
          >
            🔴 GAVE (CREDIT)
          </button>
          <button
            onClick={() => handleOpenAddTxModal('debit')}
            className="flex-1 h-[56px] rounded-xl bg-success hover:bg-success/90 text-white font-extrabold tracking-wider shadow-md active:scale-[0.98] flex items-center justify-center text-base"
          >
            🟢 RECEIVED (DEBIT)
          </button>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isAddTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up">
            
            <div className={`px-6 py-5 text-white flex justify-between items-center ${
              txModalType === 'credit' ? 'bg-danger' : 'bg-success'
            }`}>
              <h3 className="text-lg font-bold">
                {txModalType === 'credit' ? 'You Gave (Credit)' : 'You Received (Debit)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(false)}
                className="text-white/80 hover:text-white text-xl font-bold"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTxSubmit} className="p-6 space-y-4">
              {txError && (
                <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-semibold">
                  {txError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Amount (₹) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="Enter amount (e.g. 500)"
                  className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 focus:border-primary outline-none font-bold text-lg placeholder:text-neutral-400"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="e.g. 2kg sugar, payment for bill #4"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Entry Date
                </label>
                <input
                  type="date"
                  max={getLocalDateString()}
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium text-text-primary"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxModalOpen(false)}
                  className="w-1/2 py-3.5 rounded-xl border border-neutral-200 font-bold text-text-secondary hover:bg-neutral-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !txAmount}
                  className={`w-1/2 py-3.5 rounded-xl text-white font-bold tracking-wide shadow-md ${
                    isSubmitting || !txAmount
                      ? 'bg-neutral-300 shadow-none'
                      : txModalType === 'credit'
                      ? 'bg-danger hover:bg-danger/90 shadow-danger/10'
                      : 'bg-success hover:bg-success/90 shadow-success/10'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Entry Modal */}
      {isEditTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up">
            
            <div className={`px-6 py-5 text-white flex justify-between items-center ${
              editTxType === 'credit' ? 'bg-danger' : 'bg-success'
            }`}>
              <h3 className="text-lg font-bold">Transaction Options</h3>
              <button
                type="button"
                onClick={() => setIsEditTxModalOpen(false)}
                className="text-white/80 hover:text-white text-xl font-bold"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditTxSubmit} className="p-6 space-y-4">
              {editTxError && (
                <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-semibold">
                  {editTxError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Type (Locked)
                </label>
                <input
                  type="text"
                  disabled
                  value={editTxType === 'credit' ? 'GAVE (CREDIT) 🔴' : 'RECEIVED (DEBIT) 🟢'}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-text-secondary font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Amount (₹) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 focus:border-primary outline-none font-bold text-lg placeholder:text-neutral-400"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={editTxNote}
                  onChange={(e) => setEditTxNote(e.target.value)}
                  placeholder="Enter note"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Entry Date (Locked for Edit)
                </label>
                <input
                  type="date"
                  disabled
                  value={editTxDate}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-text-secondary font-semibold cursor-not-allowed"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  *To modify dates or transaction type, delete this entry and create a new record.
                </p>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleDeleteTxSubmit}
                  className="w-1/3 py-3.5 rounded-xl border border-danger/20 bg-danger/5 hover:bg-danger/10 text-danger font-bold text-sm transition-colors"
                  disabled={isSubmitting}
                >
                  🗑️ Delete
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditTxModalOpen(false)}
                  className="w-1/3 py-3.5 rounded-xl border border-neutral-200 font-bold text-text-secondary hover:bg-neutral-100 text-sm transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/3 py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md shadow-primary/10 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Info Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up">
            
            <div className="bg-primary px-6 py-5 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Edit Customer Details</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-white/80 hover:text-white text-xl font-bold"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-semibold">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Phone Number
                </label>
                <div className="relative flex rounded-xl border border-neutral-200 focus-within:border-primary overflow-hidden">
                  <span className="flex items-center justify-center bg-neutral-100 px-3 text-text-secondary font-semibold border-r border-neutral-200 text-sm">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="99999 99999"
                    className="w-full px-4 py-3 outline-none text-text-primary font-medium placeholder:text-neutral-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Enter shop or residence address"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. wholesale customer, milk supplier"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400 h-24 resize-none"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 py-3.5 rounded-xl border border-neutral-200 font-bold text-text-secondary hover:bg-neutral-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editName.trim()}
                  className={`w-1/2 py-3.5 rounded-xl text-white font-bold tracking-wide shadow-md ${
                    isSubmitting || !editName.trim()
                      ? 'bg-neutral-300 shadow-none'
                      : 'bg-primary hover:bg-primary-dark shadow-primary/10'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger text-2xl mb-4">
              ⚠️
            </div>
            
            <h3 className="text-lg font-bold text-neutral-900">Delete Customer?</h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-neutral-900">{customer.name}</span>?
              <br />
              <span className="text-danger font-semibold mt-1 block">
                This will delete all transaction history for {customer.name}.
              </span>
            </p>

            <div className="flex space-x-3 pt-6">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-1/2 py-3.5 rounded-xl border border-neutral-200 font-bold text-text-secondary hover:bg-neutral-100 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className={`w-1/2 py-3.5 rounded-xl text-white font-bold tracking-wide shadow-md ${
                  isSubmitting ? 'bg-neutral-300' : 'bg-danger hover:bg-danger/90'
                }`}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
