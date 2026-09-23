import { NextRequest, NextResponse } from 'next/server'

// Telegram não dá URL de mídia de entrada (foto do lead) direto — só um file_id, que precisa de
// getFile (Bot API) pra virar um caminho de download, autenticado com o token do bot. Essa rota
// existe só pra essa troca acontecer no servidor: o token nunca aparece no HTML/JS do navegador,
// só nessa chamada nossa pro Telegram. Ver uso em sendpulseConversaFluxo.ts (normalizarMensagem).
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId')
  const token = request.nextUrl.searchParams.get('token')
  if (!fileId || !token) return NextResponse.json({ error: 'fileId e token são obrigatórios' }, { status: 400 })

  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)
    const info = await infoRes.json()
    const filePath = info?.result?.file_path
    if (!infoRes.ok || !info?.ok || !filePath) {
      return NextResponse.json({ error: info?.description || 'Não foi possível resolver o arquivo no Telegram' }, { status: 502 })
    }

    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: 'Falha ao baixar o arquivo do Telegram' }, { status: 502 })
    }

    // O Telegram serve o arquivo como application/octet-stream (confirmado testando ao vivo) —
    // sem forçar image/jpeg aqui, o <img src=...> não teria garantia de renderizar. Fotos de
    // conversa do Telegram são sempre JPEG (é o Bot API que comprime assim).
    return new NextResponse(fileRes.body, {
      headers: {
        'Content-Type': 'image/jpeg',
        // Imutável: o file_path de uma foto já enviada não muda — seguro cachear bastante.
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
