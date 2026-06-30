import { NextResponse } from 'next/server'
import { listarPastas } from '@/lib/integrações/googleDrive'

export async function GET() {
  try {
    const pastas = await listarPastas()
    return NextResponse.json({ pastas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
