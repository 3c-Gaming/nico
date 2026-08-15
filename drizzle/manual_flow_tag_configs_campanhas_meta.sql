-- Nomes de campanha do Meta Ads atribuídos manualmente a cada funil (ver painel de Detalhes,
-- tela de Funis) — usado pra somar o gasto do funil no período. Atribuição é manual (checklist
-- de campanhas do dia) porque o nome da campanha não segue um padrão confiável pra match
-- automático (ex: "F01"/"F01.02" aparecem tanto no funil F01.11 quanto em campanhas de um
-- produto totalmente diferente — match por regex geraria atribuição errada de gasto).
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table flow_tag_configs add column if not exists campanhas_meta jsonb default '[]'::jsonb;
