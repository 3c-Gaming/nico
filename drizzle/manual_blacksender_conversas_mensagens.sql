-- Conversas e mensagens do Black Sender (CRM receptivo de WhatsApp), mesmo princípio de
-- manual_blacksender_leads_flow_runs.sql — alimentadas em tempo real pelo blacksender-bridge.

create table if not exists blacksender_conversas (
  id text primary key,
  contact_id text,
  channel_id text,
  status text,
  ultima_mensagem_em_origem text,
  criado_em_origem text,
  recebido_em text not null,
  bruto jsonb
);

create index if not exists blacksender_conversas_contact_id_idx
  on blacksender_conversas (contact_id);

create table if not exists blacksender_mensagens (
  id text primary key,
  conversation_id text,
  conteudo text,
  direcao text,
  remetente text,
  status text,
  erro_codigo text,
  erro_mensagem text,
  midia_url text,
  midia_tipo text,
  criado_em_origem text,
  recebido_em text not null,
  bruto jsonb
);

create index if not exists blacksender_mensagens_conversation_id_idx
  on blacksender_mensagens (conversation_id, criado_em_origem);
