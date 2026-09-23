'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { X, RefreshCw, Image as ImageIcon, CalendarClock, ChevronRight, Ban, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'
import { formatNumero, formatMoeda } from '@/lib/resultadoDisparo'
import { useDisparos } from '@/hooks/useDisparos'
import { useResultadoDisparo } from '@/hooks/useResultadoDisparo'
import { FunilConversaoChart, type EstagioFunil } from '@/components/funis/FunilConversaoChart'
import { LeadConversaDetalhe, formatarTempoRelativo, type LeadComConversa, type MensagemFluxo } from '@/components/funis/LeadConversaCard'
import { renderizarRcsContent, renderizarFallbackText, primeiroLinkRcs } from '@/lib/rcs/template'
import type { RcsContent } from '@/lib/rcs/tipos'
import { CUSTO_RCS_POR_ENVIO, CUSTO_FALLBACK_SMS } from '@/lib/rcs/tipos'
import { RcsSuggestionChips } from './RcsSuggestionChips'
import { EditarAgendamento } from './EditarAgendamento'
import type { Disparo } from '@/types'

const LARGURA = 440
const LARGURA_LISTA_NUMEROS = 380
const LARGURA_LEAD_DETALHE = 440

interface EnvioRcs {
  telefone: string
  status: string
  clicado?: boolean
  erro?: string | null
  fallback_status?: string | null
  enviado_em?: string
  atualizado_em?: string
  receptivo_enviado_em?: string | null
  receptivo_erro?: string | null
}

// Um RcsContent (texto ou card) renderizado (variáveis já resolvidas) virando bolha de conversa —
// mesmo formato que LeadConversaCard usa pras conversas de funil de tráfego (SendPulse/Black
// Sender), reaproveitado aqui pra dar a mesma visão de chat pros disparos de RCS.
function conteudoParaMensagem(id: string, criadoEm: string, conteudo: RcsContent, variables?: Record<string, string>): MensagemFluxo {
  const c = renderizarRcsContent(conteudo, variables)
  const sugestoes = c.type === 'card' ? c.card.suggestions : c.suggestions
  const botoesOferecidos = sugestoes?.length ? sugestoes.map((s) => s.text) : undefined
  if (c.type === 'card') {
    return {
      id, direcao: 'saida', criadoEm,
      tipo: c.card.media?.url ? 'imagem' : 'texto',
      titulo: c.card.title || undefined,
      texto: c.card.description || undefined,
      imagemUrl: c.card.media?.url,
      botoesOferecidos,
    }
  }
  return { id, direcao: 'saida', criadoEm, tipo: 'texto', texto: c.text, botoesOferecidos }
}

function cliqueParaMensagem(id: string, criadoEm: string, conteudo: RcsContent): MensagemFluxo {
  const sugestoes = conteudo.type === 'card' ? conteudo.card.suggestions : conteudo.suggestions
  const botao = sugestoes?.find((s) => s.type === 'REPLY') ?? sugestoes?.[0]
  return { id, direcao: 'entrada', criadoEm, tipo: 'botao_clicado', botaoTitulo: botao?.text || 'clique' }
}

function envioParaLeadConversa(envio: EnvioRcs, variables: Record<string, string> | undefined, disparo: Disparo): LeadComConversa {
  const mensagens: MensagemFluxo[] = []
  const enviadoEm = envio.enviado_em ?? disparo.criadoEm
  if (disparo.rcsConteudo) mensagens.push(conteudoParaMensagem('msg1', enviadoEm, disparo.rcsConteudo, variables))
  if (envio.clicado && disparo.rcsConteudo) {
    mensagens.push(cliqueParaMensagem('click', envio.atualizado_em ?? enviadoEm, disparo.rcsConteudo))
  }
  if (envio.receptivo_enviado_em && disparo.rcsReceptivo?.conteudo) {
    mensagens.push(conteudoParaMensagem('msg2', envio.receptivo_enviado_em, disparo.rcsReceptivo.conteudo, variables))
  }
  return {
    contactId: envio.telefone,
    nome: envio.telefone,
    telefone: envio.telefone,
    ultimaAtividade: envio.receptivo_enviado_em || envio.atualizado_em || enviadoEm,
    tags: [],
    variaveis: variables ?? {},
    mensagens,
    tagCliqueLink: null,
  }
}

const FALHA = new Set(['erro', 'failed', 'undelivered'])

