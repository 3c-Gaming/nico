-- Receptivo agora suporta texto OU card com imagem (não só texto puro) — precisa de um objeto
-- RcsContent completo, não uma string. Substitui receptivo_texto (migration 003) por
-- receptivo_conteudo (jsonb), migrando o que já tiver sido gravado.

ALTER TABLE rcs_envios ADD COLUMN IF NOT EXISTS receptivo_conteudo JSONB;

UPDATE rcs_envios
  SET receptivo_conteudo = jsonb_build_object('type', 'text', 'text', receptivo_texto)
  WHERE receptivo_texto IS NOT NULL AND receptivo_conteudo IS NULL;

ALTER TABLE rcs_envios DROP COLUMN IF EXISTS receptivo_texto;
