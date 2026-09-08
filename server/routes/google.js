const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');
const g = require('../google');

const router = express.Router();

router.get('/status', requireAdmin, async (_req, res, next) => {
  try {
    const conn = await g.getConnection();
    res.json({
      configured: g.isConfigured(),
      connected: !!conn?.google_refresh_token,
      email: conn?.google_email || null,
      timezone: conn?.google_timezone || null,
      sync_error: conn?.google_sync_error || null,
      event_minutes: g.EVENT_MINUTES,
    });
  } catch (err) {
    next(err);
  }
});

// Kicks off consent. The state cookie is checked on the way back so a stray
// callback can't attach someone else's Google account.
router.get('/connect', requireAdmin, (req, res) => {
  if (!g.isConfigured()) {
    return res
      .status(500)
      .json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set on the server' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('g_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
  res.redirect(g.authUrl(req, state));
});

router.get('/callback', requireAdmin, async (req, res, next) => {
  const { code, state, error } = req.query;
  const expected = req.cookies?.g_state;
  res.clearCookie('g_state', { path: '/' });

  if (error) return res.redirect('/?google=denied');
  if (!code || !state || !expected || state !== expected) {
    return res.redirect('/?google=state_mismatch');
  }

  try {
    const tokens = await g.exchangeCode(code, g.redirectUri(req));
    if (!tokens.refresh_token) {
      return res.redirect('/?google=no_refresh_token');
    }

    // The primary calendar's id is the account email, and its timeZone is what
    // we must stamp on events so they land at the right wall-clock time.
    const cal = await g.calendarFetch(tokens.access_token, 'GET', '/calendars/primary');

    await db.query(
      `UPDATE settings
          SET google_refresh_token = $1,
              google_calendar_id   = 'primary',
              google_email         = $2,
              google_timezone      = $3,
              google_sync_error    = NULL
        WHERE id = 1`,
      [tokens.refresh_token, cal?.id || null, cal?.timeZone || 'UTC'],
    );

    res.redirect('/?google=connected');
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', requireAdmin, async (_req, res, next) => {
  try {
    await g.disconnect();
    res.json({ connected: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
