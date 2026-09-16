-- Lucro por FTD (por casa vinculada ao funil) + links de Registro/Aposta do funil — ver painel de
-- Detalhes, tela de Funis. Rodar manualmente (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table flow_tag_configs add column if not exists lucro_ftd_por_casa jsonb default '{}'::jsonb;
alter table flow_tag_configs add column if not exists link_registro text;
alter table flow_tag_configs add column if not exists link_aposta text;
