-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto). Apresentação pública de UM funil (src/app/funis/apresentar-funil) — distinta
-- da comparação entre vários funis (funis_comparacoes). Diferente da comparação, precisa ser
-- persistida desde a criação (não só query params) porque os comentários/insights são editados
-- depois, direto na página pública.

CREATE TABLE IF NOT EXISTS funis_apresentacoes (
  "id" text PRIMARY KEY NOT NULL,
  "titulo" text NOT NULL,
  "flow_id" text NOT NULL,
  "funil" text NOT NULL,
  "inicio" text NOT NULL,
  "fim" text NOT NULL,
  "comentarios" text DEFAULT '' NOT NULL,
  "criado_em" text NOT NULL,
  "atualizado_em" text NOT NULL
);
