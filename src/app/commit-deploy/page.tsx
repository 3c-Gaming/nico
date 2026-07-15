'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    Castle?: {
      configure: (opts: { pk: string }) => void
      createRequestToken: () => Promise<string>
    }
    Telegram?: {
      WebApp?: {
        close: () => void
        ready: () => void
        expand: () => void
        MainButton: {
          setText: (text: string) => void
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
        }
      }
    }
  }
}

const CASTLE_PK = 'pk_TaKsqF94pjCsoyepV6mH3V24AXoM6A7M'

function CommitDeployInner() {
  const searchParams = useSearchParams()
  const stateB64 = searchParams.get('s')
  const [status, setStatus] = useState<'loading' | 'working' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Carregando...')
  const [details, setDetails] = useState('')
  const [castleReady, setCastleReady] = useState(false)
  const startedRef = useRef(false)

  function onCastleLoad() {
    if (window.Castle) {
      window.Castle.configure({ pk: CASTLE_PK })
      setCastleReady(true)
    }
  }

  useEffect(() => {
    window.Telegram?.WebApp?.ready()
    window.Telegram?.WebApp?.expand()
  }, [])

  useEffect(() => {
    if (!castleReady || !stateB64 || startedRef.current) return
    startedRef.current = true
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castleReady, stateB64])

  async function run() {
    try {
      setStatus('working')
      setMessage('Gerando token de segurança...')

      const castleToken = await window.Castle!.createRequestToken()

      setMessage('Commitando e deployando...')

      const state = JSON.parse(atob(stateB64!))

      const res = await fetch('/api/telegram/commit-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, castleToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`)
      }

      setStatus('success')
      setMessage('Tudo pronto!')

      let det = `📄 ${data.nome || ''}\n✅ Commit: ${data.commitMsg || 'ok'}`
      if (data.deploy?.url) {
        det += `\n🚀 Deploy: ${data.deploy.url}`
      } else if (data.deploy?.deployment_id) {
        det += `\n🚀 Deploy iniciado`
      } else if (data.deploy?.error) {
        det += `\n⚠️ Deploy: ${data.deploy.error}`
      }
      setDetails(det)

      // Fechar web app automaticamente após 2s
      setTimeout(() => {
        window.Telegram?.WebApp?.close()
      }, 2500)
    } catch (err) {
      setStatus('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://d2t77mnxyo7adj.cloudfront.net/v2/castle.min.js"
        onLoad={onCastleLoad}
        onError={() => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/@castleio/castle-js@2/dist/castle.browser.js'
          s.onload = onCastleLoad
          s.onerror = () => { setStatus('error'); setMessage('Falha ao carregar SDK') }
          document.head.appendChild(s)
        }}
      />
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: 20,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {status === 'loading' && '⏳'}
            {status === 'working' && '🚀'}
            {status === 'success' && '✅'}
            {status === 'error' && '❌'}
          </div>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>
            {status === 'success' ? 'Commit + Deploy OK!' : 'Processando...'}
          </h1>
          <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>{message}</p>
          {details && (
            <pre style={{
              textAlign: 'left', fontSize: 12, color: '#ccc',
              background: '#111', padding: 12, borderRadius: 8,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {details}
            </pre>
          )}
          {status === 'error' && (
            <button
              onClick={() => { startedRef.current = false; run() }}
              style={{
                marginTop: 16, padding: '8px 20px', background: '#333',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Tentar Novamente
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default function CommitDeployPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff' }}>⏳ Carregando...</div>}>
      <CommitDeployInner />
    </Suspense>
  )
}
