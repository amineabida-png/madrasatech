/* api.js — Client API MadrasaTech */
const api = {
  _token() { return localStorage.getItem('mt_token'); },

  async req(method, url, body) {
    const opts = { method, headers: {} };
    const token = this._token();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch('/api' + url, opts);
    if (r.status === 401) { localStorage.removeItem('mt_token'); window.location.href = '/login.html'; return null; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  },
  get: (url) => api.req('GET', url),
  post: (url, body) => api.req('POST', url, body),
  put: (url, body) => api.req('PUT', url, body),
  delete: (url) => api.req('DELETE', url),
};
