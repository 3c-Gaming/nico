import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

// Mesma abordagem de /api/resultados/upload-imagem: sobe pro Storage do Supabase e devolve a URL
// pública, que vai direto no `media.url` do card RCS (a Solvefy consome a imagem por URL).
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}
const BUCKET = 'rcs'
// RCS: imagem de card costuma ter teto de ~2MB. Mantém folga.
const MAX_BYTES = 2 * 1024 * 1024

let bucketGarantido = false
async function garantirBucket(): Promise<void> {
  if (bucketGarantido) return
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (!error || /already exists/i.test(error.message)) bucketGarantido = true
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file é obrigatório' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não permitido. Use PNG, JPG ou WebP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Imagem acima de 2MB — o RCS pode recusar.' }, { status: 400 })
    }

    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 })

    await garantirBucket()

    const nome = `${crypto.randomUUID()}${EXT_MAP[file.type]}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await supabase.storage.from(BUCKET).upload(nome, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      return NextResponse.json({ error: `Erro ao enviar para o Storage: ${error.message}` }, { status: 500 })
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nome)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao fazer upload' }, { status: 500 })
  }
}
