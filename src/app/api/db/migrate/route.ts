import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json({ error: 'DATABASE_URL não configurada' }, { status: 500 })
    }

    const { default: postgres } = await import('postgres')

    const sql = postgres(databaseUrl, { max: 1 })

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
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
    ]

    for (const stmt of migrationSql) {
      await sql.unsafe(stmt)
    }

    await sql.end()

    return NextResponse.json({ success: true, statements: migrationSql.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
