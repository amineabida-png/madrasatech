/* utils.js — Utilitaires MadrasaTech */

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg, type='ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const ico = type==='success'||type==='ok' ? '✅' : type==='error'||type==='err' ? '❌' : 'ℹ️';
  el.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
// alias
function toast(msg, type='ok') { showToast(msg, type==='err'?'error':type==='ok'?'success':type); }

// ── Modal ─────────────────────────────────────────────────────
function openModal(title, bodyHtml, large=false) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalBox').className = 'modal-box' + (large?' modal-lg':'');
  document.getElementById('modal').classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ── Formatage ─────────────────────────────────────────────────
function fmtDate(d) { if(!d) return '—'; try { return new Date(d).toLocaleDateString('fr-MA',{day:'2-digit',month:'2-digit',year:'numeric'}); } catch { return d; } }
function fmtMoney(n) { return Number(n||0).toLocaleString('fr-MA') + ' MAD'; }
function fmtNote(n) { const v=parseFloat(n); return isNaN(v)?'—':v.toFixed(2)+'/20'; }
function mention(n) {
  if(n>=16) return '<span class="badge badge-green">Excellent</span>';
  if(n>=14) return '<span class="badge badge-blue">Très Bien</span>';
  if(n>=12) return '<span class="badge badge-purple">Bien</span>';
  if(n>=10) return '<span class="badge badge-amber">Passable</span>';
  return '<span class="badge badge-rose">Insuffisant</span>';
}
function initials(nom, prenom='') { return ((prenom||'').charAt(0)+(nom||'').charAt(0)).toUpperCase(); }
const avColors = ['av-blue','av-green','av-amber','av-rose'];
function avColor(id) { return avColors[(id||0)%4]; }
function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') p.set(k,v); });
  const s = p.toString(); return s ? '?'+s : '';
}

// ── CSV export ────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if (!rows.length) return showToast('Aucune donnée à exporter', 'error');
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))];
  const blob = new Blob(['\ufeff'+lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  showToast('Export CSV réussi', 'success');
}

// ── Print ─────────────────────────────────────────────────────
function printZone(html) {
  const z = document.getElementById('print-zone');
  z.innerHTML = html; z.style.display = 'block'; window.print(); z.style.display = 'none'; z.innerHTML = '';
}

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

// ── Navigation ────────────────────────────────────────────────
let currentView = 'dashboard';
function nav(el) {
  event.preventDefault();
  const view = el.dataset.view;
  goView(view);
  if(window.innerWidth<=768) toggleSidebar();
}

function goView(view) {
  currentView = view;
  localStorage.setItem('mt_active_section', view);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-'+view);
  if (target) target.classList.add('active');
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view===view));
  const names = {dashboard:'Dashboard',eleves:'Élèves',classes:'Classes',professeurs:'Professeurs',notes:'Notes & Bulletins',absences:'Absences',emploi:'Emploi du temps',paiements:'Paiements',depenses:'Dépenses',annonces:'Annonces',utilisateurs:'Utilisateurs',facturation:'Facturation',devoirs:'Devoirs & Exercices','espace-eleve':'Mon Espace',messagerie:'Messagerie',calendrier:'Calendrier Scolaire',notifications:'Notifications',certificats:'Certificats & Documents',parametres:'Paramètres',superadmin:'Super Admin'};
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.textContent = names[view]||view;

  const loaders = {
    dashboard:   () => typeof loadDashboard   === 'function' && loadDashboard(),
    eleves:      () => typeof loadEleves      === 'function' && loadEleves(),
    classes:     () => typeof loadClasses     === 'function' && loadClasses(),
    professeurs: () => typeof loadProfesseurs === 'function' && loadProfesseurs(),
    notes:       () => typeof loadNotes       === 'function' && loadNotes(),
    absences:    () => typeof loadAbsences    === 'function' && loadAbsences(),
    emploi:      () => typeof loadEmploi      === 'function' && loadEmploi(),
    paiements:   () => typeof loadPaiements   === 'function' && loadPaiements(),
    depenses:    () => typeof loadDepenses    === 'function' && loadDepenses(),
    facturation: () => typeof loadFacturation === 'function' && loadFacturation(),
    annonces:    () => typeof AnnoncesMod !== 'undefined' ? AnnoncesMod.init() : typeof loadAnnonces === 'function' && loadAnnonces(),
    utilisateurs:  () => typeof loadUtilisateurs  === 'function' && loadUtilisateurs(),
    devoirs:       () => typeof loadDevoirs       === 'function' && loadDevoirs(),
    'espace-eleve':  () => typeof loadEspaceEleve   === 'function' && loadEspaceEleve(),
    messagerie:      () => typeof loadMessagerie    === 'function' && loadMessagerie(),
    calendrier:      () => typeof loadCalendrier    === 'function' && loadCalendrier(),
    notifications:   () => typeof loadNotifications === 'function' && loadNotifications(),
    certificats:     () => typeof loadCertificats   === 'function' && loadCertificats(),
    superadmin:  () => typeof SuperAdminMod   !== 'undefined' && SuperAdminMod.init(),
  };
  if(loaders[view]) loaders[view]();
}

