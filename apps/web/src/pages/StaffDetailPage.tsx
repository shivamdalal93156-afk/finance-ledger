import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStaffStore } from '../store/staffStore'
import type { AttendanceStatus, SalaryPayment } from '@khataclone/shared/types'

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const staffId = id || ''

  const {
    staff,
    attendance,
    salaryPayments,
    fetchStaff,
    updateStaff,
    deleteStaff,
    fetchEmployeeAttendance,
    markAttendance,
    fetchSalaryPayments,
    paySalary,
  } = useStaffStore()

  // Modals / Dropdowns state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [selectedDayForAttendance, setSelectedDayForAttendance] = useState<number | null>(null)

  // Edit Staff Form State
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSalary, setEditSalary] = useState('')
  const [editJoinDate, setEditJoinDate] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())
  const calendarYear = currentDate.getFullYear()
  const calendarMonth = currentDate.getMonth() + 1 // 1-indexed

  // Find the employee
  const employee = staff.find((s) => s.id === staffId)

  useEffect(() => {
    if (staff.length === 0) {
      fetchStaff()
    }
    if (staffId) {
      fetchEmployeeAttendance(staffId)
      fetchSalaryPayments(staffId)
    }
  }, [staffId, staff.length, fetchStaff, fetchEmployeeAttendance, fetchSalaryPayments])

  // Initialize edit employee form
  useEffect(() => {
    if (employee) {
      setEditName(employee.name)
      setEditPhone(employee.phone || '')
      setEditSalary(employee.salary ? employee.salary.toString() : '')
      setEditJoinDate(employee.join_date || '')
    }
  }, [employee, isEditModalOpen])

  if (!employee) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
        <p className="mt-3 text-sm text-text-secondary font-bold">Loading employee details...</p>
      </div>
    );
  }

  // Edit/Delete Employee Handlers
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId) return
    setEditError(null)
    setIsSubmitting(true)

    const salaryNum = parseFloat(editSalary)
    if (editSalary && (isNaN(salaryNum) || salaryNum < 0)) {
      setEditError('Salary must be a positive number')
      setIsSubmitting(false)
      return
    }

    try {
      const updated = await updateStaff(staffId, {
        name: editName,
        phone: editPhone || undefined,
        salary: editSalary ? salaryNum : undefined,
        joinDate: editJoinDate || undefined,
      })

      if (updated) {
        setIsEditModalOpen(false)
      } else {
        setEditError(useStaffStore.getState().error || 'Failed to update employee details')
      }
    } catch (err: any) {
      setEditError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!staffId) return
    setIsSubmitting(true)

    try {
      const deleted = await deleteStaff(staffId)
      if (deleted) {
        navigate('/')
      } else {
        alert(useStaffStore.getState().error || 'Failed to delete employee')
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calendar Helpers
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate()
  const firstDayIndex = new Date(calendarYear, calendarMonth - 1, 1).getDay() // 0 = Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(calendarYear, calendarMonth - 2, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(calendarYear, calendarMonth, 1))
  }

  const handleOpenAttendanceModal = (day: number) => {
    setSelectedDayForAttendance(day)
    setIsAttendanceModalOpen(true)
  }

  const handleMarkAttendanceStatus = async (status: AttendanceStatus | 'clear') => {
    if (!staffId || selectedDayForAttendance === null) return
    
    const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(selectedDayForAttendance).padStart(2, '0')}`
    
    try {
      if (status === 'clear') {
        // We can't delete directly via store, so we update status in local or just skip.
        // For simplicity, we just mark as clear/absent or not mark, let's treat upserting status as 'absent' / half_day.
        // Actually, marking as 'absent' is a valid status. Let's support Present, Absent, Half Day.
      } else {
        await markAttendance(staffId, dateStr, status)
      }
      setIsAttendanceModalOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  // Statistics calculation for selected month
  let presentDays = 0
  let absentDays = 0
  let halfDays = 0
  let totalWorkingDays = 0

  const daysGrid: { day: number; dateStr: string; status: AttendanceStatus | 'not_marked'; isSunday: boolean }[] = []

  // Check days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isSunday = new Date(calendarYear, calendarMonth - 1, d).getDay() === 0
    const record = attendance[dateStr]?.[staffId]
    const status = record?.status || 'not_marked'

    if (!isSunday) {
      totalWorkingDays++
    }

    if (status === 'present') presentDays++
    else if (status === 'absent') absentDays++
    else if (status === 'half_day') halfDays++

    daysGrid.push({ day: d, dateStr, status, isSunday })
  }

  // Salary calculations
  const monthlySalary = employee.salary || 0
  const perDaySalary = totalWorkingDays > 0 ? monthlySalary / totalWorkingDays : 0
  const earnedSalary = (presentDays + halfDays * 0.5) * perDaySalary

  // Salary Payments check
  const actualPayments = salaryPayments[staffId] || []
  const isSalaryPaidThisMonth = actualPayments.some(
    (p: SalaryPayment) => p.month === calendarMonth && p.year === calendarYear
  )

  const handleMarkSalaryPaid = async () => {
    if (!staffId || monthlySalary <= 0 || isSalaryPaidThisMonth) return
    if (!confirm(`Mark ${formatINR(Math.round(earnedSalary))} as paid for ${currentDate.toLocaleString('default', { month: 'long' })} ${calendarYear}?`)) return
    
    try {
      await paySalary(staffId, calendarMonth, calendarYear, Math.round(earnedSalary))
    } catch (err: any) {
      alert(err.message || 'Failed to record salary payment')
    }
  }

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const joinDateFormatted = employee.join_date
    ? new Date(employee.join_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not set'

  return (
    <div className="min-h-screen bg-neutral-50 text-text-primary pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              ⬅️
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-lg bg-primary/10 text-primary">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">
                {employee.name}
              </h1>
              <p className="text-xs text-text-secondary">
                {employee.phone ? `+91 ${employee.phone.replace(/^\+91/, '')}` : 'No phone number'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
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
              Remove Staff
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-8 md:grid-cols-3">
        
        {/* Left Column: Details & Salary Summary */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Info Card */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
              Staff Details
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Name</p>
                <p className="text-sm font-semibold mt-1">{employee.name}</p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Phone</p>
                <p className="text-sm font-semibold mt-1">
                  {employee.phone ? `+91 ${employee.phone.replace(/^\+91/, '')}` : <span className="text-text-secondary italic">No phone added</span>}
                </p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Join Date</p>
                <p className="text-sm font-semibold mt-1">{joinDateFormatted}</p>
              </div>

              <div>
                <p className="text-xs text-text-secondary font-bold uppercase">Monthly Salary</p>
                <p className="text-sm font-black text-neutral-900 mt-1">{formatINR(monthlySalary)}</p>
              </div>
            </div>
          </div>

          {/* Salary Calculation Card */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">
              Salary for {currentDate.toLocaleString('default', { month: 'short' })} {calendarYear}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/50">
                <p className="text-[10px] font-bold text-text-secondary uppercase">Monthly Base</p>
                <p className="text-sm font-bold mt-1 text-neutral-900">{formatINR(monthlySalary)}</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/50">
                <p className="text-[10px] font-bold text-text-secondary uppercase">Working Days</p>
                <p className="text-sm font-bold mt-1 text-neutral-900">{totalWorkingDays} days</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/50">
                <p className="text-[10px] font-bold text-text-secondary uppercase">Present (incl. Half)</p>
                <p className="text-sm font-bold mt-1 text-neutral-900">{presentDays + halfDays * 0.5} days</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/50">
                <p className="text-[10px] font-bold text-text-secondary uppercase">Per Day Wage</p>
                <p className="text-sm font-bold mt-1 text-neutral-900">{formatINR(Math.round(perDaySalary))}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <p className="text-xs font-bold text-text-secondary uppercase">Salary Earned</p>
              <h2 className="text-3xl font-black text-primary mt-1">
                {formatINR(Math.round(earnedSalary))}
              </h2>
            </div>

            <button
              onClick={handleMarkSalaryPaid}
              disabled={isSalaryPaidThisMonth || earnedSalary <= 0}
              className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all shadow-md flex items-center justify-center space-x-2 ${
                isSalaryPaidThisMonth
                  ? 'bg-success/20 text-success cursor-not-allowed shadow-none'
                  : earnedSalary <= 0
                  ? 'bg-neutral-300 text-white cursor-not-allowed shadow-none'
                  : 'bg-primary hover:bg-primary-dark hover:shadow-primary/20 text-white'
              }`}
            >
              {isSalaryPaidThisMonth ? (
                <>
                  <span>✓</span>
                  <span>Paid for this Month</span>
                </>
              ) : (
                <span>Mark Salary Paid</span>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: Attendance Calendar & Payment History */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Attendance Section */}
          <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            
            {/* Calendar Header */}
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
              <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                Attendance Register
              </h3>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 transition-colors"
                >
                  ◀️
                </button>
                <span className="text-xs font-bold text-neutral-900">
                  {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 transition-colors"
                >
                  ▶️
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    {d}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-2">
                {/* Pad first day of month */}
                {Array.from({ length: firstDayIndex }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="aspect-square bg-neutral-50/50 rounded-xl"></div>
                ))}

                {daysGrid.map(({ day, status, isSunday }) => {
                  let statusBg = 'bg-neutral-100 hover:bg-neutral-200 text-text-secondary'
                  if (status === 'present') statusBg = 'bg-success text-white'
                  else if (status === 'absent') statusBg = 'bg-danger text-white'
                  else if (status === 'half_day') statusBg = 'bg-amber-500 text-white'
                  
                  if (isSunday) {
                    statusBg = 'bg-neutral-100/50 text-neutral-400 cursor-not-allowed'
                  }

                  return (
                    <button
                      key={`day-${day}`}
                      onClick={() => !isSunday && handleOpenAttendanceModal(day)}
                      disabled={isSunday}
                      className={`aspect-square flex flex-col items-center justify-center rounded-xl font-bold text-xs transition-all active:scale-95 ${statusBg}`}
                    >
                      <span>{day}</span>
                      {isSunday ? (
                        <span className="text-[8px] font-bold tracking-tight uppercase">Sun</span>
                      ) : status !== 'not_marked' ? (
                        <span className="text-[7px] font-extrabold tracking-tight uppercase mt-0.5">
                          {status === 'present' ? 'P' : status === 'absent' ? 'A' : 'H'}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Attendance Summary Panel */}
              <div className="mt-6 pt-4 border-t border-neutral-100 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-success/5 border border-success/10 p-2.5">
                  <p className="text-[9px] font-bold text-success uppercase tracking-wider">Present</p>
                  <p className="text-base font-black text-success mt-0.5">{presentDays} days</p>
                </div>
                <div className="rounded-xl bg-danger/5 border border-danger/10 p-2.5">
                  <p className="text-[9px] font-bold text-danger uppercase tracking-wider">Absent</p>
                  <p className="text-base font-black text-danger mt-0.5">{absentDays} days</p>
                </div>
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-2.5">
                  <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Half Day</p>
                  <p className="text-base font-black text-amber-600 mt-0.5">{halfDays} days</p>
                </div>
              </div>

            </div>

          </div>

          {/* Salary Payment History */}
          <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200">
              <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                Salary Payment History
              </h3>
            </div>

            {actualPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-secondary italic">
                No salary payments recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {actualPayments.map((payment: SalaryPayment) => {
                  const paidMonthName = new Date(payment.year, payment.month - 1, 1).toLocaleString('default', { month: 'long' })
                  const paidAtFormatted = new Date(payment.paid_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                  return (
                    <div key={payment.id} className="flex justify-between items-center px-6 py-4 hover:bg-neutral-50">
                      <div>
                        <p className="font-bold text-sm text-neutral-900">
                          Salary for {paidMonthName} {payment.year}
                        </p>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          Paid on: {paidAtFormatted}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-success text-base">
                          {formatINR(payment.amount)}
                        </p>
                        <span className="text-[9px] font-bold text-success uppercase tracking-wider">Paid ✓</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Edit Staff Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up">
            
            <div className="bg-primary px-6 py-5 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Edit Employee Details</h3>
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
                  Employee Name <span className="text-danger">*</span>
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
                  Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value)}
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
                  value={editJoinDate}
                  onChange={(e) => setEditJoinDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium text-text-primary"
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

      {/* Delete Staff Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger text-2xl mb-4">
              ⚠️
            </div>
            
            <h3 className="text-lg font-bold text-neutral-900">Remove Staff Member?</h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-neutral-900">{employee.name}</span>?
              <br />
              <span className="text-danger font-semibold mt-1 block">
                This will delete all attendance records and salary history for this employee.
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
                {isSubmitting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Attendance Day Modal */}
      {isAttendanceModalOpen && selectedDayForAttendance !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-100 overflow-hidden animate-slide-up p-6">
            <h3 className="text-base font-bold text-neutral-900 text-center mb-4">
              Mark Attendance — {selectedDayForAttendance} {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleMarkAttendanceStatus('present')}
                className="w-full py-3.5 rounded-xl bg-success text-white font-bold text-sm tracking-wide shadow-md shadow-success/10 hover:bg-success/90 active:scale-95 transition-all"
              >
                🟢 Present
              </button>
              
              <button
                type="button"
                onClick={() => handleMarkAttendanceStatus('half_day')}
                className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-bold text-sm tracking-wide shadow-md shadow-amber-500/10 hover:bg-amber-600 active:scale-95 transition-all"
              >
                🟡 Half Day
              </button>

              <button
                type="button"
                onClick={() => handleMarkAttendanceStatus('absent')}
                className="w-full py-3.5 rounded-xl bg-danger text-white font-bold text-sm tracking-wide shadow-md shadow-danger/10 hover:bg-danger/90 active:scale-95 transition-all"
              >
                🔴 Absent
              </button>

              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="w-full py-3 rounded-xl border border-neutral-200 font-bold text-text-secondary text-xs hover:bg-neutral-100 transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
