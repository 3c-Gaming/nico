import { NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const slug = formData.get('slug') as string | null

    if (!file || !slug) {
      return NextResponse.json({ error: 'file e slug são obrigatórios' }, { status: 400 })
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não permitido. Use PNG, JPG, WebP ou SVG.' }, { status: 400 })
    }

    const ext = EXT_MAP[file.type]
    const dir = path.join(process.cwd(), 'public', 'casas')
    const filePath = path.join(dir, `${slug}${ext}`)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    return NextResponse.json({ logo: `/casas/${slug}${ext}` })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao fazer upload' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { slug } = await request.json()
    if (!slug) {
      return NextResponse.json({ error: 'slug é obrigatório' }, { status: 400 })
    }

    const dir = path.join(process.cwd(), 'public', 'casas')
    for (const ext of ['.png', '.jpg', '.webp', '.svg']) {
      try {
        await unlink(path.join(dir, `${slug}${ext}`))
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao remover logo' }, { status: 500 })
  }
}
