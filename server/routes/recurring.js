const express = require('express');
const db = require('../db');

const router = express.Router();

function nextMonday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dow = d.getDay(); // 0=Sun .. 6=Sat
  const daysToNextMonday = dow === 0 ? 1 : 8 - dow;
  d.setDate(d.getDate() + daysToNextMonday);
  return d;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOffsetFromMonday(dow) {
  // dow: 0=Sun..6=Sat. Monday is anchor (offset 0).
  return dow === 0 ? 6 : dow - 1;
}

router.post('/apply', async (req, res, next) => {
  const weeks = Math.max(1, Math.min(12, Number(req.body?.weeks) || 1));
  try {
    const { rows } = await db.query(
      'SELECT hourly_rate, recurring_schedule FROM settings WHERE id = 1',
    );
    const settings = rows[0];
    const schedule = Array.isArray(settings?.recurring_schedule)
      ? settings.recurring_schedule
      : [];
    if (schedule.length === 0) {
      return res.json({ created: 0, skipped: 0, weeks });
    }

    const rate = Number(settings.hourly_rate);
    let created = 0;
    let skipped = 0;

    for (let w = 0; w < weeks; w++) {
      const monday = nextMonday();
      monday.setDate(monday.getDate() + w * 7);

      for (const slot of schedule) {
        const dow = Number(slot.day_of_week);
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
        const start = slot.start_time || null;
        const end   = slot.end_time   || null;

        const date = new Date(monday);
        date.setDate(monday.getDate() + dayOffsetFromMonday(dow));
        const sessionDate = toISODate(date);

        const existing = await db.query(
          `SELECT id FROM sessions
            WHERE session_date = $1
              AND start_time IS NOT DISTINCT FROM $2::time`,
          [sessionDate, start],
        );
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        await db.query(
          `INSERT INTO sessions
             (session_date, start_time, end_time, duration_hrs, rate_snapshot)
           VALUES ($1, $2, $3, 0, $4)`,
          [sessionDate, start, end, rate],
        );
        created++;
      }
    }

    res.json({ created, skipped, weeks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
