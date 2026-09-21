import { pgTable, text, jsonb, real, boolean, integer, primaryKey } from 'drizzle-orm/pg-core'

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
  daxxCampanhaId: text('daxx_campanha_id'),
  sendpulseCampanhaId: text('sendpulse_campanha_id'),
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

export const disparosPilhado = pgTable('disparos_pilhado', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  painel: text('painel').notNull(),
  origem: text('origem').notNull().default('manual'),
  daxxCampanhaId: text('daxx_campanha_id'),
  nomenclatura: text('nomenclatura'),
  totalBase: integer('total_base').notNull().default(0),
  entregues: integer('entregues').notNull().default(0),
  lidas: integer('lidas').notNull().default(0),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
})

// Resultado de vendas do h2premios por painel, lido da Edição selecionada no Dashboard (não por
// dia — ver comentário em PilhadoPremiosConfig no types/index.ts).
export const pilhadoPremiosConfig = pgTable('pilhado_premios_config', {
  painel: text('painel').primaryKey(),
  edicaoId: text('edicao_id').notNull(),
  edicaoLabel: text('edicao_label'),
  receitaVendas: real('receita_vendas'),
  ticketMedio: real('ticket_medio'),
  quantidadeCompras: integer('quantidade_compras'),
  clientesCaptados: integer('clientes_captados'),
  atualizadoEm: text('atualizado_em').notNull(),
})

export const esteiras = pgTable('esteiras', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  chave: text('chave'),
  casasAposta: jsonb('casas_aposta').notNull().default('[]'),
  etapas: jsonb('etapas').notNull().default('[]'),
  criadoEm: text('criado_em').notNull(),
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
  origem: text('origem'), // 'sendpulse' (config antiga, sem o campo) | 'blacksender'
  tags: jsonb('tags').notNull().default('[]'),
  funil: text('funil'),
  utm: text('utm'),
  utmsExtras: jsonb('utms_extras').default('[]'),
  casas: jsonb('casas').default('[]'),
  tipo: text('tipo').notNull().default('disparo'),
  lpUrl: text('lp_url'),
  comentarios: text('comentarios'),
  kpisBotao: jsonb('kpis_botao').default('[]'),
  campanhasMeta: jsonb('campanhas_meta').default('[]'),
  kpisCusto: jsonb('kpis_custo').default('[]'),
  lucroFtdPorCasa: jsonb('lucro_ftd_por_casa').default('{}'),
  linkRegistro: text('link_registro'),
  linkAposta: text('link_aposta'),
})

// Snapshot diário de leads/custos/ROI por funil (ver src/lib/funis.ts, calcularSnapshotDoFunil) —
// "leads hoje"/custos eram só calculados ao vivo e somem quando o dia vira; essa tabela guarda o
// histórico pra consulta por data.
export const funilMetricasDiarias = pgTable('funil_metricas_diarias', {
  flowId: text('flow_id').notNull(),
  data: text('data').notNull(), // YYYY-MM-DD, fuso Brasília
  funil: text('funil'),
  leads: integer('leads').notNull().default(0),
  registros: integer('registros').notNull().default(0),
  ftds: integer('ftds').notNull().default(0),
  ftdsPorCasa: jsonb('ftds_por_casa').default('{}'),
  tagsContagem: jsonb('tags_contagem').default('{}'),
  gastoMeta: real('gasto_meta'),
  custoEntrada: real('custo_entrada'),
  custoRegistro: real('custo_registro'),
  custoFtd: real('custo_ftd'),
  lucroFtdTotal: real('lucro_ftd_total'),
  roi: real('roi'),
  atualizadoEm: text('atualizado_em').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.flowId, t.data] }) }))

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

export const resultados = pgTable('resultados', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  periodoInicio: text('periodo_inicio').notNull(),
  periodoFim: text('periodo_fim').notNull(),
  dados: jsonb('dados').notNull(),
  topicos: jsonb('topicos').notNull().default('{}'),
  publicToken: text('public_token').unique(),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
})

export const funisComparacoes = pgTable('funis_comparacoes', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  flowIds: jsonb('flow_ids').notNull().default('[]'),
  funis: jsonb('funis').notNull().default('[]'),
  inicio: text('inicio').notNull(),
  fim: text('fim').notNull(),
  criadoEm: text('criado_em').notNull(),
})

export const funisApresentacoes = pgTable('funis_apresentacoes', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  flowId: text('flow_id').notNull(),
  funil: text('funil').notNull(),
  inicio: text('inicio').notNull(),
  fim: text('fim').notNull(),
  comentarios: text('comentarios').notNull().default(''),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
})

