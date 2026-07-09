import { BOT_IDS } from './contact-map'
import { executarCicloTeste } from './runner'
import { carregarConfig } from './store'

let intervalId: ReturnType<typeof setInterval> | null = null

async function executarCicloCompleto() {
  const promises = BOT_IDS.map(botId =>
    executarCicloTeste(botId).catch(err => {
      console.error(`[bot-test] Erro no bot ${botId}:`, err)
    })
  )
  await Promise.allSettled(promises)
}

export async function iniciarCron() {
  if (intervalId) return
  const cfg = await carregarConfig()
  console.log(`[bot-test] Cron iniciado — testando bots a cada ${cfg.pollIntervalMs / 1000}s`)
  executarCicloCompleto()
  intervalId = setInterval(executarCicloCompleto, cfg.pollIntervalMs)
}

export function pararCron() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[bot-test] Cron parado')
  }
}

export async function reiniciarCron() {
  pararCron()
  await iniciarCron()
}
