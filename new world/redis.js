/**
 * lib/redis.js
 * Tiny Upstash Redis REST client. No @upstash/redis package needed — Vercel's
 * Node runtime has fetch built in, and this only needs GET/SET/DEL.
 *
 * Requires these env vars (auto-injected once you connect an Upstash Redis
 * integration from the Vercel Marketplace — see README.md):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

async function redisCommand(...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Redis is not configured — connect an Upstash Redis integration from the Vercel Marketplace (see README.md)."
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis command failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.result;
}

async function redisGetJSON(key, fallback = null) {
  const raw = await redisCommand("GET", key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function redisSetJSON(key, value) {
  return redisCommand("SET", key, JSON.stringify(value));
}

async function redisDel(key) {
  return redisCommand("DEL", key);
}

module.exports = { redisCommand, redisGetJSON, redisSetJSON, redisDel };
