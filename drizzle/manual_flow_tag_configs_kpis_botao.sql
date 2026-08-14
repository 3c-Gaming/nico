-- KPIs customizados de clique em botão (ver painel de Detalhes, tela de Funis) — lista de
-- { id, nome, botaoTitulo } que o usuário monta escolhendo, entre os botões que aparecem nas
-- conversas do fluxo, qual clique quer acompanhar como um KPI a mais (ex: "Já fiz a entrada ✅").
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table flow_tag_configs add column if not exists kpis_botao jsonb default '[]'::jsonb;
