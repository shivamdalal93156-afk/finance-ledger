import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { profileSchema } from '@khataclone/shared/validators'

export function SetupProfilePage() {
  const navigate = useNavigate()
  const { session, setProfile } = useAuthStore()

  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Grab the phone number from the authenticated user (check phone first, then fall back to email prefix)
  const phone = session?.user?.phone || session?.user?.email?.split('@')[0]?.replace('user_', '').replace(/^u/, '') || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!session?.user?.id) {
      setError('Session expired. Please log in again.')
      setLoading(false)
      return
    }

    const inputData = {
      business_name: businessName,
      owner_name: ownerName || undefined,
      phone,
      upi_id: upiId || undefined,
    }

    try {
      // Validate inputs using shared schema
      const parseResult = profileSchema.safeParse(inputData)
      if (!parseResult.success) {
        setError(parseResult.error.errors[0]?.message || 'Invalid input data')
        setLoading(false)
        return
      }

      const validatedProfile = parseResult.data

      const { data, error: dbError } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          business_name: validatedProfile.business_name,
          owner_name: validatedProfile.owner_name || null,
          phone: validatedProfile.phone,
          upi_id: validatedProfile.upi_id || null,
        })
        .select()
        .single()

      if (dbError) {
        throw dbError
      }

      setProfile(data)
      navigate('/')
    } catch (err: any) {
      console.error('[setupProfile]', err)
      setError(err.message || 'Failed to save business profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-neutral-100 overflow-hidden transition-all">
        {/* Banner Top */}
        <div className="bg-primary px-8 py-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <h2 className="text-2xl font-bold tracking-tight">Business Profile</h2>
          <p className="mt-1 text-white/80 text-sm font-medium">Set up your digital ledger store details</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 rounded-xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger animate-fade-in flex items-center">
              <span className="mr-2">⚠️</span>
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Business Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Ramesh Kirana Store"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Owner Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                UPI ID (for payments)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. name@okaxis"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none font-medium placeholder:text-neutral-400"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Phone Number (Verified)
              </label>
              <input
                type="text"
                value={phone}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-text-secondary outline-none font-semibold cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !businessName.trim()}
              className={`w-full py-4 mt-2 rounded-xl text-white font-bold tracking-wide transition-all shadow-md active:scale-[0.98] ${
                loading || !businessName.trim()
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
                  Saving Details...
                </span>
              ) : (
                'Create Profile'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
