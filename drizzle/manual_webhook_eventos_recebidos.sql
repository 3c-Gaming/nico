-- Eventos crus de webhooks externos (ex.: Black Sender, CRM receptivo de WhatsApp) — payload
-- gravado sem parsing, só pra inspecionar o formato real assim que o sistema de origem disparar
-- eventos de teste (leads criados, conversas, kanban, tags, erros). Depois que virmos o formato
-- de verdade, os eventos passam a ser mapeados pra dado estruturado.

create table if not exists webhook_eventos_recebidos (
  id text primary key,
  origem text not null,
  evento text not null,
  payload jsonb,
  headers jsonb,
  metodo text not null,
  ip text,
  recebido_em text not null
);

create index if not exists webhook_eventos_recebidos_origem_evento_idx
  on webhook_eventos_recebidos (origem, evento, recebido_em desc);
