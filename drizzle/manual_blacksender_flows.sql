-- Fluxos (flows) do Black Sender — nome legível pro seletor de "vincular fluxo a um Funil"
-- (ver src/lib/funis.ts e tela /funis). Mesmo princípio de manual_blacksender_leads_flow_runs.sql.

create table if not exists blacksender_flows (
  id text primary key,
  nome text,
  ativo boolean,
  criado_em_origem text,
  recebido_em text not null,
  bruto jsonb
);
