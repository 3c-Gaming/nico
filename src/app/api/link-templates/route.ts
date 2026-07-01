import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { listarLinkTemplates } = await import('@/lib/db/supabase')
    const templates = await listarLinkTemplates()
    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ templates: [] })
  }
}
