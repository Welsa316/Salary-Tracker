const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { week } = req.query;
    let rows;
    if (week) {
      ({ rows } = await db.query(
        `SELECT * FROM schedule_days
          WHERE day_date >= $1::date
            AND day_date < ($1::date + INTERVAL '7 days')
          ORDER BY day_date ASC, start_time ASC`,
        [week],
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT * FROM schedule_days ORDER BY day_date ASC, start_time ASC`,
      ));
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/week', async (req, res, next) => {
  const { week_start, days } = req.body || {};
  if (!week_start || !Array.isArray(days)) {
    return res.status(400).json({ error: 'week_start and days[] required' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM schedule_days
        WHERE day_date >= $1::date
          AND day_date < ($1::date + INTERVAL '7 days')`,
      [week_start],
    );

    const inserted = [];
    for (const d of days) {
      if (!d?.day_date || !d?.start_time) continue;
      const { rows } = await client.query(
        `INSERT INTO schedule_days (day_date, start_time)
         VALUES ($1, $2)
         ON CONFLICT (day_date) DO UPDATE
           SET start_time = EXCLUDED.start_time,
               updated_at = NOW()
         RETURNING *`,
        [d.day_date, d.start_time],
      );
      inserted.push(rows[0]);
    }

    await client.query('COMMIT');
    res.json(inserted);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM schedule_days WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
