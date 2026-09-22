-- rcsReceptivo (RcsReceptivo, ver src/lib/rcs/tipos.ts) foi adicionado ao tipo Disparo mas eu
-- esqueci de criar a coluna correspondente na tabela `disparos` — resultado: todo disparo RCS
-- criado com a mensagem receptiva ativada falhava silenciosamente ao gravar o registro (o envio
-- de verdade acontecia normal, só o card na tela de Disparos que nunca era criado).

ALTER TABLE disparos ADD COLUMN IF NOT EXISTS rcs_receptivo JSONB;
