import { useEffect, useState } from 'react'

type Webhook = { id: string; source: string; createdAt: string; processed: boolean }

export default function Webhooks () {
  const [items, setItems] = useState<Webhook[]>([])

  const fetchItems = async () => {
    const res = await fetch('/api/v1/webhooks/logs', { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
    if (res.ok) setItems(await res.json())
  }

  useEffect(() => { fetchItems() }, [])

  return (
    <div>
      <h1>Webhooks</h1>
      <div className="card">
        <h3>Recent Events</h3>
        <table className="table">
          <thead><tr><th>ID</th><th>Source</th><th>Processed</th><th>Received</th></tr></thead>
          <tbody>
            {items.map(w => (
              <tr key={w.id}>
                <td>{w.id}</td>
                <td>{w.source}</td>
                <td><span className="badge">{w.processed ? 'yes' : 'no'}</span></td>
                <td>{new Date(w.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
