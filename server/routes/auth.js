const express = require('express');
const { isAdmin } = require('../auth');

const router = express.Router();

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_YEAR_MS,
    path: '/',
  };
}

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  const secret   = process.env.AUTH_SECRET;

  if (!expected || !secret) {
    return res
      .status(500)
      .json({ error: 'ADMIN_PASSWORD and AUTH_SECRET must be configured on the server' });
  }
  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.cookie('tt_auth', secret, cookieOptions());
  res.json({ admin: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('tt_auth', { path: '/' });
  res.json({ admin: false });
});

router.get('/me', (req, res) => {
  res.json({ admin: isAdmin(req) });
});

module.exports = router;
