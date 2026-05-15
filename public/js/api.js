/* api.js — Client API MadrasaTech */
const API = {
  async req(method, url, body) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    if (r.status === 401) { window.location.href = '/login'; return null; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  },
  get: (url) => API.req('GET', url),
  post: (url, body) => API.req('POST', url, body),
  put: (url, body) => API.req('PUT', url, body),
  delete: (url) => API.req('DELETE', url),

  // Auth
  me: () => API.get('/api/auth/me'),
  login: (email, password) => API.post('/api/auth/login', { email, password }),
  logout: () => API.post('/api/auth/logout'),
  changePassword: (current, nouveau) => API.put('/api/auth/password', { current, nouveau }),
  updateSchool: (school) => API.put('/api/auth/school', { school }),

  // Élèves
  getEleves: (params='') => API.get(`/api/eleves${params}`),
  getEleve: (id) => API.get(`/api/eleves/${id}`),
  createEleve: (data) => API.post('/api/eleves', data),
  updateEleve: (id, data) => API.put(`/api/eleves/${id}`, data),
  deleteEleve: (id) => API.delete(`/api/eleves/${id}`),

  // Classes
  getClasses: () => API.get('/api/classes'),
  createClasse: (data) => API.post('/api/classes', data),
  updateClasse: (id, data) => API.put(`/api/classes/${id}`, data),
  deleteClasse: (id) => API.delete(`/api/classes/${id}`),

  // Professeurs
  getProfesseurs: () => API.get('/api/professeurs'),
  createProfesseur: (data) => API.post('/api/professeurs', data),
  updateProfesseur: (id, data) => API.put(`/api/professeurs/${id}`, data),
  deleteProfesseur: (id) => API.delete(`/api/professeurs/${id}`),

  // Notes
  getNotes: (params='') => API.get(`/api/notes${params}`),
  createNote: (data) => API.post('/api/notes', data),
  updateNote: (id, data) => API.put(`/api/notes/${id}`, data),
  deleteNote: (id) => API.delete(`/api/notes/${id}`),
  getBulletin: (eleveId, trimestre) => API.get(`/api/bulletins/${eleveId}/${trimestre}`),

  // Absences
  getAbsences: (params='') => API.get(`/api/absences${params}`),
  createAbsence: (data) => API.post('/api/absences', data),
  updateAbsence: (id, data) => API.put(`/api/absences/${id}`, data),
  deleteAbsence: (id) => API.delete(`/api/absences/${id}`),

  // Paiements
  getPaiements: (params='') => API.get(`/api/paiements${params}`),
  createPaiement: (data) => API.post('/api/paiements', data),
  updatePaiement: (id, data) => API.put(`/api/paiements/${id}`, data),

  // Emploi du temps
  getEmploi: (params='') => API.get(`/api/emploi-temps${params}`),
  createCours: (data) => API.post('/api/emploi-temps', data),
  deleteCours: (id) => API.delete(`/api/emploi-temps/${id}`),

  // Annonces
  getAnnonces: () => API.get('/api/annonces'),
  createAnnonce: (data) => API.post('/api/annonces', data),
  updateAnnonce: (id, data) => API.put(`/api/annonces/${id}`, data),
  deleteAnnonce: (id) => API.delete(`/api/annonces/${id}`),

  // Dépenses
  getDepenses: (params='') => API.get(`/api/depenses${params}`),
  createDepense: (data) => API.post('/api/depenses', data),
  updateDepense: (id, data) => API.put(`/api/depenses/${id}`, data),
  deleteDepense: (id) => API.delete(`/api/depenses/${id}`),

  // Stats
  getStats: () => API.get('/api/stats'),
};
