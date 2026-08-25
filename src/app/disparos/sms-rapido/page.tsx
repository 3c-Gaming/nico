'use client'

import { useEffect, useMemo, useState } from 'react'
import { Upload, Send, RefreshCw, Link2, Save, BookmarkPlus, Pin } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { UtmComboBox } from '@/components/ui/UtmComboBox'
import { useToast } from '@/components/ui/Toast'
import { useDisparos } from '@/hooks/useDisparos'
import { usePinnedDisparos } from '@/hooks/usePinnedDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { useResultadoDisparo } from '@/hooks/useResultadoDisparo'
import { formatMoeda, formatNumero } from '@/lib/resultadoDisparo'
import type { Disparo } from '@/types'

const CASA_TRACKING_INFO = {
  superbet: { label: 'Superbet' },
  betmgm: { label: 'BetMGM' },
} as const
type CasaTracking = keyof typeof CASA_TRACKING_INFO

function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getLocalHora(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface LinhaBase {
  telefone: string
  variables: Record<string, string>
}

interface ResultadoEnvio {
  telefone: string
  ok: boolean
  status?: string
  erro?: string
}

interface SmsTemplate {
  id: string
  nome: string
  corpo: string
}

// Divide o corpo em pedaços de texto normal + tokens {{variavel}}, marcando cada token como
// reconhecido (existe entre as colunas da base carregada) ou não — é a "forma visual de saber
// que a variável foi aplicada" antes de disparar, sem precisar de um textarea rico.
function CopyComTags({ texto, variaveisConhecidas }: { texto: string; variaveisConhecidas: string[] }) {
  const partes = texto.split(/(\{\{[^}]*\}\})/g).filter((p) => p !== '')
  if (!texto) return <span className="text-[var(--text-muted)] italic">nada escrito ainda...</span>
  return (
    <>
      {partes.map((parte, i) => {
        const m = parte.match(/^\{\{([^}]*)\}\}$/)
        if (!m) return <span key={i}>{parte}</span>
        const nomeVar = m[1].trim()
        const reconhecida = variaveisConhecidas.includes(nomeVar)
        return (
          <span
            key={i}
            className={`px-1 rounded font-mono ${reconhecida ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
            title={reconhecida ? 'Variável reconhecida — existe como coluna na base carregada' : 'Essa variável não bate com nenhuma coluna da base — vai ser enviada em branco'}
          >
            {parte}
          </span>
        )
      })}
    </>
  )
}

function resolverExemplo(texto: string, variables: Record<string, string>): string {
  return texto.replace(/\{\{([^}]*)\}\}/g, (match, nome) => variables[nome.trim()] ?? match)
}

// Cor por status — "clicked" ganha destaque próprio (é o sinal de engajamento real, não só
// entrega) e só existe quando useShortener + trackClicks estavam ligados no envio.
function corDoStatus(status: string): string {
  if (status === 'clicked') return 'text-violet-400 font-semibold'
  if (status === 'delivered') return 'text-emerald-400'
  if (status === 'undelivered' || status === 'failed') return 'text-[var(--error)]'
  return 'text-[var(--text-primary)]'
}

const COLUNAS_TELEFONE = ['telefone', 'phone', 'numero', 'número', 'celular', 'whatsapp', 'to']

// Parser simples de CSV — trata campos entre aspas (podem ter vírgula dentro), sem dependência
// externa. Suficiente pra base de telefones + colunas extras viram variáveis do template.
function parsearCsv(texto: string): { headers: string[]; linhas: string[][] } {
  const linhasBrutas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  function parseLinha(linha: string): string[] {
    const campos: string[] = []
    let atual = ''
    let dentroAspas = false
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i]
      if (c === '"') {
        dentroAspas = !dentroAspas
      } else if (c === ',' && !dentroAspas) {
        campos.push(atual.trim())
        atual = ''
      } else {
        atual += c
      }
    }
    campos.push(atual.trim())
    return campos
  }
  const [headerLinha, ...resto] = linhasBrutas
  return { headers: parseLinha(headerLinha), linhas: resto.map(parseLinha) }
}

export default function SmsRapidoPage() {
  const { addToast } = useToast()
  const { create: createDisparo } = useDisparos()
  const { toggle: togglePin, isPinned } = usePinnedDisparos()
  const { list: casasList } = useCasasAposta()

  const [campanha, setCampanha] = useState(() => `sms-${new Date().toISOString().slice(0, 10)}`)
  const [from, setFrom] = useState('DISPARO')
  const [corpo, setCorpo] = useState('')
  const [useShortener, setUseShortener] = useState(true)

  // Tracking (opcional, mas é o que faz Reg/FTD/CPA aparecerem depois — mesma UTM+casa usada em
  // /funis e /utms) e custo fixo por SMS (a Solvefy não retorna preço, então é digitado aqui).
  const [casaTracking, setCasaTracking] = useState<CasaTracking | ''>('')
  const [utmValor, setUtmValor] = useState('')
  const [custoPorSms, setCustoPorSms] = useState('')
  const [disparoCriado, setDisparoCriado] = useState<Disparo | null>(null)

  const { resultado: resultadoTracking, custo: custoTracking, carregando: carregandoTracking } = useResultadoDisparo({
    utmValor: disparoCriado?.utm || disparoCriado?.betmgmPid,
    casa: disparoCriado ? (disparoCriado.utm ? 'superbet' : disparoCriado.betmgmPid ? 'betmgm' : null) : null,
    data: disparoCriado?.dataDisparo,
    entregues: disparoCriado?.base.totalRegistros,
    custoPorUnidade: disparoCriado?.custoPorEnvio,
  })

  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [colunaTelefone, setColunaTelefone] = useState<string>('')
  const [linhas, setLinhas] = useState<LinhaBase[]>([])
  const [linhasCruas, setLinhasCruas] = useState<string[][]>([])

  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null)
  const [atualizandoStatus, setAtualizandoStatus] = useState(false)

  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [templateSelecionadoId, setTemplateSelecionadoId] = useState('')
  const [mostrarSalvarTemplate, setMostrarSalvarTemplate] = useState(false)
  const [nomeNovoTemplate, setNomeNovoTemplate] = useState('')
  const [salvandoTemplate, setSalvandoTemplate] = useState(false)

  useEffect(() => {
    fetch('/api/sms/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {})
  }, [])

  function handleCarregarTemplate(id: string) {
    setTemplateSelecionadoId(id)
    const template = templates.find((t) => t.id === id)
    if (template) setCorpo(template.corpo)
  }

  async function handleSalvarTemplate() {
    if (!nomeNovoTemplate.trim() || !corpo.trim()) return
    setSalvandoTemplate(true)
    try {
      const res = await fetch('/api/sms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeNovoTemplate.trim(), corpo }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTemplates((prev) => [data.template, ...prev])
      setTemplateSelecionadoId(data.template.id)
      setMostrarSalvarTemplate(false)
      setNomeNovoTemplate('')
      addToast('success', 'Template salvo')
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setSalvandoTemplate(false)
    }
  }

  function recalcularLinhas(hdrs: string[], cruas: string[][], colTelefone: string) {
    const idx = hdrs.indexOf(colTelefone)
    if (idx === -1) { setLinhas([]); return }
    const novas = cruas.map((campos) => {
      const variables: Record<string, string> = {}
      hdrs.forEach((h, i) => { if (i !== idx) variables[h] = campos[i] ?? '' })
      return { telefone: campos[idx] ?? '', variables }
    }).filter((l) => l.telefone)
    setLinhas(novas)
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNomeArquivo(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const texto = String(reader.result ?? '')
      const { headers: hdrs, linhas: cruas } = parsearCsv(texto)
      setHeaders(hdrs)
      setLinhasCruas(cruas)
      const auto = hdrs.find((h) => COLUNAS_TELEFONE.includes(h.toLowerCase())) ?? hdrs[0] ?? ''
      setColunaTelefone(auto)
      recalcularLinhas(hdrs, cruas, auto)
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleColunaTelefone(col: string) {
    setColunaTelefone(col)
    recalcularLinhas(headers, linhasCruas, col)
  }

  function inserirVariavel(nome: string) {
    setCorpo((prev) => `${prev}{{${nome}}}`)
  }

  const variaveisDisponiveis = useMemo(
    () => headers.filter((h) => h !== colunaTelefone),
    [headers, colunaTelefone],
  )

  const podeEnviar = campanha.trim() && from.trim() && corpo.trim() && linhas.length > 0 && !enviando

  async function handleEnviar() {
    if (!podeEnviar) return
    if (!confirm(`Enviar SMS pra ${linhas.length} número(s) agora? Essa ação é real, não tem como desfazer.`)) return
    setEnviando(true)
    setProgresso(`Enviando 0 / ${linhas.length}...`)
    setResultados(null)
    setDisparoCriado(null)
    try {
      const res = await fetch('/api/sms/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha, from, corpo, useShortener, destinatarios: linhas }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResultados(data.resultados)
      addToast(data.falhas > 0 ? 'warning' : 'success', `${data.enviados} enviado(s), ${data.falhas} falha(s)`)

      // Cria um Disparo de verdade só quando casa+UTM foram preenchidos — é o que permite ver
      // Reg/FTD/CPA depois (mesmo tracking de /funis e /utms) e pinar na Home. Sem isso, o envio
      // já aconteceu normalmente, só fica sem esse acompanhamento agregado.
      if (casaTracking && utmValor.trim()) {
        const casaId = casasList.find((c) => c.nome.toLowerCase().includes(casaTracking === 'superbet' ? 'super' : 'mgm'))?.id
        const agora = new Date()
        const novoDisparo: Disparo = {
          id: crypto.randomUUID(),
          tipo: 'PONTUAL',
          canal: 'sms',
          nomenclatura: campanha,
          status: 'executado',
          casasAposta: casaId ? [casaId] : [],
          dataDisparo: getLocalDate(),
          horarioDisparo: getLocalHora(),
          base: { status: 'disponivel', totalRegistros: linhas.length, nomeArquivo: nomeArquivo ?? undefined },
          utm: casaTracking === 'superbet' ? utmValor.trim() : undefined,
          betmgmPid: casaTracking === 'betmgm' ? utmValor.trim() : undefined,
          custoPorEnvio: custoPorSms ? Number(custoPorSms) : undefined,
          criadoEm: agora.toISOString(),
          atualizadoEm: agora.toISOString(),
          notas: `Disparo SMS via Solvefy — campanha "${campanha}"`,
        }
        try {
          const resDisparo = await fetch('/api/disparos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disparo: novoDisparo }),
          })
          const dataDisparo = await resDisparo.json()
          if (dataDisparo.disparo) {
            createDisparo(dataDisparo.disparo)
            togglePin(dataDisparo.disparo.id)
            setDisparoCriado(dataDisparo.disparo)
            addToast('success', 'Disparo criado e pinado na Home')
          }
        } catch {
          addToast('warning', 'SMS enviado, mas não deu pra criar o registro de tracking')
        }
      }
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setEnviando(false)
      setProgresso('')
    }
  }

  async function handleAtualizarStatus() {
    setAtualizandoStatus(true)
    try {
      const res = await fetch('/api/sms/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const porTelefone = new Map((data.envios as { telefone: string; status: string }[]).map((e) => [e.telefone, e.status]))
      setResultados((prev) => prev?.map((r) => ({ ...r, status: porTelefone.get(r.telefone) ?? r.status })) ?? null)
      addToast('success', 'Status atualizado')
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setAtualizandoStatus(false)
    }
  }

  return (
    <>
      <PageHeader titulo="Disparo SMS" descricao="Envio direto via Solvefy — base, copy e tracking numa tela só" />
      <div className="p-6 space-y-5 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Nome da campanha</label>
            <input
              value={campanha}
              onChange={(e) => setCampanha(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">From (sender ID)</label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] font-mono outline-none focus:border-[var(--border-strong)]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--text-muted)]">Base (CSV)</label>
          <label className="flex items-center gap-2 h-10 px-3 border border-dashed border-[var(--border)] rounded-md text-sm text-[var(--text-muted)] cursor-pointer hover:border-[var(--border-strong)] transition-colors w-fit">
            <Upload size={14} />
            {nomeArquivo ?? 'Escolher arquivo CSV...'}
            <input type="file" accept=".csv" onChange={handleArquivo} className="hidden" />
          </label>
          {headers.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[var(--text-muted)]">Coluna do telefone:</span>
              <select
                value={colunaTelefone}
                onChange={(e) => handleColunaTelefone(e.target.value)}
                className="h-7 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
              >
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-xs text-[var(--text-muted)]">{linhas.length} número(s) válido(s)</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-medium text-[var(--text-muted)]">Mensagem</label>
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <select
                  value={templateSelecionadoId}
                  onChange={(e) => handleCarregarTemplate(e.target.value)}
                  className="h-7 px-2 text-[10px] bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none"
                >
                  <option value="">Carregar template...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={() => setMostrarSalvarTemplate((v) => !v)}
                disabled={!corpo.trim()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 transition-colors"
              >
                <BookmarkPlus size={11} />
                Salvar como template
              </button>
            </div>
          </div>

          {mostrarSalvarTemplate && (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nomeNovoTemplate}
                onChange={(e) => setNomeNovoTemplate(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSalvarTemplate()}
                placeholder="Nome do template..."
                className="flex-1 h-7 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)]"
              />
              <Button size="sm" icon={<Save size={12} />} onClick={handleSalvarTemplate} disabled={!nomeNovoTemplate.trim()} loading={salvandoTemplate}>
                Salvar
              </Button>
            </div>
          )}

          {variaveisDisponiveis.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-[var(--text-muted)]">inserir:</span>
              {variaveisDisponiveis.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserirVariavel(v)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Oi {{nome}}, seu bônus está liberado! Acesse: {{link}}"
            rows={4}
            maxLength={1530}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] resize-none font-mono"
          />
          <p className="text-[10px] text-[var(--text-muted)]">{corpo.length}/1530 caracteres — links completos na copy (com http/https) são encurtados automaticamente se a opção abaixo estiver ligada.</p>

          {corpo && (
            <div className="space-y-2 pt-1">
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
                <p className="text-[10px] font-medium text-[var(--text-muted)] mb-1">
                  Pré-visualização — <span className="text-emerald-400">verde</span> = variável reconhecida na base, <span className="text-red-400">vermelho</span> = não bate com nenhuma coluna
                </p>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
                  <CopyComTags texto={corpo} variaveisConhecidas={variaveisDisponiveis} />
                </p>
              </div>
              {linhas.length > 0 && (
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
                  <p className="text-[10px] font-medium text-[var(--text-muted)] mb-1">Exemplo real (1ª linha da base, {linhas[0].telefone})</p>
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{resolverExemplo(corpo, linhas[0].variables)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer w-fit">
          <input type="checkbox" checked={useShortener} onChange={(e) => setUseShortener(e.target.checked)} />
          <Link2 size={13} className="text-[var(--text-muted)]" />
          Encurtar links automaticamente (encurtador nativo da Solvefy, com tracking de cliques)
        </label>

        <div className="space-y-1.5 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]">
          <p className="text-xs font-medium text-[var(--text-primary)]">Tracking (opcional, mas é o que traz Reg/FTD/CPA depois)</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-[var(--bg-base)] border border-[var(--border)] rounded p-0.5">
              {(['', 'superbet', 'betmgm'] as const).map((opcao) => (
                <button
                  key={opcao || 'nenhuma'}
                  type="button"
                  onClick={() => { setCasaTracking(opcao); setUtmValor('') }}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${casaTracking === opcao ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {opcao === '' ? 'Sem tracking' : CASA_TRACKING_INFO[opcao].label}
                </button>
              ))}
            </div>
            {casaTracking && (
              <div className="flex-1 min-w-[180px]">
                <UtmComboBox value={utmValor} onChange={setUtmValor} casa={casaTracking} placeholder="UTM/PID dessa campanha..." />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">Custo/SMS R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={custoPorSms}
                onChange={(e) => setCustoPorSms(e.target.value)}
                placeholder="0,00"
                className="w-20 h-7 px-2 text-xs bg-[var(--bg-base)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
            </div>
          </div>
          {casaTracking && !utmValor.trim() && (
            <p className="text-[10px] text-amber-400">Sem UTM/PID preenchida, o disparo não vai virar um registro rastreável — só o SMS em si vai ser enviado.</p>
          )}
        </div>

        {linhas.length > 0 && (
          <div className="rounded-md border border-[var(--border)] overflow-hidden max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                <tr>
                  <th className="text-left px-3 py-1.5 text-[var(--text-muted)]">Telefone</th>
                  {variaveisDisponiveis.map((v) => <th key={v} className="text-left px-3 py-1.5 text-[var(--text-muted)]">{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 5).map((l, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-3 py-1 font-mono text-[var(--text-primary)]">{l.telefone}</td>
                    {variaveisDisponiveis.map((v) => <td key={v} className="px-3 py-1 text-[var(--text-muted)] truncate max-w-[120px]">{l.variables[v]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length > 5 && <p className="text-[10px] text-[var(--text-muted)] px-3 py-1 border-t border-[var(--border)]">+{linhas.length - 5} linha(s)...</p>}
          </div>
        )}

        <Button icon={<Send size={14} />} onClick={handleEnviar} disabled={!podeEnviar} loading={enviando}>
          {enviando ? (progresso || 'Enviando...') : `Enviar pra ${linhas.length || 0} número(s)`}
        </Button>

        {resultados && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Resultado do envio</h3>
              <div className="flex items-center gap-2">
                {disparoCriado && (
                  <Button
                    variant={isPinned(disparoCriado.id) ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<Pin size={12} />}
                    onClick={() => togglePin(disparoCriado.id)}
                  >
                    {isPinned(disparoCriado.id) ? 'Pinado na Home' : 'Pinar na Home'}
                  </Button>
                )}
                <Button variant="secondary" size="sm" icon={<RefreshCw size={12} className={atualizandoStatus ? 'animate-spin' : ''} />} onClick={handleAtualizarStatus} loading={atualizandoStatus}>
                  Atualizar status
                </Button>
              </div>
            </div>

            {disparoCriado && (
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{carregandoTracking ? '…' : formatNumero(resultadoTracking?.registros ?? 0)}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Registros</div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{carregandoTracking ? '…' : formatNumero(resultadoTracking?.ftds ?? 0)}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">FTDs</div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{carregandoTracking ? '…' : resultadoTracking?.cpas ?? '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">CPAs</div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-400">{custoTracking > 0 ? formatMoeda(custoTracking) : '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Custo</div>
                </div>
              </div>
            )}

            <div className="rounded-md border border-[var(--border)] overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-[var(--text-muted)]">Telefone</th>
                    <th className="text-left px-3 py-1.5 text-[var(--text-muted)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.telefone} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">{r.telefone}</td>
                      <td className={`px-3 py-1.5 ${r.ok ? corDoStatus(r.status ?? 'queued') : 'text-[var(--error)]'}`}>
                        <span className="inline-flex items-center gap-1">
                          {r.ok ? (r.status ?? 'queued') : (r.erro ?? 'erro')}
                          {r.ok && r.status === 'clicked' && <Link2 size={11} />}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
