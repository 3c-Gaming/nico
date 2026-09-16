-- Histórico diário de leads/registros/FTDs/custos/ROI por funil (ver src/lib/funis.ts,
-- calcularSnapshotDoFunil) — escrito no Salvar de um funil (dia corrente) e pelo cron
-- funil-metricas-snapshot (fechamento do dia anterior). Rodar manualmente (endpoint de migração
-- via Vercel não alcança o Postgres direto).

create table if not exists funil_metricas_diarias (
  flow_id text not null,
  data text not null,
  funil text,
  leads integer not null default 0,
  registros integer not null default 0,
  ftds integer not null default 0,
  ftds_por_casa jsonb default '{}'::jsonb,
  tags_contagem jsonb default '{}'::jsonb,
  gasto_meta real,
  custo_entrada real,
  custo_registro real,
  custo_ftd real,
  lucro_ftd_total real,
  roi real,
  atualizado_em text not null,
  primary key (flow_id, data)
);
