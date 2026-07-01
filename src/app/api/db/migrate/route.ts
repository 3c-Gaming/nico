import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function POST() {
  try {
    const { drizzle } = await import('drizzle-orm/postgres-js')
    const postgres = await import('postgres')

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json({ error: 'DATABASE_URL não configurada' }, { status: 500 })
    }

    const sql = postgres.default(databaseUrl, { max: 1 })
    const migrationPath = join(process.cwd(), 'drizzle', '0000_yummy_stellaris.sql')
    const migrationSql = readFileSync(migrationPath, 'utf-8')

    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    for (const stmt of statements) {
      await sql.unsafe(stmt)
    }

    await sql.end()

    return NextResponse.json({ success: true, statements: statements.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
