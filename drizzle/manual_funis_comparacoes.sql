-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto). Histórico de comparações de funis geradas na tela de apresentação
-- (src/app/funis/apresentar) — cada clique em "Apresentar dados" salva um registro aqui, com um
-- snapshot dos nomes dos funis (não só os flowIds) pra continuar legível mesmo se um flowId
-- parar de resolver depois (número caiu, fluxo mudou de bot etc).

CREATE TABLE IF NOT EXISTS funis_comparacoes (
  "id" text PRIMARY KEY NOT NULL,
  "titulo" text NOT NULL,
  "flow_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "funis" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "inicio" text NOT NULL,
  "fim" text NOT NULL,
  "criado_em" text NOT NULL
);
