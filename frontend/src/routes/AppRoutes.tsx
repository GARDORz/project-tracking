import { Routes, Route } from 'react-router-dom'
import Login from '../pages/Login'
import Placeholder from '../pages/Placeholder'
import Dashboard from '../pages/Dashboard'
import Tasks from '../pages/Tasks'
import Team from '../pages/Team'
import Customers from '../pages/Customers'
import Equipment from '../pages/Equipment'
import ProjectEquipment from '../pages/ProjectEquipment'
import Reports from '../pages/Reports'
import Overview from '../pages/Overview'
import Settings from '../pages/Settings'
import AuditLog from '../pages/AuditLog'
import TrackJob from '../pages/TrackJob'
import Layout from '../components/Layout'
import RequireAuth from './RequireAuth'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/track/:shareToken" element={<TrackJob />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route
          path="/projects/:projectId/equipment"
          element={<ProjectEquipment />}
        />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/team" element={<Team />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/feedback" element={<Placeholder title="ข้อเสนอแนะ" />} />
        <Route path="/help" element={<Placeholder title="ช่วยเหลือ" />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
