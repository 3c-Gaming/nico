export type TipoDisparo = 'D1' | 'D3' | 'D5' | 'D7' | 'PONTUAL'

export interface UtmConfig {
  id: string
  nome: string
  valor: string
  casa: 'superbet' | 'betmgm'
  // Superbet: id da "deal" no painel de afiliados, define o valor do CPA daquela UTM.
  siteId?: string
  criadoEm: string
}

export interface EsteiraEtapaConfig {
  tipo: string
  casaId: string
  offsetDias: number
}

export interface EsteiraEtapa {
  tipo: string
  disparoId: string
}

export interface LinkTemplate {
  id: string
  casaId: string
  nome: string
  urlTemplate: string
  tipos: TipoDisparo[]
  criadoEm: string
  atualizadoEm: string
}

export type StatusDisparo =
  | 'rascunho'
  | 'pronto'
  | 'em_validacao'
  | 'executado'
  | 'cancelado'

export type StatusBase = 'pendente' | 'baixando' | 'disponivel' | 'erro'

export interface PainelCPA {
  id: string
  nome: string
  valorCPA: number
}

export interface CasaAposta {
  id: string
  nome: string
  slug: string
  cor: string
  logo?: string
  variaveis: Record<string, string>
  paineisCPA: PainelCPA[]
  funilIds: string[]
}

export interface TrackingResultado {
  registros: number
  ftds: number
}

export interface ResultadoDisparo {
  registros: number
  ftds: number
  cpas: number
  custo: number
  valorFaturadoCPA: number
  atualizadoEm?: string
}

export interface ConversaoDisparo {
  entreguesDaxx: number
  leadsFluxo: number
  atualizadoEm?: string
}

export interface TemplateDaxx {
  id: string
  nome: string
  descricao?: string
  url?: string
}

export interface DisparoDaxx {
  id: string
  nome: string
  status: string
  responsavel: string
  totalBase: number
  entregues: number
  lidas: number
  rejeitados: number
  dataCriacao: string
  linkTemplate?: string
}

export type OrigemDisparoPilhado = 'daxx' | 'manual'

/** Braço "Pilhado Prêmios" — disparos que ou vêm de uma campanha DAXX pontual (nome contém
 * "PILHADO PREMIOS", sem D1/D3/D5/D7) ou são só avisados manualmente ao longo do dia. `data` é só
 * informativa (dia em que o disparo saiu) — não dá pra atribuir vendas a um disparo específico,
 * então vendas/faturamento vivem em PilhadoPremiosConfig, por painel/edição, não aqui. Custo e %
 * são sempre calculados no app a partir de totalBase/entregues/lidas, nunca armazenados. */
export interface DisparoPilhado {
  id: string
  data: string
  painel: string
  origem: OrigemDisparoPilhado
  daxxCampanhaId?: string | null
  nomenclatura?: string | null
  totalBase: number
  entregues: number
  lidas: number
  criadoEm: string
  atualizadoEm: string
}

/** Resultado de vendas do painel h2premios por conta (kaue/thomas/gustavo), lido da Edição
 * selecionada no Dashboard — não por dia (o painel não filtra vendas por dia de forma confiável;
 * confirmado ao vivo, os cards não mudam ao trocar o período). A edição é escolhida manualmente
 * (não dá pra saber com certeza qual edição está "ativa" só olhando a lista — a mais nova pode
 * estar zerada) e fica salva aqui até o usuário trocar. */
export interface PilhadoPremiosConfig {
  painel: string
  edicaoId: string
  edicaoLabel?: string | null
  receitaVendas?: number | null
  ticketMedio?: number | null
  quantidadeCompras?: number | null
  clientesCaptados?: number | null
  atualizadoEm: string
}

export interface FaixaLeitura {
  label: string
  total: number
}

export interface DistribuicaoDdd {
  ddd: string
  uf: string
  total: number
  pctLeitura: number
}

export interface FalhaBase {
  numero: string
  erroDescricao: string | null
}

export interface DestinatarioBase {
  numero: string
  status: string
  enviadoEm: string
  entregueEm: string | null
  lidoEm: string | null
  erroDescricao: string | null
  optOut: boolean
  tempoLeituraSeg: number | null
  ddd: string | null
  uf: string | null
}

