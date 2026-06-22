'use client'

import { useParams, useRouter } from 'next/navigation'
import { useDisparos } from '@/hooks/useDisparos'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function DetalheDisparoPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { getById, remove } = useDisparos()
  const { casas } = useCasasAposta()
  const { addToast } = useToast()

  const disparo = getById(id)

  if (!disparo) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <p className="text-[var(--text-secondary)]">Disparo não encontrado</p>
        <Link href="/disparos">
          <Button variant="secondary">Voltar para lista</Button>
        </Link>
      </div>
    )
  }

  function handleDelete() {
    if (confirm('Tem certeza que deseja apagar este disparo?')) {
      remove(id)
      addToast('success', 'Disparo removido')
      router.push('/disparos')
    }
  }

  return (
    <>
      <PageHeader
        titulo={disparo.nomenclatura}
        descricao={`ID: ${disparo.id.slice(0, 8)}...`}
        acoes={
          <div className="flex items-center gap-2">
            <Link href="/disparos">
              <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />}>
                Voltar
              </Button>
            </Link>
            <Button variant="danger" size="sm" onClick={handleDelete} icon={<Trash2 size={16} />}>
              Excluir
            </Button>
          </div>
        }
      />
      <div className="p-6 max-w-2xl">
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Tipo</span>
              <Badge variant="tipo" value={disparo.tipo} />
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Status</span>
              <div className="flex items-center gap-1.5">
                <StatusDot status={disparo.status} />
                <Badge variant="status" value={disparo.status} />
              </div>
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Data</span>
              <span className="text-sm text-[var(--text-primary)]">{disparo.dataDisparo}</span>
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Horário</span>
              <span className="text-sm text-[var(--text-primary)]">{disparo.horarioDisparo}</span>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
            <span className="text-xs text-[var(--text-muted)] block mb-2">Casas de Aposta</span>
            <div className="flex flex-wrap gap-1.5">
              {disparo.casasAposta.map((cId) => {
                const c = casas[cId]
                if (!c) return null
                return <Chip key={cId} label={c.nome} cor={c.cor} size="md" />
              })}
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
            <span className="text-xs text-[var(--text-muted)] block mb-2">Base CSV</span>
            <div className="text-sm text-[var(--text-primary)]">
              <span className="capitalize">{disparo.base.status}</span>
              {disparo.base.nomeArquivo && (
                <span className="text-[var(--text-secondary)] ml-2">({disparo.base.nomeArquivo})</span>
              )}
              {disparo.base.totalRegistros && (
                <span className="text-[var(--text-muted)] ml-2">· {disparo.base.totalRegistros} registros</span>
              )}
            </div>
          </div>

          {disparo.templateDaxx && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-2">Template DAXX</span>
              <span className="text-sm text-[var(--text-primary)]">{disparo.templateDaxx.nome}</span>
              {disparo.templateDaxx.url && (
                <a
                  href={disparo.templateDaxx.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--d1)] ml-2 hover:underline"
                >
                  Ver destino
                </a>
              )}
            </div>
          )}

          {disparo.numeroSendpulse && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-2">Número Sendpulse</span>
              <span className="text-sm text-[var(--text-primary)]">{disparo.numeroSendpulse.numero}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">
                (Chatbot: {disparo.numeroSendpulse.chatbotId})
              </span>
            </div>
          )}

          {disparo.notas && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4">
              <span className="text-xs text-[var(--text-muted)] block mb-2">Notas</span>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{disparo.notas}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
