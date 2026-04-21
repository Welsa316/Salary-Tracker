const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[db] DATABASE_URL not set — API requests will fail until configured.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] unexpected idle client error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
