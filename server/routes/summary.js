const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const unpaidQ = db.query(
      `SELECT COALESCE(SUM(duration_hrs * rate_snapshot), 0) AS total_owed,
              COUNT(*)                                        AS unpaid_count
         FROM sessions
        WHERE paid = false AND duration_hrs > 0`,
    );
    const lifetimeQ = db.query(
      `SELECT COALESCE(SUM(duration_hrs * rate_snapshot), 0) AS total_earned,
              COUNT(*)                                        AS sessions_logged
         FROM sessions
        WHERE duration_hrs > 0`,
    );
    const paidQ = db.query(
      `SELECT COALESCE(SUM(duration_hrs * rate_snapshot), 0) AS total_paid
         FROM sessions
        WHERE paid = true`,
    );

    const [unpaid, lifetime, paid] = await Promise.all([unpaidQ, lifetimeQ, paidQ]);

    res.json({
      total_owed:        Number(unpaid.rows[0].total_owed),
      unpaid_count:      Number(unpaid.rows[0].unpaid_count),
      total_earned:      Number(lifetime.rows[0].total_earned),
      sessions_logged:   Number(lifetime.rows[0].sessions_logged),
      total_paid:        Number(paid.rows[0].total_paid),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
