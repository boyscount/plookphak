import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Spinner } from './components/ui'
import { UpdateBanner } from './components/UpdateBanner'
import { AuthProvider, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import { Activity } from './pages/Activity'
import { BorrowerDetail } from './pages/BorrowerDetail'
import { BorrowerHome } from './pages/BorrowerHome'
import { Browse, Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Me } from './pages/Me'
import { NewBorrower } from './pages/NewBorrower'

// บ้านแมวมี three.js (~ครึ่ง MB) — โหลดเมื่อเปิดหน้านี้เท่านั้น
const CatHome = lazy(() => import('./pages/CatHome'))
const CatBuilding = lazy(() => import('./pages/CatBuilding'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } },
})

function Routed() {
  const { session, profile, loading, isStaff } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Login />
  if (!profile || !profile.active) {
    return (
      <div className="p-8 text-center">
        <p>
          {profile
            ? 'บัญชีนี้ถูกปิดใช้งาน'
            : 'บัญชีนี้ยังไม่มีโปรไฟล์ในระบบ — ต้องสร้างผ่านหน้าเพิ่มผู้ยืม/จัดการ admin หรือ bootstrap_super_admin เท่านั้น'}
        </p>
        <button className="mt-4 underline" onClick={() => supabase.auth.signOut()}>
          ออกจากระบบ
        </button>
      </div>
    )
  }
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={isStaff ? <Dashboard /> : <BorrowerHome />} />
        <Route path="browse" element={isStaff ? <Browse /> : <BorrowerHome initialTab="history" />} />
        <Route path="activity" element={<Activity />} />
        <Route path="me" element={<Me />} />
        <Route
          path="cat"
          element={
            <Suspense fallback={<Spinner />}>
              <CatHome />
            </Suspense>
          }
        />
        {isStaff && <Route path="borrowers/new" element={<NewBorrower />} />}
        {isStaff && <Route path="borrowers/:id" element={<BorrowerDetail />} />}
        {isStaff && (
          <Route
            path="building"
            element={
              <Suspense fallback={<Spinner />}>
                <CatBuilding />
              </Suspense>
            }
          />
        )}
        {isStaff && (
          <Route
            path="borrowers/:id/cat"
            element={
              <Suspense fallback={<Spinner />}>
                <CatHome />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routed />
            <UpdateBanner />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
