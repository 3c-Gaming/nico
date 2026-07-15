const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://controlenumeros.vercel.app'

/**
 * Gera o link de deploy para o Lovable.
 * O deploy real acontece no browser do usuário (precisa do Castle.js para fingerprinting).
 */
export function getDeployUrl(projectId: string): string {
  return `${APP_URL}/deploy/${projectId}`
}

/**
 * Gera a mensagem de deploy para o Telegram.
 */
export function getDeployMessage(projectId: string): string {
  const url = getDeployUrl(projectId)
  return `\n🚀 [Clique aqui para deployar](${url})`
}
