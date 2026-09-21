import { NextRequest, NextResponse } from 'next/server'
import { listarFlowTagConfigs, upsertFunilMetricaDiaria } from '@/lib/db/supabase'
import { carregarContextoSnapshot, gerarSnapshotDoFunil } from '@/lib/funilSnapshot'
import { hojeBrasilISO } from '@/lib/datas'

export const maxDuration = 60

/**
 * POST /api/funil-metricas-diarias/snapshot
 * body: { flowId: string }
 *
 * Grava (upsert) o snapshot de HOJE de um funil — disparado ao Salvar na tela de Funis (fire-and-
 * forget, ver updateFlowTagConfig/handleSave), pra que qualquer configuração nova já vire linha no
 * banco sem esperar o cron da meia-noite. O cron (funil-metricas-snapshot) cobre o fechamento do
 * dia mesmo que esse disparo falhe ou nunca aconteça (funil configurado e nunca mais salvo).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { flowId?: string }
    if (!body.flowId) return NextResponse.json({ error: 'flowId é obrigatório' }, { status: 400 })

    const configs = await listarFlowTagConfigs()
    const config = configs.find((c) => c.flowId === body.flowId)
    if (!config) return NextResponse.json({ error: `Funil ${body.flowId} não configurado` }, { status: 404 })
    // Funil Black Sender nunca tem tags (não existe esse conceito lá — ver FlowTagConfig.origem) e
    // isso é normal, não falta de configuração; só bloqueia quem é SendPulse de verdade e ainda não
    // configurou tag nenhuma. gerarSnapshotDoFunil já lida com tags vazias sem quebrar (só
    // registros/FTDs/gasto ficam certos pra Black Sender por enquanto — leads fica 0 aqui até esse
    // snapshot histórico também aprender a origem, ver PainelFunisBlacksender.tsx pro "leads hoje"
    // ao vivo, que já está correto).
    if (config.origem !== 'blacksender' && (!config.tags || config.tags.length === 0)) {
      return NextResponse.json({ error: 'Funil sem tags configuradas — nada pra medir ainda' }, { status: 400 })
    }

    const data = hojeBrasilISO()
    const ctx = await carregarContextoSnapshot(data)
    const snapshot = await gerarSnapshotDoFunil(config, data, ctx)
    const salvo = await upsertFunilMetricaDiaria({ ...snapshot, atualizadoEm: new Date().toISOString() })

    return NextResponse.json({ metrica: salvo })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
