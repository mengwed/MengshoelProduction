import { NextResponse } from 'next/server'
import { AuthError } from './auth'

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return apiError('Unauthorized', 401)
  }

  console.error('API error:', error)
  return apiError('Internal server error', 500)
}
