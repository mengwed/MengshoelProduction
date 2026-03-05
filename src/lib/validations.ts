import { z } from 'zod'
import { apiError } from './api-response'

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  org_number: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  postal_code: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
})

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  org_number: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  postal_code: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  category_id: z.number().int().positive().nullable().optional(),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
})

export const documentUpdateSchema = z.object({
  type: z.enum([
    'outgoing_invoice', 'incoming_invoice', 'payment_received',
    'credit_card_statement', 'government_fee', 'loan_statement',
    'receipt', 'other',
  ]).optional(),
  invoice_number: z.string().max(100).nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  vat: z.number().nullable().optional(),
  vat_rate: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  status: z.enum(['imported', 'reviewed', 'paid']).optional(),
  customer_id: z.number().int().positive().nullable().optional(),
  supplier_id: z.number().int().positive().nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  payment_date: z.string().nullable().optional(),
  ai_needs_review: z.boolean().optional(),
})

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | { error: ReturnType<typeof apiError> } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return { error: apiError(message, 400) }
  }
  return { data: result.data }
}
