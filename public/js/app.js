// ============================================================
// APP.JS — Point d'entrée principal MadrasaTech
// ============================================================

(async () => {
  // Vérification auth
  let user = null;
  try {
    user = await api.get('/auth/me');
  } catch(e) {
    window.location.href = '/login.html';
    return;
  }

  // Stocker l'utilisateur globalement
  window.currentUser = user;

  // Afficher le nom de l'école et de l'utilisateur
  const schoolNameEl = document.getElementById('school-name');
  const userNameEl = document.getElementById('user-name');
  const userEmailEl = document.getElementById('user-email');
  const userAvatarEl = document.getElementById('user-avatar');

  if (schoolNameEl) schoolNameEl.textContent = user.school_name || 'MadrasaTech';
  if (userNameEl) userNameEl.textContent = user.name || user.email;
  if (userEmailEl) userEmailEl.textContent = user.email;
  if (userAvatarEl) userAvatarEl.textContent = (user.name || user.email).charAt(0).toUpperCase();

  // Titre de la page dans le header
  const headerTitle = document.getElementById('header-title');
  const headerSubtitle = document.getElementById('header-subtitle');

  // Map des modules
  const moduleMap = {
    dashboard:    { mod: () => DashboardMod.init(),    title: 'Tableau de bord', subtitle: 'Vue d\'ensemble de votre établissement' },
    eleves:       { mod: () => ElevesMod.init(),       title: 'Élèves',          subtitle: 'Gestion des élèves inscrits' },
    classes:      { mod: () => ClassesMod.init(),      title: 'Classes',         subtitle: 'Organisation des classes' },
    professeurs:  { mod: () => ProfesseursMod.init(),  title: 'Professeurs',     subtitle: 'Corps enseignant' },
    notes:        { mod: () => NotesMod.init(),        title: 'Notes & Bulletins', subtitle: 'Évaluation et bulletins scolaires' },
    absences:     { mod: () => AbsencesMod.init(),     title: 'Absences',        subtitle: 'Suivi des présences' },
    emploi:       { mod: () => EmploiMod.init(),       title: 'Emploi du temps', subtitle: 'Planning hebdomadaire' },
    paiements:    { mod: () => PaiementsMod.init(),    title: 'Paiements',       subtitle: 'Gestion financière des scolarités' },
    depenses:     { mod: () => DepensesMod.init(),     title: 'Dépenses',        subtitle: 'Suivi des dépenses de l\'établissement' },
    annonces:     { mod: () => AnnoncesMod.init(),     title: 'Annonces',        subtitle: 'Communications internes' },
    parametres:   { mod: () => initParametres(),       title: 'Paramètres',      subtitle: 'Configuration de votre compte' },
  };

  // Navigation
  window.navigateTo = function(section) {
    // Masquer toutes les vues
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

    // Afficher la vue cible
    const view = document.getElementById(`view-${section}`);
    if (view) view.style.display = 'block';

    // Mettre à jour le menu actif
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Mettre à jour le header
    if (moduleMap[section]) {
      if (headerTitle) headerTitle.textContent = moduleMap[section].title;
      if (headerSubtitle) headerSubtitle.textContent = moduleMap[section].subtitle;
    }

    // Fermer sidebar sur mobile
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth < 768 && sidebar) {
      sidebar.classList.remove('open');
    }

    // Initialiser le module
    if (moduleMap[section]) {
      moduleMap[section].mod();
    }

    // Sauvegarder la section active
    localStorage.setItem('mt_active_section', section);
  };

  // Bind nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) navigateTo(section);
    });
  });

  // Sidebar toggle mobile
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (sidebarOverlay) sidebarOverlay.classList.toggle('visible');
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('visible');
    });
  }

  // Logout
  window.logout = async function() {
    try { await api.post('/auth/logout', {}); } catch(e) {}
    window.location.href = '/login.html';
  };

  // Paramètres
  function initParametres() {
    const view = document.getElementById('view-parametres');
    if (!view) return;
    view.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-title">⚙️ Paramètres</h2>
          <p class="view-subtitle">Configuration de votre compte</p>
        </div>
      </div>
      <div style="display:grid;gap:1.5rem;max-width:640px">
        <div class="card">
          <div class="card-body">
            <h3 style="margin-bottom:1rem;font-weight:600">Informations de l'établissement</h3>
            <div class="form-group">
              <label>Nom de l'école</label>
              <input type="text" id="settings-school" class="form-input" value="${user.school_name || ''}">
            </div>
            <button class="btn btn-primary" onclick="saveSchool()">Enregistrer</button>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <h3 style="margin-bottom:1rem;font-weight:600">Changer le mot de passe</h3>
            <div class="form-group">
              <label>Ancien mot de passe</label>
              <input type="password" id="settings-old-pw" class="form-input" placeholder="Ancien mot de passe">
            </div>
            <div class="form-group">
              <label>Nouveau mot de passe</label>
              <input type="password" id="settings-new-pw" class="form-input" placeholder="Nouveau mot de passe">
            </div>
            <button class="btn btn-primary" onclick="savePassword()">Changer</button>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <h3 style="margin-bottom:1rem;font-weight:600">Compte</h3>
            <p style="color:var(--text-secondary);margin-bottom:1rem">Connecté en tant que <strong>${user.email}</strong></p>
            <button class="btn btn-danger" onclick="logout()">Se déconnecter</button>
          </div>
        </div>
      </div>
    `;
  }

  window.saveSchool = async function() {
    const name = document.getElementById('settings-school').value.trim();
    if (!name) return showToast('Nom requis', 'error');
    try {
      await api.put('/auth/school', { school_name: name });
      user.school_name = name;
      if (schoolNameEl) schoolNameEl.textContent = name;
      showToast('École mise à jour', 'success');
    } catch(e) { showToast('Erreur', 'error'); }
  };

  window.savePassword = async function() {
    const old_password = document.getElementById('settings-old-pw').value;
    const new_password = document.getElementById('settings-new-pw').value;
    if (!old_password || !new_password) return showToast('Remplir les deux champs', 'error');
    if (new_password.length < 6) return showToast('Mot de passe trop court (6 min)', 'error');
    try {
      await api.put('/auth/password', { old_password, new_password });
      showToast('Mot de passe changé', 'success');
      document.getElementById('settings-old-pw').value = '';
      document.getElementById('settings-new-pw').value = '';
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
  };

  // Démarrer sur la dernière section ou dashboard
  const lastSection = localStorage.getItem('mt_active_section') || 'dashboard';
  navigateTo(lastSection);

})();
