// ── SUPER ADMIN MODULE ────────────────────────────────────────
window.SuperAdminMod = (() => {
  let clients = [];
  let demandes = [];
  let activeTab = 'clients';

  async function init() {
    const view = document.getElementById('view-superadmin');
    if (!view) return;
    view.innerHTML = `<div class="sa-loading">⏳ Chargement...</div>`;
    try {
      [clients, demandes] = await Promise.all([
        api.get('/superadmin/clients'),
        api.get('/superadmin/demandes')
      ]);
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
    if (diff < 0)  return { label: 'Expirée', cls: 'badge-rose', icon: '❌', pct: 0 };
    if (diff <= 1) return { label: diff + 'j restant', cls: 'badge-rose', icon: '🔴', pct: 5 };
    if (diff <= 7) return { label: diff + 'j restants', cls: 'badge-amber', icon: '⚠️', pct: 20 };
    if (diff <= 30)return { label: diff + 'j restants', cls: 'badge-amber', icon: '🟡', pct: 50 };
    return { label: diff + 'j restants', cls: 'badge-green', icon: '✅', pct: 90 };
  }

  function render() {
    const view = document.getElementById('view-superadmin');
    if (!view) return;

    const total    = clients.length;
    const actifs   = clients.filter(c => c.plan_expires && (c.plan_expires==='9999-12-31'||new Date(c.plan_expires)>new Date())).length;
    const expires7 = clients.filter(c => { if(!c.plan_expires||c.plan_expires==='9999-12-31') return false; const d=Math.ceil((new Date(c.plan_expires)-new Date())/86400000); return d>=0&&d<=7; }).length;
    const expired  = clients.filter(c => c.plan_expires&&c.plan_expires!=='9999-12-31'&&new Date(c.plan_expires)<new Date()).length;
    const lifetime = clients.filter(c => c.plan_expires==='9999-12-31').length;
    const pending  = demandes.filter(d => d.statut==='en_attente').length;

    view.innerHTML = `
    <div class="sa-wrapper">
      <div class="sa-header">
        <div class="sa-header-left">
          <div class="sa-crown">👑</div>
          <div>
            <h1 class="sa-title">Super Admin</h1>
            <p class="sa-subtitle">Gestion des licences & clients MadrasaTech</p>
          </div>
        </div>
        <button class="sa-btn-new" onclick="SuperAdminMod.addClient()">+ Nouveau client</button>
      </div>

      <!-- KPI -->
      <div class="sa-kpi-grid">
        <div class="sa-kpi sa-kpi-blue"><div class="sa-kpi-icon">👥</div><div class="sa-kpi-val">${total}</div><div class="sa-kpi-label">Clients</div></div>
        <div class="sa-kpi sa-kpi-green"><div class="sa-kpi-icon">✅</div><div class="sa-kpi-val">${actifs}</div><div class="sa-kpi-label">Actifs</div></div>
        <div class="sa-kpi sa-kpi-purple"><div class="sa-kpi-icon">♾️</div><div class="sa-kpi-val">${lifetime}</div><div class="sa-kpi-label">À vie</div></div>
        <div class="sa-kpi sa-kpi-amber"><div class="sa-kpi-icon">⚠️</div><div class="sa-kpi-val">${expires7}</div><div class="sa-kpi-label">Expirent 7j</div></div>
        <div class="sa-kpi sa-kpi-rose"><div class="sa-kpi-icon">❌</div><div class="sa-kpi-val">${expired}</div><div class="sa-kpi-label">Expirées</div></div>
        <div class="sa-kpi sa-kpi-orange" onclick="SuperAdminMod.switchTab('demandes')" style="cursor:pointer">
          <div class="sa-kpi-icon">📋</div>
          <div class="sa-kpi-val">${pending}</div>
          <div class="sa-kpi-label">Demandes test</div>
          ${pending>0?`<div class="sa-notif-dot"></div>`:''}
        </div>
      </div>

      <!-- Tabs -->
      <div class="sa-tabs">
        <button class="sa-tab ${activeTab==='clients'?'active':''}" onclick="SuperAdminMod.switchTab('clients')">👥 Clients (${total})</button>
        <button class="sa-tab ${activeTab==='demandes'?'active':''}" onclick="SuperAdminMod.switchTab('demandes')">
          📋 Demandes test (${demandes.length})
          ${pending>0?`<span class="sa-tab-badge">${pending}</span>`:''}
        </button>
      </div>

      <!-- Tab: Clients -->
      <div id="tab-clients" style="${activeTab==='clients'?'':'display:none'}">
        <div class="sa-clients">
          ${clients.length===0
            ? `<div class="sa-empty">Aucun client. Créez le premier ↑</div>`
            : clients.map(c => renderClient(c)).join('')}
        </div>
      </div>

      <!-- Tab: Demandes -->
      <div id="tab-demandes" style="${activeTab==='demandes'?'':'display:none'}">
        ${renderDemandes()}
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

  function switchTab(tab) {
    activeTab = tab;
    const tabs = ['clients','demandes'];
    tabs.forEach(t => {
      const el = document.getElementById('tab-'+t);
      if (el) el.style.display = t===tab ? '' : 'none';
    });
    document.querySelectorAll('.sa-tab').forEach((btn, i) => {
      btn.classList.toggle('active', tabs[i]===tab);
    });
  }

  function renderClient(c) {
    const info = planExpireInfo(c);
    const created = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-MA') : '—';
    const lastLogin = c.last_login ? new Date(c.last_login).toLocaleDateString('fr-MA') : 'Jamais';
    const initiale = (c.school||c.email||'C').charAt(0).toUpperCase();
    const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899'];
    const color = colors[c.id % colors.length];

    return `
    <div class="sa-client-card">
      <div class="sa-client-left">
        <div class="sa-client-avatar" style="background:${color}">${initiale}</div>
        <div class="sa-client-info">
          <div class="sa-client-school">${c.school||'École sans nom'}</div>
          <div class="sa-client-email">📧 ${c.email}</div>
          <div class="sa-client-meta">
            <span>📅 Créé le ${created}</span>
            <span>🔐 Connexion: ${lastLogin}</span>
          </div>
        </div>
      </div>
      <div class="sa-client-middle">
        <div class="sa-license-box">
          <div class="sa-license-status">
            <span class="sa-status-icon">${info.icon}</span>
            <span class="sa-badge ${info.cls}">${info.label}</span>
          </div>
          <div class="sa-license-bar"><div class="sa-license-fill" style="width:${info.pct}%"></div></div>
          <div class="sa-license-date">${c.plan_expires==='9999-12-31'?'♾️ Permanente':c.plan_expires?'Expire le '+new Date(c.plan_expires).toLocaleDateString('fr-MA'):'Aucune'}</div>
        </div>
      </div>
      <div class="sa-client-right">
        <div class="sa-actions-label">Activer licence :</div>
        <div class="sa-action-btns">
          <button class="sa-act-btn sa-act-test" onclick="SuperAdminMod.activate(${c.id},'test')" title="Test 24h">⏱ 24h</button>
          <button class="sa-act-btn sa-act-30j"  onclick="SuperAdminMod.activate(${c.id},'30j')"  title="30 jours">📅 30j</button>
          <button class="sa-act-btn sa-act-1an"  onclick="SuperAdminMod.activate(${c.id},'1an')"  title="1 an">📆 1an</button>
          <button class="sa-act-btn sa-act-vie"  onclick="SuperAdminMod.activate(${c.id},'vie')"  title="À vie">♾️ Vie</button>
        </div>
        <button class="sa-delete-btn" onclick="SuperAdminMod.deleteClient(${c.id})">🗑 Supprimer</button>
      </div>
    </div>`;
  }

  function renderDemandes() {
    if (!demandes.length) return `<div class="sa-empty">📋 Aucune demande de test reçue pour l'instant.</div>`;

    const statutColors = { en_attente:'badge-amber', traitee:'badge-green', refusee:'badge-rose' };
    const statutLabels = { en_attente:'⏳ En attente', traitee:'✅ Traitée', refusee:'❌ Refusée' };
    const nbEleves = { moins50:'< 50 élèves', '50-150':'50 à 150', '150-300':'150 à 300', plus300:'+ de 300' };

    return `
    <div class="sa-demandes">
      ${demandes.map(d => `
      <div class="sa-demande-card ${d.statut==='en_attente'?'sa-demande-pending':''}">
        <div class="sa-demande-top">
          <div class="sa-demande-school">🏫 ${d.ecole}</div>
          <span class="sa-badge ${statutColors[d.statut]||'badge-amber'}">${statutLabels[d.statut]||d.statut}</span>
        </div>
        <div class="sa-demande-grid">
          <div class="sa-demande-item"><span>👤 Contact</span><strong>${d.prenom} ${d.nom}</strong></div>
          <div class="sa-demande-item"><span>📧 Email</span><a href="mailto:${d.email}" style="color:#1a56db">${d.email}</a></div>
          <div class="sa-demande-item"><span>📞 Téléphone</span><a href="tel:${d.telephone}" style="color:#1a56db;font-weight:700">${d.telephone}</a></div>
          <div class="sa-demande-item"><span>📍 Ville</span><strong>${d.ville||'—'}</strong></div>
          <div class="sa-demande-item"><span>👨‍🎓 Élèves</span><strong>${nbEleves[d.nb_eleves]||d.nb_eleves||'—'}</strong></div>
          <div class="sa-demande-item"><span>📅 Reçue le</span><strong>${new Date(d.created_at).toLocaleDateString('fr-MA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</strong></div>
        </div>
        ${d.message?`<div class="sa-demande-msg">💬 "${d.message}"</div>`:''}
        <div class="sa-demande-actions">
          ${d.statut==='en_attente'?`
            <button class="sa-act-btn sa-act-1an" onclick="SuperAdminMod.activerDemande(${d.id},'test')">⏱ Activer 24h</button>
            <button class="sa-act-btn sa-act-30j" onclick="SuperAdminMod.activerDemande(${d.id},'30j')">📅 Activer 30j</button>
            <button class="sa-act-btn sa-act-vie" onclick="SuperAdminMod.refuserDemande(${d.id})">❌ Refuser</button>
          `:`
            <span style="font-size:12px;color:#94a3b8">Demande ${statutLabels[d.statut]||d.statut}</span>
          `}
          <button class="sa-delete-btn" onclick="SuperAdminMod.deleteDemande(${d.id})" style="margin-left:auto">🗑</button>
        </div>
      </div>`).join('')}
    </div>`;
  }

  async function activate(id, duree) {
    const labels = { test:'24 heures', '30j':'30 jours', '1an':'1 an', vie:'À vie' };
    const client = clients.find(c => c.id===id);
    if (!window.confirm(`Activer "${labels[duree]}" pour ${client?.school||'ce client'} ?`)) return;
    try {
      await api.post('/superadmin/activate', { user_id: id, duree });
      showToast(`✅ Licence "${labels[duree]}" activée !`, 'success');
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  async function activerDemande(demandeId, duree) {
    const d = demandes.find(x => x.id===demandeId);
    if (!d) return;
    if (!window.confirm(`Créer un compte test pour "${d.ecole}" (${d.email}) ?`)) return;
    try {
      // Créer le compte client
      await api.post('/superadmin/clients', {
        school: d.ecole, email: d.email, password: 'MadrasaTech2025!', plan: duree
      });
      // Marquer la demande comme traitée
      await api.put('/superadmin/demandes/'+demandeId, { statut: 'traitee' });
      showToast(`✅ Compte créé pour ${d.ecole} ! Mot de passe: MadrasaTech2025!`, 'success');
      [clients, demandes] = await Promise.all([api.get('/superadmin/clients'), api.get('/superadmin/demandes')]);
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  async function refuserDemande(demandeId) {
    if (!window.confirm('Refuser cette demande ?')) return;
    try {
      await api.put('/superadmin/demandes/'+demandeId, { statut: 'refusee' });
      showToast('Demande refusée', 'success');
      demandes = await api.get('/superadmin/demandes');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  async function deleteDemande(id) {
    if (!window.confirm('Supprimer cette demande ?')) return;
    try {
      await api.delete('/superadmin/demandes/'+id);
      showToast('Demande supprimée', 'success');
      demandes = await api.get('/superadmin/demandes');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  async function deleteClient(id) {
    const client = clients.find(c => c.id===id);
    if (!window.confirm(`Supprimer "${client?.school}" ? Irréversible !`)) return;
    try {
      await api.delete('/superadmin/clients/'+id);
      showToast('Client supprimé', 'success');
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  function addClient() {
    document.getElementById('sa-modal-title').textContent = '➕ Nouveau client';
    document.getElementById('sa-modal-body').innerHTML = `
      <div class="sa-form">
        <div class="sa-form-group"><label>🏫 Nom de l'école *</label><input type="text" id="sa-school" class="sa-input" placeholder="Ex: École Al Amal"></div>
        <div class="sa-form-group"><label>📧 Email administrateur *</label><input type="email" id="sa-email" class="sa-input" placeholder="admin@ecole.ma"></div>
        <div class="sa-form-group"><label>🔒 Mot de passe *</label><input type="password" id="sa-password" class="sa-input" placeholder="Minimum 6 caractères"></div>
        <div class="sa-form-group"><label>📋 Plan initial</label>
          <div class="sa-plan-grid">
            <label class="sa-plan-opt"><input type="radio" name="sa-plan" value="test"> <span class="sa-plan-card sa-plan-test">⏱<br><strong>24h</strong><br><small>Test</small></span></label>
            <label class="sa-plan-opt"><input type="radio" name="sa-plan" value="30j"> <span class="sa-plan-card sa-plan-30j">📅<br><strong>30j</strong><br><small>Mensuel</small></span></label>
            <label class="sa-plan-opt"><input type="radio" name="sa-plan" value="1an" checked> <span class="sa-plan-card sa-plan-1an sa-plan-selected">📆<br><strong>1 an</strong><br><small>Annuel</small></span></label>
            <label class="sa-plan-opt"><input type="radio" name="sa-plan" value="vie"> <span class="sa-plan-card sa-plan-vie">♾️<br><strong>Vie</strong><br><small>Permanent</small></span></label>
          </div>
        </div>
        <div class="sa-modal-footer">
          <button class="sa-btn-cancel" onclick="SuperAdminMod.closeModal()">Annuler</button>
          <button class="sa-btn-create" onclick="SuperAdminMod.saveClient()">✅ Créer le client</button>
        </div>
      </div>`;
    document.querySelectorAll('input[name="sa-plan"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('.sa-plan-card').forEach(c => c.classList.remove('sa-plan-selected'));
        r.nextElementSibling.classList.add('sa-plan-selected');
      });
    });
    document.getElementById('sa-modal').style.display = 'flex';
  }

  async function saveClient() {
    const school   = document.getElementById('sa-school').value.trim();
    const email    = document.getElementById('sa-email').value.trim();
    const password = document.getElementById('sa-password').value;
    const planR    = document.querySelector('input[name="sa-plan"]:checked');
    const plan     = planR ? planR.value : '1an';
    if (!school||!email||!password) return showToast('Tous les champs sont requis', 'error');
    if (password.length<6) return showToast('Mot de passe minimum 6 caractères', 'error');
    try {
      await api.post('/superadmin/clients', { school, email, password, plan });
      showToast(`✅ Client "${school}" créé !`, 'success');
      closeModal();
      clients = await api.get('/superadmin/clients');
      render();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  }

  function closeModal() {
    const m = document.getElementById('sa-modal');
    if (m) m.style.display = 'none';
  }

  return { init, activate, activerDemande, refuserDemande, deleteDemande, deleteClient, addClient, saveClient, closeModal, switchTab };
})();
