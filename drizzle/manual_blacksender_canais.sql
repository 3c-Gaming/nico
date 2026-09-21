-- Números (whatsapp_channels) do Black Sender — pra tela de Números junto com os bots SendPulse.
-- Mesmo princípio de manual_blacksender_leads_flow_runs.sql. Colunas já filtradas na origem
-- (ver blacksender-bridge/src/poller.ts) — access_token e meta_app_secret nunca chegam aqui.

create table if not exists blacksender_canais (
  id text primary key,
  nome text,
  telefone text,
  provedor text,
  status text,
  health_status text,
  health_reason text,
  health_checked_em text,
  meta_phone_status text,
  meta_name_status text,
  quality_rating text,
  foto_url text,
  criado_em_origem text,
  recebido_em text not null,
  bruto jsonb
);
