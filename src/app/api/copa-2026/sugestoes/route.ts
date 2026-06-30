import { NextRequest, NextResponse } from 'next/server'
import type { CopaMatch, SugestaoCopa } from '@/types'

const GEMINI_MODEL = 'gemini-3.5-flash'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const GEMINI_KEY = process.env.GEMINI_API_KEY

function extrairRetryDelay(text: string): number | null {
  const m = text.match(/retryDelay["':\s]+(\d+(?:\.\d+)?)\s*s/i)
  if (m) return Math.ceil(Number(m[1]) * 1000) + 500
  return null
}

function montarPrompt(
  matches: CopaMatch[],
  data: string,
  preferencias: string,
  quantidade = 3,
): string {
  const jogos = matches
    .map((m) => `- ${m.homeTeam} vs ${m.awayTeam} (${m.stage})`)
    .join('\n')

  let prompt = `Você é um especialista em marketing para a SuperBet, casa de apostas brasileira.

Gere ${quantidade} sugestões de disparo promocional para os jogos de amanhã da Copa do Mundo FIFA 2026.

Jogos disponíveis (${data}):
${jogos}

Cada sugestão deve ter:
1. titulo: "ODD 1000X — TimeA vs TimeB" (combine 1 a 3 jogos)
2. matches: array de objetos { homeTeam, awayTeam } com os times envolvidos
3. copyBlocos: array com exatamente 3 strings seguindo este molde:
   - Bloco 1: uma frase curta e impactante sobre os jogos do dia e o multiplicador 1000x
   - Bloco 2: explicação que o lead coloca 30 para buscar 30.000 e que o trabalho de análise já foi feito
   - Bloco 3: call to action para clicar no botão e liberar a entrada

USE EXATAMENTE "30" para entrada e "30.000" para retorno. NÃO use placeholders como {N} ou {M} — escreva os valores reais.

${preferencias ? `Preferências anteriores do usuário (sugestões que ele já aprovou):\n${preferencias}\n\nUse essas preferências como referência de estilo e formato.` : ''}

Retorne APENAS um JSON array válido, sem markdown, sem comentários, sem texto extra. Exemplo:
[{ "titulo": "ODD 1000X — Belgica vs Senegal + EUA vs Bosnia", "matches": [{ "homeTeam": "Belgica", "awayTeam": "Senegal" }, { "homeTeam": "EUA", "awayTeam": "Bosnia" }], "copyBlocos": ["texto1", "texto2", "texto3"] }]`

  return prompt
}

function gerarFallback(
  matches: CopaMatch[],
  data: string,
): SugestaoCopa[] {
  const agora = new Date().toISOString()
  return matches.slice(0, 3).map((m, i) => ({
    id: `sug-${Date.now()}-${i}`,
    data,
    matches: [{ homeTeam: m.homeTeam, awayTeam: m.awayTeam }],
    titulo: `ODD 1000X — ${m.homeTeam} vs ${m.awayTeam}`,
    copyBlocos: [
      `🚀 É AMANHÃ! ${m.homeTeam} × ${m.awayTeam} vale ODD 1000X na SuperBet!`,
      `💰 Com apenas R$30 você pode buscar R$30.000. Nossa equipe já fez toda a análise dos confrontos de hoje — é só copiar e garantir.`,
      `👇 Clique no botão abaixo e libere sua entrada VIP para essa oportunidade!`,
    ],
    multiplicador: '1000X',
    entrada: 'R$ 30',
    retorno: 'R$ 30.000',
    criadaEm: agora,
  }))
}

async function chamarGemini(
  prompt: string,
  tentativas = 2,
): Promise<{ resultado: SugestaoCopa[]; raw?: string }> {
  for (let t = 0; t < tentativas; t++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: prompt,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (res.ok) {
      const json = await res.json()
      const step = json?.steps?.find((s: any) => s.type === 'model_output')
      const text = step?.content?.map((c: any) => c.text).join('') ?? ''
      return { resultado: [], raw: text }
    }

    if (res.status === 429) {
      const body = await res.text().catch(() => '')
      const delay = extrairRetryDelay(body)
      if (delay && t < tentativas - 1) {
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw new Error(`Gemini 429: cota excedida após ${t + 1} tentativa(s)`)
    }

    const text = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${text}`)
  }

  throw new Error('Todas as tentativas esgotadas')
}

export async function POST(request: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { matches, data, preferencias, quantidade } = body as {
      matches: CopaMatch[]
      data: string
      preferencias?: string
      quantidade?: number
    }

    if (!matches?.length) {
      return NextResponse.json({ error: 'Nenhum jogo fornecido' }, { status: 400 })
    }

    const prompt = montarPrompt(matches, data, preferencias ?? '', quantidade ?? 3)
    let sugestoes: SugestaoCopa[]
    let usouFallback = false

    try {
      const { resultado, raw } = await chamarGemini(prompt)
      if (raw) {
        let parsed: any[]
        try {
          parsed = JSON.parse(raw)
        } catch {
          const jsonMatch = raw.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0])
            } catch {
              parsed = []
            }
          } else {
            parsed = []
          }
        }

        if (parsed.length > 0) {
          const agora = new Date().toISOString()
          sugestoes = parsed.map((s: any, i: number) => ({
            id: `sug-${Date.now()}-${i}`,
            data,
            matches: s.matches ?? [],
            titulo: s.titulo ?? `Sugestão ${i + 1}`,
            copyBlocos: s.copyBlocos ?? ['', '', ''],
            multiplicador: '1000X',
            entrada: 'R$ 30',
            retorno: 'R$ 30.000',
            criadaEm: agora,
          }))
        } else {
          usouFallback = true
          sugestoes = gerarFallback(matches, data)
        }
      } else {
        sugestoes = resultado
      }
    } catch {
      usouFallback = true
      sugestoes = gerarFallback(matches, data)
    }

    return NextResponse.json({ sugestoes, usouFallback })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
