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

export const api = {
  getSettings:   () => request('GET', '/api/settings'),
  putSettings:   (patch) => request('PUT', '/api/settings', patch),

  getSessions:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/sessions${q ? '?' + q : ''}`);
  },
  createSession: (data) => request('POST', '/api/sessions', data),
  updateSession: (id, data) => request('PUT', `/api/sessions/${id}`, data),
  deleteSession: (id) => request('DELETE', `/api/sessions/${id}`),
  markPaid:      (id, payment_id) => request('POST', `/api/sessions/${id}/paid`, { payment_id }),
  markUnpaid:    (id) => request('POST', `/api/sessions/${id}/unpaid`),
  bulkMarkPaid:  (ids, payment_id) => request('POST', '/api/sessions/bulk/paid', { ids, payment_id }),

  getPayments:   () => request('GET', '/api/payments'),
  createPayment: (data) => request('POST', '/api/payments', data),
  deletePayment: (id) => request('DELETE', `/api/payments/${id}`),

  getSummary:    () => request('GET', '/api/summary'),
};
