-- Dados estruturados do Black Sender (CRM receptivo de WhatsApp), alimentados em tempo real
-- pelo blacksender-bridge (listener Realtime no Supabase deles) via /api/webhooks/blacksender.
-- `bruto` guarda o registro completo recebido, os demais campos são o melhor esforço de mapeamento
-- pros nomes reais de coluna do lado deles (contacts / flow_runs).

create table if not exists blacksender_leads (
  id text primary key,
  nome text,
  telefone text,
  tags jsonb,
  etapa_id text,
  ai_disabled boolean,
  criado_em_origem text,
  recebido_em text not null,
  bruto jsonb
);

create index if not exists blacksender_leads_criado_em_idx
  on blacksender_leads (criado_em_origem desc);

create table if not exists blacksender_flow_runs (
  id text primary key,
  flow_id text,
  contact_id text,
  status text,
  criado_em_origem text,
  atualizado_em_origem text,
  recebido_em text not null,
  bruto jsonb
);

create index if not exists blacksender_flow_runs_flow_id_idx
  on blacksender_flow_runs (flow_id, status);
