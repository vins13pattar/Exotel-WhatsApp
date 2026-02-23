import { useEffect, useState } from 'react'

type Template = {
  id: string
  name: string
  category: string
  language: string
  status: string
}

export default function Templates () {
  const [items, setItems] = useState<Template[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('UTILITY')
  const [language, setLanguage] = useState('en')
  const [payload, setPayload] = useState('{"text":"Hi"}')

  const fetchItems = async () => {
    const res = await fetch('/api/v1/templates', { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
    if (res.ok) setItems(await res.json())
  }

  useEffect(() => { fetchItems() }, [])

  const add = async () => {
    await fetch('/api/v1/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      body: JSON.stringify({ name, category, language, payload: JSON.parse(payload) })
    })
    setName(''); setPayload('{"text":"Hi"}')
    fetchItems()
  }

  return (
    <div>
      <h1>Templates</h1>
      <div className="card">
        <h3>Create Template</h3>
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} />
        <label>Category</label>
        <input value={category} onChange={e => setCategory(e.target.value)} />
        <label>Language</label>
        <input value={language} onChange={e => setLanguage(e.target.value)} />
        <label>Payload JSON</label>
        <textarea value={payload} onChange={e => setPayload(e.target.value)} />
        <button onClick={add}>Save</button>
      </div>

      <div className="card">
        <h3>Templates</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Language</th><th>Status</th></tr></thead>
          <tbody>
            {items.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.category}</td>
                <td>{t.language}</td>
                <td><span className="badge">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
