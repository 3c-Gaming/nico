import { NextResponse } from 'next/server'

export async function GET() {
  // TODO: [INTEGRATION PENDING] Buscar via endpoint/scraping da DAXX
  return NextResponse.json({
    templates: [
      { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001' },
      { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002' },
      { id: 'tpl_003', nome: 'Template Esportivas', url: 'https://daxx.example.com/tpl/003' },
    ],
  })
}
