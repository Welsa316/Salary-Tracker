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

  `CREATE TABLE IF NOT EXISTS schedule_days (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_date    DATE NOT NULL,
    start_time  TIME NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT schedule_days_day_unique UNIQUE (day_date)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_schedule_days_date ON schedule_days (day_date)`,

  `CREATE TABLE IF NOT EXISTS students (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    hourly_rate   DECIMAL(10,2) NOT NULL DEFAULT 30.00,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `ALTER TABLE sessions
     ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE`,
  `ALTER TABLE schedule_days
     ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE`,

  // Seed the first student from the old single-tenant settings row, then adopt
  // every pre-existing session / schedule day into it. Idempotent: once any
  // student exists we only ever re-home orphans.
  `DO $$
   DECLARE
     target_id UUID;
     s_name TEXT;
     s_rate DECIMAL(10,2);
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM students) THEN
       SELECT COALESCE(NULLIF(TRIM(student_name), ''), 'Student'),
              COALESCE(hourly_rate, 30.00)
         INTO s_name, s_rate
         FROM settings WHERE id = 1;

       IF s_name IS NULL THEN
         s_name := 'Student';
         s_rate := 30.00;
       END IF;

       INSERT INTO students (slug, name, hourly_rate)
       VALUES (
         COALESCE(NULLIF(lower(regexp_replace(s_name, '[^a-zA-Z0-9]', '', 'g')), ''), 'student')
           || '-' || substring(md5(random()::text), 1, 6),
         s_name,
         s_rate
       )
       RETURNING id INTO target_id;
     ELSE
       SELECT id INTO target_id FROM students ORDER BY created_at ASC LIMIT 1;
     END IF;

     UPDATE sessions      SET student_id = target_id WHERE student_id IS NULL;
     UPDATE schedule_days SET student_id = target_id WHERE student_id IS NULL;
   END $$`,

  // One scheduled slot per day was fine single-tenant; now it must be per student.
  `ALTER TABLE schedule_days DROP CONSTRAINT IF EXISTS schedule_days_day_unique`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'schedule_days_student_day_unique'
     ) THEN
       ALTER TABLE schedule_days
         ADD CONSTRAINT schedule_days_student_day_unique UNIQUE (student_id, day_date);
     END IF;
   END $$`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions (student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_schedule_days_student ON schedule_days (student_id)`,

  // Google Calendar link. Single admin, single Google account, so this lives on
  // the singleton settings row. The refresh token never leaves the server.
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_refresh_token TEXT`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_calendar_id TEXT NOT NULL DEFAULT 'primary'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_email TEXT`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_timezone TEXT`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_sync_error TEXT`,

  // Lets an edited or cleared schedule day update / remove the right event.
  `ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS google_event_id TEXT`,
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
