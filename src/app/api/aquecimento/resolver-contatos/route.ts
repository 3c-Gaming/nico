import { NextRequest, NextResponse } from 'next/server'
import { listarNumerosTodasContas, listarChatsAtivos } from '@/lib/integrações/sendpulse'
import { listarContasSendpulse } from '@/lib/integrações/contasSendpulse'

function soDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

/** Acha o contact_id que o bot `origemBotId` usa pra falar com o telefone `telefoneAlvo` — só
 * existe se os dois números já trocaram uma mensagem real pelo WhatsApp alguma vez (é isso que faz
 * a SendPulse criar o contato). Evita o usuário ter que ir manualmente no painel da SendPulse
 * copiar o contact_id: como o telefone de cada bot já é conhecido (listarNumerosTodasContas), basta
 * listar os chats ativos do bot de origem e casar pelo telefone. */
async function buscarContactId(origemBotId: string, apiKey: string, telefoneAlvo: string): Promise<string | null> {
  const alvo = soDigitos(telefoneAlvo)
  const { chats } = await listarChatsAtivos(origemBotId, apiKey, AbortSignal.timeout(15_000))
  const encontrado = chats.find((c) => soDigitos(c.contactTelefone) === alvo)
  return encontrado?.contactId ?? null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { botIdA, botIdB } = body
  if (!botIdA || !botIdB) {
    return NextResponse.json({ error: 'botIdA e botIdB são obrigatórios' }, { status: 400 })
  }

  try {
    const numeros = await listarNumerosTodasContas(AbortSignal.timeout(15_000))
    const numeroA = numeros.find((n) => n.id === botIdA)
    const numeroB = numeros.find((n) => n.id === botIdB)
    if (!numeroA || !numeroB) {
      return NextResponse.json({ error: 'número não encontrado na SendPulse' }, { status: 404 })
    }

    const contas = listarContasSendpulse()
    const apiKeyA = contas.find((c) => c.id === numeroA.contaId)?.apiKey
    const apiKeyB = contas.find((c) => c.id === numeroB.contaId)?.apiKey
    if (!apiKeyA || !apiKeyB) {
      return NextResponse.json({ error: 'conta SendPulse não configurada pra um dos números' }, { status: 404 })
    }

    const [contactIdA, contactIdB] = await Promise.all([
      buscarContactId(botIdA, apiKeyA, numeroB.numero),
      buscarContactId(botIdB, apiKeyB, numeroA.numero),
    ])

    return NextResponse.json({ contactIdA, contactIdB })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
