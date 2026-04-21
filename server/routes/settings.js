const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/', requireAdmin, async (req, res, next) => {
  const { hourly_rate, student_name, currency } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE settings
         SET hourly_rate  = COALESCE($1, hourly_rate),
             student_name = COALESCE($2, student_name),
             currency     = COALESCE($3, currency),
             updated_at   = NOW()
       WHERE id = 1
       RETURNING *`,
      [hourly_rate, student_name, currency],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
