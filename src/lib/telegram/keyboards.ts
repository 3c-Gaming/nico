import { InlineKeyboard } from 'grammy'

export function menuPrincipal(): InlineKeyboard {
  return new InlineKeyboard().text('📄 Páginas', 'pg:list')
}

export function listaPaginas(paginas: Array<{ id: string; nome: string }>, indices: Map<string, number>): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const p of paginas) {
    const idx = indices.get(p.id)!
    kb.text(p.nome, `pg:v:${idx}`).row()
  }
  kb.text('⬅️ Voltar', 'pg:menu')
  return kb
}

export function detalhesPagina(paginaIdx: number, destinations: Array<{ phone: string; flowId: string; weight: number }>): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (let i = 0; i < destinations.length; i++) {
    const d = destinations[i]
    const flowShort = d.flowId ? d.flowId.slice(0, 8) + '...' : 'sem flow'
    kb.text(`📞 ${d.phone} · #${flowShort} · ${d.weight}%`, `pg:e:${paginaIdx}:${i}`).row()
  }
  kb.text('⬅️ Voltar', 'pg:list')
  return kb
}

export function listaNumeros(numeros: Array<{ id: string; numero: string; nome: string }>, paginaIdx: number, destIndex: number): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const n of numeros) {
    const label = n.numero ? `${n.nome} (${n.numero})` : n.nome
    kb.text(label, `pg:n:${paginaIdx}:${destIndex}:${n.id}`).row()
  }
  kb.text('❌ Cancelar', `pg:c:${paginaIdx}`)
  return kb
}

export function listaFluxos(fluxos: Array<{ id: string; nome: string; status: string }>, paginaIdx: number, destIndex: number): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const f of fluxos) {
    const statusTag = f.status !== 'ativo' ? ` (${f.status})` : ''
    kb.text(`${f.nome}${statusTag}`, `pg:f:${paginaIdx}:${destIndex}:${f.id}`).row()
  }
  kb.text('❌ Cancelar', `pg:c:${paginaIdx}`)
  return kb
}

export function confirmacao(paginaIdx: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirmar e Commitar', `pg:ok:${paginaIdx}`)
    .row()
    .text('❌ Cancelar', `pg:c:${paginaIdx}`)
}