// ── Recherche globale ─────────────────────────────────────────
let searchTimeout;
async function globalSearch() {
  clearTimeout(searchTimeout);
  const q = document.getElementById('globalSearch').value.trim();
  const results = document.getElementById('searchResults');
  if(q.length < 2) { results.classList.remove('show'); return; }
  searchTimeout = setTimeout(async () => {
    try {
      const eleves = await api.get('/eleves'+qs({search:q}));
      if(!eleves||!eleves.length) { results.innerHTML='<div class="search-item">Aucun résultat</div>'; results.classList.add('show'); return; }
      results.innerHTML = eleves.slice(0,6).map(e => `
        <div class="search-item" onclick="goView('eleves');document.getElementById('searchResults').classList.remove('show');document.getElementById('globalSearch').value=''">
          <div class="avatar av-blue">${initials(e.nom,e.prenom)}</div>
          <div><strong>${e.prenom} ${e.nom}</strong><br><small>${e.classe||'—'}</small></div>
        </div>`).join('');
      results.classList.add('show');
    } catch {}
  }, 300);
}
document.addEventListener('click', e => {
  const sr = document.getElementById('searchResults');
  if (sr && !e.target.closest('.search-wrap')) sr.classList.remove('show');
});

// ── Settings modal ────────────────────────────────────────────
function showSettings() {
  const schoolEl = document.getElementById('schoolName');
  const currentSchool = schoolEl ? schoolEl.textContent : '';
  openModal('⚙️ Paramètres', `
    <div class="settings-section">
      <div class="settings-title">Informations de l'établissement</div>
      <div class="form-group">
        <label class="form-label">Nom de l'école</label>
        <input class="form-control" id="settSchool" placeholder="Nom de l'école" value="${currentSchool}">
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-title">Changer le mot de passe</div>
      <div class="form-group"><label class="form-label">Mot de passe actuel</label><input type="password" class="form-control" id="settPwOld" placeholder="Actuel"></div>
      <div class="form-group" style="margin-top:8px"><label class="form-label">Nouveau mot de passe</label><input type="password" class="form-control" id="settPwNew" placeholder="Nouveau"></div>
      <div class="form-group" style="margin-top:8px"><label class="form-label">Confirmer</label><input type="password" class="form-control" id="settPwConf" placeholder="Confirmation"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveSettings()">Enregistrer</button>
    </div>
  `);
}

async function saveSettings() {
  const school = document.getElementById('settSchool').value.trim();
  const old = document.getElementById('settPwOld').value;
  const nw  = document.getElementById('settPwNew').value;
  const conf= document.getElementById('settPwConf').value;
  if (school) {
    try {
      await api.put('/auth/school', { school_name: school });
      const s1 = document.getElementById('schoolName'); if(s1) s1.textContent = school;
      const s2 = document.getElementById('topSchool');  if(s2) s2.textContent = school;
      showToast('École mise à jour','success');
    } catch(e) { showToast(e.message,'error'); }
  }
  if (old || nw) {
    if (nw !== conf) { showToast('Les mots de passe ne correspondent pas','error'); return; }
    try { await api.put('/auth/password', { current: old, nouveau: nw }); showToast('Mot de passe modifié','success'); closeModal(); }
    catch(e) { showToast(e.message,'error'); }
  } else { closeModal(); }
}

// ── Logout ────────────────────────────────────────────────────
async function logout() {
  if (!window.confirm('Déconnexion ?')) return;
  try { await api.post('/auth/logout', {}); } catch(e) {}
  localStorage.removeItem('mt_token');
  window.location.href = '/login.html';
}
