const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { migrate } = require('./migrate');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/summary',  require('./routes/summary'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[api] error:', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    if (process.env.DATABASE_URL) {
      await migrate();
    } else {
      console.warn('[start] DATABASE_URL not set, skipping migrations');
    }
    app.listen(PORT, () => {
      console.log(`[start] listening on :${PORT}`);
    });
  } catch (err) {
    console.error('[start] failed to start:', err);
    process.exit(1);
  }
}

start();
