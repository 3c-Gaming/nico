'use client'

import { useState, useEffect } from 'react'

export default function ExportLocalPage() {
  const [json, setJson] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('nico_app_state')
    if (raw) {
      setJson(JSON.stringify(JSON.parse(raw), null, 2))
    } else {
      setJson('Nenhum dado encontrado no localStorage (nico_app_state)')
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.getElementById('json-textarea') as HTMLTextAreaElement
      if (ta) {
        ta.select()
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
      <h2 style={{ marginBottom: 12 }}>📋 Dados do localStorage</h2>
      <p style={{ marginBottom: 12, color: '#666' }}>
        Copie o JSON abaixo e me envie para que eu possa importar no Supabase de produção.
      </p>
      <button
        onClick={handleCopy}
        style={{
          marginBottom: 12,
          padding: '8px 16px',
          cursor: 'pointer',
          background: copied ? '#22c55e' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
        }}
      >
        {copied ? 'Copiado!' : 'Copiar JSON'}
      </button>
      <textarea
        id="json-textarea"
        readOnly
        value={json}
        style={{
          width: '100%',
          height: '80vh',
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
          fontFamily: 'monospace',
          background: '#f9f9f9',
          whiteSpace: 'pre',
          overflow: 'auto',
        }}
      />
    </div>
  )
}
