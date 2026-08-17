-- KPIs customizados de custo por etapa da jornada (ver painel de Detalhes, tela de Funis) —
-- lista de { id, nome, tag } que o usuário monta escolhendo uma tag do fluxo; o custo é
-- calculado como gasto (Meta, já atribuído em campanhas_meta) ÷ leads com aquela tag.
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table flow_tag_configs add column if not exists kpis_custo jsonb default '[]'::jsonb;
