'use client'

/** Barra de progresso indeterminada (estilo YouTube/GitHub) — pra sinalizar "ainda carregando
 * dados" de um jeito visível no topo da tela, sem depender de um spinner pequeno escondido no
 * meio de outros botões (ver uso em funis/page.tsx: a tabela já aparece com as linhas, mas
 * colunas como Leads hoje/Total ainda estão sendo preenchidas em segundo plano). `ativa=false`
 * não desmonta — só fica transparente, pra não empurrar o layout quando some. */
export function BarraProgresso({ ativa }: { ativa: boolean }) {
  return (
    <div
      className="relative h-[3px] w-full overflow-hidden bg-[var(--border)] transition-opacity duration-300"
      style={{ opacity: ativa ? 1 : 0 }}
      aria-hidden={!ativa}
    >
      {ativa && <div className="barra-progresso-indeterminada" />}
    </div>
  )
}
