import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const migrationSql = [
      `CREATE TABLE IF NOT EXISTS disparos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(50) NOT NULL DEFAULT 'manual',
        status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
        casas_aposta TEXT[] DEFAULT '{}',
        utm VARCHAR(255),
        betmgm_pid VARCHAR(255),
        data_disparo DATE,
        config JSONB DEFAULT '{}',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS esteiras (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        ativa BOOLEAN DEFAULT true,
        disparos JSONB DEFAULT '{}',
        config JSONB DEFAULT '{}',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS casas_aposta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS link_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        template TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS flow_tag_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flow_id VARCHAR(100) NOT NULL,
        tag_id VARCHAR(100) NOT NULL,
        utm VARCHAR(255),
        bot_id VARCHAR(100),
        casas JSONB DEFAULT '[]'::jsonb,
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
      `ALTER TABLE flow_tag_configs ADD COLUMN IF NOT EXISTS casas JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS numeros_nao_monitorados JSONB NOT NULL DEFAULT '[]'::jsonb`,
      `CREATE TABLE IF NOT EXISTS resultados (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        periodo_inicio TEXT NOT NULL,
        periodo_fim TEXT NOT NULL,
        dados JSONB NOT NULL,
        topicos JSONB NOT NULL DEFAULT '{}'::jsonb,
        public_token TEXT UNIQUE,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      )`,
    ]

    const resultados: { statement: string; ok: boolean; error?: string }[] = []

    for (const stmt of migrationSql) {
      try {
        await db.execute(sql.raw(stmt))
        resultados.push({ statement: stmt.slice(0, 60), ok: true })
      } catch (err) {
        const cause = (err as { cause?: { message?: string } }).cause
        resultados.push({ statement: stmt.slice(0, 60), ok: false, error: cause?.message ?? (err as Error).message })
      }
    }

    return NextResponse.json({ success: resultados.every((r) => r.ok), resultados })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
