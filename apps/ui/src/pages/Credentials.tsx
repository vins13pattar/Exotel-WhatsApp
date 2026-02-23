import { useEffect, useState } from 'react'

type Credential = {
  id: string
  label: string
  subdomain: string
  sid: string
  region?: string
  status: string
}

export default function Credentials () {
  const [items, setItems] = useState<Credential[]>([])
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [sid, setSid] = useState('')
  const [region, setRegion] = useState('api.exotel.com')

  const fetchItems = async () => {
    const res = await fetch('/api/v1/credentials', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    })
    if (res.ok) setItems(await res.json())
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const add = async () => {
    await fetch('/api/v1/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
      },
      body: JSON.stringify({ label, apiKey, apiToken, subdomain, sid, region })
    })
    setLabel(''); setApiKey(''); setApiToken(''); setSubdomain(''); setSid('')
    fetchItems()
  }

  return (
    <div>
      <h1>Credentials</h1>
      <div className="card">
        <h3>Add Credential</h3>
        <label>Label</label>
        <input value={label} onChange={e => setLabel(e.target.value)} />
        <label>API Key</label>
        <input value={apiKey} onChange={e => setApiKey(e.target.value)} />
        <label>API Token</label>
        <input value={apiToken} onChange={e => setApiToken(e.target.value)} />
        <label>Subdomain</label>
        <input value={subdomain} onChange={e => setSubdomain(e.target.value)} />
        <label>SID</label>
        <input value={sid} onChange={e => setSid(e.target.value)} />
        <label>Region</label>
        <input value={region} onChange={e => setRegion(e.target.value)} />
        <button onClick={add}>Save</button>
      </div>

      <div className="card">
        <h3>Saved Credentials</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th><th>Subdomain</th><th>SID</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td>{c.subdomain}</td>
                <td>{c.sid}</td>
                <td><span className="badge">{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
