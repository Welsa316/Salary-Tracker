const db = require('./db');

const AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_API   = 'https://www.googleapis.com/calendar/v3';
const SCOPE     = 'https://www.googleapis.com/auth/calendar.events';

// Scheduled days carry a start time but no end (you don't know how long you'll
// stay), so events go on the calendar as a fixed-length placeholder block.
const EVENT_MINUTES = 60;

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(req) {
  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/+$/, '')}/api/google/callback`;
}

function authUrl(req, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Without this Google omits refresh_token on re-consent, which would leave
    // us connected but unable to mint access tokens later.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function postForm(url, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `token request failed (${res.status})`);
  }
  return data;
}

function exchangeCode(code, redirect_uri) {
  return postForm(TOKEN_URL, {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri,
    grant_type: 'authorization_code',
  });
}

function refreshAccessToken(refresh_token) {
  return postForm(TOKEN_URL, {
    refresh_token,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
}

async function getConnection() {
  const { rows } = await db.query(
    `SELECT google_refresh_token, google_calendar_id, google_email,
            google_timezone, google_sync_error
       FROM settings WHERE id = 1`,
  );
  return rows[0] || null;
}

async function setSyncError(message) {
  await db.query('UPDATE settings SET google_sync_error = $1 WHERE id = 1', [message]);
}

async function disconnect() {
  await db.query(
    `UPDATE settings
        SET google_refresh_token = NULL, google_email = NULL,
            google_timezone = NULL, google_sync_error = NULL
      WHERE id = 1`,
  );
  await db.query('UPDATE schedule_days SET google_event_id = NULL');
}

async function calendarFetch(accessToken, method, path, body) {
  const res = await fetch(`${CAL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // A deleted-in-Google event is not an error for us — treat it as gone.
  if (res.status === 404 || res.status === 410) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `calendar ${method} failed (${res.status})`);
  }
  return data;
}

function addDays(iso, n) {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

function eventBody(studentName, dayIso, startTime, timeZone) {
  const hhmm = String(startTime).slice(0, 5);
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + EVENT_MINUTES;
  const endHhmm =
    `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  // A late start pushes the end past midnight; without advancing the date the
  // event would end before it starts and Google rejects it.
  const endDay = addDays(dayIso, Math.floor(total / (24 * 60)));
  return {
    summary: `Tutoring · ${studentName}`,
    start: { dateTime: `${dayIso}T${hhmm}:00`,   timeZone },
    end:   { dateTime: `${endDay}T${endHhmm}:00`, timeZone },
  };
}

/**
 * Reconciles one student's week against Google Calendar. Best-effort by design:
 * the schedule is already committed before this runs, so a Google outage or a
 * revoked token can never block saving a week. Errors are recorded on settings
 * and surfaced in the connection status instead.
 *
 * `prev` and `next` are arrays of { day_date, start_time, google_event_id }.
 * Returns a map of day_date -> event id for rows that need persisting.
 */
async function syncWeek(studentName, prev, next) {
  const conn = await getConnection();
  if (!isConfigured() || !conn?.google_refresh_token) return null;

  const calendarId = encodeURIComponent(conn.google_calendar_id || 'primary');
  const tz = conn.google_timezone || 'UTC';

  const key = (r) => String(r.day_date).slice(0, 10);
  const prevByDay = new Map(prev.map((r) => [key(r), r]));
  const nextByDay = new Map(next.map((r) => [key(r), r]));

  const { access_token } = await refreshAccessToken(conn.google_refresh_token);
  const eventIds = {};

  // Days that disappeared from the week.
  for (const [day, row] of prevByDay) {
    if (nextByDay.has(day) || !row.google_event_id) continue;
    await calendarFetch(access_token, 'DELETE', `/calendars/${calendarId}/events/${row.google_event_id}`);
  }

  for (const [day, row] of nextByDay) {
    const before = prevByDay.get(day);
    const body = eventBody(studentName, day, row.start_time, tz);

    if (before?.google_event_id) {
      const updated = await calendarFetch(
        access_token, 'PATCH',
        `/calendars/${calendarId}/events/${before.google_event_id}`, body,
      );
      // Null means the event was deleted in Google; recreate so the calendar
      // converges back to what the app says.
      if (updated) {
        eventIds[day] = before.google_event_id;
        continue;
      }
    }

    const created = await calendarFetch(access_token, 'POST', `/calendars/${calendarId}/events`, body);
    if (created?.id) eventIds[day] = created.id;
  }

  return eventIds;
}

module.exports = {
  isConfigured,
  redirectUri,
  authUrl,
  exchangeCode,
  refreshAccessToken,
  getConnection,
  setSyncError,
  disconnect,
  calendarFetch,
  syncWeek,
  EVENT_MINUTES,
};
