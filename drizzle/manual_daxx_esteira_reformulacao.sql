-- Reformulação do vínculo DAXX <-> Disparo <-> Esteira
-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel
-- não alcança o Postgres direto, confirmado nesta sessão).
--
-- ORDEM IMPORTA. Rode os blocos NA ORDEM abaixo.

-- ============================================================
-- 1) ADITIVO — seguro rodar com o código antigo ainda no ar
-- ============================================================
alter table disparos add column if not exists daxx_campanha_id text;
alter table esteiras add column if not exists chave text;
alter table esteiras add column if not exists etapas jsonb not null default '[]'::jsonb;

create or replace function fn_cadastrar_etapa_daxx(
  p_esteira_id text, p_chave text, p_nome text,
  p_casas jsonb, p_etapa jsonb, p_disparo_id text
) returns esteiras
language plpgsql
as $$
declare
  v_esteira esteiras;
begin
  perform pg_advisory_xact_lock(hashtext(p_chave));
  select * into v_esteira from esteiras where chave = p_chave;

  if v_esteira.id is null then
    insert into esteiras (id, nome, chave, casas_aposta, etapas, criado_em, atualizado_em, ativa)
    values (p_esteira_id, p_nome, p_chave, p_casas, jsonb_build_array(p_etapa), now()::text, now()::text, true)
    returning * into v_esteira;
  else
    update esteiras set
      etapas = (
        select coalesce(jsonb_agg(elem), '[]'::jsonb) from (
          select distinct on (elem->>'tipo') elem
          from jsonb_array_elements(v_esteira.etapas || jsonb_build_array(p_etapa)) elem
          order by elem->>'tipo', (elem->>'disparoId' = p_etapa->>'disparoId') desc
        ) sub
      ),
      casas_aposta = (
        select coalesce(jsonb_agg(distinct c), '[]'::jsonb)
        from jsonb_array_elements(v_esteira.casas_aposta || p_casas) c
      ),
      atualizado_em = now()::text
    where id = v_esteira.id
    returning * into v_esteira;
  end if;

  update disparos set esteira_pai_id = v_esteira.id, atualizado_em = now()::text where id = p_disparo_id;
  return v_esteira;
end;
$$;

-- Teste rápido da função (opcional, mas recomendado antes de seguir):
-- select fn_cadastrar_etapa_daxx('teste-id-1', 'teste::base-x', 'Teste D1', '["casa-1"]'::jsonb, '{"tipo":"D1","disparoId":"disp-1"}'::jsonb, 'disp-1');
-- select fn_cadastrar_etapa_daxx('teste-id-2', 'teste::base-x', 'Teste D1', '["casa-1"]'::jsonb, '{"tipo":"D3","disparoId":"disp-2"}'::jsonb, 'disp-2');
-- select * from esteiras where chave = 'teste::base-x'; -- deve ter 1 linha só, com etapas D1+D3
-- delete from esteiras where chave = 'teste::base-x'; delete from disparos where id in ('disp-1','disp-2');

-- ============================================================
-- 2) LIMPEZA — rodar só depois do novo código já estar deployado
-- ============================================================
truncate table disparos, esteiras;

-- ============================================================
-- 3) CONSTRAINTS — com as tabelas já vazias, sem risco de colisão
-- ============================================================
create unique index if not exists disparos_daxx_campanha_id_key on disparos (daxx_campanha_id) where daxx_campanha_id is not null;
create unique index if not exists esteiras_chave_key on esteiras (chave) where chave is not null;

-- ============================================================
-- 4) CLEANUP FINAL — só depois de validar em produção (passo 6 do plano)
-- ============================================================
-- alter table esteiras drop column if exists disparos;
