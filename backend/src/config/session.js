const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const dbUrl = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;

let store;
if (dbUrl) {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  });

  store = new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  });
}

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.NETLIFY);

const sessionConfig = {
  store,
  secret: process.env.SESSION_SECRET || 'codemaster-lms-super-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  name: 'codemaster_sid',
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

module.exports = session(sessionConfig);