export interface AnaliseBaseDaxx {
  total: number
  dataDisparo: string | null
  entregues: number
  lidos: number
  falhas: number
  pendentes: number
  pctEntregues: number
  pctLidos: number
  pctFalhas: number
  pctPendentes: number
  taxaEntregaTotal: number
  taxaLeituraSobreEntregues: number
  optOuts: number
  pctOptOuts: number
  tempoEntregaMedioSeg: number
  tempoEntregaMedianaSeg: number
  tempoLeituraMedioSeg: number
  tempoLeituraMedianaSeg: number
  faixasLeitura: FaixaLeitura[]
  distribuicaoDdd: DistribuicaoDdd[]
  distribuicaoDddPorLeitura: DistribuicaoDdd[]
  falhasLista: FalhaBase[]
  destinatarios: DestinatarioBase[]
  optOutsLista: string[]
}

export interface DisparoAgendadoDaxx {
  id: string
  cliente_id: string
  status: string
  agendado_para: string
  criado_em: string
  atualizado_em?: string
  marcas?: { nome: string } | null
  [key: string]: unknown
}

export interface NumeroSendpulse {
  id: string
  numero: string
  nome: string
  descricao?: string
  status: 'ativo' | 'inativo'
  inboxTotal: number
  inboxNaoLidas: number
  ultimaSync?: string
  /** Conta SendPulse de origem (id "01"/"02"/... e nome amigável) — preenchido por
   * listarNumerosTodasContas() quando há mais de uma conta configurada. */
  contaId?: string
  contaNome?: string
}

export interface FluxoSendpulse {
  id: string
  botId: string
  nome: string
  status: 'ativo' | 'inativo' | 'rascunho'
  triggers: Array<{
    id: string
    nome: string
    tipo: number
  }>
}

export interface ChatAtivoSendpulse {
  contactId: string
  contactNome: string
  contactTelefone: string
  ultimaMensagem?: string
  ultimaAtividade: string
  ultimaAtividadeBot?: string
  naoLidas: number
  chatAberto: boolean
}

export interface EstatisticasBotSendpulse {
  totalInscritos: number
  ativosInscritos: number
  totalMensagensEnviadas: number
}

export interface DriveFile {
  id: string
  nome: string
  mimeType: string
  tamanho: number
  criadoEm: string
}

export interface DriveFolder {
  id: string
  nome: string
}

export interface BaseCSV {
  leadhubId?: string
  driveFileId?: string
  driveFolderId?: string
  driveFolderPath?: string
  nomeArquivo?: string
  totalRegistros?: number
  status: StatusBase
  baixadoEm?: string
  caminhoLocal?: string
  erro?: string
}

export interface Disparo {
  id: string
  tipo: TipoDisparo
  nomenclatura: string
  status: StatusDisparo
  casasAposta: string[]
  dataDisparo: string
  horarioDisparo: string
  base: BaseCSV
  templateDaxx?: TemplateDaxx
  daxxCampanhaId?: string
  numeroSendpulse?: NumeroSendpulse
  esteiraPaiId?: string
  numerosSendpulse?: NumeroSendpulse[]
  linkTemplatesSelecionados?: string[]
  criadoEm: string
  atualizadoEm: string
  notas?: string
  flowIds?: string[]
  /** @deprecated migrado para flowIds */
  flowId?: string
  cpaPainelId?: string
  utm?: string
  betmgmPid?: string
  resultados?: ResultadoDisparo
  valorTotalBase?: number
  conversao?: ConversaoDisparo
}

export interface Esteira {
  id: string
  nome: string
  chave?: string
  casasAposta: string[]
  etapas: EsteiraEtapa[]
  criadoEm: string
  atualizadoEm: string
  ativa: boolean
}

export type StatusInteracao = 'respondendo' | 'ocioso' | 'parado' | 'em_pico' | 'numero_caido'

export interface NumeroMonitorado {
  numero: NumeroSendpulse
  chats: ChatAtivoSendpulse[]
  totalConversas: number
  leadsHoje: number
  totalNaoLidas: number
  volumeUltimos5Min: number
  volumeUltimaHora: number
  volumeHoje: number
  volumeOutbox5Min: number
  chatsScanned: number
  chatsTotal: number
  totalMensagensEnviadas: number
  totalFluxos: number
  statusInteracao?: StatusInteracao
  ultimoAumentoMs?: number
}

export interface DadosMonitoramento {
  numeros: NumeroMonitorado[]
  ultimaAtualizacao: string
}

