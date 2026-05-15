// ══════════════════════════════════════════════════════════════
// MODULE UTILISATEURS — Gestion des comptes par rôle
// ══════════════════════════════════════════════════════════════
async function loadUtilisateurs() {
  const v = document.getElementById('view-utilisateurs');
  if (!v) return;
  v.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--muted)">⏳ Chargement...</div>`;

  try {
    const data = await api.get('/school-users');
    renderUtilisateurs(data);
  } catch(e) {
    v.innerHTML = `<div style="padding:3rem;text-align:center;color:#ef4444">❌ ${e.message}</div>`;
  }
}

function renderUtilisateurs(data) {
  const v = document.getElementById('view-utilisateurs');
  if (!v) return;
  const { users, counts, limits } = data;

  const roles = [
    { key:'admin_ecole', label:'Administrateurs', icon:'🛡️', color:'#6366f1', limit:10,    desc:'Accès complet à la gestion de l\'école' },
    { key:'professeur',  label:'Professeurs',     icon:'👨‍🏫', color:'#0ea5e9', limit:null,  desc:'Accès aux notes, absences et emploi du temps' },
    { key:'parent',      label:'Parents d\'élèves',icon:'👨‍👩‍👧', color:'#10b981', limit:null,  desc:'Consultation des bulletins et absences de leurs enfants' },
  ];

  const activeFilter = window._usersFilter || 'tous';

  v.innerHTML = `
  <div class="page-header">
    <div>
      <div class="page-title">👥 Gestion des utilisateurs</div>
      <div class="page-sub">Créez et gérez les comptes de votre établissement</div>
    </div>
    <button class="btn btn-primary" onclick="modalUser()">+ Nouvel utilisateur</button>
  </div>

  <!-- KPI par rôle -->
  <div class="usr-kpi-grid">
    ${roles.map(r => {
      const count = counts[r.key] || 0;
      const pct   = r.limit ? Math.round(count/r.limit*100) : null;
      const warn  = r.limit && count >= r.limit;
      return `
      <div class="usr-kpi-card" style="border-top:3px solid ${r.color}">
        <div class="usr-kpi-top">
          <span class="usr-kpi-icon">${r.icon}</span>
          <span class="usr-kpi-count" style="color:${r.color}">${count}</span>
        </div>
        <div class="usr-kpi-label">${r.label}</div>
        <div class="usr-kpi-desc">${r.desc}</div>
        ${r.limit ? `
          <div class="usr-kpi-bar-wrap">
            <div class="usr-kpi-bar" style="background:#f1f5f9">
              <div style="height:100%;width:${pct}%;background:${warn?'#ef4444':r.color};border-radius:99px;transition:width .4s"></div>
            </div>
            <span class="usr-kpi-quota ${warn?'usr-kpi-warn':''}">${count}/${r.limit}</span>
          </div>
          ${warn?`<div class="usr-limit-badge">⚠️ Limite atteinte</div>`:''}
        ` : `<div class="usr-kpi-unlimited">∞ Illimité</div>`}
      </div>`;
    }).join('')}
  </div>

  <!-- Filtres + recherche -->
  <div class="usr-toolbar">
    <div class="usr-filters">
      ${['tous','admin_ecole','professeur','parent'].map(f => {
        const labels = {tous:'Tous',admin_ecole:'🛡️ Admins',professeur:'👨‍🏫 Profs',parent:'👨‍👩‍👧 Parents'};
        return `<button class="usr-filter-btn ${activeFilter===f?'active':''}" onclick="filterUsers('${f}')">${labels[f]}</button>`;
      }).join('')}
    </div>
    <input type="text" class="usr-search" id="usr-search" placeholder="🔍 Rechercher..." oninput="searchUsers(this.value)">
  </div>

  <!-- Table utilisateurs -->
  <div class="card">
    <div class="table-wrap">
      <table id="usr-table">
        <thead><tr>
          <th>Utilisateur</th>
          <th>Rôle</th>
          <th>Email</th>
          <th>Téléphone</th>
          <th>Statut</th>
          <th>Dernière connexion</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="usr-tbody">
          ${renderUserRows(users, activeFilter)}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal -->
  <div class="modal-backdrop" id="usr-modal" onclick="if(event.target===this)closeUserModal()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;align-items:center;justify-content:center">
    <div class="modal-box" id="usr-modal-box" style="max-width:520px">
      <div class="modal-header">
        <h3 id="usr-modal-title">Nouvel utilisateur</h3>
        <button class="modal-close" onclick="closeUserModal()">✕</button>
      </div>
      <div class="modal-body" id="usr-modal-body"></div>
    </div>
  </div>
  `;

  // Store data globally for filter/search
  window._usersData = data;
}

