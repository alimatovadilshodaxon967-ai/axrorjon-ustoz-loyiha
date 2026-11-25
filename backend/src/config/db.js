const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.NETLIFY_DB_URL;
if (!dbUrl) {
  try {
    const { getConnectionString } = require('@netlify/database');
    dbUrl = getConnectionString();
    if (dbUrl) process.env.NETLIFY_DB_URL = dbUrl;
  } catch {
    // Ignore when @netlify/database is not configured locally
  }
}

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
