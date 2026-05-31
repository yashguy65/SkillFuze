/**
 * Upstash Redis singleton for the Next.js web app.
 *
 * Uses @upstash/redis (HTTP-based REST client — no persistent TCP connections,
 * safe on Vercel serverless).  Falls back to null when env vars are absent so
 * every page works in local dev without Redis configured.
 *
 * Required env vars (add to root .env AND Vercel dashboard):
 *   UPSTASH_REDIS_REST_URL   – from Upstash console "REST API" section
 *   UPSTASH_REDIS_REST_TOKEN – from Upstash console "REST API" section
 */

import { Redis } from '@upstash/redis'

let _client: Redis | null = null
let _attempted = false

export function getRedis(): Redis | null {
  if (_attempted) return _client
  _attempted = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn('[Redis] UPSTASH_REDIS_REST_URL / TOKEN not set — caching disabled.')
    return null
  }

  try {
    _client = new Redis({ url, token })
  } catch (e) {
    console.error('[Redis] Failed to create client:', e)
    _client = null
  }

  return _client
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis()
  if (!r) return null
  try {
    return await r.get<T>(key)
  } catch (e) {
    console.error(`[Redis] cacheGet(${key}) error:`, e)
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.set(key, value, { ex: ttlSeconds })
  } catch (e) {
    console.error(`[Redis] cacheSet(${key}) error:`, e)
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.del(key)
  } catch (e) {
    console.error(`[Redis] cacheDelete(${key}) error:`, e)
  }
}
