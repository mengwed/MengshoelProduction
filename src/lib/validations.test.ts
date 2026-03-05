import { describe, it, expect } from 'vitest'
import { customerSchema, supplierSchema, categorySchema, documentUpdateSchema, validateBody } from './validations'

describe('customerSchema', () => {
  it('accepts valid customer', () => {
    const result = customerSchema.safeParse({ name: 'Test AB' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = customerSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = customerSchema.safeParse({
      name: 'Test AB',
      org_number: '556677-8899',
      email: 'test@test.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = customerSchema.safeParse({ name: 'Test', email: 'not-email' })
    expect(result.success).toBe(false)
  })
})

describe('supplierSchema', () => {
  it('accepts valid supplier with category_id', () => {
    const result = supplierSchema.safeParse({ name: 'Supplier AB', category_id: 5 })
    expect(result.success).toBe(true)
  })

  it('accepts null category_id', () => {
    const result = supplierSchema.safeParse({ name: 'Supplier AB', category_id: null })
    expect(result.success).toBe(true)
  })
})

describe('categorySchema', () => {
  it('accepts valid category', () => {
    const result = categorySchema.safeParse({ name: 'Transport', emoji: '🚗' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = categorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('documentUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = documentUpdateSchema.safeParse({ status: 'reviewed' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = documentUpdateSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('accepts amount as number', () => {
    const result = documentUpdateSchema.safeParse({ amount: 1500.50 })
    expect(result.success).toBe(true)
  })
})

describe('validateBody', () => {
  it('returns data on valid input', () => {
    const result = validateBody(customerSchema, { name: 'Test AB' })
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.name).toBe('Test AB')
    }
  })

  it('returns error Response on invalid input', async () => {
    const result = validateBody(customerSchema, { name: '' })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(400)
      const body = await result.error.json()
      expect(body.error).toContain('name')
    }
  })

  it('returns error with field path for nested validation', async () => {
    const result = validateBody(customerSchema, { name: 'Test', email: 'invalid' })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      const body = await result.error.json()
      expect(body.error).toContain('email')
    }
  })
})