function renderUserRows(users, filter='tous') {
  const roleMeta = {
    admin_ecole: { label:'Admin',     badge:'badge-purple', icon:'🛡️' },
    professeur:  { label:'Professeur',badge:'badge-blue',   icon:'👨‍🏫' },
    parent:      { label:'Parent',    badge:'badge-green',  icon:'👨‍👩‍👧' },
  };
  const filtered = users.filter(u => filter==='tous' || u.role===filter);
  if (!filtered.length) return `<tr><td colspan="7"><div class="empty"><div class="empty-ico">👥</div><div class="empty-title">Aucun utilisateur${filter!=='tous'?' dans cette catégorie':''}</div></div></td></tr>`;

  return filtered.map(u => {
    const m = roleMeta[u.role] || { label:u.role, badge:'badge-gray', icon:'👤' };
    const initiale = ((u.prenom||'').charAt(0)+(u.nom||'').charAt(0)).toUpperCase();
    const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString('fr-MA') : 'Jamais';
    return `
    <tr data-role="${u.role}" data-name="${(u.prenom+' '+u.nom).toLowerCase()}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar ${u.actif?'av-blue':'av-gray'}" style="width:36px;height:36px;font-size:13px">${initiale}</div>
          <div><strong>${u.prenom} ${u.nom}</strong></div>
        </div>
      </td>
      <td><span class="badge ${m.badge}">${m.icon} ${m.label}</span></td>
      <td><a href="mailto:${u.email}" style="color:var(--primary)">${u.email}</a></td>
      <td>${u.telephone||'—'}</td>
      <td>${u.actif
        ? '<span class="badge badge-green">✅ Actif</span>'
        : '<span class="badge badge-rose">❌ Inactif</span>'}</td>
      <td style="color:var(--muted);font-size:12px">${lastLogin}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" onclick="modalEditUser(${u.id})" title="Modifier">✏️</button>
          <button class="btn btn-sm btn-ghost" onclick="modalResetUserPw(${u.id},'${u.prenom} ${u.nom}')" title="Réinitialiser MDP">🔑</button>
          <button class="btn btn-sm ${u.actif?'btn-ghost':'btn-primary'}" onclick="toggleUserActif(${u.id},${u.actif?0:1})" title="${u.actif?'Désactiver':'Activer'}">
            ${u.actif?'🚫':'✅'}
          </button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteUser(${u.id},'${u.prenom} ${u.nom}')" title="Supprimer">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterUsers(role) {
  window._usersFilter = role;
  document.querySelectorAll('.usr-filter-btn').forEach(b => {
    const f = b.textContent.includes('Tous')?'tous':b.textContent.includes('Admin')?'admin_ecole':b.textContent.includes('Prof')?'professeur':'parent';
    b.classList.toggle('active', f===role);
  });
  if (window._usersData) {
    document.getElementById('usr-tbody').innerHTML = renderUserRows(window._usersData.users, role);
  }
}

function searchUsers(q) {
  document.querySelectorAll('#usr-table tbody tr[data-name]').forEach(row => {
    row.style.display = (!q || row.dataset.name.includes(q.toLowerCase())) ? '' : 'none';
  });
}

// ── Modal Nouveau ─────────────────────────────────────────────
function modalUser() {
  document.getElementById('usr-modal-title').textContent = '➕ Nouvel utilisateur';
  const adminCount = (window._usersData?.counts?.admin_ecole || 0);
  const adminDisabled = adminCount >= 10;

  document.getElementById('usr-modal-body').innerHTML = `
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Prénom *</label><input class="form-control" id="u-prenom" placeholder="Prénom"></div>
    <div class="form-group"><label class="form-label">Nom *</label><input class="form-control" id="u-nom" placeholder="Nom"></div>
    <div class="form-group full"><label class="form-label">Email *</label><input type="email" class="form-control" id="u-email" placeholder="utilisateur@ecole.ma"></div>
    <div class="form-group"><label class="form-label">Téléphone</label><input class="form-control" id="u-tel" placeholder="06 XX XX XX XX"></div>
    <div class="form-group"><label class="form-label">Mot de passe *</label><input type="password" class="form-control" id="u-pw" placeholder="Minimum 6 caractères"></div>
    <div class="form-group full">
      <label class="form-label">Rôle *</label>
      <div class="usr-role-grid">
        <label class="usr-role-opt ${adminDisabled?'usr-role-disabled':''}">
          <input type="radio" name="u-role" value="admin_ecole" ${adminDisabled?'disabled':''}>
          <div class="usr-role-card" style="border-color:#6366f1">
            <div class="usr-role-icon" style="background:#eef2ff">🛡️</div>
            <div class="usr-role-name">Administrateur</div>
            <div class="usr-role-desc">Accès complet</div>
            <div class="usr-role-limit ${adminDisabled?'usr-limit-warn':''}">
              ${adminDisabled?'⚠️ Limite 10/10':'Max 10 par école'}
            </div>
          </div>
        </label>
        <label class="usr-role-opt">
          <input type="radio" name="u-role" value="professeur" checked>
          <div class="usr-role-card usr-role-selected" style="border-color:#0ea5e9">
            <div class="usr-role-icon" style="background:#f0f9ff">👨‍🏫</div>
            <div class="usr-role-name">Professeur</div>
            <div class="usr-role-desc">Notes & absences</div>
            <div class="usr-role-limit">∞ Illimité</div>
          </div>
        </label>
        <label class="usr-role-opt">
          <input type="radio" name="u-role" value="parent">
          <div class="usr-role-card" style="border-color:#10b981">
            <div class="usr-role-icon" style="background:#f0fdf4">👨‍👩‍👧</div>
            <div class="usr-role-name">Parent</div>
            <div class="usr-role-desc">Bulletins & absences</div>
            <div class="usr-role-limit">∞ Illimité</div>
          </div>
        </label>
      </div>
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeUserModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveUser(null)">Créer le compte</button>
  </div>`;

  // Role card selection
  document.querySelectorAll('input[name="u-role"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.usr-role-card').forEach(c => c.classList.remove('usr-role-selected'));
      if (!r.disabled) r.parentElement.querySelector('.usr-role-card').classList.add('usr-role-selected');
    });
  });

  document.getElementById('usr-modal').style.display = 'flex';
}

// ── Modal Édition ─────────────────────────────────────────────
function modalEditUser(id) {
  const u = window._usersData?.users.find(x => x.id===id);
  if (!u) return;
  document.getElementById('usr-modal-title').textContent = '✏️ Modifier l\'utilisateur';
  document.getElementById('usr-modal-body').innerHTML = `
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Prénom *</label><input class="form-control" id="u-prenom" value="${u.prenom}"></div>
    <div class="form-group"><label class="form-label">Nom *</label><input class="form-control" id="u-nom" value="${u.nom}"></div>
    <div class="form-group full"><label class="form-label">Email *</label><input type="email" class="form-control" id="u-email" value="${u.email}"></div>
    <div class="form-group"><label class="form-label">Téléphone</label><input class="form-control" id="u-tel" value="${u.telephone||''}"></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeUserModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveUser(${id})">Enregistrer</button>
  </div>`;
  document.getElementById('usr-modal').style.display = 'flex';
}

// ── Modal Reset MDP ───────────────────────────────────────────
function modalResetUserPw(id, name) {
  document.getElementById('usr-modal-title').textContent = '🔑 Réinitialiser mot de passe';
  document.getElementById('usr-modal-body').innerHTML = `
  <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;margin-bottom:16px;border-left:4px solid #6366f1">
    <strong>${name}</strong>
  </div>
  <div class="form-grid">
    <div class="form-group full"><label class="form-label">Nouveau mot de passe *</label>
      <input type="password" class="form-control" id="u-pw-new" placeholder="Minimum 6 caractères">
    </div>
    <div class="form-group full"><label class="form-label">Confirmer *</label>
      <input type="password" class="form-control" id="u-pw-conf" placeholder="Répétez le mot de passe">
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeUserModal()">Annuler</button>
    <button class="btn btn-primary" onclick="doResetUserPw(${id})">🔑 Réinitialiser</button>
  </div>`;
  document.getElementById('usr-modal').style.display = 'flex';
}

// ── Actions ───────────────────────────────────────────────────
async function saveUser(id) {
  const prenom = document.getElementById('u-prenom').value.trim();
  const nom    = document.getElementById('u-nom').value.trim();
  const email  = document.getElementById('u-email').value.trim();
  const tel    = document.getElementById('u-tel').value.trim();

  if (!prenom||!nom||!email) return showToast('Prénom, nom et email sont requis', 'error');

  if (!id) {
    const pw   = document.getElementById('u-pw').value;
    const roleR= document.querySelector('input[name="u-role"]:checked');
    const role = roleR ? roleR.value : 'professeur';
    if (!pw||pw.length<6) return showToast('Mot de passe minimum 6 caractères', 'error');
    try {
      await api.post('/school-users', { prenom, nom, email, password:pw, role, telephone:tel });
      showToast(`✅ Compte ${role==='admin_ecole'?'Admin':role==='professeur'?'Professeur':'Parent'} créé !`, 'success');
      closeUserModal();
      loadUtilisateurs();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  } else {
    try {
      await api.put('/school-users/'+id, { prenom, nom, email, telephone:tel });
      showToast('✅ Utilisateur modifié', 'success');
      closeUserModal();
      loadUtilisateurs();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }
}

async function doResetUserPw(id) {
  const pw   = document.getElementById('u-pw-new').value;
  const conf = document.getElementById('u-pw-conf').value;
  if (!pw||pw.length<6) return showToast('Mot de passe trop court', 'error');
  if (pw!==conf) return showToast('Les mots de passe ne correspondent pas', 'error');
  try {
    await api.put('/school-users/'+id+'/password', { password:pw });
    showToast('✅ Mot de passe réinitialisé', 'success');
    closeUserModal();
  } catch(e) { showToast(e.message||'Erreur', 'error'); }
}

async function toggleUserActif(id, actif) {
  try {
    await api.put('/school-users/'+id, { actif });
    showToast(actif?'✅ Compte activé':'🚫 Compte désactivé', 'success');
    loadUtilisateurs();
  } catch(e) { showToast(e.message||'Erreur', 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm(`Supprimer le compte de "${name}" ? Cette action est irréversible.`)) return;
  try {
    await api.delete('/school-users/'+id);
    showToast('Compte supprimé', 'success');
    loadUtilisateurs();
  } catch(e) { showToast(e.message||'Erreur', 'error'); }
}

function closeUserModal() {
  document.getElementById('usr-modal').style.display = 'none';
}
