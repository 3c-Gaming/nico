import { obterBots } from './bot-list'
import { executarCicloTeste } from './runner'

export async function executarCicloCompleto() {
  const bots = await obterBots()
  for (const bot of bots) {
    try {
      await executarCicloTeste(bot.botId)
    } catch (err) {
      console.error(`[bot-test] Erro no bot ${bot.botId}:`, err)
    }
  }
}
