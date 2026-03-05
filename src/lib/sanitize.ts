export function sanitize(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  return value.replace(/<[^>]*>/g, '')
}

export function sanitizeObject<T extends object>(obj: T): T {
  const result = { ...obj }
  for (const key in result) {
    if (typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = sanitize(result[key] as string)
    }
  }
  return result
}