const LIMITE_NUMEROS = 1000

interface ResumoRcs {
  total: number
  enviados: number
  entregues: number
  lidas: number
  clicados: number
  falhas: number
  fallbackEnviados: number
  recebeuRcs: number
  recebeuSms: number
  naoRecebeu: number
  processando: number
  cobravel: number
  rejeitados: number
}

function corStatus(status: string): string {
  if (status === 'read') return 'text-violet-400'
  if (status === 'delivered') return 'text-emerald-400'
  if (FALHA.has(status)) return 'text-[var(--error)]'
  return 'text-[var(--text-secondary)]'
}

function BucketLinha({ cor, label, hint, n, pct }: { cor: string; label: string; hint: string; n: number; pct: number }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-[var(--text-primary)] font-medium">{label}</span>
          <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">{formatNumero(n)} · {pct}%</span>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] leading-tight">{hint}</p>
      </div>
    </div>
  )
}

function Estatistica({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex-1 min-w-[80px] px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-base)]">
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
      <div className="text-base font-bold tabular-nums mt-0.5" style={{ color: cor ?? 'var(--text-primary)' }}>{valor}</div>
    </div>
  )
}

function PreviewRcs({ disparo }: { disparo: Disparo }) {
  const conteudo = disparo.rcsConteudo
  if (!conteudo) return <p className="text-[11px] text-[var(--text-muted)]">Sem conteúdo registrado.</p>
  const c = renderizarRcsContent(conteudo, {})
  const sugestoes = c.type === 'card' ? c.card.suggestions : c.suggestions

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-base)]">
      {c.type === 'card' ? (
        <>
          {c.card.media?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.card.media.url} alt="" className="w-full object-cover" style={{ maxHeight: 170 }} />
          ) : (
            <div className="h-16 flex items-center justify-center text-[var(--text-muted)]"><ImageIcon size={16} /></div>
          )}
          <div className="p-3 space-y-1">
            {c.card.title && <p className="text-sm font-semibold text-[var(--text-primary)]">{c.card.title}</p>}
            {c.card.description && <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{c.card.description}</p>}
          </div>
        </>
      ) : (
        <div className="p-3">
          <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap">{c.type === 'text' ? c.text : ''}</p>
        </div>
      )}
      <RcsSuggestionChips suggestions={sugestoes} />
    </div>
  )
}

