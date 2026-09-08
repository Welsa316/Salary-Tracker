const db = require('./db');

// Resolves ?student=<slug> to a student id. Writes the error response itself and
// returns undefined when the slug is missing or unknown, so callers can bail with
// `if (studentId === undefined) return;`.
async function resolveStudentId(req, res) {
  const slug = req.query.student || req.body?.student;
  if (!slug) {
    res.status(400).json({ error: 'student slug required' });
    return undefined;
  }
  const { rows } = await db.query('SELECT id FROM students WHERE slug = $1', [slug]);
  if (!rows[0]) {
    res.status(404).json({ error: 'student not found' });
    return undefined;
  }
  return rows[0].id;
}

module.exports = { resolveStudentId };
