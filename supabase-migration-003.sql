-- Formato de disparo RCS receptivo: 2ª mensagem disparada quando o lead clica a suggestion
-- REPLY da 1ª. A Solvefy não avisa esse clique por webhook (confirmado testando ao vivo), então
-- um cron confere por polling (GET /rcs/messages/{id}) e usa essas colunas pra saber o que tá
-- pendente e o que já foi.

ALTER TABLE rcs_envios
  ADD COLUMN IF NOT EXISTS receptivo_texto TEXT,
  ADD COLUMN IF NOT EXISTS receptivo_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receptivo_solvefy_message_id TEXT,
  ADD COLUMN IF NOT EXISTS receptivo_erro TEXT;
