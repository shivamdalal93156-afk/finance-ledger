import type { Transaction } from '../types'

/** Positive balance = customer owes you. Negative = you owe customer. */
export function calculateBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => {
    return t.type === 'credit' ? acc + t.amount : acc - t.amount
  }, 0)
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function sendWhatsAppReminder(
  phone: string,
  customerName: string,
  amount: number,
  businessName: string,
): string {
  const cleanPhone = phone.replace(/\D/g, '').replace(/^91/, '')
  const message = encodeURIComponent(
    `Hi ${customerName}, aapka ${businessName} mein ${formatCurrency(amount)} baaki hai. Kripya jaldi settlement karein. Dhanyawad! 🙏`,
  )
  return `https://wa.me/91${cleanPhone}?text=${message}`
}
