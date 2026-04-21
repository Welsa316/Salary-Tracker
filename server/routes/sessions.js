const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function currentRate() {
  const { rows } = await db.query('SELECT hourly_rate FROM settings WHERE id = 1');
  return rows[0] ? Number(rows[0].hourly_rate) : 25;
}

router.get('/', async (req, res, next) => {
  try {
    const { status, week } = req.query;
    const clauses = [];
    const params = [];

    if (status === 'unpaid') {
      clauses.push('paid = false AND duration_hrs > 0');
    } else if (status === 'paid') {
      clauses.push('paid = true');
    } else {
      clauses.push('duration_hrs > 0');
    }

    if (week) {
      params.push(week);
      clauses.push(`session_date >= $${params.length}::date`);
      params.push(week);
      clauses.push(`session_date < ($${params.length}::date + INTERVAL '7 days')`);
    }

    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT * FROM sessions ${where} ORDER BY session_date DESC, start_time DESC NULLS LAST, created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  const {
    session_date,
    start_time,
    end_time,
    duration_hrs,
    notes,
    rate_snapshot,
  } = req.body;

  if (!session_date) {
    return res.status(400).json({ error: 'session_date is required' });
  }

  try {
    const rate =
      toNumberOrNull(rate_snapshot) !== null ? Number(rate_snapshot) : await currentRate();
    const hours = toNumberOrNull(duration_hrs) ?? 0;

    const { rows } = await db.query(
      `INSERT INTO sessions
         (session_date, start_time, end_time, duration_hrs, rate_snapshot, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [session_date, start_time || null, end_time || null, hours, rate, notes || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/import', requireAdmin, async (req, res, next) => {
  const { sessions } = req.body || {};
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.status(400).json({ error: 'sessions[] required' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let count = 0;
    for (const s of sessions) {
      if (!s.session_date) continue;
      const paid = !!s.paid;
      await client.query(
        `INSERT INTO sessions
           (session_date, start_time, end_time, duration_hrs, rate_snapshot, notes, paid, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          s.session_date,
          s.start_time || null,
          s.end_time || null,
          Number(s.duration_hrs) || 0,
          Number(s.rate_snapshot),
          s.notes || null,
          paid,
          paid ? new Date() : null,
        ],
      );
      count++;
    }
    await client.query('COMMIT');
    res.status(201).json({ inserted: count });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

router.post('/bulk/paid', requireAdmin, async (req, res, next) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids[] required' });
  }
  try {
    const { rows } = await db.query(
      `UPDATE sessions
         SET paid = true, paid_at = NOW(), updated_at = NOW()
       WHERE id = ANY($1::uuid[])
       RETURNING *`,
      [ids],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const {
    session_date,
    start_time,
    end_time,
    duration_hrs,
    notes,
    rate_snapshot,
  } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE sessions
         SET session_date  = COALESCE($1, session_date),
             start_time    = $2,
             end_time      = $3,
             duration_hrs  = COALESCE($4, duration_hrs),
             rate_snapshot = COALESCE($5, rate_snapshot),
             notes         = $6,
             updated_at    = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        session_date || null,
        start_time || null,
        end_time || null,
        toNumberOrNull(duration_hrs),
        toNumberOrNull(rate_snapshot),
        notes ?? null,
        id,
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/paid', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE sessions
         SET paid = true, paid_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/unpaid', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE sessions
         SET paid = false, paid_at = NULL, payment_id = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
