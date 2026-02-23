import { Link, Route, Routes } from 'react-router-dom'
import Dashboard from './Dashboard'
import Credentials from './Credentials'
import Messages from './Messages'
import Templates from './Templates'
import Onboarding from './Onboarding'
import Webhooks from './Webhooks'
import Login from './Login'

export default function App () {
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
          <Link to="/login">Login</Link>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  )
}
