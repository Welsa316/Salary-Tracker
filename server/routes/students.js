const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

function makeSlug(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'student'}-${suffix}`;
}

// Admin-only: parents must not be able to enumerate other families.
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT st.*,
              COALESCE(u.total_owed, 0)   AS total_owed,
              COALESCE(u.unpaid_count, 0) AS unpaid_count
         FROM students st
         LEFT JOIN (
           SELECT student_id,
                  SUM(duration_hrs * rate_snapshot) AS total_owed,
                  COUNT(*)                          AS unpaid_count
             FROM sessions
            WHERE paid = false AND duration_hrs > 0
            GROUP BY student_id
         ) u ON u.student_id = st.id
        ORDER BY st.name ASC`,
    );
    res.json(
      rows.map((r) => ({
        ...r,
        total_owed: Number(r.total_owed),
        unpaid_count: Number(r.unpaid_count),
      })),
    );
  } catch (err) {
    next(err);
  }
});

// Public: this is what a parent's bookmarked link resolves against.
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM students WHERE slug = $1', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  const { name, hourly_rate } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const rate = Number(hourly_rate);
    const { rows } = await db.query(
      `INSERT INTO students (slug, name, hourly_rate)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [makeSlug(name), String(name).trim(), Number.isFinite(rate) && rate > 0 ? rate : 30],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:slug', requireAdmin, async (req, res, next) => {
  const { name, hourly_rate } = req.body || {};
  try {
    const rate = Number(hourly_rate);
    const { rows } = await db.query(
      `UPDATE students
          SET name        = COALESCE($1, name),
              hourly_rate = COALESCE($2, hourly_rate),
              updated_at  = NOW()
        WHERE slug = $3
        RETURNING *`,
      [
        name ? String(name).trim() : null,
        Number.isFinite(rate) && rate > 0 ? rate : null,
        req.params.slug,
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Cascades to that student's sessions and schedule days.
router.delete('/:slug', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM students WHERE slug = $1', [req.params.slug]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
