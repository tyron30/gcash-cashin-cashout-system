import { Route, Routes } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import AuditLogsPage from '../pages/AuditLogsPage'
import DailyClosingPage from '../pages/DailyClosingPage'
import DashboardPage from '../pages/DashboardPage'
import FeesPage from '../pages/FeesPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import ReportsPage from '../pages/ReportsPage'
import SettingsPage from '../pages/SettingsPage'
import StaffPage from '../pages/StaffPage'
import TransactionDetailsPage from '../pages/TransactionDetailsPage'
import TransactionFormPage from '../pages/TransactionFormPage'
import TransactionsPage from '../pages/TransactionsPage'
import UnauthorizedPage from '../pages/UnauthorizedPage'
import ProtectedRoute from './ProtectedRoute'

// Owner-only pages. The database enforces this too; this is for a clean experience.
const ownerPages = [
  { path: 'closing', element: <DailyClosingPage /> },
  { path: 'reports', element: <ReportsPage /> },
  { path: 'fees', element: <FeesPage /> },
  { path: 'staff', element: <StaffPage /> },
  { path: 'audit-logs', element: <AuditLogsPage /> },
  { path: 'settings', element: <SettingsPage /> },
]

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        {/* key makes React reset the form when you switch between Cash In and Cash Out */}
        <Route path="cash-in" element={<TransactionFormPage key="cash_in" type="cash_in" />} />
        <Route path="cash-out" element={<TransactionFormPage key="cash_out" type="cash_out" />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/:id" element={<TransactionDetailsPage />} />

        {ownerPages.map(({ path, element }) => (
          <Route key={path} path={path} element={<ProtectedRoute adminOnly>{element}</ProtectedRoute>} />
        ))}

        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
