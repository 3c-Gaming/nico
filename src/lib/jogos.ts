// Ligas acompanhadas na tela de Jogos — arquivo sem código server-only (sem process.env),
// pra poder ser importado tanto pela API route quanto pelos componentes client (filtro de liga).
export const LIGAS_ACOMPANHADAS = [
  { id: 71, nome: 'Brasileirão Série A', pais: 'Brasil' },
  { id: 73, nome: 'Copa do Brasil', pais: 'Brasil' },
  { id: 13, nome: 'Libertadores', pais: 'América do Sul' },
  { id: 11, nome: 'Sul-Americana', pais: 'América do Sul' },
  { id: 2, nome: 'Champions League', pais: 'Europa' },
  { id: 140, nome: 'La Liga', pais: 'Espanha' },
  { id: 39, nome: 'Premier League', pais: 'Inglaterra' },
] as const
