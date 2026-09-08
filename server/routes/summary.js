const express = require('express');
const db = require('../db');
const { resolveStudentId } = require('../students');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const studentId = await resolveStudentId(req, res);
    if (studentId === undefined) return;

    const [unpaid, lifetime, paid] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(duration_hrs * rate_snapshot), 0) AS total_owed,
                COUNT(*)                                        AS unpaid_count
           FROM sessions
          WHERE student_id = $1 AND paid = false AND duration_hrs > 0`,
        [studentId],
      ),
      db.query(
        `SELECT COALESCE(SUM(duration_hrs * rate_snapshot), 0) AS total_earned,
                COUNT(*)                                        AS sessions_logged
           FROM sessions
          WHERE student_id = $1 AND duration_hrs > 0`,
        [studentId],
      ),
      db.query(
        `SELECT COALESCE(SUM(duration_hrs * rate_snapshot), 0) AS total_paid
           FROM sessions
          WHERE student_id = $1 AND paid = true`,
        [studentId],
      ),
    ]);

    res.json({
      total_owed:      Number(unpaid.rows[0].total_owed),
      unpaid_count:    Number(unpaid.rows[0].unpaid_count),
      total_earned:    Number(lifetime.rows[0].total_earned),
      sessions_logged: Number(lifetime.rows[0].sessions_logged),
      total_paid:      Number(paid.rows[0].total_paid),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
