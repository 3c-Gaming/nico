-- Origem do fluxo ('sendpulse' | 'blacksender') — configs antigas ficam com origem null, tratadas
-- como 'sendpulse' no código (ver FlowTagConfig.origem em src/types/index.ts).
alter table flow_tag_configs add column if not exists origem text;
