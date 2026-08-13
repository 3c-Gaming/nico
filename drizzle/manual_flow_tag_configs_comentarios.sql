-- Anotações/insights sobre o funil, editável direto no painel de Detalhes (tela de Funis) — ao
-- contrário dos comentários de funis_apresentacoes (presos a uma apresentação/período específico),
-- esse fica ligado ao fluxo em si, sempre visível independente da data selecionada.
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table flow_tag_configs add column if not exists comentarios text;
