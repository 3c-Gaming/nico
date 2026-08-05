-- Permite mais de uma UTM/PID por fluxo (soma os resultados de FTD/registro entre elas).
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel
-- não alcança o Postgres direto).

alter table flow_tag_configs add column if not exists utms_extras jsonb default '[]'::jsonb;
