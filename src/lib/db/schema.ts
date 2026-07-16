import { pgTable, text, jsonb, real, boolean, integer } from 'drizzle-orm/pg-core'

export const disparos = pgTable('disparos', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  nomenclatura: text('nomenclatura').notNull(),
  status: text('status').notNull().default('rascunho'),
  casasAposta: jsonb('casas_aposta').notNull().default('[]'),
  dataDisparo: text('data_disparo').notNull(),
  horarioDisparo: text('horario_disparo').notNull().default('10:00'),
  base: jsonb('base').notNull().default('{}'),
  templateDaxx: jsonb('template_daxx'),
  numeroSendpulse: jsonb('numero_sendpulse'),
  esteiraPaiId: text('esteira_pai_id'),
  numerosSendpulse: jsonb('numeros_sendpulse'),
  linkTemplatesSelecionados: jsonb('link_templates_selecionados'),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
  notas: text('notas'),
  flowIds: jsonb('flow_ids'),
  cpaPainelId: text('cpa_painel_id'),
  utm: text('utm'),
  betmgmPid: text('betmgm_pid'),
  resultados: jsonb('resultados'),
  valorTotalBase: real('valor_total_base'),
  conversao: jsonb('conversao'),
})

export const esteiras = pgTable('esteiras', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  casasAposta: jsonb('casas_aposta').notNull().default('[]'),
  disparos: jsonb('disparos').notNull().default('{}'),
  criadaEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
  ativa: boolean('ativa').notNull().default(true),
})

export const casasAposta = pgTable('casas_aposta', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  slug: text('slug').notNull().unique(),
  cor: text('cor').notNull().default('#6366f1'),
  logo: text('logo'),
  variaveis: jsonb('variaveis').notNull().default('{}'),
  paineisCpa: jsonb('paineis_cpa').notNull().default('[]'),
  funilIds: jsonb('funil_ids').notNull().default('[]'),
})

export const linkTemplates = pgTable('link_templates', {
  id: text('id').primaryKey(),
  casaId: text('casa_id').notNull(),
  nome: text('nome').notNull(),
  urlTemplate: text('url_template').notNull(),
  tipos: jsonb('tipos').notNull().default('[]'),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
})

export const flowTagConfigs = pgTable('flow_tag_configs', {
  flowId: text('flow_id').primaryKey(),
  botId: text('bot_id').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  funil: text('funil'),
  utm: text('utm'),
  casas: jsonb('casas').default('[]'),
  tipo: text('tipo').notNull().default('disparo'),
})

export const demandas = pgTable('demandas', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  coluna: text('coluna').notNull().default('ideias'),
  ordem: real('ordem').notNull().default(0),
  prioridade: text('prioridade').default('media'),
  tags: jsonb('tags').notNull().default('[]'),
  responsavelId: text('responsavel_id'),
  dataCriacao: text('data_criacao'),
  dataConclusao: text('data_conclusao'),
  userStories: jsonb('user_stories').notNull().default('[]'),
  links: jsonb('links').notNull().default('[]'),
  imagens: jsonb('imagens').notNull().default('[]'),
  funilIds: jsonb('funil_ids').notNull().default('[]'),
  numerosSendpulse: jsonb('numeros_sendpulse').notNull().default('[]'),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
})

export const usuariosResponsaveis = pgTable('usuarios_responsaveis', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email'),
  avatar: text('avatar'),
  cargo: text('cargo'),
  criadoEm: text('criado_em').notNull(),
})
