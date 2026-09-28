/**
 * lib/catalog.js
 * Reads/writes the product+facility catalog in Redis, seeding it from
 * default-catalog.js the first time it's requested and nothing exists yet.
 */

const { redisGetJSON, redisSetJSON } = require("./redis");
const DEFAULT_CATALOG = require("./default-catalog");

const CATALOG_KEY = "sypher:catalog";

async function getCatalog() {
  const existing = await redisGetJSON(CATALOG_KEY, null);
  if (existing && Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  // First run — seed Redis with the defaults so the site works immediately.
  await redisSetJSON(CATALOG_KEY, DEFAULT_CATALOG);
  return DEFAULT_CATALOG;
}

async function saveCatalog(catalog) {
  await redisSetJSON(CATALOG_KEY, catalog);
}

async function getCatalogById() {
  const catalog = await getCatalog();
  const byId = {};
  for (const item of catalog) byId[item.id] = item;
  return byId;
}

module.exports = { getCatalog, saveCatalog, getCatalogById, CATALOG_KEY };
