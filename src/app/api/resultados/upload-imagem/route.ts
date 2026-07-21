import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

const BUCKET = 'resultados'

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

    if (!file) {
      return NextResponse.json({ error: 'file é obrigatório' }, { status: 400 })
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não permitido. Use PNG, JPG, WebP ou SVG.' }, { status: 400 })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 })
    }

    await garantirBucket()

    const ext = EXT_MAP[file.type]
    const nome = `${crypto.randomUUID()}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage.from(BUCKET).upload(nome, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      return NextResponse.json({ error: `Erro ao enviar para o Supabase Storage: ${error.message}` }, { status: 500 })
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nome)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao fazer upload' }, { status: 500 })
  }
}
