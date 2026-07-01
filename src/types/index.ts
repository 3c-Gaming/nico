export type TipoDisparo = 'D1' | 'D3' | 'D5' | 'D7' | 'PONTUAL'

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
  casasAposta: string[]
  disparos: {
    d1: string
    d3?: string
    d5?: string
    d7?: string
  }
  criadaEm: string
  atualizadoEm: string
  ativa: boolean
}

export type StatusInteracao = 'respondendo' | 'ocioso' | 'parado'

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
  funil?: string
  utm?: string
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
  ultimaSync?: string
}
