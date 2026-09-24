-- Histórico de observação dos números Black Sender.
-- O canal pode sumir do bridge quando cai, mas o registro deve continuar no relatório.

alter table blacksender_canais
  add column if not exists primeiro_visto_em text,
  add column if not exists ultimo_visto_em text;

-- Para linhas anteriores à migração, a data de criação no Black Sender é o melhor
-- histórico disponível; novos webhooks preservam a primeira observação real.
update blacksender_canais
set primeiro_visto_em = coalesce(primeiro_visto_em, criado_em_origem, recebido_em),
    ultimo_visto_em = coalesce(ultimo_visto_em, recebido_em)
where primeiro_visto_em is null or ultimo_visto_em is null;

create index if not exists blacksender_canais_ultimo_visto_em_idx
  on blacksender_canais (ultimo_visto_em desc);
