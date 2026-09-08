const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');
const { resolveStudentId } = require('../students');
const google = require('../google');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const studentId = await resolveStudentId(req, res);
    if (studentId === undefined) return;

    const { week } = req.query;
    let rows;
    if (week) {
      ({ rows } = await db.query(
        `SELECT * FROM schedule_days
          WHERE student_id = $1
            AND day_date >= $2::date
            AND day_date < ($2::date + INTERVAL '7 days')
          ORDER BY day_date ASC, start_time ASC`,
        [studentId, week],
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT * FROM schedule_days
          WHERE student_id = $1
          ORDER BY day_date ASC, start_time ASC`,
        [studentId],
      ));
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/week', requireAdmin, async (req, res, next) => {
  const { week_start, days } = req.body || {};
  if (!week_start || !Array.isArray(days)) {
    return res.status(400).json({ error: 'week_start and days[] required' });
  }

  const studentId = await resolveStudentId(req, res);
  if (studentId === undefined) return;

  const client = await db.pool.connect();
  let inserted;
  let previous;
  try {
    // Snapshot before the delete so we keep hold of each day's Google event id.
    const before = await client.query(
      `SELECT day_date, start_time, google_event_id
         FROM schedule_days
        WHERE student_id = $1
          AND day_date >= $2::date
          AND day_date < ($2::date + INTERVAL '7 days')`,
      [studentId, week_start],
    );
    previous = before.rows;
    const eventIdByDay = new Map(
      previous.map((r) => [String(r.day_date).slice(0, 10), r.google_event_id]),
    );

    await client.query('BEGIN');

    await client.query(
      `DELETE FROM schedule_days
        WHERE student_id = $1
          AND day_date >= $2::date
          AND day_date < ($2::date + INTERVAL '7 days')`,
      [studentId, week_start],
    );

    inserted = [];
    for (const d of days) {
      if (!d?.day_date || !d?.start_time) continue;
      const { rows } = await client.query(
        `INSERT INTO schedule_days (student_id, day_date, start_time, google_event_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, day_date) DO UPDATE
           SET start_time = EXCLUDED.start_time,
               updated_at = NOW()
         RETURNING *`,
        [studentId, d.day_date, d.start_time, eventIdByDay.get(d.day_date) || null],
      );
      inserted.push(rows[0]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    return next(err);
  }
  client.release();

  // The week is already saved. Calendar sync runs after the commit and never
  // fails the request — a revoked token or a Google outage must not stop you
  // from planning a week.
  try {
    const { rows } = await db.query('SELECT name FROM students WHERE id = $1', [studentId]);
    const eventIds = await google.syncWeek(rows[0]?.name || 'Student', previous, inserted);
    if (eventIds) {
      for (const [day, eventId] of Object.entries(eventIds)) {
        await db.query(
          `UPDATE schedule_days SET google_event_id = $1
            WHERE student_id = $2 AND day_date = $3::date`,
          [eventId, studentId, day],
        );
      }
      await google.setSyncError(null);
    }
  } catch (err) {
    console.error('[google] week sync failed:', err.message);
    await google.setSyncError(err.message).catch(() => {});
  }

  res.json(inserted);
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM schedule_days WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
