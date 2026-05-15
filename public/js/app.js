// ============================================================
// APP.JS — Point d'entrée principal MadrasaTech
// ============================================================
(async () => {
  // Vérification auth
  let user = null;
  try {
    user = await api.get('/auth/me');
    if (!user) throw new Error('not auth');
  } catch(e) {
    localStorage.removeItem('mt_token');
    window.location.href = '/login.html';
    return;
  }

  window.currentUser = user;

  // Afficher infos utilisateur
  const schoolNameEl = document.getElementById('school-name');
  const userNameEl   = document.getElementById('user-name');
  const userAvatarEl = document.getElementById('user-avatar');

  if (schoolNameEl) schoolNameEl.textContent = user.school || 'MadrasaTech';
  if (userNameEl)   userNameEl.textContent   = (user.prenom || '') + ' ' + (user.nom || user.email);
  if (userAvatarEl) userAvatarEl.textContent = (user.prenom || user.email).charAt(0).toUpperCase();

  // Logout
  window.logout = async function() {
    try { await api.post('/auth/logout', {}); } catch(e) {}
    localStorage.removeItem('mt_token');
    window.location.href = '/login.html';
  };

  // Paramètres
  window.saveSchool = async function() {
    const name = document.getElementById('settings-school')?.value.trim();
    if (!name) return showToast('Nom requis', 'error');
    try {
      await api.put('/auth/school', { school_name: name });
      user.school = name;
      if (schoolNameEl) schoolNameEl.textContent = name;
      showToast('École mise à jour', 'success');
    } catch(e) { showToast('Erreur', 'error'); }
  };

  window.savePassword = async function() {
    const current = document.getElementById('settings-old-pw')?.value;
    const nouveau = document.getElementById('settings-new-pw')?.value;
    if (!current || !nouveau) return showToast('Remplir les deux champs', 'error');
    if (nouveau.length < 6) return showToast('Mot de passe trop court (6 min)', 'error');
    try {
      await api.put('/auth/password', { current, nouveau });
      showToast('Mot de passe changé', 'success');
      document.getElementById('settings-old-pw').value = '';
      document.getElementById('settings-new-pw').value = '';
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
  };

  // Init paramètres view
  function initParametres() {
    const view = document.getElementById('view-parametres');
    if (!view) return;
    view.innerHTML = `
      <div class="view-header">
        <div><h2 class="view-title">⚙️ Paramètres</h2><p class="view-subtitle">Configuration de votre compte</p></div>
      </div>
      <div style="display:grid;gap:1.5rem;max-width:640px">
        <div class="card"><div class="card-body">
          <h3 style="margin-bottom:1rem;font-weight:600">Nom de l'établissement</h3>
          <div class="form-group"><label>Nom de l'école</label>
            <input type="text" id="settings-school" class="form-input" value="${user.school || ''}">
          </div>
          <button class="btn btn-primary" onclick="saveSchool()">Enregistrer</button>
        </div></div>
        <div class="card"><div class="card-body">
          <h3 style="margin-bottom:1rem;font-weight:600">Changer le mot de passe</h3>
          <div class="form-group"><label>Ancien mot de passe</label>
            <input type="password" id="settings-old-pw" class="form-input">
          </div>
          <div class="form-group"><label>Nouveau mot de passe</label>
            <input type="password" id="settings-new-pw" class="form-input">
          </div>
          <button class="btn btn-primary" onclick="savePassword()">Changer</button>
        </div></div>
        <div class="card"><div class="card-body">
          <h3 style="margin-bottom:1rem;font-weight:600">Compte</h3>
          <p style="color:var(--text-secondary);margin-bottom:1rem">Connecté en tant que <strong>${user.email}</strong></p>
          <button class="btn btn-danger" onclick="logout()">Se déconnecter</button>
        </div></div>
      </div>`;
  }

  // Override goView pour inclure parametres
  const _origGoView = window.goView;
  window.goView = function(view) {
    if (view === 'parametres') {
      // Show/hide manually
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const target = document.getElementById('view-parametres');
      if (target) { target.classList.add('active'); initParametres(); }
      document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view === 'parametres'));
      const bc = document.getElementById('breadcrumb');
      if (bc) bc.textContent = 'Paramètres';
    } else {
      _origGoView(view);
    }
  };

  // Démarrer sur dashboard
  const lastSection = localStorage.getItem('mt_active_section') || 'dashboard';
  localStorage.setItem('mt_active_section', lastSection);
  goView(lastSection);

  // Sauvegarder section active à chaque navigation
  const origGoView2 = window.goView;
  window.goView = function(view) {
    localStorage.setItem('mt_active_section', view);
    origGoView2(view);
  };

})();
