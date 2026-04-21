const db = require('./db');

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  `CREATE TABLE IF NOT EXISTS settings (
    id            SMALLINT PRIMARY KEY DEFAULT 1,
    hourly_rate   DECIMAL(10,2) NOT NULL DEFAULT 25.00,
    student_name  TEXT,
    currency      TEXT NOT NULL DEFAULT 'USD',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT singleton CHECK (id = 1)
  )`,

  `CREATE TABLE IF NOT EXISTS payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount        DECIMAL(10,2) NOT NULL,
    paid_on       DATE NOT NULL,
    method        TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_payments_date ON payments (paid_on DESC)`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date  DATE NOT NULL,
    start_time    TIME,
    end_time      TIME,
    duration_hrs  DECIMAL(5,2) NOT NULL DEFAULT 0,
    rate_snapshot DECIMAL(10,2) NOT NULL,
    notes         TEXT,
    paid          BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at       TIMESTAMPTZ,
    payment_id    UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (session_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_paid ON sessions (paid)`,

  `INSERT INTO settings (id, hourly_rate, student_name, currency)
     VALUES (1, 25.00, NULL, 'USD')
     ON CONFLICT (id) DO NOTHING`,

  `ALTER TABLE settings
     ADD COLUMN IF NOT EXISTS recurring_schedule JSONB NOT NULL DEFAULT '[]'::jsonb`,
];

async function migrate() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  console.log('[migrate] schema ready');
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
