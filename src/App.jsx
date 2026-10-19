import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { StoreProvider } from './contexts/StoreContext'
import { ToastProvider } from './contexts/ToastContext'
import ConfigErrorPage from './pages/ConfigErrorPage'
import AppRoutes from './routes/AppRoutes'
import { hasUnsafeKey, supabase } from './services/supabaseClient'

export default function App() {
  if (!supabase) return <ConfigErrorPage unsafeKey={hasUnsafeKey} />

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>
            <AppRoutes />
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
