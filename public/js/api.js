/* api.js — Client API MadrasaTech */
const api = {
  _token() { return localStorage.getItem('mt_token'); },

  async req(method, url, body) {
    const opts = { method, headers: {} };
    const token = this._token();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch('/api' + url, opts);
    if (r.status === 401) {
      localStorage.removeItem('mt_token');
      window.location.href = '/login.html';
      throw new Error('Session expirée, reconnexion...');
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  },

  // Base methods
  get:    (url)       => api.req('GET',    url),
  post:   (url, body) => api.req('POST',   url, body),
  put:    (url, body) => api.req('PUT',    url, body),
  delete: (url)       => api.req('DELETE', url),

  // Auth
  me:             ()        => api.get('/auth/me'),
  login:          (e, p)    => api.post('/auth/login', { email: e, password: p }),
  logout:         ()        => api.post('/auth/logout', {}),
  changePassword: (c, n)    => api.put('/auth/password', { current: c, nouveau: n }),
  updateSchool:   (school)  => api.put('/auth/school', { school_name: school }),

  // Élèves
  getEleves:    (p='')     => api.get('/eleves' + p),
  getEleve:     (id)       => api.get('/eleves/' + id),
  createEleve:  (d)        => api.post('/eleves', d),
  updateEleve:  (id, d)    => api.put('/eleves/' + id, d),
  deleteEleve:  (id)       => api.delete('/eleves/' + id),

  // Classes
  getClasses:   ()         => api.get('/classes'),
  createClasse: (d)        => api.post('/classes', d),
  updateClasse: (id, d)    => api.put('/classes/' + id, d),
  deleteClasse: (id)       => api.delete('/classes/' + id),

  // Professeurs
  getProfesseurs:   ()      => api.get('/professeurs'),
  createProfesseur: (d)     => api.post('/professeurs', d),
  updateProfesseur: (id, d) => api.put('/professeurs/' + id, d),
  deleteProfesseur: (id)    => api.delete('/professeurs/' + id),

  // Notes
  getNotes:    (p='')       => api.get('/notes' + p),
  createNote:  (d)          => api.post('/notes', d),
  updateNote:  (id, d)      => api.put('/notes/' + id, d),
  deleteNote:  (id)         => api.delete('/notes/' + id),
  getBulletin: (eid, trim)  => api.get('/bulletins/' + eid + '/' + trim),

  // Absences
  getAbsences:   (p='')    => api.get('/absences' + p),
  createAbsence: (d)       => api.post('/absences', d),
  updateAbsence: (id, d)   => api.put('/absences/' + id, d),
  deleteAbsence: (id)      => api.delete('/absences/' + id),

  // Paiements
  getPaiements:   (p='')   => api.get('/paiements' + p),
  createPaiement: (d)      => api.post('/paiements', d),
  updatePaiement: (id, d)  => api.put('/paiements/' + id, d),

  // Emploi du temps
  getEmploi:  (p='')       => api.get('/emploi-temps' + p),
  createCours:(d)          => api.post('/emploi-temps', d),
  deleteCours:(id)         => api.delete('/emploi-temps/' + id),

  // Annonces
  getAnnonces:   ()        => api.get('/annonces'),
  createAnnonce: (d)       => api.post('/annonces', d),
  updateAnnonce: (id, d)   => api.put('/annonces/' + id, d),
  deleteAnnonce: (id)      => api.delete('/annonces/' + id),

  // Dépenses
  getDepenses:   (p='')    => api.get('/depenses' + p),
  createDepense: (d)       => api.post('/depenses', d),
  updateDepense: (id, d)   => api.put('/depenses/' + id, d),
  deleteDepense: (id)      => api.delete('/depenses/' + id),

  // Stats
  getStats: () => api.get('/stats'),
};
