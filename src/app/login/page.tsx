'use client'

import { useState, useEffect, useRef } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Try to auto-fill saved credentials on page load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PasswordCredential) {
      navigator.credentials.get({
        password: true,
        mediation: 'optional',
      } as CredentialRequestOptions).then((cred) => {
        if (cred && cred.type === 'password') {
          const pwCred = cred as PasswordCredential
          if (emailRef.current) emailRef.current.value = pwCred.id
          if (passwordRef.current) passwordRef.current.value = pwCred.password || ''
        }
      }).catch(() => {})
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // Save credentials to browser before the redirect
    if (typeof window !== 'undefined' && window.PasswordCredential) {
      try {
        const cred = new PasswordCredential({
          id: email,
          password: password,
        })
        await navigator.credentials.store(cred)
      } catch {}
    }

    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">AJ</h1>
          <p className="text-gray-400 mt-2">Logga in</p>
        </div>

        <form action={handleSubmit} autoComplete="on" className="space-y-4">
          <div>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              placeholder="E-post"
              autoComplete="username email"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              placeholder="Lösenord"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-wait"
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  )
}
