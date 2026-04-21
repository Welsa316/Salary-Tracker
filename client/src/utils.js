const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$' };

export function money(n, currency = 'USD') {
  const amt = Number(n || 0);
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const formatted = amt.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function parseDate(s) {
  if (!s) return null;
  const ymd = String(s).slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Normalizes any date-ish string to 'YYYY-MM-DD' (safe for <input type="date">).
export function toDateInput(s) {
  if (!s) return '';
  return String(s).slice(0, 10);
}

export function formatDate(d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (typeof d === 'string') d = parseDate(d);
  if (!d) return '';
  return d.toLocaleDateString(undefined, opts);
}

export function todayISO() {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Returns Monday of the week containing the given date.
export function startOfWeek(d) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = copy.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function endOfWeek(d) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function durationFromTimes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

export function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function sessionEarnings(s) {
  return Number(s.duration_hrs) * Number(s.rate_snapshot);
}

export function groupByWeek(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const d = parseDate(s.session_date);
    const weekStart = startOfWeek(d);
    const key = toISODate(weekStart);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        start: weekStart,
        end: endOfWeek(d),
        sessions: [],
      });
    }
    groups.get(key).sessions.push(s);
  }
  return Array.from(groups.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function weekLabel(group) {
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const thisWeekKey = toISODate(thisWeekStart);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekKey = toISODate(lastWeekStart);

  if (group.key === thisWeekKey) return 'This week';
  if (group.key === lastWeekKey) return 'Last week';
  const s = formatDate(group.start, { month: 'short', day: 'numeric' });
  const e = formatDate(group.end, { month: 'short', day: 'numeric' });
  return `${s} – ${e}`;
}
