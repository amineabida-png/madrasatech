// ══════════════════════════════════════════════════════════════
// MODULE ANNONCES — Design Premium
// ══════════════════════════════════════════════════════════════
let _annonces = [];

async function loadAnnonces() {
  const v = document.getElementById('view-annonces');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    _annonces = await api.getAnnonces();
    renderAnnonces(_annonces);
  } catch(e) {
    v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`;
  }
}

function renderAnnonces(annonces) {
  const v = document.getElementById('view-annonces');
  const urgentes   = annonces.filter(a => a.priorite === 'urgente');
  const importantes= annonces.filter(a => a.priorite === 'importante');
  const normales   = annonces.filter(a => a.priorite === 'normale' || !a.priorite);

  v.innerHTML = `
  <!-- Header -->
  <div class="page-header">
    <div>
      <div class="page-title">📢 Annonces</div>
      <div class="page-sub">${annonces.length} annonce(s) publiée(s)</div>
    </div>
    <button class="btn btn-primary" onclick="modalAnnonce()">+ Nouvelle annonce</button>
  </div>

  <!-- Stats rapides -->
  <div class="ann-stats">
    <div class="ann-stat ann-stat-rouge">
      <span class="ann-stat-icon">🔴</span>
      <span class="ann-stat-val">${urgentes.length}</span>
      <span class="ann-stat-lbl">Urgentes</span>
    </div>
    <div class="ann-stat ann-stat-amber">
      <span class="ann-stat-icon">🟡</span>
      <span class="ann-stat-val">${importantes.length}</span>
      <span class="ann-stat-lbl">Importantes</span>
    </div>
    <div class="ann-stat ann-stat-blue">
      <span class="ann-stat-icon">🔵</span>
      <span class="ann-stat-val">${normales.length}</span>
      <span class="ann-stat-lbl">Normales</span>
    </div>
    <div class="ann-stat ann-stat-gray">
      <span class="ann-stat-icon">📢</span>
      <span class="ann-stat-val">${annonces.length}</span>
      <span class="ann-stat-lbl">Total</span>
    </div>
  </div>

  <!-- Filtres -->
  <div class="ann-filters">
    <button class="ann-filter active" data-f="tous" onclick="filtreAnn(this,'tous')">📋 Toutes</button>
    <button class="ann-filter" data-f="urgente" onclick="filtreAnn(this,'urgente')">🔴 Urgentes</button>
    <button class="ann-filter" data-f="importante" onclick="filtreAnn(this,'importante')">🟡 Importantes</button>
    <button class="ann-filter" data-f="normale" onclick="filtreAnn(this,'normale')">🔵 Normales</button>
    <div class="ann-search-wrap">
      <input type="text" class="ann-search" placeholder="🔍 Rechercher..." oninput="searchAnn(this.value)">
    </div>
  </div>

  <!-- Liste annonces -->
  <div id="ann-list">
    ${annonces.length ? renderAnnList(annonces) : renderAnnEmpty()}
  </div>

  <!-- Modal -->
  <div class="modal-backdrop" id="ann-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;align-items:center;justify-content:center" onclick="if(event.target===this)closeAnn()">
    <div class="modal-box" id="ann-modal-box" style="max-width:560px">
      <div class="modal-header">
        <h3 id="ann-modal-title">Nouvelle annonce</h3>
        <button class="modal-close" onclick="closeAnn()">✕</button>
      </div>
      <div class="modal-body" id="ann-modal-body"></div>
    </div>
  </div>`;
}

function renderAnnEmpty() {
  return `<div class="ann-empty">
    <div class="ann-empty-icon">📢</div>
    <div class="ann-empty-title">Aucune annonce publiée</div>
    <div class="ann-empty-sub">Créez votre première annonce pour communiquer avec vos équipes</div>
    <button class="btn btn-primary" onclick="modalAnnonce()" style="margin-top:16px">+ Créer une annonce</button>
  </div>`;
}

function renderAnnList(annonces) {
  const prioConfig = {
    urgente:    { color:'#ef4444', bg:'#fef2f2', border:'#fecaca', badge:'🔴 Urgente',    icon:'🚨' },
    importante: { color:'#d97706', bg:'#fffbeb', border:'#fde68a', badge:'🟡 Importante', icon:'⚠️' },
    normale:    { color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe', badge:'🔵 Normale',    icon:'📌' },
  };
  const destLabel = { tous:'👥 Tous', eleves:'🎓 Élèves', professeurs:'👨‍🏫 Professeurs', parents:'👨‍👩‍👧 Parents', administration:'🛡️ Administration' };

  return `<div class="ann-grid" id="ann-grid">
    ${annonces.map(a => {
      const p = prioConfig[a.priorite] || prioConfig.normale;
      const date = new Date(a.created_at).toLocaleDateString('fr-MA',{day:'2-digit',month:'long',year:'numeric'});
      const dest = destLabel[a.cible || a.destinataires] || '👥 Tous';
      return `
      <div class="ann-card" data-prio="${a.priorite||'normale'}" data-titre="${(a.titre||'').toLowerCase()}" data-contenu="${(a.contenu||'').toLowerCase()}"
           style="border-left:4px solid ${p.color};background:${p.bg}">
        <div class="ann-card-header">
          <div class="ann-card-badges">
            <span class="ann-prio-badge" style="background:${p.color}20;color:${p.color};border:1px solid ${p.border}">${p.badge}</span>
            <span class="ann-dest-badge">${dest}</span>
          </div>
          <div class="ann-card-date">📅 ${date}</div>
        </div>
        <div class="ann-card-icon-title">
          <span class="ann-card-icon">${p.icon}</span>
          <h3 class="ann-card-title">${a.titre}</h3>
        </div>
        <p class="ann-card-content">${a.contenu}</p>
        <div class="ann-card-footer">
          <div></div>
          <div class="ann-card-actions">
            <button class="ann-action-btn ann-edit" onclick="modalAnnonce(${a.id})" title="Modifier">✏️ Modifier</button>
            <button class="ann-action-btn ann-delete" onclick="deleteAnn(${a.id})" title="Supprimer">🗑 Supprimer</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Filtres ───────────────────────────────────────────────────
function filtreAnn(btn, filtre) {
  document.querySelectorAll('.ann-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.ann-card').forEach(card => {
    card.style.display = (filtre === 'tous' || card.dataset.prio === filtre) ? '' : 'none';
  });
}

function searchAnn(q) {
  const qL = q.toLowerCase();
  document.querySelectorAll('.ann-card').forEach(card => {
    const match = !qL || card.dataset.titre.includes(qL) || card.dataset.contenu.includes(qL);
    card.style.display = match ? '' : 'none';
  });
}

// ── Modal Créer/Modifier ──────────────────────────────────────
function modalAnnonce(id=null) {
  const a = id ? _annonces.find(x=>x.id===id)||{} : {};
  document.getElementById('ann-modal-title').textContent = id ? '✏️ Modifier l\'annonce' : '📢 Nouvelle annonce';
  document.getElementById('ann-modal-body').innerHTML = `
  <div class="form-group">
    <label class="form-label">Titre *</label>
    <input class="form-control" id="a-titre" value="${a.titre||''}" placeholder="Ex: Réunion parents-professeurs — 20 Janvier">
  </div>
  <div class="form-group">
    <label class="form-label">Contenu *</label>
    <textarea class="form-control" id="a-contenu" rows="4" placeholder="Détails de l'annonce...">${a.contenu||''}</textarea>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="form-group">
      <label class="form-label">Priorité</label>
      <select class="form-control" id="a-prio">
        <option value="normale"    ${(a.priorite||'normale')==='normale'   ?'selected':''}>🔵 Normale</option>
        <option value="importante" ${a.priorite==='importante'?'selected':''}>🟡 Importante</option>
        <option value="urgente"    ${a.priorite==='urgente'   ?'selected':''}>🔴 Urgente</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Destinataires</label>
      <select class="form-control" id="a-dest">
        <option value="tous"           ${(!a.cible||a.cible==='tous')          ?'selected':''}>👥 Tous</option>
        <option value="eleves"         ${a.cible==='eleves'         ?'selected':''}>🎓 Élèves</option>
        <option value="professeurs"    ${a.cible==='professeurs'    ?'selected':''}>👨‍🏫 Professeurs</option>
        <option value="parents"        ${a.cible==='parents'        ?'selected':''}>👨‍👩‍👧 Parents</option>
        <option value="administration" ${a.cible==='administration' ?'selected':''}>🛡️ Administration</option>
      </select>
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeAnn()">Annuler</button>
    <button class="btn btn-primary" onclick="saveAnn(${id||'null'})">📢 ${id?'Enregistrer':'Publier'}</button>
  </div>`;
  document.getElementById('ann-modal').style.display = 'flex';
}

async function saveAnn(id) {
  const titre   = document.getElementById('a-titre').value.trim();
  const contenu = document.getElementById('a-contenu').value.trim();
  if (!titre || !contenu) return showToast('Titre et contenu requis','error');
  const data = {
    titre, contenu,
    priorite:     document.getElementById('a-prio').value,
    destinataires:document.getElementById('a-dest').value,
    cible:        document.getElementById('a-dest').value,
  };
  try {
    if (id) await api.updateAnnonce(id, data);
    else    await api.createAnnonce(data);
    showToast(id ? '✅ Annonce modifiée' : '✅ Annonce publiée !','success');
    closeAnn();
    _annonces = await api.getAnnonces();
    renderAnnonces(_annonces);
  } catch(e) { showToast(e.message,'error'); }
}

async function deleteAnn(id) {
  if (!confirm('Supprimer cette annonce ?')) return;
  try {
    await api.deleteAnnonce(id);
    showToast('Annonce supprimée','success');
    _annonces = await api.getAnnonces();
    renderAnnonces(_annonces);
  } catch(e) { showToast(e.message,'error'); }
}

function closeAnn() {
  document.getElementById('ann-modal').style.display = 'none';
}