export function PainelDetalheDisparoRcs({ disparo, onClose }: { disparo: Disparo | null; onClose: () => void }) {
  const router = useRouter()
  const { update: atualizarDisparo } = useDisparos()
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [cancelando, setCancelando] = useState(false)
  const [resumo, setResumo] = useState<ResumoRcs | null>(null)
  const [falhasRows, setFalhasRows] = useState<EnvioRcs[]>([])
  const [carregou, setCarregou] = useState(false)
  const [atualizando, setAtualizando] = useState(false)

  // "Por número" abre um sidebar de lista (à esquerda deste painel) — em disparo comum a base
  // tem dezenas de milhares de linhas, então a lista completa só carrega quando o usuário abre,
  // com teto de LIMITE_NUMEROS. Clicar num lead da lista abre um 3º sidebar com a conversa —
  // mesmo empilhamento de painéis usado em PainelConversasFluxo (funis de tráfego).
  const [mostrarNumeros, setMostrarNumeros] = useState(!!disparo)
  const [numeros, setNumeros] = useState<EnvioRcs[]>([])
  const [numerosTotal, setNumerosTotal] = useState(0)
  const [leadSelecionado, setLeadSelecionado] = useState<LeadComConversa | null>(null)

  const campanha = disparo?.nomenclatura

  // Abre o sidebar "Por número" junto, sem precisar rolar até o botão e clicar — e trocar de
  // disparo (sem fechar o painel) já limpa a conversa aberta, que era de outro lead. Ajuste de
  // estado durante o render (não em efeito) ao detectar troca de id — padrão recomendado pelo
  // React pra "resetar estado quando uma prop muda", evita o cascading-render de um useEffect.
  const [disparoIdAnterior, setDisparoIdAnterior] = useState(disparo?.id)
  if (disparo?.id !== disparoIdAnterior) {
    setDisparoIdAnterior(disparo?.id)
    setMostrarNumeros(!!disparo)
    setLeadSelecionado(null)
  }

  // Contadores da jornada + resumo de falhas — leves (agregado no banco + só as linhas que
  // falharam), então dá pra fazer polling a cada 15s enquanto o painel está aberto.
  useEffect(() => {
    if (!campanha) return
    let cancel = false
    const q = encodeURIComponent(campanha)
    const puxar = () => {
      Promise.all([
        fetch('/api/rcs/resumo').then((r) => (r.ok ? r.json() : { resumo: {} })).catch(() => ({ resumo: {} })),
        fetch(`/api/rcs/status?campanha=${q}&falhas=1`).then((r) => (r.ok ? r.json() : { envios: [] })).catch(() => ({ envios: [] })),
      ]).then(([res, fal]) => {
        if (cancel) return
        setResumo((res.resumo?.[campanha] as ResumoRcs) ?? null)
        setFalhasRows((fal.envios ?? []) as EnvioRcs[])
        setCarregou(true)
      })
    }
    puxar()
    const id = setInterval(puxar, 15_000)
    return () => { cancel = true; clearInterval(id) }
  }, [campanha])

  // Lista completa por número — só enquanto o accordion está aberto.
  useEffect(() => {
    if (!campanha || !mostrarNumeros) return
    let cancel = false
    const puxar = () => {
      fetch(`/api/rcs/status?campanha=${encodeURIComponent(campanha)}&limit=${LIMITE_NUMEROS}`)
        .then((r) => (r.ok ? r.json() : { envios: [], total: 0 }))
        .then((data) => {
          if (cancel) return
          setNumeros((data.envios ?? []) as EnvioRcs[])
          setNumerosTotal(data.total ?? 0)
        })
        .catch(() => {})
    }
    puxar()
    const id = setInterval(puxar, 12_000)
    return () => { cancel = true; clearInterval(id) }
  }, [campanha, mostrarNumeros])

  const podeCancelar = disparo?.status === 'agendado' || disparo?.status === 'enviando'

  async function cancelarDisparo() {
    if (!disparo) return
    const ok = await confirm({
      titulo: 'Cancelar disparo',
      mensagem: disparo.status === 'enviando'
        ? 'O disparo está em andamento. Cancelar interrompe os lotes que ainda faltam — o que já saiu não volta.'
        : 'Cancelar o disparo agendado? Ele não vai mais disparar.',
      confirmLabel: 'Cancelar disparo',
      cancelLabel: 'Voltar',
      danger: true,
    })
    if (!ok) return
    setCancelando(true)
    try {
      atualizarDisparo(disparo.id, { status: 'cancelado' })
      addToast('success', 'Disparo cancelado')
      onClose()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally {
      setCancelando(false)
    }
  }

  async function atualizarStatus() {
    if (!campanha) return
    setAtualizando(true)
    try {
      await fetch('/api/rcs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha }),
      })
      const q = encodeURIComponent(campanha)
      const [res, fal] = await Promise.all([
        fetch('/api/rcs/resumo').then((r) => r.json()).catch(() => ({ resumo: {} })),
        fetch(`/api/rcs/status?campanha=${q}&falhas=1`).then((r) => r.json()).catch(() => ({ envios: [] })),
      ])
      setResumo((res.resumo?.[campanha] as ResumoRcs) ?? null)
      setFalhasRows((fal.envios ?? []) as EnvioRcs[])
    } catch {
      /* noop */
    } finally {
      setAtualizando(false)
    }
  }

  const base = disparo?.base.totalRegistros ?? disparo?.rcsDestinatarios?.length ?? 0
  const total = resumo?.total ?? 0
  const enviados = resumo?.enviados ?? 0
  const entregues = resumo?.entregues ?? 0
  const lidas = resumo?.lidas ?? 0
  const cliques = resumo?.clicados ?? 0
  const falhas = resumo?.falhas ?? 0
  const motivosFalha = Array.from(
    new Set(falhasRows.filter((e) => e.erro).map((e) => e.erro as string)),
  )
  const fallbackTentado = falhasRows.filter((e) => e.fallback_status).length
  const fallbackEntregue = falhasRows.filter(
    (e) => e.fallback_status === 'delivered' || e.fallback_status === 'read',
  ).length

  // "O que chegou no lead" — buckets mutuamente exclusivos (somam `total`).
  const recebeuRcs = resumo?.recebeuRcs ?? entregues
  const recebeuSms = resumo?.recebeuSms ?? 0
  const naoRecebeu = resumo?.naoRecebeu ?? 0
  const processando = resumo?.processando ?? 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  // A Solvefy cobra por RCS SUBMETIDO (não só entregue), MENOS as rejeições por saldo
  // (insufficient_balance = R$ 0). `cobravel` já desconta essas. + SMS de fallback (~R$ 0,078/nº).
  const custoUnit = disparo?.custoPorEnvio ?? CUSTO_RCS_POR_ENVIO
  const cobravel = resumo?.cobravel ?? enviados
  const rejeitados = resumo?.rejeitados ?? 0
  const custoFallback = (resumo?.fallbackEnviados ?? 0) * CUSTO_FALLBACK_SMS
  const custoSubmetido = cobravel * custoUnit + custoFallback
  const custoEntregue = entregues * custoUnit + custoFallback
  const custoEstimado = base * custoUnit

  // Resultado na casa (Reg/FTD/CPA) — mesma lógica do SMS: casa vem da UTM (Superbet) ou do
  // PID (BetMGM) gravado no disparo. Custo = RCS submetido + SMS de fallback.
  const casaAtiva: 'superbet' | 'betmgm' | null = disparo?.utm ? 'superbet' : disparo?.betmgmPid ? 'betmgm' : null
  const { resultado: tracking, carregando: carregandoTracking, custo: custoTracking } = useResultadoDisparo({
    utmValor: disparo?.utm || disparo?.betmgmPid,
    casa: casaAtiva,
    data: disparo?.dataDisparo,
    entregues: cobravel,
    custoPorUnidade: custoUnit,
    custoExtra: custoFallback,
  })

  const estagios: EstagioFunil[] = disparo ? [
    { tag: 'Base', contagem: base },
    { tag: 'Enviados', contagem: enviados || total },
    { tag: 'Entregues', contagem: entregues },
    { tag: 'Lidas', contagem: lidas },
    { tag: 'Cliques', contagem: cliques },
  ] : []

  // Variáveis por telefone (pra renderizar {{tokens}} igual saiu na mensagem de verdade) — vêm
  // da base do próprio disparo, já carregada junto com ele.
  const variaveisPorTelefone = useMemo(() => {
    const mapa = new Map<string, Record<string, string>>()
    for (const d of disparo?.rcsDestinatarios ?? []) mapa.set(d.telefone, d.variables ?? {})
    return mapa
  }, [disparo?.rcsDestinatarios])

  const leadsConversa = useMemo(() => {
    if (!disparo) return []
    return numeros.map((e) => envioParaLeadConversa(e, variaveisPorTelefone.get(e.telefone), disparo))
  }, [numeros, variaveisPorTelefone, disparo])

  // Escape fecha o mais interno primeiro (conversa -> lista de números), só no 3º Escape fecha
  // o painel principal — mesmo comportamento do PainelConversasFluxo.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (leadSelecionado) setLeadSelecionado(null)
      else if (mostrarNumeros) setMostrarNumeros(false)
    }
    if (mostrarNumeros || leadSelecionado) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mostrarNumeros, leadSelecionado])

  return (
    <AnimatePresence>
      {confirmDialog}
      {disparo && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60" onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
            style={{ width: LARGURA }}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate" title={disparo.nomenclatura}>
                    {disparo.nomenclatura}
                  </h2>
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-violet-500/15 text-violet-400">RCS</span>
                </div>
                <span className="inline-flex items-center gap-1.5 mt-1">
                  <StatusDot status={disparo.status} size={7} />
                  <Badge variant="status" value={disparo.status} />
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {disparo.status === 'agendado' && (
                  <button
                    onClick={() => router.push(`/disparos/rcs?edit=${disparo.id}`)}
                    className="flex items-center gap-1 text-[11px] px-2 h-7 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                )}
                {podeCancelar && (
                  <button
                    onClick={cancelarDisparo}
                    disabled={cancelando}
                    className="flex items-center gap-1 text-[11px] px-2 h-7 rounded border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors disabled:opacity-50"
                  >
                    <Ban size={12} /> {cancelando ? 'Cancelando…' : 'Cancelar'}
                  </button>
                )}
                <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Jornada da campanha</h3>
                  <button
                    onClick={atualizarStatus}
                    disabled={atualizando}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={atualizando ? 'animate-spin' : ''} />
                    {atualizando ? 'Consultando…' : 'Atualizar status'}
                  </button>
                </div>
                <FunilConversaoChart estagios={estagios} cor="#8b5cf6" orientacao="vertical" />
                {total === 0 && carregou && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Nenhum envio registrado ainda pra essa campanha.
                  </p>
                )}
                {falhas > 0 && (
                  <div className="text-[11px] text-[var(--error)]">
                    {falhas} envio(s) com falha{motivosFalha.length > 0 && ':'}
                    {motivosFalha.map((m, i) => (
                      <div key={i} className="pl-2">• {m}</div>
                    ))}
                  </div>
                )}
                {fallbackTentado > 0 && (
                  <p className="text-[11px] text-sky-400">
                    Fallback SMS: {fallbackEntregue}/{fallbackTentado} entregue(s)
                  </p>
                )}
              </section>

              {total > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    O que chegou no lead <span className="font-normal normal-case">(de {formatNumero(total)})</span>
                  </h3>
                  <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
                    <BucketLinha cor="#22c55e" label="Recebeu RCS" n={recebeuRcs} pct={pct(recebeuRcs)}
                      hint="o card completo (imagem + botões) renderizou no aparelho" />
                    <BucketLinha cor="#38bdf8" label="Recebeu SMS (fallback)" n={recebeuSms} pct={pct(recebeuSms)}
                      hint="aparelho não suporta RCS — caiu pro SMS e o SMS foi entregue" />
                    <BucketLinha cor="var(--error)" label="Não recebeu nada" n={naoRecebeu} pct={pct(naoRecebeu)}
                      hint="RCS falhou e o SMS de fallback também falhou (ou não tinha fallback)" />
                    <BucketLinha cor="var(--text-muted)" label="Processando" n={processando} pct={pct(processando)}
                      hint="ainda sem confirmação de entrega da Solvefy" />
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Resultado na casa</h3>
                <div className="flex flex-wrap gap-2">
                  <Estatistica label="Registros" valor={carregandoTracking ? '…' : formatNumero(tracking?.registros ?? 0)} cor="var(--d1)" />
                  <Estatistica label="FTDs" valor={carregandoTracking ? '…' : formatNumero(tracking?.ftds ?? 0)} cor="#22c55e" />
                  <Estatistica label="CPAs" valor={carregandoTracking ? '…' : String(tracking?.cpas ?? 0)} cor="var(--warning)" />
                  <Estatistica label="Custo" valor={custoTracking > 0 ? formatMoeda(custoTracking) : '—'} cor="#34d399" />
                </div>
                {!casaAtiva && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Sem UTM/PID de casa vinculado — sem isso não dá pra calcular Reg/FTD/CPA. Configure na criação do disparo.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Mensagem enviada</h3>
                <PreviewRcs disparo={disparo} />
              </section>

              {disparo.rcsFallback?.enabled && (() => {
                const conteudo = (disparo.rcsConteudo ?? { type: 'text', text: '' }) as RcsContent
                const vars = disparo.rcsDestinatarios?.[0]?.variables
                const link = primeiroLinkRcs(conteudo)
                const exemplo = renderizarFallbackText(disparo.rcsFallback, conteudo, vars)
                return (
                  <section className="space-y-2">
                    <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">SMS de fallback</h3>
                    <div className="rounded-lg border border-sky-500/30 bg-sky-500/[0.04] p-3 space-y-2">
                      <div className="text-[11px] text-[var(--text-muted)]">De: <span className="font-mono text-[var(--text-secondary)]">{disparo.rcsFallback.from}</span></div>
                      <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words">{exemplo || <span className="text-[var(--text-muted)] italic">copy vazia</span>}</p>
                      {link && (
                        <div className="text-[10px] text-sky-400 break-all">🔗 {link}</div>
                      )}
                      <div className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                        Exemplo com as variáveis do 1º número. Template salvo:
                        <div className="font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words mt-0.5">{disparo.rcsFallback.text}</div>
                      </div>
                    </div>
                  </section>
                )
              })()}

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Detalhes</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[var(--text-muted)]">Base</div>
                    <div className="text-[var(--text-primary)]">{formatNumero(base)} número(s)</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Custo estimado</div>
                    <div className="text-[var(--text-primary)]">R$ {custoSubmetido.toFixed(2)}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      RCS: {formatNumero(cobravel)} cobrável{cobravel === 1 ? '' : 's'} × {custoUnit.toFixed(2)} = R$ {(cobravel * custoUnit).toFixed(2)}
                    </div>
                    {custoFallback > 0 && (
                      <div className="text-[10px] text-sky-400/90">
                        Fallback SMS: {resumo?.fallbackEnviados} × {CUSTO_FALLBACK_SMS.toFixed(3)} = R$ {custoFallback.toFixed(2)}
                      </div>
                    )}
                    {rejeitados > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {formatNumero(rejeitados)} rejeitado(s) por saldo — R$ 0 (não cobrado)
                      </div>
                    )}
                    {cobravel === 0 && rejeitados === 0 && (
                      <div className="text-[10px] text-[var(--text-muted)]">estimado até R$ {custoEstimado.toFixed(2)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] flex items-center gap-1">
                      {disparo.status === 'agendado' && <CalendarClock size={10} />}
                      Data/Hora
                    </div>
                    {disparo.status === 'agendado' ? (
                      <EditarAgendamento
                        dataDisparo={disparo.dataDisparo}
                        horarioDisparo={disparo.horarioDisparo}
                        onSalvar={async (d, h) => {
                          await atualizarDisparo(disparo.id, { dataDisparo: d, horarioDisparo: h })
                          addToast('success', `Reagendado pra ${d} às ${h}`)
                        }}
                      />
                    ) : (
                      <div className="text-[var(--text-primary)]">{disparo.dataDisparo} {disparo.horarioDisparo}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Entregues / Lidas / Cliques</div>
                    <div className="text-[var(--text-primary)]">{entregues} / {lidas} / {cliques}</div>
                  </div>
                  {casaAtiva && (
                    <div>
                      <div className="text-[var(--text-muted)]">UTM/PID ({casaAtiva === 'superbet' ? 'Superbet' : 'BetMGM'})</div>
                      <div className="font-mono text-[var(--text-primary)] truncate">{disparo.utm || disparo.betmgmPid}</div>
                    </div>
                  )}
                </div>
              </section>

              {total > 0 && (
                <section className="space-y-2">
                  <button
                    onClick={() => setMostrarNumeros((v) => !v)}
                    className="flex items-center gap-1.5 w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ChevronRight size={13} />
                    Por número ({total})
                  </button>
                </section>
              )}
            </div>
          </motion.div>

          {mostrarNumeros && (
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 z-50 w-[380px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
              style={{ right: LARGURA }}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Por número</h2>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {numerosTotal > numeros.length ? `${numeros.length} de ${numerosTotal}` : `${numeros.length} número(s)`}
                  </p>
                </div>
                <button
                  onClick={() => { setMostrarNumeros(false); setLeadSelecionado(null) }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {numeros.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center py-10">Carregando…</p>
                ) : (
                  leadsConversa.map((lead, i) => {
                    const e = numeros[i]
                    const cliques = lead.mensagens.filter((m) => m.tipo === 'botao_clicado').length
                    const selecionado = leadSelecionado?.contactId === lead.contactId
                    return (
                      <button
                        key={lead.contactId}
                        onClick={() => setLeadSelecionado(lead)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          selecionado ? 'bg-[var(--d1)]/10 border-[var(--d1)]/40' : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{lead.telefone}</div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {lead.mensagens.length} msg · {cliques} clique(s) · {formatarTempoRelativo(lead.ultimaAtividade)}
                          </div>
                          <div className={`text-[10px] mt-0.5 font-mono ${corStatus(e.status)}`}>
                            {e.status}{e.fallback_status ? ` · SMS: ${e.fallback_status}` : ''}
                          </div>
                          {e.erro && FALHA.has(e.status) && (
                            <div className="text-[10px] text-[var(--error)]/80 truncate">{e.erro}</div>
                          )}
                          {e.receptivo_erro && (
                            <div className="text-[10px] text-[var(--error)]/80 truncate">receptivo: {e.receptivo_erro}</div>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}

          {leadSelecionado && (
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 z-50 max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
              style={{ right: LARGURA + LARGURA_LISTA_NUMEROS, width: LARGURA_LEAD_DETALHE }}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{leadSelecionado.telefone}</h2>
                  <p className="text-[10px] text-[var(--text-muted)]">{formatarTempoRelativo(leadSelecionado.ultimaAtividade)}</p>
                </div>
                <button onClick={() => setLeadSelecionado(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <LeadConversaDetalhe lead={leadSelecionado} remetenteNome="RCS" canal="rcs" />
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
