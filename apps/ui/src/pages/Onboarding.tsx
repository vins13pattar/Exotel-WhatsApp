import { useEffect, useState } from 'react'

type Link = { id: string; url: string; expiresAt: string; remainingUses: number }

export default function Onboarding () {
  const [links, setLinks] = useState<Link[]>([])
  const [count, setCount] = useState(1)

  const fetchLinks = async () => {
    const res = await fetch('/api/v1/onboarding-links', { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
    if (res.ok) setLinks(await res.json())
  }

  useEffect(() => { fetchLinks() }, [])

  const generate = async () => {
    await fetch('/api/v1/onboarding-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      body: JSON.stringify({ count })
    })
    fetchLinks()
  }

  return (
    <div>
      <h1>Onboarding Links</h1>
      <div className="card">
        <h3>Generate Links</h3>
        <label>Count (max 5)</label>
        <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} />
        <button onClick={generate}>Generate</button>
      </div>

      <div className="card">
        <h3>Existing Links</h3>
        <table className="table">
          <thead><tr><th>URL</th><th>Expires</th><th>Remaining Uses</th></tr></thead>
          <tbody>
            {links.map(l => (
              <tr key={l.id}>
                <td><a href={l.url} target="_blank" rel="noreferrer">{l.url}</a></td>
                <td>{new Date(l.expiresAt).toLocaleString()}</td>
                <td><span className="badge">{l.remainingUses}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