export interface FlowTagConfig {
  flowId: string
  botId: string
  tags: string[]
  funil?: string | null
  utm?: string | null
  /** UTMs adicionais além de `utm` — resultados (registros/FTD) somam entre todas. */
  utmsExtras?: string[]
  casas?: string[]
  tipo?: 'traffic' | 'disparo'
  lpUrl?: string | null
  /** Anotações/insights sobre esse funil — editável no painel de Detalhes (tela de Funis). */
  comentarios?: string | null
  /** KPIs customizados que contam cliques únicos num botão específico da jornada — ver
   * painel de Detalhes (tela de Funis). */
  kpisBotao?: KpiBotao[]
  /** Nomes exatos de campanha do Meta Ads atribuídos manualmente a esse funil (ver painel de
   * Detalhes) — usado pra somar o gasto do funil no período, sem tentar adivinhar por regex
   * (nomes de campanha têm padrão inconsistente e ambíguo entre funis diferentes). */
  campanhasMeta?: string[]
  /** KPIs customizados de custo por etapa da jornada — escolhe uma tag do fluxo e calcula
   * gasto (Meta) ÷ leads com aquela tag, ex: "custo por CTA". Ver painel de Detalhes. */
  kpisCusto?: KpiCusto[]
}

export interface KpiCusto {
  id: string
  nome: string
  tag: string
}

export interface KpiBotao {
  id: string
  nome: string
  /** Texto exato do botão (botaoTitulo/linkTexto de MensagemFluxo) usado pra contar cliques. */
  botaoTitulo: string
  /** "botao": resposta rápida/lista, clique correlacionado por mensagem (exato). "link": botão de
   * link (cta_url) — clique confirmado via tag CTA_*, não é possível distinguir entre múltiplos
   * links diferentes no mesmo fluxo (limitação da API do WhatsApp, ver sendpulseConversaFluxo.ts). */
  tipo: 'botao' | 'link'
}

export interface CopaMatch {
  id: number
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  date: string
  stage: string
  status: string
  venue?: string
  country?: string
  city?: string
  group?: string
  homeScore?: number
  awayScore?: number
}

export interface Jogo {
  id: number
  ligaId: number
  ligaNome: string
  ligaLogo?: string
  paisNome?: string
  rodada?: string
  date: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  statusCurto: string
  elapsed?: number | null
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  homeScore?: number
  awayScore?: number
  venue?: string
  city?: string
}

export interface CopaNoticia {
  titulo: string
  link: string
  fonte: string
  fonteUrl: string
  data: string
}

export interface SugestaoCopa {
  id: string
  data: string
  matches: Array<{ homeTeam: string; awayTeam: string }>
  titulo: string
  copyBlocos: [string, string, string]
  multiplicador: string
  entrada: string
  retorno: string
  linkCurto?: string
  linkLongo?: string
  numeroId?: string
  flowId?: string
  criadaEm: string
}

export interface GroupStanding {
  rank: number
  teamId: string
  teamName: string
  badge: string
  group: string
  played: number
  win: number
  draw: number
  loss: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form: string
}

export interface TeamInfo {
  id: string
  name: string
  shortName: string
  badge: string
  stadium: string
  location: string
  capacity: number
  description: string
  formedYear: string
}

export interface RecentMatch {
  id: string
  date: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  round: string
  league: string
  status: string
}

export interface PreferenciaCopa {
  id: string
  sugestaoId: string
  data: string
  createdAt: string
  sugestao: SugestaoCopa
  stage: string
}

export interface UserStory {
  id: string
  titulo: string
  descricao?: string
  concluido: boolean
}

export interface ItemLink {
  url: string
  titulo: string
}

export type ColunaDemanda = 'ideias' | 'fazendo' | 'revisao' | 'concluido'

export type PrioridadeDemanda = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Demanda {
  id: string
  titulo: string
  descricao?: string
  coluna: ColunaDemanda
  ordem: number
  prioridade: PrioridadeDemanda
  tags: string[]
  responsavelId?: string
  dataCriacao?: string
  dataConclusao?: string
  userStories: UserStory[]
  links: ItemLink[]
  imagens: string[]
  funilIds: string[]
  numerosSendpulse: string[]
  criadoEm: string
  atualizadoEm: string
}

export interface UsuarioResponsavel {
  id: string
  nome: string
  email?: string
  avatar?: string
  cargo?: string
  discordId?: string
  criadoEm: string
}

export interface CacheMetrica {
  funil: string
  leadsHoje: number
  totalLeads: number
  registros: number
  ftds: number
  atualizadoEm: string
}

export interface ItemCalendario {
  id: string
  tipo: TipoDisparo
  nome: string
  nomenclatura: string
  dataDisparo: string
  horarioDisparo?: string
  casasAposta: string[]
  status: string
  fonte: 'local' | 'daxx' | 'agendado' | 'projetado'
  entregues?: number
  lidas?: number
  rejeitados?: number
  totalBase?: number
  disparoLocal?: Disparo
  campanhaDaxx?: DisparoDaxx
  agendado?: DisparoAgendadoDaxx
}

