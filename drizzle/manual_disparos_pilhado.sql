-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto). Cria a tabela do braço "Pilhado Prêmios" — disparos que vêm de campanha DAXX
-- pontual ("PILHADO PREMIOS" no nome) ou são cadastrados manualmente (base/entregues/lidas
-- avisados ao longo do dia). Vendas/faturamento vêm do painel h2premios (scraper); custo, %,
-- ticket médio, conversão e ROI são sempre calculados no app — não têm coluna aqui.

CREATE TABLE IF NOT EXISTS disparos_pilhado (
  "id" text PRIMARY KEY NOT NULL,
  "data" text NOT NULL,
  "painel" text NOT NULL,
  "origem" text DEFAULT 'manual' NOT NULL,
  "daxx_campanha_id" text,
  "nomenclatura" text,
  "total_base" integer DEFAULT 0 NOT NULL,
  "entregues" integer DEFAULT 0 NOT NULL,
  "lidas" integer DEFAULT 0 NOT NULL,
  "vendas" integer,
  "faturamento" real,
  "criado_em" text NOT NULL,
  "atualizado_em" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS disparos_pilhado_daxx_campanha_id_idx
  ON disparos_pilhado ("daxx_campanha_id")
  WHERE "daxx_campanha_id" IS NOT NULL;
