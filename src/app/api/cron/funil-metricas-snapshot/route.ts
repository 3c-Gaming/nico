import { NextResponse } from 'next/server'
import { listarFlowTagConfigs, upsertFunilMetricaDiaria } from '@/lib/db/supabase'
import { carregarContextoSnapshot, gerarSnapshotDoFunil } from '@/lib/funilSnapshot'
import { inicioDoDiaBrasilMs, dataParaBrasilISO } from '@/lib/datas'

export const maxDuration = 300

/**
 * Fecha o snapshot diário (leads/registros/FTDs/tags/custos/ROI) de TODO funil configurado, pro
 * dia que acabou de virar — roda logo depois da meia-noite de Brasília (ver vercel.json,
 * "10 3 * * *" = 00:10 BRT) pra já pegar o dia anterior completo, sem depender de alguém ter
 * salvo o funil naquele dia (ver /api/funil-metricas-diarias/snapshot, que só cobre o dia
 * corrente e só quando alguém mexe na config). Um funil falho não derruba os outros
 * (Promise.allSettled) — mesmo padrão de cron/discord-report.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Unauthorized' }, { status: 401 })
  }

  const ontem = dataParaBrasilISO(new Date(inicioDoDiaBrasilMs() - 1))

  try {
    const configs = (await listarFlowTagConfigs()).filter((c) => (c.tags?.length ?? 0) > 0)
    const ctx = await carregarContextoSnapshot(ontem)

    const resultados = await Promise.allSettled(
      configs.map(async (config) => {
        const snapshot = await gerarSnapshotDoFunil(config, ontem, ctx)
        return upsertFunilMetricaDiaria({ ...snapshot, atualizadoEm: new Date().toISOString() })
      }),
    )

    const sucesso = resultados.filter((r) => r.status === 'fulfilled').length
    const falhas = resultados.length - sucesso
    return NextResponse.json({ ok: true, data: ontem, funis: configs.length, sucesso, falhas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
