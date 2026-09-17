-- Campanhas de broadcast criadas direto no painel da SendPulse (a API não lista, só consulta por
-- ID) — importadas manualmente colando o link/ID na tela de Disparos. Números (enviadas/
-- entregues/etc.) não são persistidos aqui, são buscados ao vivo a cada carregamento via
-- /campaigns/report. Rodar manualmente (endpoint de migração via Vercel não alcança o Postgres
-- direto).

create table if not exists campanhas_sendpulse_importadas (
  id text primary key,
  conta_id text not null,
  bot_id text not null,
  canal text not null default 'telegram',
  titulo text not null,
  send_at text,
  criado_em_sendpulse text not null,
  importado_em text not null
);