export interface AppState {
  disparos: Record<string, Disparo>
  esteiras: Record<string, Esteira>
  casasAposta: Record<string, CasaAposta>
  linkTemplates: Record<string, LinkTemplate>
  numerosDisponiveis: NumeroSendpulse[]
  templatesDisponiveis: TemplateDaxx[]
  flowTagConfigs: Record<string, FlowTagConfig>
  pinnedNumeros: string[]
  pinnedFunis: string[]
  pinnedDisparos: string[]
  numerosNaoMonitorados: string[]
  cacheMetricas: Record<string, CacheMetrica>
  demandas: Record<string, Demanda>
  usuariosResponsaveis: Record<string, UsuarioResponsavel>
  utmConfigs: Record<string, UtmConfig>
  etapaConfigs: EsteiraEtapaConfig[]
  ultimaSync?: string
}

// --- Retrospectiva mensal de disparos (ex: /resultados-junho-26) ---

export type CicloDisparo = 'D1' | 'D3' | 'D5' | 'D7' | 'TOTAL'

export interface DisparoJunho {
  data: string
  casa: string
  utm: string
  nome: string
  ciclo: CicloDisparo
  lucro: number
  roas: number
  entregues: number
  lidas: number
  cliques: number
  custo: number
  registros: number
  ftd: number
  cpas: number
  cpaReceita: number,
  img?: string
}

export interface AgregadoJunho {
  disparos: number
  entregues: number
  lidas: number
  custo: number
  faturamento: number
  lucro: number
  registros: number
  ftd: number
  cpas: number
  roas: number
}

export interface DiaJunho {
  data: string
  lucro: number
  entregues: number
  ftd: number
}

// Destaque de "segunda casa": ofertas complementares (sem custo de disparo próprio) que o
// usuário aproveita numa segunda casa de apostas pra potencializar o LTV. Agregado do período
// inteiro, sem data/promoção específica — por isso fica de fora de rankings por disparo/dia.
export interface ItemSegundaCasa {
  casa: string
  registros: number
  ftd: number
  cpas: number
  faturamento: number
}

export interface ResultadosJunho2026 {
  periodo: { inicio: string; fim: string }
  totais: AgregadoJunho & {
    custoPorFtd: number
    custoPorRegistro: number
    convFtd: number
    txLidas: number
  }
  porCiclo: Record<CicloDisparo, AgregadoJunho>
  porCasa: Record<string, AgregadoJunho>
  porDia: DiaJunho[]
  melhorDia: DiaJunho
  topDisparos: DisparoJunho[]
  bottomDisparos: DisparoJunho[]
  disparos: DisparoJunho[]
  segundaCasa?: ItemSegundaCasa[]
}

// --- Resultados (listagem de apresentações mensais, ex: /resultados) ---

export interface TopicosResultado {
  capaTituloPrincipal?: string
  capaSubtitulo?: string
  fechamentoTitulo?: string
  fechamentoMensagem?: string
  acertos: string[]
  pontosAtencao: string[]
  proximosPassos: string[]
  fonte?: string
  capaImagemFundo?: string
  logos?: string[]
  logoAltura?: number
  capaTituloCor?: string
}

export interface Resultado {
  id: string
  titulo: string
  periodoInicio: string
  periodoFim: string
  dados: ResultadosJunho2026
  topicos: TopicosResultado
  publicToken?: string | null
  criadoEm: string
  atualizadoEm: string
}

/** Histórico de comparações de funis geradas em /funis/apresentar — um registro por clique em
 * "Apresentar dados". `funis` é um snapshot dos nomes no momento do salvamento, não só os ids. */
export interface FunilComparacao {
  id: string
  titulo: string
  flowIds: string[]
  funis: string[]
  inicio: string
  fim: string
  criadoEm: string
}

/** Apresentação pública de UM funil (distinta da comparação entre vários) — leads/reg/FTD/conversão
 * do período, funil de conversão das tags e últimas conversas, com espaço pra inserir insights. Ao
 * contrário de FunilComparacao, precisa ser um registro persistido desde a criação (não só query
 * params) porque os comentários são editados depois, direto na página pública. */
export interface FunilApresentacao {
  id: string
  titulo: string
  flowId: string
  funil: string
  inicio: string
  fim: string
  comentarios: string
  criadoEm: string
  atualizadoEm: string
}
