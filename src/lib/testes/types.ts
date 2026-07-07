export type TestStatus = 'pending' | 'aguardando_resposta' | 'ok' | 'sem_resposta' | 'copy_incorreta' | 'link_quebrado' | 'erro'

export interface LinkVerificado {
  url: string
  statusCode?: number
  utms: Record<string, string>
}

export interface TestRequest {
  botId: string
  mensagem?: string
  expect?: {
    copyContains?: string[]
    linksEsperados?: number
    utms?: Record<string, string>
  }
}

export interface TestResult {
  id: string
  botId: string
  status: TestStatus
  mensagemEnviada: string
  respostaRecebida?: string
  linksEncontrados?: string[]
  linksVerificados?: LinkVerificado[]
  duracaoMs: number
  criadoEm: string
  erro?: string
}

export interface TesteDatabase {
  testes: TestResult[]
}
