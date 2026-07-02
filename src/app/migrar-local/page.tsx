'use client'

import { useState } from 'react'

export default function MigrarLocalPage() {
  const [status, setStatus] = useState<'idle' | 'migrando' | 'sucesso' | 'erro'>('idle')
  const [resultado, setResultado] = useState('')
  const [erro, setErro] = useState('')

  async function handleMigrar() {
    setStatus('migrando')
    setResultado('')
    setErro('')

    try {
      const raw = localStorage.getItem('nico_app_state')
      if (!raw) {
        setErro('Nenhum dado encontrado no localStorage (nico_app_state)')
        setStatus('erro')
        return
      }

      const state = JSON.parse(raw)

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro desconhecido')
        setStatus('erro')
        return
      }

      const linhas: string[] = []
      if (data.flowTagConfigs) linhas.push(`FlowTagConfigs: ${data.flowTagConfigs.inserted}`)
      if (data.casas) linhas.push(`Casas: ${data.casas.inserted}`)
      if (data.linkTemplates) linhas.push(`LinkTemplates: ${data.linkTemplates.inserted}`)
      if (data.disparos) linhas.push(`Disparos: ${data.disparos.inserted}`)
      if (data.esteiras) linhas.push(`Esteiras: ${data.esteiras.inserted}`)

      setResultado(linhas.length > 0 ? linhas.join(', ') : 'Nenhum dado para importar')
      setStatus('sucesso')
    } catch (err) {
      setErro((err as Error).message)
      setStatus('erro')
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Migrar dados do navegador para o Supabase</h2>
      <p style={{ marginBottom: 24, color: '#555', fontSize: 14 }}>
        Esta página lê os dados do <code>localStorage</code> (<code>nico_app_state</code>) e envia para o Supabase via API.
        Use se quiser trazer os dados (tags, funis, UTMs, casas, templates, disparos, esteiras) da sua máquina local para a nuvem.
      </p>

      <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
        <strong>Dados que serão enviados:</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li><code>flowTagConfigs</code> — cruzamento de tags, funis, UTMs</li>
          <li><code>casasAposta</code> — casas de aposta configuradas</li>
          <li><code>linkTemplates</code> — templates de link</li>
          <li><code>disparos</code> — disparos criados</li>
          <li><code>esteiras</code> — esteiras de disparos</li>
        </ul>
      </div>

      <button
        onClick={handleMigrar}
        disabled={status === 'migrando'}
        style={{
          padding: '12px 24px',
          cursor: status === 'migrando' ? 'not-allowed' : 'pointer',
          background: status === 'migrando' ? '#94a3b8' : status === 'sucesso' ? '#22c55e' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          opacity: status === 'migrando' ? 0.7 : 1,
        }}
      >
        {status === 'idle' && 'Migrar dados para o Supabase'}
        {status === 'migrando' && 'Migrando...'}
        {status === 'sucesso' && 'Migrado com sucesso!'}
        {status === 'erro' && 'Tentar novamente'}
      </button>

      {status === 'migrando' && (
        <p style={{ marginTop: 16, color: '#666' }}>Enviando dados...</p>
      )}

      {status === 'sucesso' && resultado && (
        <div style={{ marginTop: 16, padding: 16, background: '#f0fdf4', borderRadius: 8, color: '#15803d', fontSize: 14 }}>
          ✅ {resultado}
        </div>
      )}

      {status === 'erro' && erro && (
        <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 14 }}>
          ❌ {erro}
        </div>
      )}
    </div>
  )
}
