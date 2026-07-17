import fs from 'fs'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

interface CacheEntry<T = unknown> {
  data: T
  expiry: number
  staleExpiry: number
}

interface PersistedCache {
  [key: string]: { data: unknown; expiry: number; staleExpiry: number }
}

const CACHE_PATH = path.join(process.cwd(), 'data', 'cache.json')
const PERSIST_INTERVAL = 30_000
const DEFAULT_STALE_MULTIPLIER = 3
const DISK_MAX_AGE = 24 * 60 * 60 * 1000

const store = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<unknown>>()
let persistTimer: ReturnType<typeof setInterval> | null = null
let loaded = false

function loadFromDisk() {
  if (loaded) return
  loaded = true
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const raw = fs.readFileSync(CACHE_PATH, 'utf-8')
      const parsed: PersistedCache = JSON.parse(raw)
      const now = Date.now()
      for (const [key, entry] of Object.entries(parsed)) {
        if (now < entry.staleExpiry && now - entry.expiry < DISK_MAX_AGE) {
          store.set(key, entry)
        }
      }
    }
  } catch {
    // cache file corrupt or missing — start fresh
  }
}

function persistToDisk() {
  try {
    const dir = path.dirname(CACHE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const obj: PersistedCache = {}
    for (const [key, entry] of store) {
      if (Date.now() < entry.staleExpiry) {
        obj[key] = entry
      }
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(obj), 'utf-8')
  } catch {
    // persist failure is non-critical
  }
}

function startPersistTimer() {
  if (persistTimer) return
  persistTimer = setInterval(persistToDisk, PERSIST_INTERVAL)
  if (persistTimer && typeof persistTimer === 'object' && 'unref' in persistTimer) {
    persistTimer.unref()
  }
}

loadFromDisk()
startPersistTimer()

function cacheKey(prefix: string, id: string): string {
  return `${prefix}::${id}`
}

export async function getOrFetch<T>(
  prefix: string,
  id: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  staleMultiplier: number = DEFAULT_STALE_MULTIPLIER
): Promise<T> {
  const key = cacheKey(prefix, id)
  const now = Date.now()
  const entry = store.get(key)

  if (entry) {
    if (now < entry.expiry) {
      return entry.data as T
    }

    if (now < entry.staleExpiry) {
      if (!pending.has(key)) {
        pending.set(
          key,
          fetcher()
            .then((data) => {
              store.set(key, {
                data,
                expiry: now + ttlMs,
                staleExpiry: now + ttlMs * staleMultiplier,
              })
              return data
            })
            .finally(() => pending.delete(key))
        )
      }
      return entry.data as T
    }
  }

  const existingFetch = pending.get(key)
  if (existingFetch) {
    return existingFetch as Promise<T>
  }

  const promise = fetcher()
  pending.set(key, promise)

  try {
    const data = await promise
    store.set(key, {
      data,
      expiry: now + ttlMs,
      staleExpiry: now + ttlMs * staleMultiplier,
    })
    return data
  } finally {
    pending.delete(key)
  }
}

export function invalidate(prefix: string, id?: string) {
  if (id) {
    store.delete(cacheKey(prefix, id))
  } else {
    const pattern = `${prefix}::`
    for (const key of store.keys()) {
      if (key.startsWith(pattern)) {
        store.delete(key)
      }
    }
  }
}

export function invalidateAll() {
  store.clear()
}

export function getCacheSize(): number {
  return store.size
}
