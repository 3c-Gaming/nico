import type { BotConfig } from './types'

export const CONTACT_MAP: Record<string, BotConfig> = {
  '6a22e4867ea489d82b0e2677': { numero: '5511936237198', contactId: '6a4fcf5fb11cdcfbbb08c199', flowId: '6a4fda0b6db7515e0c056e05', nome: 'Bot 7198' },
  '6a22e3517869e2b0f204f51c': { numero: '5511936237140', contactId: '6a4fd62676cdfab28e08c0bd', flowId: '6a4fda0f4009795f170cd59b', nome: 'Bot 7140' },
  '6a275b0e33e434b6290b8969': { numero: '5511936237314', contactId: '6a4fd5cf6c897166100b48ce', flowId: '6a4fd9f16db7515e0c056e03', nome: 'Bot 7314' },
  '6a22e26cf99f97efd0014c8f': { numero: '5511936238179', contactId: '6a4fd62f35a26d907203adc7', flowId: '6a4fda12294595b7dc0a77ec', nome: 'Bot 8179' },
  '6a264685f7bc4b7074004fb2': { numero: '5511936237281', contactId: '6a4fd5f476cdfab28e08c065', flowId: '6a4fd9fb294595b7dc0a77ea', nome: 'Bot 7281' },
  '6a2645cd96ed0a6efd0728d0': { numero: '5511936236988', contactId: '6a4fd60476cdfab28e08c082', flowId: '6a4fd9ff6db7515e0c056e04', nome: 'Bot 6988' },
  '6a27572022d6e376cb0242ad': { numero: '5511936238156', contactId: '6a4fd5dd6f656c1e17086309', flowId: '6a4fd9f74009795f170cd599', nome: 'Bot 8156' },
  '6a2a14fea931f85e850ce68b': { numero: '5511936238187', contactId: '6a4fd79e76cdfab28e08c3e1', flowId: '6a4fd9a69f2655131c0346a6', nome: 'Bot 8187' },
  '6a22e8944a0343f0260d3156': { numero: '5511936237291', contactId: '6a4fd6116eb6273d7b0a6900', flowId: '6a4fda07294595b7dc0a77eb', nome: 'Bot 7291' },
}

export const BOT_IDS = Object.keys(CONTACT_MAP)
