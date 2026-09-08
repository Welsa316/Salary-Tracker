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
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  const s = new URLSearchParams(clean).toString();
  return s ? '?' + s : '';
}

export const api = {
  getSettings:   () => request('GET', '/api/settings'),
  putSettings:   (patch) => request('PUT', '/api/settings', patch),

  listStudents:  () => request('GET', '/api/students'),
  getStudent:    (slug) => request('GET', `/api/students/${slug}`),
  createStudent: (data) => request('POST', '/api/students', data),
  updateStudent: (slug, data) => request('PUT', `/api/students/${slug}`, data),
  deleteStudent: (slug) => request('DELETE', `/api/students/${slug}`),

  getSessions:   (student, params = {}) =>
    request('GET', `/api/sessions${qs({ ...params, student })}`),
  createSession: (student, data) =>
    request('POST', '/api/sessions', { ...data, student }),
  updateSession: (id, data) => request('PUT', `/api/sessions/${id}`, data),
  deleteSession: (id) => request('DELETE', `/api/sessions/${id}`),
  markPaid:      (id) => request('POST', `/api/sessions/${id}/paid`),
  markUnpaid:    (id) => request('POST', `/api/sessions/${id}/unpaid`),
  bulkMarkPaid:  (ids) => request('POST', '/api/sessions/bulk/paid', { ids }),

  getSchedule:     (student, params = {}) =>
    request('GET', `/api/schedule${qs({ ...params, student })}`),
  putScheduleWeek: (student, week_start, days) =>
    request('PUT', '/api/schedule/week', { student, week_start, days }),

  getSummary:    (student) => request('GET', `/api/summary${qs({ student })}`),

  getMe:         () => request('GET', '/api/auth/me'),
  login:         (password) => request('POST', '/api/auth/login', { password }),
  logout:        () => request('POST', '/api/auth/logout'),

  googleStatus:     () => request('GET', '/api/google/status'),
  googleDisconnect: () => request('POST', '/api/google/disconnect'),
};
