import { NextResponse } from 'next/server'
import { listarBlacksenderLeadsHoje } from '@/lib/db/supabase'

export async function GET() {
  const leads = await listarBlacksenderLeadsHoje()
  return NextResponse.json({ leads, total: leads.length })
}
