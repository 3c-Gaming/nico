'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pause, Play, Save, Flame, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { AquecimentoNumero, AquecimentoScript, AquecimentoPar, AquecimentoExecucao, AquecimentoConfig, NumeroSendpulse } from '@/types'

function diaDaRampa(iniciadoEm: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(iniciadoEm).getTime()) / 86_400_000) + 1)
}

const SCRIPT_EXEMPLO = JSON.stringify([
  { de: 'A', texto: 'Oi, tudo bem?', atrasoSegundos: 120 },
  { de: 'B', texto: 'Tudo sim, e você?', atrasoSegundos: 180 },
  { de: 'A', texto: 'Tudo certo por aqui também', atrasoSegundos: 300 },
], null, 2)

export default function AquecimentoPage() {
  const [numerosSendpulse, setNumerosSendpulse] = useState<NumeroSendpulse[]>([])
  const [numeros, setNumeros] = useState<AquecimentoNumero[]>([])
  const [scripts, setScripts] = useState<AquecimentoScript[]>([])
  const [pares, setPares] = useState<AquecimentoPar[]>([])
  const [execucoes, setExecucoes] = useState<AquecimentoExecucao[]>([])
  const [config, setConfig] = useState<AquecimentoConfig | null>(null)
  const [carregando, setCarregando] = useState(true)

  const carregarTudo = useCallback(async () => {
    const [rNumSp, rNum, rScripts, rPares, rExec, rConfig] = await Promise.all([
      fetch('/api/sendpulse/numeros').then((r) => r.ok ? r.json() : { numeros: [] }),
      fetch('/api/aquecimento/numeros').then((r) => r.ok ? r.json() : { numeros: [] }),
      fetch('/api/aquecimento/scripts').then((r) => r.ok ? r.json() : { scripts: [] }),
      fetch('/api/aquecimento/pares').then((r) => r.ok ? r.json() : { pares: [] }),
      fetch('/api/aquecimento/execucoes').then((r) => r.ok ? r.json() : { execucoes: [] }),
      fetch('/api/aquecimento/config').then((r) => r.ok ? r.json() : { config: null }),
    ])
    setNumerosSendpulse(rNumSp.numeros ?? [])
    setNumeros(rNum.numeros ?? [])
    setScripts(rScripts.scripts ?? [])
    setPares(rPares.pares ?? [])
    setExecucoes(rExec.execucoes ?? [])
    setConfig(rConfig.config ?? null)
    setCarregando(false)
  }, [])

  useEffect(() => { carregarTudo() }, [carregarTudo])

  const nomeDoNumero = useCallback((botId: string) => {
    const n = numerosSendpulse.find((x) => x.id === botId)
    return n ? `${n.nome || n.numero} (${n.numero})` : botId
  }, [numerosSendpulse])

  const numerosAquecendo = useMemo(() => numeros.filter((n) => n.status !== 'pausado' || true), [numeros])

  // --- Config ---
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const salvarConfig = useCallback(async (patch: Partial<{ janelaInicioHora: number; janelaFimHora: number; cronPaused: boolean; rampa: Record<string, number> }>) => {
    setSalvandoConfig(true)
    try {
      const res = await fetch('/api/aquecimento/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const { config: novo } = await res.json()
        setConfig(novo)
      }
    } finally {
      setSalvandoConfig(false)
    }
  }, [])
  const [rampaTexto, setRampaTexto] = useState('')
  useEffect(() => { if (config) setRampaTexto(JSON.stringify(config.rampa, null, 2)) }, [config])

  // --- Scripts ---
  const [novoScriptNome, setNovoScriptNome] = useState('')
  const [novoScriptTema, setNovoScriptTema] = useState('')
  const [novoScriptJson, setNovoScriptJson] = useState(SCRIPT_EXEMPLO)
  const [erroScript, setErroScript] = useState<string | null>(null)
  const [criandoScript, setCriandoScript] = useState(false)

  const criarScript = useCallback(async () => {
    setErroScript(null)
    if (!novoScriptNome.trim()) { setErroScript('Dá um nome pro script'); return }
    let mensagens
    try {
      mensagens = JSON.parse(novoScriptJson)
    } catch {
      setErroScript('JSON inválido')
      return
    }
    setCriandoScript(true)
    try {
      const res = await fetch('/api/aquecimento/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoScriptNome, tema: novoScriptTema || undefined, mensagens }),
      })
      const data = await res.json()
      if (!res.ok) { setErroScript(data.error ?? 'Erro ao criar script'); return }
      setNovoScriptNome(''); setNovoScriptTema(''); setNovoScriptJson(SCRIPT_EXEMPLO)
      await carregarTudo()
    } finally {
      setCriandoScript(false)
    }
  }, [novoScriptNome, novoScriptTema, novoScriptJson, carregarTudo])

  const excluirScript = useCallback(async (id: string) => {
    await fetch(`/api/aquecimento/scripts/${id}`, { method: 'DELETE' })
    await carregarTudo()
  }, [carregarTudo])

  const toggleScriptAtivo = useCallback(async (script: AquecimentoScript) => {
    await fetch(`/api/aquecimento/scripts/${script.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !script.ativo }),
    })
    await carregarTudo()
  }, [carregarTudo])

  // --- Pares ---
  const [botIdA, setBotIdA] = useState('')
  const [botIdB, setBotIdB] = useState('')
  const [contactIdA, setContactIdA] = useState('')
  const [contactIdB, setContactIdB] = useState('')
  const [erroPar, setErroPar] = useState<string | null>(null)
  const [criandoPar, setCriandoPar] = useState(false)

  const [buscandoContatos, setBuscandoContatos] = useState(false)
  const buscarContatosAutomaticamente = useCallback(async () => {
    setErroPar(null)
    if (!botIdA || !botIdB) { setErroPar('Escolhe os dois números primeiro'); return }
    setBuscandoContatos(true)
    try {
      const res = await fetch('/api/aquecimento/resolver-contatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botIdA, botIdB }),
      })
      const data = await res.json()
      if (!res.ok) { setErroPar(data.error ?? 'Erro ao buscar contatos'); return }
      if (data.contactIdA) setContactIdA(data.contactIdA)
      if (data.contactIdB) setContactIdB(data.contactIdB)
      if (!data.contactIdA || !data.contactIdB) {
        setErroPar(`Achei ${[data.contactIdA && 'A', data.contactIdB && 'B'].filter(Boolean).join(' e ') || 'nenhum'} — o outro lado ainda não trocou mensagem real com esse número.`)
      }
    } finally {
      setBuscandoContatos(false)
    }
  }, [botIdA, botIdB])

  const criarPar = useCallback(async () => {
    setErroPar(null)
    if (!botIdA || !botIdB) { setErroPar('Escolhe os dois números'); return }
    setCriandoPar(true)
    try {
      const res = await fetch('/api/aquecimento/pares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botIdA, botIdB, contactIdA: contactIdA || undefined, contactIdB: contactIdB || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setErroPar(data.error ?? 'Erro ao criar par'); return }
      setBotIdA(''); setBotIdB(''); setContactIdA(''); setContactIdB('')
      await carregarTudo()
    } finally {
      setCriandoPar(false)
    }
  }, [botIdA, botIdB, contactIdA, contactIdB, carregarTudo])

  const excluirPar = useCallback(async (id: string) => {
    await fetch(`/api/aquecimento/pares/${id}`, { method: 'DELETE' })
    await carregarTudo()
  }, [carregarTudo])

  const [scriptParaIniciar, setScriptParaIniciar] = useState<Record<string, string>>({})
  const iniciarExecucao = useCallback(async (parId: string) => {
    const scriptId = scriptParaIniciar[parId]
    if (!scriptId) return
    await fetch('/api/aquecimento/execucoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parId, scriptId }),
    })
    await carregarTudo()
  }, [scriptParaIniciar, carregarTudo])

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <>
      <PageHeader titulo="Aquecimento" descricao="Números próprios conversando entre si automaticamente, pra esquentar antes de usar em campanha" />

      <div className="p-6 space-y-8">
        {/* Config */}
        {config && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Configuração geral</h2>
            <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Janela — início (h)</label>
                <input type="number" min={0} max={23} value={config.janelaInicioHora}
                  onChange={(e) => setConfig({ ...config, janelaInicioHora: Number(e.target.value) })}
                  className="w-20 px-2 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Janela — fim (h)</label>
                <input type="number" min={0} max={23} value={config.janelaFimHora}
                  onChange={(e) => setConfig({ ...config, janelaFimHora: Number(e.target.value) })}
                  className="w-20 px-2 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs text-[var(--text-muted)] mb-1">Rampa (dia → teto de msgs/dia)</label>
                <textarea value={rampaTexto} onChange={(e) => setRampaTexto(e.target.value)} rows={2}
                  className="w-full px-2 py-1.5 rounded-md text-xs font-mono border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
              </div>
              <button
                onClick={() => {
                  let rampa
                  try { rampa = JSON.parse(rampaTexto) } catch { return }
                  salvarConfig({ janelaInicioHora: config.janelaInicioHora, janelaFimHora: config.janelaFimHora, rampa })
                }}
                disabled={salvandoConfig}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: 'var(--d1)' }}
              >
                <Save size={13} /> Salvar
              </button>
              <button
                onClick={() => salvarConfig({ cronPaused: !config.cronPaused })}
                disabled={salvandoConfig}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                {config.cronPaused ? <Play size={13} /> : <Pause size={13} />}
                {config.cronPaused ? 'Retomar cron' : 'Pausar cron'}
              </button>
            </div>
          </section>
        )}

        {/* Números em aquecimento */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Números em aquecimento</h2>
          {numerosAquecendo.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Nenhum número em aquecimento ainda — entra em /numeros clicando no ícone de chama em cada linha.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Número</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Papel</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Dia</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Msgs hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {numerosAquecendo.map((n) => (
                    <tr key={n.botId} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--text-primary)]">{nomeDoNumero(n.botId)}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{n.papel}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{n.status}</td>
                      <td className="py-2 px-3 text-right font-mono">{diaDaRampa(n.iniciadoEm)}</td>
                      <td className="py-2 px-3 text-right font-mono">{n.mensagensHoje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Scripts */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Scripts de conversa</h2>
          <div className="space-y-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex gap-3 flex-wrap">
              <input placeholder="Nome do script" value={novoScriptNome} onChange={(e) => setNovoScriptNome(e.target.value)}
                className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
              <input placeholder="Tema (opcional)" value={novoScriptTema} onChange={(e) => setNovoScriptTema(e.target.value)}
                className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
            </div>
            <textarea value={novoScriptJson} onChange={(e) => setNovoScriptJson(e.target.value)} rows={8}
              className="w-full px-2.5 py-2 rounded-md text-xs font-mono border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
            {erroScript && <p className="text-xs text-[var(--error)]">{erroScript}</p>}
            <button onClick={criarScript} disabled={criandoScript}
              className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: 'var(--d1)' }}>
              <Plus size={13} /> Criar script
            </button>
          </div>

          {scripts.length > 0 && (
            <div className="space-y-2">
              {scripts.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{s.nome} {s.tema && <span className="text-xs text-[var(--text-muted)]">— {s.tema}</span>}</div>
                    <div className="text-xs text-[var(--text-muted)]">{s.mensagens.length} mensagem(ns) · {s.ativo ? 'ativo' : 'inativo'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleScriptAtivo(s)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)]" title={s.ativo ? 'Desativar' : 'Ativar'}>
                      {s.ativo ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={() => excluirScript(s.id)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--error)]" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pares */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pares (quem conversa com quem)</h2>
          <div className="space-y-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
            <p className="text-xs text-[var(--text-muted)]">
              Contact ID é o identificador do outro número dentro da conta SendPulse de cada bot — só existe depois que os
              dois números trocarem uma mensagem real pelo WhatsApp uma vez. Escolhe os dois números e clica em
              &quot;Buscar contact_id automaticamente&quot; pra preencher sozinho (ou cola manualmente se já souber).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <select value={botIdA} onChange={(e) => setBotIdA(e.target.value)}
                className="px-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                <option value="">Número A</option>
                {numerosAquecendo.map((n) => <option key={n.botId} value={n.botId}>{nomeDoNumero(n.botId)}</option>)}
              </select>
              <select value={botIdB} onChange={(e) => setBotIdB(e.target.value)}
                className="px-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                <option value="">Número B</option>
                {numerosAquecendo.map((n) => <option key={n.botId} value={n.botId}>{nomeDoNumero(n.botId)}</option>)}
              </select>
              <input placeholder="Contact ID de B na conta de A" value={contactIdA} onChange={(e) => setContactIdA(e.target.value)}
                className="px-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
              <input placeholder="Contact ID de A na conta de B" value={contactIdB} onChange={(e) => setContactIdB(e.target.value)}
                className="px-2.5 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" />
            </div>
            {erroPar && <p className="text-xs text-[var(--error)]">{erroPar}</p>}
            <div className="flex items-center gap-2">
              <button onClick={buscarContatosAutomaticamente} disabled={buscandoContatos || !botIdA || !botIdB}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40">
                {buscandoContatos ? <Spinner size={13} /> : <Search size={13} />}
                Buscar contact_id automaticamente
              </button>
              <button onClick={criarPar} disabled={criandoPar}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: 'var(--d1)' }}>
                <Plus size={13} /> Criar par
              </button>
            </div>
          </div>

          {pares.length > 0 && (
            <div className="space-y-2">
              {pares.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]">
                  <div className="text-sm text-[var(--text-primary)]">
                    {nomeDoNumero(p.botIdA)} <Flame size={11} className="inline text-orange-400 mx-1" /> {nomeDoNumero(p.botIdB)}
                    {(!p.contactIdA || !p.contactIdB) && <span className="ml-2 text-xs text-[var(--warning)]">contact_id faltando</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={scriptParaIniciar[p.id] ?? ''} onChange={(e) => setScriptParaIniciar((m) => ({ ...m, [p.id]: e.target.value }))}
                      className="px-2 py-1 rounded-md text-xs border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                      <option value="">Script...</option>
                      {scripts.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                    <button onClick={() => iniciarExecucao(p.id)} disabled={!scriptParaIniciar[p.id]}
                      className="px-2 py-1 rounded-md text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: 'var(--d1)' }}>
                      Iniciar
                    </button>
                    <button onClick={() => excluirPar(p.id)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--error)]" title="Excluir par">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Execuções */}
        {execucoes.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Execuções</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Par</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Script</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Progresso</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-muted)]">Próxima mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {execucoes.map((e) => {
                    const par = pares.find((p) => p.id === e.parId)
                    const script = scripts.find((s) => s.id === e.scriptId)
                    return (
                      <tr key={e.id} className="border-b border-[var(--border)]">
                        <td className="py-2 px-3 text-[var(--text-primary)]">{par ? `${nomeDoNumero(par.botIdA)} ↔ ${nomeDoNumero(par.botIdB)}` : e.parId}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{script?.nome ?? e.scriptId}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{e.status}</td>
                        <td className="py-2 px-3 text-right font-mono">{e.proximoIndice}/{script?.mensagens.length ?? '?'}</td>
                        <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{e.proximaMensagemEm ? new Date(e.proximaMensagemEm).toLocaleString('pt-BR') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
