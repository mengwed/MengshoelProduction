import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3 })
    expect(limiter.check('ip1').allowed).toBe(true)
    expect(limiter.check('ip1').allowed).toBe(true)
    expect(limiter.check('ip1').allowed).toBe(true)
  })

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2 })
    limiter.check('ip1')
    limiter.check('ip1')
    const result = limiter.check('ip1')
    expect(result.allowed).toBe(false)
  })

  it('tracks IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 })
    limiter.check('ip1')
    expect(limiter.check('ip2').allowed).toBe(true)
  })

  it('resets after window expires', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 })
    limiter.check('ip1')
    expect(limiter.check('ip1').allowed).toBe(false)

    vi.advanceTimersByTime(61000)
    expect(limiter.check('ip1').allowed).toBe(true)
  })
})
