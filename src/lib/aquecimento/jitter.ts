/** Aplica uma variação aleatória de ±percentual em cima de um atraso base (segundos) — evita que
 * mensagens do aquecimento saiam em intervalos robóticos e idênticos todo dia. */
export function jitterSegundos(baseSegundos: number, percentual = 0.35): number {
  const variacao = baseSegundos * percentual
  const delta = (Math.random() * 2 - 1) * variacao
  return Math.max(5, Math.round(baseSegundos + delta))
}

/** Empurra `data` pro próximo horário dentro da janela [horaInicio, horaFim) em Brasília —
 * se já está dentro da janela, devolve como está; se passou da janela hoje, joga pro início da
 * janela de amanhã; se é antes da janela hoje, joga pro início da janela de hoje. */
export function proximoHorarioNaJanela(data: Date, horaInicioBrasilia: number, horaFimBrasilia: number): Date {
  const horaAtual = Number(data.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  if (horaAtual >= horaInicioBrasilia && horaAtual < horaFimBrasilia) return data

  const offsetParaProximaJanela = horaAtual < horaInicioBrasilia
    ? horaInicioBrasilia - horaAtual
    : 24 - horaAtual + horaInicioBrasilia

  const resultado = new Date(data)
  resultado.setUTCHours(resultado.getUTCHours() + offsetParaProximaJanela, 0, 0, 0)
  return resultado
}
