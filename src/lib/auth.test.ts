import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from './auth'

describe('requireAuth', () => {
  it('returns user when session exists', async () => {
    const mockUser = { id: 'user-123', email: 'test@test.com' }
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as any)

    const user = await requireAuth()
    expect(user.id).toBe('user-123')
  })

  it('throws AuthError when no session', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'No session' } }),
      },
    } as any)

    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })
})
