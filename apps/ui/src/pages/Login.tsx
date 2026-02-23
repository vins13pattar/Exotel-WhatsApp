import { useState } from 'react'

export default function Login () {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [token, setToken] = useState('')

  const submit = async () => {
    setError('')
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (res.ok) {
      const data = await res.json()
      setToken(data.token)
      localStorage.setItem('token', data.token)
    } else {
      const msg = await res.json()
      setError(msg.error ?? 'Login failed')
    }
  }

  return (
    <div>
      <h1>Login</h1>
      <div className="card">
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={submit}>Login</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {token && <p className="badge">Token saved to localStorage</p>}
      </div>
    </div>
  )
}
