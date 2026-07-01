import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { db: ReturnType<typeof drizzle> | undefined }

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada')
  }

  if (!globalForDb.db) {
    const client = postgres(process.env.DATABASE_URL, { prepare: false })
    globalForDb.db = drizzle(client, { schema })
  }

  return globalForDb.db
}

export const db = getDb()
