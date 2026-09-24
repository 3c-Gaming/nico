'use client'

// "Mesma visão de análise" do PainelConversasFluxo (SendPulse) — mesmo layout de painéis
// empilhados (detalhe -> lead selecionado -> lista "ao vivo"), mesma comparação por dia/por funil
// e os mesmos blocos de Gasto em Ads / Lucro por FTD (reaproveitados literalmente daquele arquivo,
// já que dependem só de FlowTagConfig, que a Black Sender também tem — ver PainelConversasFluxo.tsx).
// O que não reaproveita: KPIs de clique (não existe botão de fluxo rastreado assim aqui) e o
// gráfico de funil por tag (jornada por tag não existe na Black Sender, é status de execução —
// mostrado como barras de progresso por status em vez de forçar no FunilConversaoChart, que
// pressupõe estágios cumulativos).

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronRight, CalendarDays, Copy, Check, GitCompare, MessageCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { adicionarDias, formatarData, parsearDataISO, hojeBrasilISO } from '@/lib/datas'
import { buscarResultadosDoDia, calcularResultadoLinhaNoDia, contarFunisPorUtm } from '@/lib/funis'
import { getState } from '@/lib/store'
import type { FlowTagConfig, CasaAposta, BlacksenderMensagem, BlacksenderCanal } from '@/types'
import { extrairVariaveisDaJornada, extrairCanalId, extrairTagsDaJornada } from '@/lib/blacksender/jornada'
import { BlocoMetricas, BlocoGastoMeta, BlocoLucroELinks, BlocoFunilChart, FunilComboBox } from './PainelConversasFluxo'
import { LeadConversaDetalhe, formatarTempoRelativo, type LeadComConversa, type MensagemFluxo } from './LeadConversaCard'
import type { EstagioFunil } from './FunilConversaoChart'

const LARGURA_METRICAS = 420
const LARGURA_COLUNA_COMPARACAO = 380
const LARGURA_LEAD_DETALHE = 440
const LARGURA_LISTA = 420
const INTERVALO_ATUALIZACAO_MS = 15_000

function formatarDataCurta(iso: string): string {
  return formatarData(parsearDataISO(iso), 'DD/MM')
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando',
  running: 'Em andamento',
  waiting_response: 'Aguardando resposta',
  completed: 'Concluído',
  error: 'Erro',
}
const STATUS_COR: Record<string, string> = {
  waiting: 'bg-[var(--text-muted)]',
  running: 'bg-[var(--d1)]',
  waiting_response: 'bg-amber-400',
  completed: 'bg-green-500',
  error: 'bg-red-500',
}
const ORDEM_STATUS = ['waiting', 'running', 'waiting_response', 'completed', 'error']

interface Execucao {
  id: string
  contactId: string | null
  status: string | null
  criadoEmOrigem: string | null
  atualizadoEmOrigem: string | null
  leadNome: string | null
  leadTelefone: string | null
  bruto: unknown
}

interface DadosFluxo {
  total: number
  porStatus: Record<string, number>
  estagiosTag: EstagioFunil[]
  execucoes: Execucao[]
}

export interface SnapshotHoje {
  leads: number
  registros: number
  ftds: number
  gasto: number
  custoEntrada: number | null
  custoRegistro: number | null
  custoFtd: number | null
}

// Campos internos do node builder da Black Sender (ids de nó, rastreamento de anúncio, tags já
// mostradas em outro lugar) que não ajudam num resumo rápido — o resto (email, lead_id de
// origem, último botão clicado etc.) é o que aparece no cabeçalho da conversa.
const VARIAVEIS_RESUMO_EXCLUIR = new Set([
  'nome', 'telefone', 'tag', 'tags', 'url_fbc', 'url_fbp', 'url_fbclid', 'etapa', 'stage_id', 'channel_id',
])

function formatarVariaveisResumo(variaveis: Record<string, unknown>): string {
  return Object.entries(variaveis)
    .filter(([chave, valor]) => !chave.startsWith('__') && !VARIAVEIS_RESUMO_EXCLUIR.has(chave) && valor != null && valor !== '')
    .map(([chave, valor]) => `${chave}: ${valor}`)
    .join(' · ')
}

