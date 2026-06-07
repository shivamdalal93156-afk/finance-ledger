import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCustomerStore } from '../store/customerStore'
import { useTransactionStore } from '../store/transactionStore'
import { useStaffStore } from '../store/staffStore'
import { calculateBalance, sendWhatsAppReminder } from '@khataclone/shared/utils'
import type { AttendanceStatus } from '@khataclone/shared/types'

export function DashboardPage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuthStore()
  
  // Customer Store
  const { customers, isLoading: isCustomersLoading, error: customerError, fetchCustomers, addCustomer } = useCustomerStore()
  
  // Transaction Store
  const { transactions, isLoading: isTxLoading, error: txError, fetchAllUserTransactions } = useTransactionStore()
  
  // Staff Store
  const { staff, attendance, isLoading: isStaffLoading, error: staffError, fetchStaff, addStaff, deleteStaff, fetchAttendance, markAttendance } = useStaffStore()

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'customers' | 'staff'>('customers')
  
  // Dashboard Date Range Filter State
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  // Dashboard Customer Search
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Staff States
  const [staffSearchQuery, setStaffSearchQuery] = useState('')
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false)
  const [staffName, setStaffName] = useState('')
  const [staffPhone, setStaffPhone] = useState('')
  const [staffSalary, setStaffSalary] = useState('')
  const [staffJoinDate, setStaffJoinDate] = useState(new Date().toISOString().split('T')[0])
  const [staffSubmitError, setStaffSubmitError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [staffSubTab, setStaffSubTab] = useState<'list' | 'attendance'>('attendance')

  useEffect(() => {
    fetchCustomers()
    fetchAllUserTransactions()
  }, [fetchCustomers, fetchAllUserTransactions])

  useEffect(() => {
    if (activeTab === 'staff') {
      fetchStaff()
      fetchAttendance(selectedDate)
    }
  }, [activeTab, fetchStaff, fetchAttendance, selectedDate])

  const handleOpenAddModal = () => {
    setFormName('')
    setFormPhone('')
    setFormAddress('')
    setFormNotes('')
    setSubmitError(null)
    setIsAddModalOpen(true)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const newCustomer = await addCustomer({
        name: formName,
        phone: formPhone || undefined,
        address: formAddress || undefined,
        notes: formNotes || undefined,
      })

      if (newCustomer) {
        setIsAddModalOpen(false)
      } else {
        setSubmitError(useCustomerStore.getState().error || 'Failed to add customer')
      }
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenAddStaffModal = () => {
    setStaffName('')
    setStaffPhone('')
    setStaffSalary('')
    setStaffJoinDate(new Date().toISOString().split('T')[0])
    setStaffSubmitError(null)
    setIsAddStaffModalOpen(true)
  }

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffSubmitError(null)
    setIsSubmitting(true)

    const salary = parseFloat(staffSalary)
    if (staffSalary && (isNaN(salary) || salary < 0)) {
      setStaffSubmitError('Salary must be a positive number')
      setIsSubmitting(false)
      return
    }

    try {
      const newEmployee = await addStaff(
        staffName,
        staffPhone || undefined,
        staffSalary ? salary : undefined,
        staffJoinDate || undefined
      )

      if (newEmployee) {
        setIsAddStaffModalOpen(false)
      } else {
        setStaffSubmitError(useStaffStore.getState().error || 'Failed to add staff member')
      }
    } catch (err: any) {
      setStaffSubmitError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? All attendance history for this employee will be deleted.`)) return
    try {
      await deleteStaff(id)
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee')
    }
  }

  const handleMarkAttendance = async (staffId: string, status: AttendanceStatus) => {
    try {
      await markAttendance(staffId, selectedDate, status)
    } catch (err: any) {
      console.error('[attendanceError]', err)
    }
  }

  // Calculate customer balances in memory
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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
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

  // Top Debtors list (up to 5)
  const topDebtors = customersWithBalance
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)

  // Recent Activity across all customers (up to 5)
  const allTx = Object.values(transactions).flat()

  // Filter transactions across all customers based on dashboard applied filter range
  const filteredAllTx = allTx.filter((tx) => {
    if (appliedFrom && tx.entry_date < appliedFrom) return false
    if (appliedTo && tx.entry_date > appliedTo) return false
    return true
  })

  // Calculations for dashboard filtered period summary
  const totalGaveDashboard = filteredAllTx
    .filter((tx) => tx.type === 'credit')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalReceivedDashboard = filteredAllTx
    .filter((tx) => tx.type === 'debit')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const netDashboard = totalGaveDashboard - totalReceivedDashboard

  const recentTx = filteredAllTx
    .sort((a, b) => {
      const dateDiff = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      if (dateDiff !== 0) return dateDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 5)

  // Filter staff list
  const filteredStaff = staff.filter((s) =>
    s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
  )

  const isLoading = isCustomersLoading || isTxLoading || isStaffLoading
  const error = customerError || txError || staffError

  const handleDebtorReminder = (phone: string, name: string, balance: number) => {
    const storeName = profile?.business_name || 'My Store'
    const link = sendWhatsAppReminder(phone, name, balance, storeName)
    window.open(link, '_blank')
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-text-primary pb-16">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white font-extrabold text-xl shadow-md">
              {profile?.business_name?.charAt(0).toUpperCase() || 'K'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">
                {profile?.business_name || 'My Business'}
              </h1>
              {profile?.owner_name && (
                <p className="text-xs text-text-secondary">Owner: {profile.owner_name}</p>
              )}
            </div>
          </div>

          {/* View Tab Selector */}
          <div className="flex rounded-xl bg-neutral-100 p-1">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'customers'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              👥 Customers
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'staff'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              💼 Staff & Attendance
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {profile?.upi_id && (
              <span className="hidden lg:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                UPI: ...{profile.upi_id.slice(-6)}
              </span>
            )}
            <button
              onClick={signOut}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        
        {/* Global errors */}
        {error && (
          <div className="mb-6 rounded-xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger font-semibold">
            Error: {error}
          </div>
        )}

        {activeTab === 'customers' ? (
          <>
            {/* Metric Summary Cards */}
            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 flex flex-col justify-between min-h-[160px] shadow-sm">
                <p className="text-sm font-semibold text-text-secondary">Total Receivable (You will get)</p>
                <p className="mt-2 text-[2rem] font-black text-danger leading-tight">{formatINR(totalReceivable)}</p>
                <span className="mt-1 inline-flex items-center text-xs font-bold text-danger">
                  ↑ {customersWithBalance.filter((c) => c.balance > 0).length} Customer accounts
                </span>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-8 flex flex-col justify-between min-h-[160px] shadow-sm">
                <p className="text-sm font-semibold text-text-secondary">Total Payable (You will pay)</p>
                <p className="mt-2 text-[2rem] font-black text-success leading-tight">{formatINR(totalPayable)}</p>
                <span className="mt-1 inline-flex items-center text-xs font-bold text-success">
                  ↓ {customersWithBalance.filter((c) => c.balance < 0).length} Customer accounts
                </span>
              </div>

              <div className={`rounded-2xl border p-8 flex flex-col justify-between min-h-[160px] shadow-sm transition-all duration-300 ${
                netBalance > 0
                  ? 'bg-gradient-to-br from-danger/10 to-danger/5 text-danger border-danger/20'
                  : netBalance < 0
                  ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-amber-600 border-amber-500/20'
                  : 'bg-gradient-to-br from-neutral-900 to-neutral-800 text-white border-neutral-800'
              }`}>
                <p className="text-sm font-semibold opacity-80">Net Balance</p>
                <p className="mt-2 text-[2rem] font-black leading-tight">
                  {netBalance < 0 ? '-' : ''}
                  {formatINR(Math.abs(netBalance))}
                </p>
                <span className="mt-1 inline-flex items-center text-xs font-bold">
                  {netBalance > 0
                    ? '● Customers owe you'
                    : netBalance < 0
                    ? '● You owe customers'
                    : '● All Settled'}
                </span>
              </div>
            </div>

            {/* Responsive Grid System: Directory Left, Widgets Right */}
            <div className="grid gap-8 lg:grid-cols-3">
              
              {/* Left Column: Customer Directory */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Search and Action row */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-neutral-200 shadow-sm">
                  <div className="relative w-full sm:max-w-xs rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 focus-within:border-primary transition-colors focus-within:bg-white">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search customers..."
                      className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-neutral-400"
                    />
                  </div>

                  <button
                    onClick={handleOpenAddModal}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm tracking-wide shadow-md hover:shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                  >
                    <span>➕</span>
                    <span>Add Customer</span>
                  </button>
                </div>

                {/* Customer List Container */}
                <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                  <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
                    <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                      Customer Directory
                    </h3>
                  </div>

                  {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
                      <p className="mt-3 text-sm text-text-secondary font-bold">Loading directory...</p>
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="py-20 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-3xl text-neutral-400">
                        👥
                      </div>
                      <h3 className="mt-4 text-base font-bold text-neutral-900">
                        {searchQuery ? 'No matching customers found' : 'No customers in your ledger'}
                      </h3>
                      <p className="mx-auto mt-2 max-w-xs text-xs text-text-secondary leading-relaxed">
                        {searchQuery
                          ? 'Check for spelling or try searching for another name.'
                          : 'Add customers to record credit/debit entries.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCustomers.map((customer) => {
                        const isOwed = customer.balance > 0
                        const isPaying = customer.balance < 0
                        return (
                          <div
                            key={customer.id}
                            onClick={() => navigate(`/customer/${customer.id}`)}
                            className={`flex items-center justify-between px-8 py-6 bg-white rounded-2xl shadow-sm border border-neutral-100 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 border-l-4 ${
                              isOwed
                                ? 'border-l-danger'
                                : isPaying
                                ? 'border-l-amber-500'
                                : 'border-l-success'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-extrabold text-lg ${
                                isOwed
                                  ? 'bg-danger/10 text-danger'
                                  : isPaying
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : 'bg-neutral-100 text-primary'
                              }`}>
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-bold text-neutral-900">{customer.name}</h4>
                                  {customer.balance === 0 && (
                                    <span className="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success border border-success/30 animate-pulse-subtle">
                                      Settled ✓
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {customer.phone ? `+91 ${customer.phone.replace(/^\+91/, '')}` : 'No phone number'}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              {isOwed ? (
                                <>
                                  <p className="font-extrabold text-xl text-danger">{formatINR(customer.balance)}</p>
                                  <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Owes You ↑</span>
                                </>
                              ) : isPaying ? (
                                <>
                                  <p className="font-extrabold text-xl text-amber-600">{formatINR(Math.abs(customer.balance))}</p>
                                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">You Owe ↓</span>
                                </>
                              ) : (
                                <>
                                  <p className="font-extrabold text-xl text-success">₹0</p>
                                  <span className="text-[10px] font-bold text-success uppercase tracking-wider">Settled ✓</span>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Widgets */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Top Debtors widget */}
                <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                  <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
                    <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                      Top Debtors
                    </h3>
                  </div>

                  {isLoading ? (
                    <div className="p-6 text-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-primary mx-auto"></div>
                    </div>
                  ) : topDebtors.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-secondary italic">
                      No outstanding debtors.
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {topDebtors.map((debtor) => (
                        <div key={debtor.id} className="flex items-center justify-between p-4 hover:bg-neutral-50">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-neutral-900 truncate">{debtor.name}</p>
                            <p className="text-xs text-danger font-extrabold mt-0.5">{formatINR(debtor.balance)}</p>
                          </div>
                          
                          {debtor.phone && (
                            <button
                              onClick={() => handleDebtorReminder(debtor.phone!, debtor.name, debtor.balance)}
                              className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors active:scale-90 ml-3"
                              title="Send WhatsApp Reminder"
                            >
                              💬
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Activity widget */}
                <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                  <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
                    <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                      Recent Activity
                    </h3>
                  </div>

                  {/* Dashboard Date Filter Panel */}
                  <div className="p-4 border-b border-neutral-100 bg-neutral-50/30 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={filterFrom}
                          onChange={(e) => setFilterFrom(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-neutral-200 outline-none text-[10px] font-semibold text-text-primary bg-white focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={filterTo}
                          onChange={(e) => setFilterTo(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-neutral-200 outline-none text-[10px] font-semibold text-text-primary bg-white focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedFrom(filterFrom)
                            setAppliedTo(filterTo)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-[10px] transition-colors active:scale-95 shadow-xs"
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
                            className="text-[10px] font-bold text-text-secondary hover:text-primary transition-colors underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary for Period */}
                    {(appliedFrom || appliedTo) && (
                      <div className="pt-2.5 border-t border-neutral-100 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="rounded-md bg-neutral-100/40 p-1 border border-neutral-200/10">
                          <p className="font-bold text-text-secondary text-[8px] uppercase">Gave</p>
                          <p className="font-extrabold text-danger mt-0.5">{formatINR(totalGaveDashboard)}</p>
                        </div>
                        <div className="rounded-md bg-neutral-100/40 p-1 border border-neutral-200/10">
                          <p className="font-bold text-text-secondary text-[8px] uppercase">Received</p>
                          <p className="font-extrabold text-success mt-0.5">{formatINR(totalReceivedDashboard)}</p>
                        </div>
                        <div className={`rounded-md p-1 border ${
                          netDashboard > 0
                            ? 'bg-danger/5 text-danger border-danger/10'
                            : netDashboard < 0
                            ? 'bg-success/5 text-success border-success/10'
                            : 'bg-neutral-100/40 text-text-secondary border-neutral-200/10'
                        }`}>
                          <p className="font-bold text-[8px] uppercase opacity-85">Net</p>
                          <p className="font-black mt-0.5">
                            {netDashboard < 0 ? '-' : ''}
                            {formatINR(Math.abs(netDashboard))}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="p-6 text-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-primary mx-auto"></div>
                    </div>
                  ) : recentTx.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-secondary italic">
                      No recent ledger entries.
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {recentTx.map((tx) => {
                        const matchedCustomer = customers.find((c) => c.id === tx.customer_id)
                        const isCredit = tx.type === 'credit'
                        const shortDate = new Date(tx.entry_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })
                        return (
                          <div
                            key={tx.id}
                            onClick={() => navigate(`/customer/${tx.customer_id}`)}
                            className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-xs text-neutral-900 truncate flex-1 pr-2">
                                {matchedCustomer?.name || 'Customer'}
                              </p>
                              <span className="text-[10px] text-text-secondary font-semibold">{shortDate}</span>
                            </div>
                            
                            <div className="flex justify-between items-center mt-1.5">
                              <p className="text-[10px] text-text-secondary truncate flex-1 pr-3">
                                {tx.note || (isCredit ? 'Gave credit' : 'Received paid')}
                              </p>
                              {isCredit ? (
                                <span className="text-xs font-extrabold text-danger">-{formatINR(tx.amount)}</span>
                              ) : (
                                <span className="text-xs font-extrabold text-success">+{formatINR(tx.amount)}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </>
        ) : (
          /* Staff & Attendance View */
          <div className="space-y-8 animate-fade-in">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
              <div className="flex rounded-xl bg-neutral-100 p-1 w-full sm:w-auto">
                <button
                  onClick={() => setStaffSubTab('attendance')}
                  className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
                    staffSubTab === 'attendance'
                      ? 'bg-white text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  📅 Attendance Register
                </button>
                <button
                  onClick={() => setStaffSubTab('list')}
                  className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
                    staffSubTab === 'list'
                      ? 'bg-white text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  👥 Employees List
                </button>
              </div>

              {staffSubTab === 'attendance' ? (
                /* Attendance Date Selector */
                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <span className="text-xs font-bold text-text-secondary">Select Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-4 py-2 rounded-xl border border-neutral-200 outline-none text-xs font-bold text-text-primary bg-neutral-50"
                  />
                </div>
              ) : (
                /* Add Staff Action */
                <button
                  onClick={handleOpenAddStaffModal}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm tracking-wide shadow-md flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <span>➕</span>
                  <span>Add Employee</span>
                </button>
              )}
            </div>

            {staffSubTab === 'list' ? (
              /* Staff Directory List View */
              <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                    Staff Directory
                  </h3>
                  <div className="relative rounded-lg border border-neutral-200 bg-white px-3 py-1.5 focus-within:border-primary">
                    <input
                      type="text"
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      placeholder="Search employee..."
                      className="bg-transparent outline-none text-xs font-medium placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
                    <p className="mt-3 text-sm text-text-secondary font-bold">Loading staff directory...</p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-3xl text-neutral-400">
                      👥
                    </div>
                    <h3 className="mt-4 text-base font-bold text-neutral-900">
                      {staffSearchQuery ? 'No matching employee found' : 'No staff added yet'}
                    </h3>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {filteredStaff.map((employee) => {
                      const joinDateStr = employee.join_date
                        ? new Date(employee.join_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not set'
                      return (
                        <div
                          key={employee.id}
                          onClick={() => navigate(`/staff/${employee.id}`)}
                          className="flex items-center justify-between px-6 py-5 hover:bg-neutral-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-extrabold text-primary text-lg">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-bold text-neutral-900">{employee.name}</h4>
                              <p className="text-xs text-text-secondary mt-0.5">
                                {employee.phone ? `+91 ${employee.phone}` : 'No phone number'} | Joined: {joinDateStr}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <p className="font-black text-neutral-900">
                                {employee.salary ? formatINR(employee.salary) : '₹0'}
                              </p>
                              <span className="text-[10px] font-bold text-text-secondary">Monthly Salary</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteStaff(employee.id, employee.name)
                              }}
                              className="p-2 border border-danger/20 text-danger rounded-lg bg-danger/5 hover:bg-danger/10 transition-colors animate-all active:scale-90"
                              title="Delete Employee"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Attendance grid Register View */
              <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
                  <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                    Daily Attendance — {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                </div>

                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
                    <p className="mt-3 text-sm text-text-secondary font-bold">Loading register...</p>
                  </div>
                ) : staff.length === 0 ? (
                  <div className="py-20 text-center px-6">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-3xl text-neutral-400">
                      📅
                    </div>
                    <h3 className="mt-4 text-base font-bold text-neutral-900">No staff members registered</h3>
                    <p className="mx-auto mt-2 max-w-sm text-xs text-text-secondary leading-relaxed">
                      Please register employee names in the **Employees List** tab before logging attendance status.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {staff.map((employee) => {
                      const record = attendance[selectedDate]?.[employee.id]
                      const currentStatus = record?.status

                      return (
                        <div key={employee.id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 font-extrabold text-text-primary text-base">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-bold text-neutral-900">{employee.name}</h4>
                              <p className="text-[10px] text-text-secondary">
                                Status: {' '}
                                {currentStatus === 'present' ? (
                                  <span className="text-success font-bold">PRESENT 🟢</span>
                                ) : currentStatus === 'half_day' ? (
                                  <span className="text-amber-500 font-bold">HALF DAY 🟡</span>
                                ) : currentStatus === 'absent' ? (
                                  <span className="text-danger font-bold">ABSENT 🔴</span>
                                ) : (
                                  <span className="text-text-secondary italic">Not marked</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Action toggle group */}
                          <div className="flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(employee.id, 'present')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition-all ${
                                currentStatus === 'present'
                                  ? 'bg-success text-white shadow-sm'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              P
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(employee.id, 'half_day')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition-all ${
                                currentStatus === 'half_day'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              H
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(employee.id, 'absent')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition-all ${
                                currentStatus === 'absent'
                                  ? 'bg-danger text-white shadow-sm'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              A
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up">
            
            <div className="bg-primary px-6 py-5 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Add New Customer</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white text-xl font-bold"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-semibold">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
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
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
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
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. wholesale customer, milk supplier"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400 h-24 resize-none"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/2 py-3.5 rounded-xl border border-neutral-200 font-bold text-text-secondary hover:bg-neutral-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formName.trim()}
                  className={`w-1/2 py-3.5 rounded-xl text-white font-bold tracking-wide shadow-md ${
                    isSubmitting || !formName.trim()
                      ? 'bg-neutral-300 shadow-none'
                      : 'bg-primary hover:bg-primary-dark shadow-primary/10'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up">
            
            <div className="bg-primary px-6 py-5 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Add New Employee</h3>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-white/80 hover:text-white text-xl font-bold"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="p-6 space-y-4">
              {staffSubmitError && (
                <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-semibold">
                  {staffSubmitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Employee Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
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
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="99999 99999"
                    className="w-full px-4 py-3 outline-none text-text-primary font-medium placeholder:text-neutral-400"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={staffSalary}
                  onChange={(e) => setStaffSalary(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Join Date
                </label>
                <input
                  type="date"
                  value={staffJoinDate}
                  onChange={(e) => setStaffJoinDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium text-text-primary"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="w-1/2 py-3.5 rounded-xl border border-neutral-200 font-bold text-text-secondary hover:bg-neutral-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !staffName.trim()}
                  className={`w-1/2 py-3.5 rounded-xl text-white font-bold tracking-wide shadow-md ${
                    isSubmitting || !staffName.trim()
                      ? 'bg-neutral-300 shadow-none'
                      : 'bg-primary hover:bg-primary-dark shadow-primary/10'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
