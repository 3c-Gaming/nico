import type { TemplateDaxx, DisparoAgendadoDaxx } from '@/types'

const DAXX_API_BASE = 'https://api.disparosimples.tech/db'

export async function listarTemplates(): Promise<TemplateDaxx[]> {
  // TODO: [INTEGRATION PENDING] Implementar cliente real da DAXX
  return [
    { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001', descricao: 'Template para ODD com 100x de odds' },
    { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002', descricao: 'Template promocional genérico' },
    { id: 'tpl_003', nome: 'Template Esportivas', url: 'https://daxx.example.com/tpl/003', descricao: 'Template para campanhas esportivas' },
  ]
}

export async function listarDisparosAgendados(token: string, signal?: AbortSignal): Promise<DisparoAgendadoDaxx[]> {
  let res: Response
  try {
    res = await fetch(DAXX_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Referer: 'https://disparosimples.tech/',
      },
      body: JSON.stringify({
        method: 'GET',
        path: '/rest/v1/disparos_agendados?status=in.(agendado,executando)&cliente_id=eq.27e045fa-94c3-4a42-a64c-8dc312beb364&order=agendado_para.asc&select=*,marcas(nome)',
        body: null,
      }),
      signal: signal ?? AbortSignal.timeout(15_000),
    })
  } catch (err) {
    console.error('[daxx] Erro de rede:', err)
    throw new Error(`Erro de rede ao conectar na daxX: ${(err as Error).message}`)
  }

  if (res.status === 401) {
    throw new Error('Token daxX inválido ou expirado')
  }
  if (!res.ok) {
    const texto = await res.text().catch(() => '')
    console.error('[daxx] Resposta inesperada:', res.status, texto)
    throw new Error(`Erro daxX API: ${res.status}`)
  }

  return res.json() as Promise<DisparoAgendadoDaxx[]>
}
