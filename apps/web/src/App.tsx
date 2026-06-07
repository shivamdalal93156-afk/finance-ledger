import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { SetupProfilePage } from './pages/SetupProfilePage'
import { DashboardPage } from './pages/DashboardPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { StaffDetailPage } from './pages/StaffDetailPage'

// Protected Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return <FullScreenLoader />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/setup-profile" replace />
  }

  return <>{children}</>
}

// Redirect if already authenticated
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return <FullScreenLoader />
  }

  if (session) {
    if (!profile) {
      return <Navigate to="/setup-profile" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Setup Profile Guard
function SetupProfileRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return <FullScreenLoader />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profile) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50">
      <div className="relative flex items-center justify-center">
        {/* Spinner ring */}
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-neutral-200 border-t-primary"></div>
        {/* Inner static marker */}
        <div className="absolute h-8 w-8 rounded-full bg-primary/10"></div>
      </div>
      <p className="mt-4 text-sm font-bold text-text-secondary animate-pulse">Loading KhataClone...</p>
    </div>
  )
}

export default function App() {
  const { setSession } = useAuthStore()

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <LoginPage />
            </AuthRoute>
          }
        />
        <Route
          path="/setup-profile"
          element={
            <SetupProfileRoute>
              <SetupProfilePage />
            </SetupProfileRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/:id"
          element={
            <ProtectedRoute>
              <CustomerDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <ProtectedRoute>
              <StaffDetailPage />
            </ProtectedRoute>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
