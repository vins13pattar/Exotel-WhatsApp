import { Link, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '../context/AuthContext'
import PrivateRoute from '../components/PrivateRoute'
import Dashboard from './Dashboard'
import Credentials from './Credentials'
import Messages from './Messages'
import Templates from './Templates'
import Onboarding from './Onboarding'
import Webhooks from './Webhooks'
import Login from './Login'

function AppShell () {
  const { user, logout } = useAuth()
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>Exotel WhatsApp</h2>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/credentials">Credentials</Link>
          <Link to="/messages">Messages</Link>
          <Link to="/templates">Templates</Link>
          <Link to="/onboarding">Onboarding</Link>
          <Link to="/webhooks">Webhooks</Link>
        </nav>
        <div className="sidebar-footer">
          {user && <p className="sidebar-user">{user.email}</p>}
          <button className="btn-signout" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

export default function App () {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — all authenticated routes */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/credentials" element={<Credentials />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/webhooks" element={<Webhooks />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
