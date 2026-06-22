import type { TemplateDaxx } from '@/types'

// TODO: [INTEGRATION PENDING] Implementar cliente real da DAXX

export async function listarTemplates(): Promise<TemplateDaxx[]> {
  // Stub: retorna dados mockados
  return [
    { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001', descricao: 'Template para ODD com 100x de odds' },
    { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002', descricao: 'Template promocional genérico' },
    { id: 'tpl_003', nome: 'Template Esportivas', url: 'https://daxx.example.com/tpl/003', descricao: 'Template para campanhas esportivas' },
  ]
}
