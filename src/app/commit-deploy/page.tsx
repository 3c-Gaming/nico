'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, Suspense } from 'react'
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
      }
    }
  }
}

const CASTLE_PK = 'pk_TaKsqF94pjCsoyepV6mH3V24AXoM6A7M'

function CommitDeployInner() {
  const searchParams = useSearchParams()
  const stateB64 = searchParams.get('s')
  const startedRef = useRef(false)

  function closeWebApp() {
    try { window.Telegram?.WebApp?.close() } catch {}
  }

  function onCastleLoad() {
    if (window.Castle) {
      window.Castle.configure({ pk: CASTLE_PK })
      run()
    }
  }

  useEffect(() => {
    window.Telegram?.WebApp?.ready()
    // Timeout de segurança: fechar em 8s mesmo se algo travar
    const safetyTimer = setTimeout(closeWebApp, 8000)
    return () => clearTimeout(safetyTimer)
  }, [])

  async function run() {
    if (startedRef.current || !stateB64) return
    startedRef.current = true

    try {
      const castleToken = await window.Castle!.createRequestToken()
      const state = JSON.parse(atob(stateB64))

      // Fire-and-forget: dispara a API e fecha imediatamente
      fetch('/api/telegram/commit-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, castleToken }),
      }).catch(() => {})

      // Fechar WebApp após enviar
      setTimeout(closeWebApp, 500)
    } catch {
      // Em caso de erro, fechar mesmo assim
      setTimeout(closeWebApp, 500)
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
          s.onerror = () => window.Telegram?.WebApp?.close()
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
      }}>
        <p style={{ color: '#aaa', fontSize: 14 }}>⏳ Processando...</p>
      </div>
    </>
  )
}

export default function CommitDeployPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff' }}>⏳</div>}>
      <CommitDeployInner />
    </Suspense>
  )
}