// Campanhas de broadcast criadas direto no painel da SendPulse (fora do nico) — a API não expõe
// um jeito de listar todas, só de consultar uma pelo ID (ver /campaigns/report). Importadas uma a
// uma colando o link/ID na tela de Disparos; só guarda a identidade aqui, os números
// (enviadas/entregues/etc.) são buscados ao vivo a cada carregamento, não persistidos.
export const campanhasSendpulseImportadas = pgTable('campanhas_sendpulse_importadas', {
  id: text('id').primaryKey(),
  contaId: text('conta_id').notNull(),
  botId: text('bot_id').notNull(),
  canal: text('canal').notNull().default('telegram'),
  titulo: text('titulo').notNull(),
  sendAt: text('send_at'),
  criadoEmSendpulse: text('criado_em_sendpulse').notNull(),
  importadoEm: text('importado_em').notNull(),
  // UTM vinculada manualmente (ver painel de Disparos) — usada pra cruzar a campanha com
  // registros/FTDs reais do tracking (SuperBet/BetMGM), mesmo princípio de FlowTagConfig.utm.
  utm: text('utm'),
})

export const usuariosResponsaveis = pgTable('usuarios_responsaveis', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email'),
  avatar: text('avatar'),
  cargo: text('cargo'),
  criadoEm: text('criado_em').notNull(),
})

// Eventos crus de webhooks externos (ex.: Black Sender) — sem parsing, só pra inspecionar o
// formato real do payload antes de mapear pra dado estruturado.
export const webhookEventosRecebidos = pgTable('webhook_eventos_recebidos', {
  id: text('id').primaryKey(),
  origem: text('origem').notNull(),
  evento: text('evento').notNull(),
  payload: jsonb('payload'),
  headers: jsonb('headers'),
  metodo: text('metodo').notNull(),
  ip: text('ip'),
  recebidoEm: text('recebido_em').notNull(),
})

// Leads (contacts) do Black Sender, espelhados em tempo real pelo blacksender-bridge (listener
// Realtime no Supabase deles) via webhooks/blacksender. `bruto` guarda o registro completo pra
// não perder campo nenhum enquanto o formato exato não está 100% mapeado.
export const blacksenderLeads = pgTable('blacksender_leads', {
  id: text('id').primaryKey(),
  nome: text('nome'),
  telefone: text('telefone'),
  tags: jsonb('tags'),
  etapaId: text('etapa_id'),
  aiDisabled: boolean('ai_disabled'),
  criadoEmOrigem: text('criado_em_origem'),
  recebidoEm: text('recebido_em').notNull(),
  bruto: jsonb('bruto'),
})

// Execuções de fluxo (flow_runs) do Black Sender, mesmo princípio de blacksenderLeads.
export const blacksenderFlowRuns = pgTable('blacksender_flow_runs', {
  id: text('id').primaryKey(),
  flowId: text('flow_id'),
  contactId: text('contact_id'),
  status: text('status'),
  criadoEmOrigem: text('criado_em_origem'),
  atualizadoEmOrigem: text('atualizado_em_origem'),
  recebidoEm: text('recebido_em').notNull(),
  bruto: jsonb('bruto'),
})

// Conversas (uma por contato+canal) do Black Sender — mesmo princípio de blacksenderLeads.
export const blacksenderConversas = pgTable('blacksender_conversas', {
  id: text('id').primaryKey(),
  contactId: text('contact_id'),
  channelId: text('channel_id'),
  status: text('status'),
  ultimaMensagemEmOrigem: text('ultima_mensagem_em_origem'),
  criadoEmOrigem: text('criado_em_origem'),
  recebidoEm: text('recebido_em').notNull(),
  bruto: jsonb('bruto'),
})

// Fluxos (flows) do Black Sender — nome legível (ex: "F01.11 ODD ALTA") pra não precisar mostrar
// UUID cru no seletor de "vincular fluxo a um Funil" (ver src/lib/funis.ts). Mesmo princípio de
// blacksenderLeads.
export const blacksenderFlows = pgTable('blacksender_flows', {
  id: text('id').primaryKey(),
  nome: text('nome'),
  ativo: boolean('ativo'),
  criadoEmOrigem: text('criado_em_origem'),
  recebidoEm: text('recebido_em').notNull(),
  bruto: jsonb('bruto'),
})

// Mensagens de uma conversa do Black Sender — mesmo princípio de blacksenderLeads.
export const blacksenderMensagens = pgTable('blacksender_mensagens', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id'),
  conteudo: text('conteudo'),
  direcao: text('direcao'),
  remetente: text('remetente'),
  status: text('status'),
  erroCodigo: text('erro_codigo'),
  erroMensagem: text('erro_mensagem'),
  midiaUrl: text('midia_url'),
  midiaTipo: text('midia_tipo'),
  criadoEmOrigem: text('criado_em_origem'),
  recebidoEm: text('recebido_em').notNull(),
  bruto: jsonb('bruto'),
})
