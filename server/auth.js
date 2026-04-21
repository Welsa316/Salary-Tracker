function isAdmin(req) {
  const token = req.cookies?.tt_auth;
  const secret = process.env.AUTH_SECRET;
  return !!token && !!secret && token === secret;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

module.exports = { isAdmin, requireAdmin };
