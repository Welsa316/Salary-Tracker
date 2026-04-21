const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM payments ORDER BY paid_on DESC, created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const { amount, paid_on, method, notes, session_ids } = req.body;

  if (amount == null || !paid_on) {
    return res.status(400).json({ error: 'amount and paid_on are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO payments (amount, paid_on, method, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [amount, paid_on, method || null, notes || null],
    );
    const payment = rows[0];

    if (Array.isArray(session_ids) && session_ids.length > 0) {
      await client.query(
        `UPDATE sessions
           SET paid = true, paid_at = NOW(), payment_id = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [payment.id, session_ids],
      );
    }

    await client.query('COMMIT');
    res.status(201).json(payment);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
