import { createRateLimiter } from './rate-limit'

export const defaultLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })
export const uploadLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })
