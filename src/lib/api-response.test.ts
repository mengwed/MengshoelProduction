import { describe, it, expect } from 'vitest'
import { apiSuccess, apiError, handleApiError } from './api-response'
import { AuthError } from './auth'

describe('apiSuccess', () => {
  it('returns JSON response with data', async () => {
    const res = apiSuccess({ name: 'test' })
    const body = await res.json()
    expect(body).toEqual({ data: { name: 'test' } })
    expect(res.status).toBe(200)
  })

  it('supports custom status code', async () => {
    const res = apiSuccess({ id: 1 }, 201)
    expect(res.status).toBe(201)
  })
})

describe('apiError', () => {
  it('returns JSON error response', async () => {
    const res = apiError('Not found', 404)
    const body = await res.json()
    expect(body).toEqual({ error: 'Not found' })
    expect(res.status).toBe(404)
  })
})

describe('handleApiError', () => {
  it('returns 401 for AuthError', async () => {
    const res = handleApiError(new AuthError())
    expect(res.status).toBe(401)
  })

  it('returns 500 for unknown errors', async () => {
    const res = handleApiError(new Error('Something broke'))
    const body = await res.json()
    expect(body).toEqual({ error: 'Internal server error' })
    expect(res.status).toBe(500)
  })
})
