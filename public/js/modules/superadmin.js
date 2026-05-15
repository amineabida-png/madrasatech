// ── SUPER ADMIN MODULE ────────────────────────────────────────
window.SuperAdminMod = (() => {
  let clients = [];

  async function init() {
    const view = document.getElementById('view-superadmin');
    if (!view) return;
    view.innerHTML = `<div class="sa-loading">⏳ Chargement...</div>`;
    try {
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) {
      view.innerHTML = `<div class="sa-error">❌ Accès refusé — Super Admin uniquement</div>`;
    }
  }

  function planExpireInfo(c) {
    if (!c.plan_expires) return { label: 'Non définie', cls: 'badge-rose', icon: '❌', pct: 0 };
    if (c.plan_expires === '9999-12-31') return { label: 'À vie', cls: 'badge-green', icon: '♾️', pct: 100 };
    const now = new Date(), exp = new Date(c.plan_expires);
    const diff = Math.ceil((exp - now) / 86400000);
    if (diff < 0) return { label: 'Expirée', cls: 'badge-rose', icon: '❌', pct: 0 };
    if (diff <= 1) return { label: diff === 0 ? 'Expire aujourd\'hui' : diff + 'j restant', cls: 'badge-rose', icon: '🔴', pct: 5 };
    if (diff <= 7) return { label: diff + 'j restants', cls: 'badge-amber', icon: '⚠️', pct: 20 };
    if (diff <= 30) return { label: diff + 'j restants', cls: 'badge-amber', icon: '🟡', pct: 50 };
    return { label: diff + 'j restants', cls: 'badge-green', icon: '✅', pct: 90 };
  }

  function render() {
    const view = document.getElementById('view-superadmin');
    if (!view) return;

    const total    = clients.length;
    const actifs   = clients.filter(c => c.plan_expires && (c.plan_expires === '9999-12-31' || new Date(c.plan_expires) > new Date())).length;
    const expires7 = clients.filter(c => { if (!c.plan_expires || c.plan_expires === '9999-12-31') return false; const d = Math.ceil((new Date(c.plan_expires)-new Date())/86400000); return d >= 0 && d <= 7; }).length;
    const expired  = clients.filter(c => c.plan_expires && c.plan_expires !== '9999-12-31' && new Date(c.plan_expires) < new Date()).length;
    const lifetime = clients.filter(c => c.plan_expires === '9999-12-31').length;

    view.innerHTML = `
    <div class="sa-wrapper">
      <!-- Header -->
      <div class="sa-header">
        <div class="sa-header-left">
          <div class="sa-crown">👑</div>
          <div>
            <h1 class="sa-title">Super Admin</h1>
            <p class="sa-subtitle">Gestion des licences & clients MadrasaTech</p>
          </div>
        </div>
        <button class="sa-btn-new" onclick="SuperAdminMod.addClient()">
          <span>+</span> Nouveau client
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="sa-kpi-grid">
        <div class="sa-kpi sa-kpi-blue">
          <div class="sa-kpi-icon">👥</div>
          <div class="sa-kpi-val">${total}</div>
          <div class="sa-kpi-label">Clients total</div>
        </div>
        <div class="sa-kpi sa-kpi-green">
          <div class="sa-kpi-icon">✅</div>
          <div class="sa-kpi-val">${actifs}</div>
          <div class="sa-kpi-label">Licences actives</div>
        </div>
        <div class="sa-kpi sa-kpi-purple">
          <div class="sa-kpi-icon">♾️</div>
          <div class="sa-kpi-val">${lifetime}</div>
          <div class="sa-kpi-label">À vie</div>
        </div>
        <div class="sa-kpi sa-kpi-amber">
          <div class="sa-kpi-icon">⚠️</div>
          <div class="sa-kpi-val">${expires7}</div>
          <div class="sa-kpi-label">Expirent sous 7j</div>
        </div>
        <div class="sa-kpi sa-kpi-rose">
          <div class="sa-kpi-icon">❌</div>
          <div class="sa-kpi-val">${expired}</div>
          <div class="sa-kpi-label">Expirées</div>
        </div>
      </div>

      <!-- Clients List -->
      <div class="sa-clients">
        ${clients.length === 0
          ? `<div class="sa-empty">Aucun client pour l'instant.<br>Créez votre premier client ↑</div>`
          : clients.map(c => renderClient(c)).join('')
        }
      </div>
    </div>

    <!-- Modal -->
    <div id="sa-modal" class="sa-modal-overlay" style="display:none" onclick="if(event.target===this)SuperAdminMod.closeModal()">
      <div class="sa-modal">
        <div class="sa-modal-header">
          <h3 id="sa-modal-title">Nouveau client</h3>
          <button class="sa-modal-close" onclick="SuperAdminMod.closeModal()">✕</button>
        </div>
        <div class="sa-modal-body" id="sa-modal-body"></div>
      </div>
    </div>
    `;
  }

  function renderClient(c) {
    const info = planExpireInfo(c);
    const created = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-MA') : '—';
    const lastLogin = c.last_login ? new Date(c.last_login).toLocaleDateString('fr-MA') : 'Jamais';
    const initiale = (c.school || c.email || 'C').charAt(0).toUpperCase();
    const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899'];
    const color = colors[c.id % colors.length];

    return `
    <div class="sa-client-card">
      <div class="sa-client-left">
        <div class="sa-client-avatar" style="background:${color}">${initiale}</div>
        <div class="sa-client-info">
          <div class="sa-client-school">${c.school || 'École sans nom'}</div>
          <div class="sa-client-email">📧 ${c.email}</div>
          <div class="sa-client-meta">
            <span>📅 Créé le ${created}</span>
            <span>🔐 Dernière connexion: ${lastLogin}</span>
          </div>
        </div>
      </div>

      <div class="sa-client-middle">
        <div class="sa-license-box">
          <div class="sa-license-status">
            <span class="sa-status-icon">${info.icon}</span>
            <span class="sa-badge ${info.cls}">${info.label}</span>
          </div>
          <div class="sa-license-bar">
            <div class="sa-license-fill" style="width:${info.pct}%"></div>
          </div>
          <div class="sa-license-date">
            ${c.plan_expires === '9999-12-31' ? '♾️ Licence permanente' : c.plan_expires ? 'Expire le ' + new Date(c.plan_expires).toLocaleDateString('fr-MA') : 'Aucune licence'}
          </div>
        </div>
      </div>

      <div class="sa-client-right">
        <div class="sa-actions-label">Activer la licence :</div>
        <div class="sa-action-btns">
          <button class="sa-act-btn sa-act-test"  onclick="SuperAdminMod.activate(${c.id},'test')" title="Test 24 heures">⏱ 24h</button>
          <button class="sa-act-btn sa-act-30j"   onclick="SuperAdminMod.activate(${c.id},'30j')"  title="30 jours">📅 30j</button>
          <button class="sa-act-btn sa-act-1an"   onclick="SuperAdminMod.activate(${c.id},'1an')"  title="1 an">📆 1an</button>
          <button class="sa-act-btn sa-act-vie"   onclick="SuperAdminMod.activate(${c.id},'vie')"  title="À vie">♾️ Vie</button>
        </div>
        <button class="sa-delete-btn" onclick="SuperAdminMod.deleteClient(${c.id})">🗑 Supprimer</button>
      </div>
    </div>
    `;
  }

  async function activate(id, duree) {
    const labels = { test:'24 heures', '30j':'30 jours', '1an':'1 an', vie:'À vie' };
    const client = clients.find(c => c.id === id);
    if (!window.confirm(`Activer la licence "${labels[duree]}" pour ${client?.school || 'ce client'} ?`)) return;
    try {
      await api.post('/superadmin/activate', { user_id: id, duree });
      showToast(`✅ Licence "${labels[duree]}" activée !`, 'success');
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
  }

  async function deleteClient(id) {
    const client = clients.find(c => c.id === id);
    if (!window.confirm(`Supprimer "${client?.school || 'ce client'}" ? Action irréversible !`)) return;
    try {
      await api.delete('/superadmin/clients/' + id);
      showToast('Client supprimé', 'success');
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message || 'Erreur', 'error'); }
  }

  function addClient() {
    document.getElementById('sa-modal-title').textContent = '➕ Nouveau client';
    document.getElementById('sa-modal-body').innerHTML = `
      <div class="sa-form">
        <div class="sa-form-group">
          <label>🏫 Nom de l'école *</label>
          <input type="text" id="sa-school" class="sa-input" placeholder="Ex: École Al Amal, Lycée Ibn Khaldoun...">
        </div>
        <div class="sa-form-group">
          <label>📧 Email administrateur *</label>
          <input type="email" id="sa-email" class="sa-input" placeholder="admin@ecole.ma">
        </div>
        <div class="sa-form-group">
          <label>🔒 Mot de passe *</label>
          <input type="password" id="sa-password" class="sa-input" placeholder="Minimum 6 caractères">
        </div>
        <div class="sa-form-group">
          <label>📋 Plan initial</label>
          <div class="sa-plan-grid">
            <label class="sa-plan-opt">
              <input type="radio" name="sa-plan" value="test"> <span class="sa-plan-card sa-plan-test">⏱<br><strong>24h</strong><br><small>Test gratuit</small></span>
            </label>
            <label class="sa-plan-opt">
              <input type="radio" name="sa-plan" value="30j"> <span class="sa-plan-card sa-plan-30j">📅<br><strong>30 jours</strong><br><small>Mensuel</small></span>
            </label>
            <label class="sa-plan-opt">
              <input type="radio" name="sa-plan" value="1an" checked> <span class="sa-plan-card sa-plan-1an sa-plan-selected">📆<br><strong>1 an</strong><br><small>Annuel</small></span>
            </label>
            <label class="sa-plan-opt">
              <input type="radio" name="sa-plan" value="vie"> <span class="sa-plan-card sa-plan-vie">♾️<br><strong>À vie</strong><br><small>Permanent</small></span>
            </label>
          </div>
        </div>
        <div class="sa-modal-footer">
          <button class="sa-btn-cancel" onclick="SuperAdminMod.closeModal()">Annuler</button>
          <button class="sa-btn-create" onclick="SuperAdminMod.saveClient()">✅ Créer le client</button>
        </div>
      </div>
    `;
    // Highlight selected plan
    document.querySelectorAll('input[name="sa-plan"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('.sa-plan-card').forEach(c => c.classList.remove('sa-plan-selected'));
        r.nextElementSibling.classList.add('sa-plan-selected');
      });
    });
    document.getElementById('sa-modal').style.display = 'flex';
  }

  async function saveClient() {
    const school    = document.getElementById('sa-school').value.trim();
    const email     = document.getElementById('sa-email').value.trim();
    const password  = document.getElementById('sa-password').value;
    const planRadio = document.querySelector('input[name="sa-plan"]:checked');
    const plan      = planRadio ? planRadio.value : '1an';

    if (!school || !email || !password) return showToast('Tous les champs sont requis', 'error');
    if (password.length < 6) return showToast('Mot de passe minimum 6 caractères', 'error');
    if (!email.includes('@')) return showToast('Email invalide', 'error');

    try {
      await api.post('/superadmin/clients', { school, email, password, plan });
      showToast(`✅ Client "${school}" créé avec succès !`, 'success');
      closeModal();
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message || 'Erreur création', 'error'); }
  }

  function closeModal() {
    const m = document.getElementById('sa-modal');
    if (m) m.style.display = 'none';
  }

  return { init, activate, deleteClient, addClient, saveClient, closeModal };
})();
