import { z } from 'zod'

const phoneRegex = /^\+91[6-9]\d{9}$/

export const phoneSchema = z
  .string()
  .transform((val) => val.replace(/[\s-]/g, ''))
  .transform((val) => (val.startsWith('+91') ? val : `+91${val.replace(/^0+/, '')}`))
  .refine((val) => phoneRegex.test(val), {
    message: 'Enter a valid Indian phone number',
  })

export const profileSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(100),
  owner_name: z.string().max(100).optional(),
  phone: phoneSchema,
  upi_id: z.string().max(50).optional(),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(100),
  phone: phoneSchema.optional().or(z.literal('')),
  address: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

export const transactionSchema = z.object({
  type: z.enum(['credit', 'debit']),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(99999999.99, 'Amount cannot exceed ₹9,99,99,999.99'),
  note: z.string().max(200).optional(),
  entry_date: z.string().date().optional(),
})

export type ProfileInput = z.infer<typeof profileSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type TransactionInput = z.infer<typeof transactionSchema>
