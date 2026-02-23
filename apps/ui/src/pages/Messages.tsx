import { useEffect, useState } from 'react'

type Message = {
  id: string
  to: string
  status: string
  createdAt: string
}

type Credential = { id: string; label: string }

export default function Messages () {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('Hello from Exotel WhatsApp')
  const [credentialId, setCredentialId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])

  const tokenHeader = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const fetchMessages = async () => {
    const res = await fetch('/api/v1/messages', { headers: tokenHeader })
    if (res.ok) setMessages(await res.json())
  }

  const fetchCreds = async () => {
    const res = await fetch('/api/v1/credentials', { headers: tokenHeader })
    if (res.ok) setCredentials(await res.json())
  }

  useEffect(() => {
    fetchMessages(); fetchCreds()
  }, [])

  const send = async () => {
    await fetch('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader },
      body: JSON.stringify({ to, type: 'text', body: { text: body }, credentialId })
    })
    setTo(''); fetchMessages()
  }

  return (
    <div>
      <h1>Messages</h1>
      <div className="card">
        <h3>Send Test Message</h3>
        <label>Recipient</label>
        <input value={to} onChange={e => setTo(e.target.value)} />
        <label>Body</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} />
        <label>Credential</label>
        <select value={credentialId} onChange={e => setCredentialId(e.target.value)}>
          <option value="">Select credential</option>
          {credentials.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
        </select>
        <button onClick={send}>Send</button>
      </div>

      <div className="card">
        <h3>Recent Messages</h3>
        <table className="table">
          <thead><tr><th>ID</th><th>To</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {messages.map(m => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td>{m.to}</td>
                <td><span className="badge">{m.status}</span></td>
                <td>{new Date(m.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
