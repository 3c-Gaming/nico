-- Adiciona site_id (deal do painel de afiliados, define o valor do CPA) nas UTMs da Superbet.
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel
-- não alcança o Postgres direto).

alter table utm_configs add column if not exists site_id text;

-- Backfill: por padrão todas as UTMs da Superbet usam o site 25730, exceto as que
-- referenciam "F90" (nome ou valor), que usam 46509.
update utm_configs
set site_id = case
  when casa = 'superbet' and (nome ilike '%f90%' or valor ilike '%f90%') then '46509'
  when casa = 'superbet' then '25730'
  else site_id
end
where casa = 'superbet';
