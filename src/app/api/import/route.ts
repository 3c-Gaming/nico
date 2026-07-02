import { NextResponse } from 'next/server'
import type { FlowTagConfig, CasaAposta, LinkTemplate, Disparo, Esteira } from '@/types'
import {
  bulkInsertFlowTagConfigs,
  bulkInsertCasas,
  bulkInsertLinkTemplates,
  bulkInsertDisparos,
  bulkInsertEsteiras,
} from '@/lib/db/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const result: Record<string, { inserted: number }> = {}

    if (body.flowTagConfigs) {
      const configs: FlowTagConfig[] = Array.isArray(body.flowTagConfigs)
        ? body.flowTagConfigs
        : Object.values(body.flowTagConfigs)
      if (configs.length > 0) {
        const inserted = await bulkInsertFlowTagConfigs(configs)
        result.flowTagConfigs = { inserted: inserted.length }
      }
    }

    if (body.casasAposta || body.casas) {
      const casas: CasaAposta[] = Array.isArray(body.casasAposta || body.casas)
        ? (body.casasAposta || body.casas)
        : Object.values(body.casasAposta || body.casas)
      if (casas.length > 0) {
        const inserted = await bulkInsertCasas(casas)
        result.casas = { inserted: inserted.length }
      }
    }

    if (body.linkTemplates) {
      const templates: LinkTemplate[] = Array.isArray(body.linkTemplates)
        ? body.linkTemplates
        : Object.values(body.linkTemplates)
      if (templates.length > 0) {
        const inserted = await bulkInsertLinkTemplates(templates)
        result.linkTemplates = { inserted: inserted.length }
      }
    }

    if (body.disparos) {
      const disparos: Disparo[] = Array.isArray(body.disparos)
        ? body.disparos
        : Object.values(body.disparos)
      if (disparos.length > 0) {
        const inserted = await bulkInsertDisparos(disparos)
        result.disparos = { inserted: inserted.length }
      }
    }

    if (body.esteiras) {
      const esteiras: Esteira[] = Array.isArray(body.esteiras)
        ? body.esteiras
        : Object.values(body.esteiras)
      if (esteiras.length > 0) {
        const inserted = await bulkInsertEsteiras(esteiras)
        result.esteiras = { inserted: inserted.length }
      }
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
