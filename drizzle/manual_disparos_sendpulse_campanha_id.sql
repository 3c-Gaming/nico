-- Rastreia qual campanha da SendPulse (ver campanhas_sendpulse_importadas) deu origem a um
-- disparo cadastrado pelo calendário — mesmo princípio de daxx_campanha_id, evita cadastrar a
-- mesma campanha duas vezes. Rodar manualmente (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table disparos add column if not exists sendpulse_campanha_id text;
create unique index if not exists disparos_sendpulse_campanha_id_key on disparos (sendpulse_campanha_id) where sendpulse_campanha_id is not null;
