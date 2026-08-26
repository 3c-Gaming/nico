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
      `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS conta_nomes JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE bot_test_config ADD COLUMN IF NOT EXISTS bilhete_casas JSONB NOT NULL DEFAULT '[]'::jsonb`,
      `ALTER TABLE disparos ADD COLUMN IF NOT EXISTS canal TEXT`,
      `ALTER TABLE disparos ADD COLUMN IF NOT EXISTS custo_por_envio NUMERIC`,
      `ALTER TABLE disparos ADD COLUMN IF NOT EXISTS sms_corpo TEXT`,
      `ALTER TABLE disparos ADD COLUMN IF NOT EXISTS sms_from TEXT`,
      `ALTER TABLE disparos ADD COLUMN IF NOT EXISTS sms_use_shortener BOOLEAN`,
      `ALTER TABLE disparos ADD COLUMN IF NOT EXISTS sms_destinatarios JSONB`,
      `CREATE TABLE IF NOT EXISTS sms_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        corpo TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS sms_envios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campanha TEXT,
        telefone TEXT NOT NULL,
        solvefy_message_id TEXT,
        status TEXT NOT NULL DEFAULT 'enviando',
        erro TEXT,
        enviado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS aquecimento_numeros (
        bot_id TEXT PRIMARY KEY,
        conta_id TEXT NOT NULL,
        papel TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'aquecendo',
        iniciado_em TIMESTAMP DEFAULT NOW(),
        ultima_mensagem_em TIMESTAMP,
        mensagens_hoje INTEGER NOT NULL DEFAULT 0,
        mensagens_hoje_data DATE,
        notas TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS aquecimento_scripts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        tema TEXT,
        mensagens JSONB NOT NULL,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS aquecimento_pares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id_a TEXT NOT NULL,
        bot_id_b TEXT NOT NULL,
        contact_id_a TEXT,
        contact_id_b TEXT,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS aquecimento_execucoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        par_id UUID NOT NULL REFERENCES aquecimento_pares(id) ON DELETE CASCADE,
        script_id UUID NOT NULL REFERENCES aquecimento_scripts(id) ON DELETE CASCADE,
        proximo_indice INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'em_andamento',
        proxima_mensagem_em TIMESTAMP,
        iniciada_em TIMESTAMP DEFAULT NOW(),
        atualizada_em TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS aquecimento_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        janela_inicio_hora INTEGER NOT NULL DEFAULT 8,
        janela_fim_hora INTEGER NOT NULL DEFAULT 21,
        cron_paused BOOLEAN NOT NULL DEFAULT false,
        rampa JSONB NOT NULL DEFAULT '{"1":2,"2":3,"3":4,"5":6,"7":8,"10":12,"14":15}'::jsonb
      )`,
      `INSERT INTO aquecimento_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
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
