// ── SUPER ADMIN MODULE ────────────────────────────────────────
window.SuperAdminMod = (() => {
  let clients = [];

  async function init() {
    const view = document.getElementById('view-superadmin');
    if (!view) return;
    view.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--muted)">⏳ Chargement...</div>`;
    try {
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) {
      view.innerHTML = `<div style="text-align:center;padding:3rem;color:red">❌ Accès refusé</div>`;
    }
  }

  function render() {
    const view = document.getElementById('view-superadmin');
    if (!view) return;
    const total   = clients.length;
    const actifs  = clients.filter(c => c.plan_expires && new Date(c.plan_expires) > new Date()).length;
    const expires = clients.filter(c => c.plan_expires && new Date(c.plan_expires) < new Date(Date.now()+7*24*3600*1000) && new Date(c.plan_expires) > new Date()).length;

    view.innerHTML = `
      <div class="view-header">
        <div><h2 class="view-title">👑 Super Admin</h2><p class="view-subtitle">Gestion des licences clients</p></div>
        <button class="btn btn-primary" onclick="SuperAdminMod.addClient()">+ Nouveau client</button>
      </div>

      <div class="stats-grid" style="margin-bottom:1.5rem">
        <div class="stat-card"><div class="stat-icon" style="background:#e0f2fe">👥</div><div><div class="stat-value">${total}</div><div class="stat-label">Clients total</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#dcfce7">✅</div><div><div class="stat-value">${actifs}</div><div class="stat-label">Licences actives</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fef9c3">⚠️</div><div><div class="stat-value">${expires}</div><div class="stat-label">Expirent bientôt</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:#fce7f3">❌</div><div><div class="stat-value">${total-actifs}</div><div class="stat-label">Expirées</div></div></div>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="table">
            <thead><tr>
              <th>École</th><th>Email</th><th>Plan</th><th>Expiration</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${clients.map(c => renderRow(c)).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted)">Aucun client</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal client -->
      <div id="sa-modal" class="modal-overlay" style="display:none">
        <div class="modal" style="max-width:500px">
          <div class="modal-header">
            <h3 id="sa-modal-title">Nouveau client</h3>
            <button class="modal-close" onclick="SuperAdminMod.closeModal()">✕</button>
          </div>
          <div class="modal-body" id="sa-modal-body"></div>
        </div>
      </div>
    `;
  }

  function renderRow(c) {
    const now = new Date();
    const exp = c.plan_expires ? new Date(c.plan_expires) : null;
    const isVie = c.plan_expires === '9999-12-31';
    let statut, statusClass;
    if (isVie) { statut = '♾️ À vie'; statusClass = 'badge-green'; }
    else if (!exp || exp < now) { statut = '❌ Expirée'; statusClass = 'badge-rose'; }
    else if (exp < new Date(now.getTime()+7*24*3600*1000)) { statut = '⚠️ Bientôt'; statusClass = 'badge-amber'; }
    else { statut = '✅ Active'; statusClass = 'badge-green'; }

    const expLabel = isVie ? 'À vie' : exp ? exp.toLocaleDateString('fr-MA') : 'Non définie';

    return `<tr>
      <td><strong>${c.school||'—'}</strong></td>
      <td>${c.email}</td>
      <td><span class="badge badge-blue">${c.plan||'free'}</span></td>
      <td>${expLabel}</td>
      <td><span class="badge ${statusClass}">${statut}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="SuperAdminMod.activate(${c.id},'test')">⏱ 24h</button>
          <button class="btn btn-sm btn-secondary" onclick="SuperAdminMod.activate(${c.id},'30j')">📅 30j</button>
          <button class="btn btn-sm btn-primary"   onclick="SuperAdminMod.activate(${c.id},'1an')">📆 1an</button>
          <button class="btn btn-sm btn-success"   onclick="SuperAdminMod.activate(${c.id},'vie')">♾️ Vie</button>
          <button class="btn btn-sm btn-danger"    onclick="SuperAdminMod.deleteClient(${c.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  }

  async function activate(id, duree) {
    const labels = { test:'24 heures', '30j':'30 jours', '1an':'1 an', vie:'À vie' };
    if (!window.confirm(`Activer la licence "${labels[duree]}" pour ce client ?`)) return;
    try {
      await api.post(`/superadmin/activate`, { user_id: id, duree });
      showToast(`Licence ${labels[duree]} activée ✅`, 'success');
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  async function deleteClient(id) {
    if (!window.confirm('Supprimer ce client ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/superadmin/clients/${id}`);
      showToast('Client supprimé', 'success');
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  function addClient() {
    document.getElementById('sa-modal-title').textContent = 'Nouveau client';
    document.getElementById('sa-modal-body').innerHTML = `
      <div class="form-group"><label>Nom de l'école *</label><input type="text" id="sa-school" class="form-input" placeholder="Ex: École Al Amal"></div>
      <div class="form-group"><label>Email *</label><input type="email" id="sa-email" class="form-input" placeholder="admin@ecole.ma"></div>
      <div class="form-group"><label>Mot de passe *</label><input type="password" id="sa-password" class="form-input" placeholder="Minimum 6 caractères"></div>
      <div class="form-group"><label>Plan initial</label>
        <select id="sa-plan" class="form-input">
          <option value="test">Test 24h</option>
          <option value="30j">30 jours</option>
          <option value="1an" selected>1 an</option>
          <option value="vie">À vie</option>
        </select>
      </div>
      <div class="modal-footer" style="margin-top:1rem">
        <button class="btn btn-secondary" onclick="SuperAdminMod.closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="SuperAdminMod.saveClient()">Créer le client</button>
      </div>`;
    document.getElementById('sa-modal').style.display = 'flex';
  }

  async function saveClient() {
    const school   = document.getElementById('sa-school').value.trim();
    const email    = document.getElementById('sa-email').value.trim();
    const password = document.getElementById('sa-password').value;
    const plan     = document.getElementById('sa-plan').value;
    if (!school || !email || !password) return showToast('Tous les champs sont requis', 'error');
    if (password.length < 6) return showToast('Mot de passe trop court', 'error');
    try {
      await api.post('/superadmin/clients', { school, email, password, plan });
      showToast('Client créé avec succès ✅', 'success');
      closeModal();
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  function closeModal() {
    const m = document.getElementById('sa-modal');
    if (m) m.style.display = 'none';
  }

  return { init, activate, deleteClient, addClient, saveClient, closeModal };
})();
