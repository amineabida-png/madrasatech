// ── APP.JS — Init MadrasaTech ──────────────────────────────────
(async () => {
  const el = (id) => document.getElementById(id);

  // Auth check
  let user;
  try {
    const token = localStorage.getItem('mt_token');
    if (!token) throw new Error('no token');
    
    user = await api.get('/auth/me');
    if (!user || !user.id) throw new Error('invalid user');
  } catch(e) {
    localStorage.removeItem('mt_token');
    window.location.href = '/login.html';
    return;
  }

  window.currentUser = user;

  // Remplir infos sidebar
  if(el('schoolName')) el('schoolName').textContent = user.school || 'MadrasaTech';
  if(el('topSchool'))  el('topSchool').textContent  = user.school || 'MadrasaTech';
  if(el('sbUsername')) el('sbUsername').textContent = (user.prenom||'') + ' ' + (user.nom||user.email);
  if(el('sbAvatar'))   el('sbAvatar').textContent   = (user.prenom||user.email||'A').charAt(0).toUpperCase();
  if(el('sbPlan'))     el('sbPlan').textContent     = user.plan || 'Pro';

  // Lien Super Admin
  if (user.role === 'superadmin') {
    const menu = document.querySelector('.sb-menu');
    if (menu && !document.querySelector('[data-view="superadmin"]')) {
      menu.insertAdjacentHTML('beforeend', `
        <div class="sb-section">Administration</div>
        <a class="sb-link" href="#" data-view="superadmin" onclick="nav(this)">
          <span class="sb-ico">👑</span><span>Super Admin</span>
        </a>
      `);
    }
  }

  // Démarrer — forcer reset des vues puis charger
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const lastView = localStorage.getItem('mt_active_section') || 'dashboard';
  goView(lastView);

})();