// A Black Sender não marca a mensagem de resposta como "clique de botão" — o que ela expõe é os
// botões OFERECIDOS na mensagem outbound (bruto.interactive.buttons, ou .cta.label pra botão de
// link único). O clique em si só se manifesta de dois jeitos indiretos: o conteúdo da próxima
// mensagem inbound é exatamente o texto do botão, e a tag correspondente àquele botão é aplicada
// no lead (ver estagiosTag/calcularEstagiosTag — tags só entram assim, nunca por texto livre).
// Sem timeline por tag (flow_run guarda só o snapshot atual, não quando cada uma foi aplicada),
// o sinal confiável e verificável é o primeiro: compara o texto da resposta com os botões
// pendentes da última outbound. A tag aplicada é o que confirma, no funil de conversão da
// jornada, que esse clique realmente avançou o lead — não dá pra amarrar a tag exata a essa
// mensagem específica sem essa timeline.
function extrairBotoesOferecidos(bruto: unknown): string[] {
  if (!bruto || typeof bruto !== 'object') return []
  const interactive = (bruto as { interactive?: unknown }).interactive
  if (!interactive || typeof interactive !== 'object') return []
  const botoes = (interactive as { buttons?: unknown }).buttons
  if (Array.isArray(botoes)) return botoes.filter((b): b is string => typeof b === 'string')
  const cta = (interactive as { cta?: unknown }).cta
  const label = cta && typeof cta === 'object' ? (cta as { label?: unknown }).label : undefined
  return typeof label === 'string' ? [label] : []
}

function extrairCtaOferecida(bruto: unknown): string | null {
  if (!bruto || typeof bruto !== 'object') return null
  const interactive = (bruto as { interactive?: unknown }).interactive
  const cta = interactive && typeof interactive === 'object'
    ? (interactive as { cta?: unknown }).cta
    : undefined
  const label = cta && typeof cta === 'object' ? (cta as { label?: unknown }).label : undefined
  return typeof label === 'string' ? label : null
}

function normalizarBotao(valor: string): string {
  return valor.trim().toLocaleLowerCase('pt-BR')
}

interface CliqueBSInferido {
  botaoId: string
  botaoTitulo: string | null
}

/** Último botão que o Black Sender guardou no estado do flow_run. Esse snapshot não é histórico:
 * ele serve para recuperar o evento mais recente quando a mensagem inbound correspondente não
 * foi persistida (o caso dos CTAs de link e alguns quick replies). */
function extrairCliqueInferido(execucao: Execucao): CliqueBSInferido | null {
  const variaveis = extrairVariaveisDaJornada(execucao.bruto)
  const botaoId = [variaveis.last_button_id, variaveis.last_button_handle]
    .find((valor): valor is string => typeof valor === 'string' && valor.trim() !== '')
  if (!botaoId || (botaoId !== 'cta' && !botaoId.startsWith('btn'))) return null
  const mensagem = typeof variaveis.last_message === 'string' ? variaveis.last_message.trim() : ''
  return { botaoId, botaoTitulo: mensagem || null }
}

function mapMensagemBS(m: BlacksenderMensagem, botoesOferecidos?: string[], botaoClicado?: string): MensagemFluxo {
  if (botaoClicado) {
    return { id: m.id, direcao: 'entrada', criadoEm: m.criadoEmOrigem ?? m.recebidoEm, tipo: 'botao_clicado', botaoTitulo: botaoClicado }
  }
  const tipo: MensagemFluxo['tipo'] =
    m.midiaTipo === 'image' ? 'imagem'
      : m.midiaTipo === 'document' ? 'documento'
        : m.midiaTipo === 'audio' ? 'audio'
          : m.midiaTipo === 'video' ? 'video'
            : 'texto'
  return {
    id: m.id,
    direcao: m.direcao === 'outbound' ? 'saida' : 'entrada',
    criadoEm: m.criadoEmOrigem ?? m.recebidoEm,
    tipo,
    texto: m.conteudo ?? undefined,
    imagemUrl: tipo === 'imagem' ? (m.midiaUrl ?? undefined) : undefined,
    botoesOferecidos: botoesOferecidos && botoesOferecidos.length > 0 ? botoesOferecidos : undefined,
  }
}

