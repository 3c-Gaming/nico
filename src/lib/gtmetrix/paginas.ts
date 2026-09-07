import { getGtmetrixUrls } from '@/lib/db/supabase'

/**
 * Seed inicial — usado só enquanto ninguém tiver salvo a lista pela tela de
 * Configurações. Depois do primeiro save, a fonte de verdade é o Supabase
 * (coluna user_preferences.gtmetrix_urls).
 */
export const URLS_GTMETRIX_SEED: string[] = [
  'https://tt.eujonvlogs.com',
]

/** Lista efetiva de páginas que o cron/`/gtmetrix-lista` devem testar. */
export async function obterUrlsGtmetrix(): Promise<string[]> {
  const { urls, configurado } = await getGtmetrixUrls()
  return configurado ? urls : URLS_GTMETRIX_SEED
}
