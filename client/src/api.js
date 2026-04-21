async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function qs(params) {
  const s = new URLSearchParams(params).toString();
  return s ? '?' + s : '';
}

export const api = {
  getSettings:   () => request('GET', '/api/settings'),
  putSettings:   (patch) => request('PUT', '/api/settings', patch),

  getSessions:   (params = {}) => request('GET', `/api/sessions${qs(params)}`),
  createSession: (data) => request('POST', '/api/sessions', data),
  updateSession: (id, data) => request('PUT', `/api/sessions/${id}`, data),
  deleteSession: (id) => request('DELETE', `/api/sessions/${id}`),
  markPaid:      (id) => request('POST', `/api/sessions/${id}/paid`),
  markUnpaid:    (id) => request('POST', `/api/sessions/${id}/unpaid`),
  bulkMarkPaid:  (ids) => request('POST', '/api/sessions/bulk/paid', { ids }),

  getSchedule:     (params = {}) => request('GET', `/api/schedule${qs(params)}`),
  putScheduleWeek: (week_start, days) =>
    request('PUT', '/api/schedule/week', { week_start, days }),

  getSummary:    () => request('GET', '/api/summary'),

  getMe:         () => request('GET', '/api/auth/me'),
  login:         (password) => request('POST', '/api/auth/login', { password }),
  logout:        () => request('POST', '/api/auth/logout'),
};