/** Percorre a conversa inteira (não mensagem a mensagem) porque decidir se um inbound foi clique
 * de botão depende do que a mensagem outbound ANTERIOR ofereceu. */
function mapMensagensBS(mensagens: BlacksenderMensagem[], execucao?: Execucao | null): MensagemFluxo[] {
  let botoesPendentes: string[] = []
  const resultado = mensagens.map((m) => {
    if (m.direcao === 'outbound') {
      const botoesOferecidos = extrairBotoesOferecidos(m.bruto)
      botoesPendentes = botoesOferecidos
      return mapMensagemBS(m, botoesOferecidos)
    }
    const conteudoNormalizado = normalizarBotao(m.conteudo ?? '')
    const botaoClicado = botoesPendentes.find((b) => normalizarBotao(b) === conteudoNormalizado)
    // Uma resposta livre não consome os botões pendentes; o próximo outbound troca o conjunto.
    // Sem isso, um texto intermediário podia esconder um clique válido que veio logo depois.
    if (botaoClicado) botoesPendentes = []
    return mapMensagemBS(m, undefined, botaoClicado)
  })

  if (!execucao) return resultado
  const clique = extrairCliqueInferido(execucao)
  if (!clique) return resultado

  const tituloNormalizado = clique.botaoTitulo ? normalizarBotao(clique.botaoTitulo) : null
  const jaExiste = resultado.some((m) => {
    if (m.direcao !== 'entrada' || m.tipo !== 'botao_clicado') return false
    if (!tituloNormalizado) return m.botaoTitulo === 'CTA'
    return normalizarBotao(m.botaoTitulo ?? '') === tituloNormalizado
  })
  if (jaExiste) return resultado

  // Recupera a oferta correspondente para inserir o clique no ponto cronológico correto, entre
  // a mensagem que ofereceu o botão e a próxima mensagem do fluxo. Para CTA de link, procura a
  // oferta de CTA pelo payload bruto; para quick reply, pelo texto do botão.
  let ofertaIndex = -1
  let tituloOferta = clique.botaoTitulo
  for (let i = resultado.length - 1; i >= 0; i--) {
    const m = resultado[i]
    if (m.direcao !== 'saida' || !m.botoesOferecidos || m.botoesOferecidos.length === 0) continue
    const bruta = mensagens[i]
    if (clique.botaoId === 'cta') {
      const cta = extrairCtaOferecida(bruta?.bruto)
      if (cta) {
        ofertaIndex = i
        tituloOferta = cta
        break
      }
    } else if (!tituloNormalizado) {
      ofertaIndex = i
      tituloOferta = m.botoesOferecidos[0] ?? null
      break
    } else if (m.botoesOferecidos.some((b) => normalizarBotao(b) === tituloNormalizado)) {
      ofertaIndex = i
      break
    }
  }

  const referencia = ofertaIndex >= 0
    ? resultado[ofertaIndex].criadoEm
    : execucao.atualizadoEmOrigem ?? execucao.criadoEmOrigem ?? new Date().toISOString()
  const referenciaMs = Date.parse(referencia)
  const criadoEm = Number.isFinite(referenciaMs) ? new Date(referenciaMs + 1).toISOString() : referencia
  const mensagemInferida: MensagemFluxo = {
    id: `inferred-${execucao.id}-${clique.botaoId}`,
    direcao: 'entrada',
    criadoEm,
    tipo: 'botao_clicado',
    botaoTitulo: tituloOferta ?? 'CTA',
    inferido: true,
  }
  if (ofertaIndex >= 0) resultado.splice(ofertaIndex + 1, 0, mensagemInferida)
  else resultado.push(mensagemInferida)
  return resultado
}

