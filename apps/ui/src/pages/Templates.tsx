import { useEffect, useState } from 'react'

type Template = {
  id: string
  name: string
  category: string
  language: string
  status: string
}

type Credential = {
  id: string
  label: string
}

const defaultPayload = JSON.stringify({
  whatsapp: {
    templates: [
      {
        template: {
          name: 'sample_template',
          category: 'UTILITY',
          language: 'en',
          components: [
            {
              type: 'BODY',
              text: 'Hello {{1}}'
            }
          ]
        }
      }
    ]
  }
}, null, 2)

export default function Templates () {
  const [items, setItems] = useState<Template[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [name, setName] = useState('sample_template')
  const [category, setCategory] = useState('UTILITY')
  const [language, setLanguage] = useState('en')
  const [payload, setPayload] = useState(defaultPayload)
  const [credentialId, setCredentialId] = useState('')
  const [wabaId, setWabaId] = useState('')

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }

  const fetchItems = async () => {
    const res = await fetch('/api/v1/templates', { headers: authHeader })
    if (res.ok) setItems(await res.json())
  }

  const fetchCredentials = async () => {
    const res = await fetch('/api/v1/credentials', { headers: authHeader })
    if (res.ok) setCredentials(await res.json())
  }

  useEffect(() => {
    void fetchItems()
    void fetchCredentials()
  }, [])

  const add = async () => {
    const body: Record<string, any> = {
      name,
      category,
      language,
      payload: JSON.parse(payload)
    }

    if (credentialId && wabaId) {
      body.credentialId = credentialId
      body.wabaId = wabaId
    }

    await fetch('/api/v1/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(body)
    })

    setName('sample_template')
    setPayload(defaultPayload)
    await fetchItems()
  }

  return (
    <div>
      <h1>Templates</h1>
      <div className='card'>
        <h3>Create Template</h3>
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} />
        <label>Category</label>
        <input value={category} onChange={e => setCategory(e.target.value)} />
        <label>Language</label>
        <input value={language} onChange={e => setLanguage(e.target.value)} />
        <label>Credential (optional for Exotel sync)</label>
        <select value={credentialId} onChange={e => setCredentialId(e.target.value)}>
          <option value=''>Local only</option>
          {credentials.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
        </select>
        <label>WABA ID (required when credential selected)</label>
        <input value={wabaId} onChange={e => setWabaId(e.target.value)} />
        <label>Payload JSON</label>
        <textarea value={payload} onChange={e => setPayload(e.target.value)} />
        <button onClick={() => { void add() }}>Save</button>
      </div>

      <div className='card'>
        <h3>Templates</h3>
        <table className='table'>
          <thead><tr><th>Name</th><th>Category</th><th>Language</th><th>Status</th></tr></thead>
          <tbody>
            {items.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.category}</td>
                <td>{t.language}</td>
                <td><span className='badge'>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
