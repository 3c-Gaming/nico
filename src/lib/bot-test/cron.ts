import { BOT_IDS } from './contact-map'
import { executarCicloTeste } from './runner'

export async function executarCicloCompleto() {
  for (const botId of BOT_IDS) {
    try {
      await executarCicloTeste(botId)
    } catch (err) {
      console.error(`[bot-test] Erro no bot ${botId}:`, err)
    }
  }
}
