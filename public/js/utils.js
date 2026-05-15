/* utils.js — Utilitaires MadrasaTech */

// Toast notifications
function toast(msg, type='ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const ico = type==='ok'?'✅':type==='err'?'❌':'ℹ️';
  el.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Modal
function openModal(title, bodyHtml, large=false) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalBox').className = 'modal-box' + (large?' modal-lg':'');
  document.getElementById('modal').classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// Format
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

// Avatar initials
function initials(nom, prenom='') {
  return ((prenom||'').charAt(0)+(nom||'').charAt(0)).toUpperCase();
}
const avColors = ['av-blue','av-green','av-amber','av-rose'];
function avColor(id) { return avColors[(id||0)%4]; }

// Confirm dialog
function confirm(msg) { return window.confirm(msg); }

// Build query string
function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') p.set(k,v); });
  const s = p.toString();
  return s ? '?'+s : '';
}

// CSV export
function exportCSV(rows, filename) {
  if (!rows.length) return toast('Aucune donnée à exporter', 'err');
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))];
  const blob = new Blob(['\ufeff'+lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast('Export CSV réussi', 'ok');
}

// Print
function printZone(html) {
  const z = document.getElementById('print-zone');
  z.innerHTML = html;
  z.style.display = 'block';
  window.print();
  z.style.display = 'none';
  z.innerHTML = '';
}

// Sidebar & nav
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

let currentView = 'dashboard';
function nav(el) {
  event.preventDefault();
  const view = el.dataset.view;
  goView(view);
  if(window.innerWidth<=768) toggleSidebar();
}

function goView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-'+view);
  if (target) target.classList.add('active');
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.view===view));
  const names = {dashboard:'Dashboard',eleves:'Élèves',classes:'Classes',professeurs:'Professeurs',notes:'Notes & Bulletins',absences:'Absences',emploi:'Emploi du temps',paiements:'Paiements',depenses:'Dépenses',annonces:'Annonces'};
  document.getElementById('breadcrumb').textContent = names[view]||view;
  // Load module
  const loaders = {dashboard:loadDashboard,eleves:loadEleves,classes:loadClasses,professeurs:loadProfesseurs,notes:loadNotes,absences:loadAbsences,emploi:loadEmploi,paiements:loadPaiements,depenses:loadDepenses,annonces:loadAnnonces};
  if(loaders[view]) loaders[view]();
}

// Global search
let searchTimeout;
async function globalSearch() {
  clearTimeout(searchTimeout);
  const q = document.getElementById('globalSearch').value.trim();
  const results = document.getElementById('searchResults');
  if(q.length < 2) { results.classList.remove('show'); return; }
  searchTimeout = setTimeout(async () => {
    try {
      const eleves = await API.getEleves(qs({search:q}));
      if(!eleves||!eleves.length) { results.innerHTML='<div class="search-item">Aucun résultat</div>'; results.classList.add('show'); return; }
      results.innerHTML = eleves.slice(0,6).map(e => `
        <div class="search-item" onclick="goView('eleves');results.classList.remove('show');document.getElementById('globalSearch').value=''">
          <div class="avatar av-blue">${initials(e.nom,e.prenom)}</div>
          <div><strong>${e.prenom} ${e.nom}</strong><br><small style="color:var(--muted)">${e.classe||'—'} · ${e.massar||''}</small></div>
        </div>`).join('');
      results.classList.add('show');
    } catch {}
  }, 300);
}
document.addEventListener('click', e => { if(!e.target.closest('.search-wrap')) document.getElementById('searchResults').classList.remove('show'); });

// Settings modal
function showSettings() {
  openModal('⚙️ Paramètres', `
    <div class="settings-section">
      <div class="settings-title">Informations de l'établissement</div>
      <div class="form-group">
        <label class="form-label">Nom de l'école</label>
        <input class="form-control" id="settSchool" placeholder="Nom de l'école">
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
  document.getElementById('settSchool').value = document.getElementById('schoolName').textContent;
}

async function saveSettings() {
  const school = document.getElementById('settSchool').value.trim();
  const old = document.getElementById('settPwOld').value;
  const nw = document.getElementById('settPwNew').value;
  const conf = document.getElementById('settPwConf').value;
  
  if (school) {
    try { await API.updateSchool(school); document.getElementById('schoolName').textContent=school; document.getElementById('topSchool').textContent=school; toast('École mise à jour','ok'); } catch(e) { toast(e.message,'err'); }
  }
  if (old || nw) {
    if (nw !== conf) { toast('Les mots de passe ne correspondent pas','err'); return; }
    try { await API.changePassword(old, nw); toast('Mot de passe modifié','ok'); closeModal(); } catch(e) { toast(e.message,'err'); }
  } else { closeModal(); }
}

async function logout() {
  if (!confirm('Déconnexion ?')) return;
  await API.logout();
  window.location.href = '/login';
}
