import type { Category } from '@/types'

let cache: Category[] | null = null
let pending: Promise<Category[]> | null = null
let lastFetch = 0
const STALE_MS = 5000

export async function getCategories(): Promise<Category[]> {
  const now = Date.now()
  if (cache && now - lastFetch < STALE_MS) return cache
  if (pending) return pending

  pending = fetch('/api/categories')
    .then(r => r.json())
    .then(d => {
      cache = d.data ?? d
      lastFetch = Date.now()
      pending = null
      return cache!
    })
    .catch(() => {
      pending = null
      return cache ?? []
    })

  return pending
}

export function invalidateCategories() {
  cache = null
  lastFetch = 0
}

export function addToCache(category: Category) {
  if (cache) {
    cache = [...cache, category].sort((a, b) => a.name.localeCompare(b.name))
  }
}