export function PainelAnaliseFunilBlacksender({
  aberto,
  config,
  nomeFluxo,
  snapshot,
  onClose,
  canaisBlacksender,
}: {
  aberto: boolean
  config: FlowTagConfig | null
  nomeFluxo: string
  snapshot: SnapshotHoje | null
  onClose: () => void
  /** Lista de canais (números WhatsApp) do Black Sender — usada só pra achar nome/foto do canal
   * que rodou esse fluxo (ver canalId abaixo), pra mostrar nas mensagens "saída" da conversa em
   * vez do genérico "Bot". Quem chama já tem essa lista carregada (ver home page). */
  canaisBlacksender?: BlacksenderCanal[]
}) {
  const flowId = config?.flowId ?? null
  const dataReferencia = hojeBrasilISO()

  const [dados, setDados] = useState<DadosFluxo | null>(null)
  const [leadSelecionadoId, setLeadSelecionadoId] = useState<string | null>(null)
  const [mensagensPorLead, setMensagensPorLead] = useState<Record<string, MensagemFluxo[]>>({})
  const [buscaLead, setBuscaLead] = useState('')
  const [flowIdCopiado, setFlowIdCopiado] = useState(false)
  const [dataComparacao, setDataComparacao] = useState<string | null>(null)
  const [resultadoComparacao, setResultadoComparacao] = useState<{ data: string; leads: number; registros: number; ftds: number; estagiosTag: EstagioFunil[] } | null>(null)
  const [todosFunis, setTodosFunis] = useState<FlowTagConfig[]>([])
  const [funisComparados, setFunisComparados] = useState<string[]>([])
  type ResultadoFunilComparado = { leads: number; registros: number; ftds: number }
  const [resultadosFunisComparados, setResultadosFunisComparados] = useState<Record<string, ResultadoFunilComparado | null>>({})

  useEffect(() => {
    if (!aberto || !flowId) return
    let ativo = true
    let buscando = false

    const carregar = () => {
      if (buscando) return
      buscando = true
      fetch(`/api/blacksender/fluxos/${flowId}?data=${dataReferencia}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (ativo && d) setDados(d) })
        .catch(() => { /* mantém o último snapshot enquanto a API estiver indisponível */ })
        .finally(() => { buscando = false })
    }

    void carregar()
    const intervalo = window.setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
  }, [aberto, flowId, dataReferencia])

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    fetch('/api/flow-tag-configs')
      .then((r) => r.json())
      .then((data) => {
        if (!ativo) return
        const configs = (data.configs ?? []) as FlowTagConfig[]
        setTodosFunis(configs.filter((c) => c.origem === 'blacksender' && c.funil))
      })
      .catch(() => {})
    return () => { ativo = false }
  }, [aberto])

  useEffect(() => {
    if (!dataComparacao || !flowId) return
    const dataAlvo = dataComparacao
    // Mesmo endpoint do dia atual (dados), só que pro dia comparado — sem isso o funil de
    // conversão da coluna de comparação ficava sempre vazio (só os totais vinham).
    Promise.all([
      buscarResultadosDoDia(dataAlvo, [], [flowId]),
      fetch(`/api/blacksender/fluxos/${flowId}?data=${dataAlvo}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([dia, dadosDia]) => {
        const r = calcularResultadoLinhaNoDia({ flowId, origem: 'blacksender', utm: config?.utm, utmsExtras: config?.utmsExtras }, dia)
        setResultadoComparacao({
          data: dataAlvo,
          leads: r.leads,
          registros: Math.round(r.registros),
          ftds: Math.round(r.ftds),
          estagiosTag: dadosDia?.estagiosTag ?? [],
        })
      })
      .catch(() => setResultadoComparacao(null))
  }, [dataComparacao, flowId, config?.utm, config?.utmsExtras])

  useEffect(() => {
    if (funisComparados.length === 0) return
    let ativo = true
    const funisPorUtm = contarFunisPorUtm(Object.values(getState().flowTagConfigs))
    Promise.all(
      funisComparados.map(async (flowIdComparado): Promise<[string, ResultadoFunilComparado | null]> => {
        const cfg = todosFunis.find((f) => f.flowId === flowIdComparado)
        if (!cfg) return [flowIdComparado, null]
        const dia = await buscarResultadosDoDia(dataReferencia, [], [flowIdComparado])
        const r = calcularResultadoLinhaNoDia(cfg, dia, funisPorUtm)
        return [flowIdComparado, { leads: r.leads, registros: Math.round(r.registros), ftds: Math.round(r.ftds) }]
      }),
    ).then((entradas) => { if (ativo) setResultadosFunisComparados(Object.fromEntries(entradas)) })
    return () => { ativo = false }
  }, [funisComparados, dataReferencia, todosFunis])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (leadSelecionadoId) setLeadSelecionadoId(null)
      else onClose()
    }
    if (aberto) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [aberto, onClose, leadSelecionadoId])

  function fechar() {
    setLeadSelecionadoId(null)
    onClose()
  }

  function alternarDataComparacao(d: string) {
    setDataComparacao((atual) => (atual === d ? null : d))
  }

  function copiarFlowId() {
    if (!flowId) return
    navigator.clipboard.writeText(flowId)
    setFlowIdCopiado(true)
    setTimeout(() => setFlowIdCopiado(false), 1500)
  }

  function adicionarFunilComparado(flowIdEscolhido: string) {
    if (!flowIdEscolhido || funisComparados.includes(flowIdEscolhido) || funisComparados.length >= 2) return
    setFunisComparados((prev) => [...prev, flowIdEscolhido])
  }

  function removerFunilComparado(flowIdRemovido: string) {
    setFunisComparados((prev) => prev.filter((id) => id !== flowIdRemovido))
  }

  // Um contato pode ter mais de uma execução (reentrou no fluxo). Guarda a execução mais recente
  // para usar os metadados de clique quando a mensagem inbound não existir no espelho do Nico.
  const ultimaExecucaoPorContato = useMemo(() => {
    const mapa = new Map<string, Execucao>()
    for (const e of dados?.execucoes ?? []) {
      if (!e.contactId) continue
      const atual = mapa.get(e.contactId)
      if (!atual || (e.criadoEmOrigem ?? '') > (atual.criadoEmOrigem ?? '')) mapa.set(e.contactId, e)
    }
    return mapa
  }, [dados])

  function selecionarLead(contactId: string) {
    setLeadSelecionadoId(contactId)
  }

  useEffect(() => {
    if (!aberto || !leadSelecionadoId) return
    let ativo = true
    let buscando = false
    const execucao = ultimaExecucaoPorContato.get(leadSelecionadoId)

    const carregarConversa = () => {
      if (buscando) return
      buscando = true
      fetch(`/api/blacksender/leads/${leadSelecionadoId}/conversa`)
        .then((r) => (r.ok ? r.json() : { mensagens: [] }))
        .then((d) => {
          if (!ativo) return
          const mensagens = mapMensagensBS((d.mensagens ?? []) as BlacksenderMensagem[], execucao)
          setMensagensPorLead((prev) => ({ ...prev, [leadSelecionadoId]: mensagens }))
        })
        .catch(() => { /* mantém a última conversa carregada em caso de falha temporária */ })
        .finally(() => { buscando = false })
    }

    void carregarConversa()
    const intervalo = window.setInterval(carregarConversa, INTERVALO_ATUALIZACAO_MS)
    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
  }, [aberto, leadSelecionadoId, ultimaExecucaoPorContato])

  // Um contato pode ter mais de uma execução (reentrou no fluxo) — agrega pela última atividade,
  // mesmo papel que a query "últimos 50 leads" cumpre no lado SendPulse.
  const leads: LeadComConversa[] = useMemo(() => {
    if (!dados) return []
    const porContato = new Map<string, LeadComConversa>()
    for (const e of dados.execucoes) {
      if (!e.contactId) continue
      const quando = e.criadoEmOrigem ?? ''
      const atual = porContato.get(e.contactId)
      if (!atual || quando > atual.ultimaAtividade) {
        porContato.set(e.contactId, {
          contactId: e.contactId,
          nome: e.leadNome ?? '',
          telefone: e.leadTelefone ?? '',
          ultimaAtividade: quando,
          // Acumulada conforme o lead avança nos nós do fluxo (ver extrairTagsDaJornada) — o
          // último elemento é a etapa mais recente que ele alcançou, mostrada na lista de leads.
          tags: extrairTagsDaJornada(e.bruto),
          variaveis: {},
          mensagens: [],
          tagCliqueLink: null,
        })
      }
    }
    return [...porContato.values()].sort((a, b) => b.ultimaAtividade.localeCompare(a.ultimaAtividade))
  }, [dados])

  // Resumo compacto das variáveis (email, lead_id de origem, último botão clicado...) pro
  // cabeçalho da conversa — da execução mais recente de cada contato, mesma ideia do `leads` acima.
  const resumoVariaveisPorContato = useMemo(() => {
    const mapa = new Map<string, string>()
    if (!dados) return mapa
    const vistos = new Set<string>()
    for (const e of dados.execucoes) {
      if (!e.contactId || vistos.has(e.contactId)) continue
      vistos.add(e.contactId)
      mapa.set(e.contactId, formatarVariaveisResumo(extrairVariaveisDaJornada(e.bruto)))
    }
    return mapa
  }, [dados])

  const buscaNormalizada = buscaLead.trim().toLowerCase()
  const leadsFiltrados = buscaNormalizada
    ? leads.filter((l) =>
        l.nome.toLowerCase().includes(buscaNormalizada) ||
        l.telefone.toLowerCase().includes(buscaNormalizada) ||
        l.tags.some((t) => t.toLowerCase().includes(buscaNormalizada)),
      )
    : leads

  const leadSelecionadoBase = leadSelecionadoId ? leads.find((l) => l.contactId === leadSelecionadoId) ?? null : null
  const leadSelecionado: LeadComConversa | null = leadSelecionadoBase
    ? { ...leadSelecionadoBase, mensagens: mensagensPorLead[leadSelecionadoBase.contactId] ?? [] }
    : null
  const carregandoMensagensLead = leadSelecionadoBase !== null && mensagensPorLead[leadSelecionadoBase.contactId] === undefined

  // Canal (número WhatsApp) que rodou esse fluxo — primeiro channel_id não-nulo entre as
  // execuções (mesma lógica de canalDoFluxo em lib/blacksender/jornada.ts, mas sem o tipo
  // BlacksenderFlowRun completo, que Execucao aqui não satisfaz).
  const canalId = useMemo(() => {
    for (const e of dados?.execucoes ?? []) {
      const c = extrairCanalId(e.bruto)
      if (c) return c
    }
    return null
  }, [dados?.execucoes])
  const canalDoFlow = canalId ? canaisBlacksender?.find((c) => c.id === canalId) : undefined

  const totalStatus = dados ? Object.values(dados.porStatus).reduce((a, b) => a + b, 0) : 0

  const dataOntem = formatarData(adicionarDias(parsearDataISO(dataReferencia), -1), 'YYYY-MM-DD')
  const dataSemanaPassada = formatarData(adicionarDias(parsearDataISO(dataReferencia), -7), 'YYYY-MM-DD')
  const funisDisponiveisParaComparar = todosFunis.filter((f) => f.flowId !== flowId && !funisComparados.includes(f.flowId))

  const corDoFunil = config?.casas?.[0] ? (getState().casasAposta as Record<string, CasaAposta>)[config.casas[0]]?.cor : undefined

  const totalColunas = 1 + (dataComparacao ? 1 : 0) + funisComparados.length
  const larguraMetricas = totalColunas > 1 ? LARGURA_COLUNA_COMPARACAO * totalColunas : LARGURA_METRICAS
  const offsetMetricas = LARGURA_LISTA + (leadSelecionado ? LARGURA_LEAD_DETALHE : 0)

  return (
    <AnimatePresence>
      {aberto && config && flowId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={fechar}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0, right: offsetMetricas, width: larguraMetricas }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 z-50 max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {config.funil || nomeFluxo}
                  {funisComparados.map((fid) => {
                    const cfg = todosFunis.find((f) => f.flowId === fid)
                    return cfg ? <span key={fid} className="text-[var(--text-muted)]"> vs {cfg.funil}</span> : null
                  })}
                </h2>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Período: Hoje</p>
                <button
                  onClick={copiarFlowId}
                  title="Copiar Flow ID"
                  className="inline-flex items-center gap-1 mt-1 px-1 py-0.5 -mx-1 rounded text-sm cursor-pointer font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  {flowIdCopiado ? (
                    <><Check size={10} className="text-[var(--success)]" /> <span className="text-[var(--success)]">Copiado</span></>
                  ) : (
                    <><Copy size={10} /> {flowId}</>
                  )}
                </button>
              </div>
              <button onClick={fechar} className="shrink-0 p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)]">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-[var(--text-primary)]">Comparar com outro dia</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => alternarDataComparacao(dataOntem)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${dataComparacao === dataOntem
                      ? 'bg-[var(--d1)]/15 border-[var(--d1)]/40 text-[var(--d1)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                  >
                    Ontem
                  </button>
                  <button
                    onClick={() => alternarDataComparacao(dataSemanaPassada)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${dataComparacao === dataSemanaPassada
                      ? 'bg-[var(--d1)]/15 border-[var(--d1)]/40 text-[var(--d1)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                  >
                    Mesma data sem. passada
                  </button>
                  <label className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)] cursor-pointer">
                    <CalendarDays size={11} />
                    <input
                      type="date"
                      value={dataComparacao ?? ''}
                      max={dataReferencia}
                      onChange={(e) => setDataComparacao(e.target.value || null)}
                      className="bg-transparent outline-none [color-scheme:dark] w-[86px]"
                    />
                  </label>
                  {dataComparacao && (
                    <button onClick={() => setDataComparacao(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                    <GitCompare size={12} />
                    Comparar com outro funil
                  </span>
                  {funisComparados.length < 2 && funisDisponiveisParaComparar.length > 0 && (
                    <FunilComboBox opcoes={funisDisponiveisParaComparar} onSelect={adicionarFunilComparado} />
                  )}
                </div>
                {funisComparados.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {funisComparados.map((fid) => {
                      const cfg = todosFunis.find((f) => f.flowId === fid)
                      return (
                        <span
                          key={fid}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                        >
                          {cfg?.funil ?? fid}
                          <button onClick={() => removerFunilComparado(fid)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                            <X size={10} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                {dataComparacao && (
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Comparação · {formatarDataCurta(dataComparacao)}</div>
                    {resultadoComparacao?.data !== dataComparacao ? (
                      <div className="flex items-center justify-center py-10">
                        <Spinner size={16} />
                      </div>
                    ) : (
                      <>
                        <BlocoMetricas leads={resultadoComparacao.leads} registros={resultadoComparacao.registros} ftds={resultadoComparacao.ftds} total={resultadoComparacao.leads} />
                        <BlocoGastoMeta
                          flowId={flowId}
                          dataInicio={dataComparacao}
                          dataFim={dataComparacao}
                          registros={resultadoComparacao.registros}
                          ftds={resultadoComparacao.ftds}
                          tags={[]}
                          contagensPorTag={{}}
                        />
                        <BlocoFunilChart estagios={resultadoComparacao.estagiosTag} cor={corDoFunil} />
                      </>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-4">
                  {totalColunas > 1 && (
                    <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{config.funil || nomeFluxo} · Hoje</div>
                  )}
                  <BlocoMetricas leads={snapshot?.leads ?? 0} registros={snapshot?.registros ?? 0} ftds={snapshot?.ftds ?? 0} total={snapshot?.leads ?? 0} />
                  <BlocoGastoMeta
                    flowId={flowId}
                    dataInicio={dataReferencia}
                    dataFim={dataReferencia}
                    registros={snapshot?.registros ?? 0}
                    ftds={snapshot?.ftds ?? 0}
                    tags={[]}
                    contagensPorTag={{}}
                    editavel
                  />
                  <BlocoFunilChart estagios={dados?.estagiosTag ?? []} cor={corDoFunil} />

                  {/* Depois do funil (não antes) — se vier antes, empurra o funil pra baixo e
                      desalinha visualmente com o gráfico da coluna de comparação ao lado, que
                      não tem esse bloco (só a coluna "Hoje" edita lucro/links). */}
                  <BlocoLucroELinks flowId={flowId} dataInicio={dataReferencia} dataFim={dataReferencia} ftds={snapshot?.ftds ?? 0} editavel />

                  <div>
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Execuções por status</p>
                    {dados === null ? (
                      <div className="flex items-center justify-center py-6"><Spinner size={16} /></div>
                    ) : (
                      <div className="space-y-1.5">
                        {ORDEM_STATUS.filter((s) => (dados.porStatus[s] ?? 0) > 0).map((status) => {
                          const count = dados.porStatus[status]
                          return (
                            <div key={status} className="flex items-center gap-2">
                              <span className="text-xs text-[var(--text-muted)] w-36 shrink-0">{STATUS_LABEL[status] ?? status}</span>
                              <div className="flex-1 h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${STATUS_COR[status] ?? 'bg-[var(--text-muted)]'}`}
                                  style={{ width: `${totalStatus > 0 ? (count / totalStatus) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-[var(--text-primary)] w-8 text-right shrink-0">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {funisComparados.map((flowIdComparado) => {
                  const cfg = todosFunis.find((f) => f.flowId === flowIdComparado)
                  const resultado = resultadosFunisComparados[flowIdComparado]
                  if (!cfg) return null
                  return (
                    <div key={flowIdComparado} className="flex-1 min-w-0 space-y-4">
                      <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{cfg.funil} · Hoje</div>
                      {!resultado ? (
                        <div className="flex items-center justify-center py-10">
                          <Spinner size={16} />
                        </div>
                      ) : (
                        <>
                          <BlocoMetricas leads={resultado.leads} registros={resultado.registros} ftds={resultado.ftds} total={resultado.leads} />
                          <BlocoGastoMeta
                            flowId={cfg.flowId}
                            dataInicio={dataReferencia}
                            dataFim={dataReferencia}
                            registros={resultado.registros}
                            ftds={resultado.ftds}
                            tags={[]}
                            contagensPorTag={{}}
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {leadSelecionado && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-[420px] z-50 w-[440px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-[var(--border)]">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{leadSelecionado.nome || leadSelecionado.telefone}</h2>
                  <p className="text-md text-[var(--text-muted)]">{formatarTempoRelativo(leadSelecionado.ultimaAtividade)}</p>
                  {resumoVariaveisPorContato.get(leadSelecionado.contactId) && (
                    <p
                      className="text-[11px] text-[var(--text-muted)]/80 line-clamp-1 font-mono mt-0.5"
                      title={resumoVariaveisPorContato.get(leadSelecionado.contactId)}
                    >
                      {resumoVariaveisPorContato.get(leadSelecionado.contactId)}
                    </p>
                  )}
                </div>
                <button onClick={() => setLeadSelecionadoId(null)} className="hover:text-[var(--text-primary)] cursor-pointer transition-colors shrink-0 px-4 py-2">
                  <ChevronRight size={20} className="shrink-0 text-text-primary" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {carregandoMensagensLead ? (
                  <div className="flex items-center justify-center py-10"><Spinner size={20} /></div>
                ) : (
                  <LeadConversaDetalhe lead={leadSelecionado} remetenteNome={canalDoFlow?.nome ?? undefined} remetenteFotoUrl={canalDoFlow?.fotoUrl} canal="whatsapp" />
                )}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full glass bg-[var(--glass-bg)] border-l border-[var(--glass-border)] flex flex-col"
          >
            <div className="px-4 py-3.5 border-b border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-[var(--text-muted)]" />
                    Conversas ao vivo
                  </h2>
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                    {config.funil || nomeFluxo} · {buscaNormalizada ? `${leadsFiltrados.length} de ${leads.length} leads` : `${leads.length} leads`}
                  </p>
                </div>
                <button onClick={fechar} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                value={buscaLead}
                onChange={(e) => setBuscaLead(e.target.value)}
                placeholder="Filtrar por nome, telefone ou tag..."
                className="w-full text-[11px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {dados === null ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={20} />
                </div>
              ) : leads.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-10">Nenhuma conversa encontrada pra esse fluxo ainda.</p>
              ) : leadsFiltrados.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-10">Nenhum lead com esse nome/telefone/tag nos {leads.length} carregados.</p>
              ) : (
                leadsFiltrados.map((lead) => {
                  const selecionado = leadSelecionadoId === lead.contactId
                  const ultimaEtapa = lead.tags[lead.tags.length - 1]
                  return (
                    <button
                      key={lead.contactId}
                      onClick={() => selecionarLead(lead.contactId)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${selecionado
                        ? 'bg-[var(--d1)]/10 border-[var(--d1)]/40'
                        : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-elevated)]'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{lead.nome || lead.telefone}</div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {lead.telefone} · {formatarTempoRelativo(lead.ultimaAtividade)}
                        </div>
                        {ultimaEtapa && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] truncate max-w-full">
                            {ultimaEtapa}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
