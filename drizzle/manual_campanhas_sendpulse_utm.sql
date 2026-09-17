-- UTM vinculada manualmente a uma campanha importada da SendPulse (ver painel de Disparos) —
-- usada pra cruzar com registros/FTDs reais do tracking (SuperBet/BetMGM), mesmo princípio de
-- flow_tag_configs.utm. Rodar manualmente (endpoint de migração via Vercel não alcança o
-- Postgres direto).

alter table campanhas_sendpulse_importadas add column if not exists utm text;
