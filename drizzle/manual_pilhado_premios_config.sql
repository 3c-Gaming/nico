-- Rodar manualmente no SQL Editor do Supabase (endpoint de migração via Vercel não alcança o
-- Postgres direto). Resultado de vendas do h2premios por painel (kaue/thomas/gustavo), lido dos
-- cards "Minhas vendas" da Edição selecionada no Dashboard — não por dia, o painel não filtra
-- vendas por dia de forma confiável (confirmado ao vivo: os cards não mudam ao trocar o período).
-- A edição é escolhida manualmente pelo usuário (a mais nova nem sempre tem dado) e fica salva
-- aqui até ser trocada.

CREATE TABLE IF NOT EXISTS pilhado_premios_config (
  "painel" text PRIMARY KEY NOT NULL,
  "edicao_id" text NOT NULL,
  "edicao_label" text,
  "receita_vendas" real,
  "ticket_medio" real,
  "quantidade_compras" integer,
  "clientes_captados" integer,
  "atualizado_em" text NOT NULL
);
