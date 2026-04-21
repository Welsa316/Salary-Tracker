const { Pool, types } = require('pg');

// Return DATE (OID 1082) as a plain 'YYYY-MM-DD' string instead of a JS Date,
// so JSON serialization doesn't push it through a timezone conversion.
types.setTypeParser(1082, (v) => v);

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
