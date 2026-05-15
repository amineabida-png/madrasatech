// ── APP.JS — Init MadrasaTech ──────────────────────────────────
(async () => {
  // Auth check
  let user;
  try {
    user = await api.get('/auth/me');
    if (!user || !user.id) throw new Error('not auth');
  } catch(e) {
    localStorage.removeItem('mt_token');
    window.location.href = '/login.html';
    return;
  }
  window.currentUser = user;

  // Remplir infos sidebar
  const el = (id) => document.getElementById(id);
  if(el('schoolName')) el('schoolName').textContent = user.school || 'MadrasaTech';
  if(el('topSchool'))  el('topSchool').textContent  = user.school || 'MadrasaTech';
  if(el('sbUsername')) el('sbUsername').textContent = (user.prenom||'') + ' ' + (user.nom||user.email);
  if(el('sbAvatar'))   el('sbAvatar').textContent   = (user.prenom||user.email||'A').charAt(0).toUpperCase();
  if(el('sbPlan'))     el('sbPlan').textContent     = user.plan || 'Pro';

  // Ajouter lien Super Admin si superadmin
  if (user.role === 'superadmin') {
    const menu = document.querySelector('.sb-menu');
    if (menu) {
      menu.insertAdjacentHTML('beforeend', `
        <div class="sb-section">Administration</div>
        <a class="sb-link" href="#" data-view="superadmin" onclick="nav(this)">
          <span class="sb-ico">👑</span><span>Super Admin</span>
        </a>
      `);
    }
  }

  // Démarrer sur la dernière vue
  const lastView = localStorage.getItem('mt_active_section') || 'dashboard';
  goView(lastView);
})();
