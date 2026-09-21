import { NextResponse } from 'next/server'
import { listarBlacksenderCanais } from '@/lib/db/supabase'

export async function GET() {
  const canais = await listarBlacksenderCanais()
  return NextResponse.json({ canais })
}
