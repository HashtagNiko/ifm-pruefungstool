import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'
import KursePage from './pages/KursePage'
import KursDetailPage from './pages/KursDetailPage'
import FragenpoolPage from './pages/FragenpoolPage'
import VorlagenPage from './pages/VorlagenPage'
import PruefungenPage from './pages/PruefungenPage'
import PruefungDetailPage from './pages/PruefungDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Geschützter Trainer-Bereich */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/kurse" replace />} />
          <Route path="kurse" element={<KursePage />} />
          <Route path="kurse/:id" element={<KursDetailPage />} />
          <Route path="fragenpool" element={<FragenpoolPage />} />
          <Route path="vorlagen" element={<VorlagenPage />} />
          <Route path="pruefungen" element={<PruefungenPage />} />
          <Route path="pruefungen/:id" element={<PruefungDetailPage />} />
          <Route
            path="geteilt"
            element={
              <PlaceholderPage
                title="Geteilt mit mir"
                description="Hier erscheinen Inhalte und Prüfungen, die Co-Trainer mit dir geteilt haben."
              />
            }
          />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
