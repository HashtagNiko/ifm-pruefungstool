import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import NeuesPasswortSeite from './pages/NeuesPasswortSeite'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import LoginPage from './pages/LoginPage'
import KursePage from './pages/KursePage'
import KursDetailPage from './pages/KursDetailPage'
import FragenpoolPage from './pages/FragenpoolPage'
import VorlagenPage from './pages/VorlagenPage'
import PruefungenPage from './pages/PruefungenPage'
import PruefungDetailPage from './pages/PruefungDetailPage'
import AuswertungPage from './pages/AuswertungPage'
import TeilnehmerPage from './pages/teilnehmer/TeilnehmerPage'
import GeteiltMitMirPage from './pages/GeteiltMitMirPage'

export default function App() {
  const { recovery } = useAuth()

  // Reset-/Einladungslink: zuerst neues Passwort setzen lassen
  if (recovery) return <NeuesPasswortSeite />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Öffentlicher Teilnehmer-Zugang (ohne Login) */}
      <Route path="/p/:code" element={<TeilnehmerPage />} />

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
          <Route path="pruefungen/:id/teilnehmer/:teilnehmerId" element={<AuswertungPage />} />
          <Route path="geteilt" element={<GeteiltMitMirPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
