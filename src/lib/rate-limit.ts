interface RateLimitConfig {
  windowMs: number
  max: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
}

interface TokenBucket {
  tokens: number[]
}

export function createRateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, TokenBucket>()

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      const bucket = buckets.get(key) || { tokens: [] }

      // Remove expired tokens
      bucket.tokens = bucket.tokens.filter(t => now - t < config.windowMs)

      if (bucket.tokens.length >= config.max) {
        buckets.set(key, bucket)
        return { allowed: false, remaining: 0 }
      }

      bucket.tokens.push(now)
      buckets.set(key, bucket)
      return { allowed: true, remaining: config.max - bucket.tokens.length }
    },
  }
}
