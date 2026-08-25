import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/db/supabase'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  if (!supabase) return NextResponse.json({ error: 'Supabase não disponível' }, { status: 502 })

  const { error } = await supabase.from('sms_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ deleted: true })
}
