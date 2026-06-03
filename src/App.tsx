import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Geschützter Trainer-Bereich */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/kurse" replace />} />
          <Route
            path="kurse"
            element={
              <PlaceholderPage
                title="Kurse"
                description="Lege deine Kurse an (z. B. Zertifizierter WEG-Verwalter) und definiere ihre Themengebiete."
              />
            }
          />
          <Route
            path="fragenpool"
            element={
              <PlaceholderPage
                title="Fragenpool"
                description="Pflege deine Fragen: Text, Typ (Single/Multi), Antwortoptionen und Themengebiet-Zuordnung."
              />
            }
          />
          <Route
            path="vorlagen"
            element={
              <PlaceholderPage
                title="Vorlagen"
                description="Erstelle Prüfungsvorlagen mit Dauer, Bestehensschwellen und Frageanzahl je Themengebiet."
              />
            }
          />
          <Route
            path="pruefungen"
            element={
              <PlaceholderPage
                title="Prüfungen"
                description="Erstelle Prüfungen aus Vorlagen, öffne die Lobby, starte sie und werte die Abgaben aus."
              />
            }
          />
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
