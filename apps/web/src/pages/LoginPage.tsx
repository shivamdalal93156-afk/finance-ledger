import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Clean phone number (digits only, last 10 digits)
      const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        setError('Enter a valid 10-digit Indian mobile number')
        setLoading(false)
        return
      }

      // Check against hardcoded password in environment
      const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'Khatabook2026'
      if (password !== correctPassword) {
        setError('Incorrect password / passcode')
        setLoading(false)
        return
      }

      const email = `u${cleanPhone}@khataclone.dev`

      // Check if phone number has been registered in local caching
      let registeredPhones: string[] = []
      try {
        const stored = localStorage.getItem('registered_phones')
        if (stored) {
          registeredPhones = JSON.parse(stored)
        }
      } catch (err) {
        console.error('Error parsing registered_phones:', err)
      }

      const isRegistered = registeredPhones.includes(cleanPhone)

      if (isRegistered) {
        // If cached as registered, only try sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: correctPassword,
        })
        if (signInError) throw signInError
      } else {
        // Not cached as registered -> Try to sign in first
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: correctPassword,
        })

        if (signInError) {
          // If sign in fails, we sign up
          if (
            signInError.message.toLowerCase().includes('invalid login credentials') ||
            signInError.message.toLowerCase().includes('user not found') ||
            signInError.status === 400 ||
            signInError.status === 412
          ) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password: correctPassword,
              options: {
                emailRedirectTo: undefined,
                data: {},
              },
            })

            if (signUpError) {
              throw signUpError
            }

            // Save cleanPhone to cached registered_phones in localStorage
            if (!registeredPhones.includes(cleanPhone)) {
              registeredPhones.push(cleanPhone)
              localStorage.setItem('registered_phones', JSON.stringify(registeredPhones))
            }

            // If signup didn't log them in automatically, try signing in again
            if (!signUpData.session) {
              const { error: retryError } = await supabase.auth.signInWithPassword({
                email,
                password: correctPassword,
              })
              if (retryError) throw retryError
            }
          } else {
            throw signInError
          }
        } else {
          // Sign in succeeded, ensure it's saved in local caching
          if (!registeredPhones.includes(cleanPhone)) {
            registeredPhones.push(cleanPhone)
            localStorage.setItem('registered_phones', JSON.stringify(registeredPhones))
          }
        }
      }

      setLoading(false)
      return
    } catch (err: any) {
      console.error('[handleLogin] Error:', err)
      setError(err.message || 'Failed to authenticate. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-3xl bg-white shadow-2xl border border-neutral-100/80 transition-all p-8 flex flex-col items-center">
        {/* App Logo */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 mb-6 text-4xl shadow-inner border border-blue-600/20">
          📒
        </div>

        <h1 className="text-2xl font-black text-neutral-900 tracking-tight text-center">KhataClone</h1>
        <p className="mt-1 text-sm text-text-secondary text-center mb-8">Digital Ledger for Small Businesses</p>

        {error && (
          <div className="w-full mb-6 rounded-xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger animate-fade-in flex items-center">
            <span className="mr-2">⚠️</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
              Phone Number
            </label>
            <div className="relative flex rounded-xl border border-neutral-200 focus-within:border-primary transition-colors overflow-hidden">
              <span className="flex items-center justify-center bg-neutral-100 px-4 text-text-secondary font-semibold border-r border-neutral-200">
                +91
              </span>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter 10-digit number"
                className="w-full px-4 py-3.5 outline-none text-text-primary font-medium placeholder:text-neutral-400"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
              Password / Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter login password"
              className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 focus:border-primary outline-none text-text-primary font-medium placeholder:text-neutral-400"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !phoneNumber.trim() || !password.trim()}
            className={`w-full py-4 rounded-xl text-white font-bold tracking-wide transition-all shadow-md active:scale-[0.98] ${
              loading || !phoneNumber.trim() || !password.trim()
                ? 'bg-neutral-300 shadow-none cursor-not-allowed'
                : 'bg-primary hover:bg-primary-dark hover:shadow-primary/20 shadow-primary/10'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </span>
            ) : (
              'Login / Register'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
