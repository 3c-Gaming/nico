'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    Castle?: {
      configure: (opts: { pk: string }) => void
      createRequestToken: () => Promise<string>
    }
  }
}

const CASTLE_PK = 'pk_TaKsqF94pjCsoyepV6mH3V24AXoM6A7M'

export default function DeployPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [status, setStatus] = useState<'loading' | 'deploying' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Carregando...')
  const [url, setUrl] = useState('')
  const [castleReady, setCastleReady] = useState(false)
  const deployedRef = useRef(false)

  function onCastleLoad() {
    if (window.Castle) {
      window.Castle.configure({ pk: CASTLE_PK })
      setCastleReady(true)
    }
  }

  useEffect(() => {
    if (!castleReady || !projectId || deployedRef.current) return
    deployedRef.current = true
    deploy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castleReady, projectId])

  async function deploy() {
    try {
      setStatus('deploying')
      setMessage('Gerando token de segurança...')

      const castleToken = await window.Castle!.createRequestToken()

      setMessage('Deployando no Lovable...')

      // Tentar via proxy do servidor primeiro
      const res = await fetch('/api/lovable/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, castleToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Se falhou com castle_denied, tentar direto do browser
        if (data.error?.includes('castle_denied')) {
          setMessage('Tentando deploy direto...')
          await deployDirect(castleToken)
          return
        }
        throw new Error(data.error || `Erro ${res.status}`)
      }

      setStatus('success')
      setUrl(data.url || '')
      setMessage('Deploy realizado com sucesso!')
    } catch (err) {
      setStatus('error')
      setMessage((err as Error).message)
    }
  }

  async function deployDirect(castleToken: string) {
    try {
      // Obter Firebase token do nosso backend
      const tokenRes = await fetch('/api/lovable/token')
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Erro ao obter token')

      // Gerar novo Castle token (o anterior pode ter expirado)
      const freshCastleToken = await window.Castle!.createRequestToken()

      // Chamar Lovable API direto do browser
      const res = await fetch(
        `https://api.lovable.dev/projects/${projectId}/deployments?async=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.token}`,
            'Content-Type': 'application/json',
            'X-Castle-Request-Token': freshCastleToken,
          },
          body: '{}',
        }
      )

      const text = await res.text()
      if (!res.ok) throw new Error(`Deploy falhou: ${res.status} ${text}`)

      const data = JSON.parse(text)
      setStatus('success')
      setUrl(data.url || '')
      setMessage('Deploy realizado com sucesso!')
    } catch (err) {
      setStatus('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <>
      <Script
        src="https://d2t77mnxyo7adj.cloudfront.net/v2/castle.min.js"
        onLoad={onCastleLoad}
        onError={() => {
          // Fallback para jsDelivr
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/@castleio/castle-js@2/dist/castle.browser.js'
          s.onload = onCastleLoad
          s.onerror = () => {
            setStatus('error')
            setMessage('Falha ao carregar SDK de segurança')
          }
          document.head.appendChild(s)
        }}
      />
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: 20,
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: 400,
          width: '100%',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {status === 'loading' && '⏳'}
            {status === 'deploying' && '🚀'}
            {status === 'success' && '✅'}
            {status === 'error' && '❌'}
          </div>

          <h1 style={{ fontSize: 20, marginBottom: 8 }}>
            {status === 'success' ? 'Deploy Concluído!' : 'Lovable Deploy'}
          </h1>

          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
            {message}
          </p>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: '#2563eb',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                marginBottom: 16,
              }}
            >
              Abrir Site
            </a>
          )}

          {status === 'error' && (
            <button
              onClick={() => { deployedRef.current = false; deploy() }}
              style={{
                display: 'block',
                margin: '0 auto',
                padding: '10px 20px',
                background: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Tentar Novamente
            </button>
          )}

          <p style={{ color: '#555', fontSize: 12, marginTop: 24 }}>
            Projeto: {projectId}
          </p>
        </div>
      </div>
    </>
  )
}
