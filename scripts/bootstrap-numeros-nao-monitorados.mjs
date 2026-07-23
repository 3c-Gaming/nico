// Roda uma vez, depois da migration supabase-migration-003.sql, pra popular
// numerosNaoMonitorados com os números que HOJE já estão inativos/caídos —
// preserva o comportamento atual (não entram em bot-test/Discord/funis) na
// hora do deploy; dali em diante o toggle em /numeros é quem manda.
//
// Uso: node scripts/bootstrap-numeros-nao-monitorados.mjs

const API_BASE = 'https://controlenumeros.vercel.app'

async function main() {
  const numerosRes = await fetch(`${API_BASE}/api/sendpulse/numeros`)
  if (!numerosRes.ok) throw new Error(`Falha ao buscar números: HTTP ${numerosRes.status}`)
  const { numeros } = await numerosRes.json()

  const inativos = numeros.filter((n) => n.status !== 'ativo').map((n) => n.id)
  console.log(`${inativos.length} de ${numeros.length} números estão inativos hoje.`)

  const prefsRes = await fetch(`${API_BASE}/api/preferencias`)
  const prefs = prefsRes.ok ? await prefsRes.json() : { pinnedNumeros: [], pinnedFunis: [] }

  const putRes = await fetch(`${API_BASE}/api/preferencias`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pinnedNumeros: prefs.pinnedNumeros ?? [],
      pinnedFunis: prefs.pinnedFunis ?? [],
      numerosNaoMonitorados: inativos,
    }),
  })

  if (!putRes.ok) throw new Error(`Falha ao salvar preferências: HTTP ${putRes.status}`)
  console.log('numerosNaoMonitorados populado com sucesso.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
