// ══════════════════════════════════════════════════════════════
// MODULE DEVOIRS — Gestion des devoirs + rendus
// ══════════════════════════════════════════════════════════════
async function loadDevoirs() {
  const v = document.getElementById('view-devoirs');
  if (!v) return;
  v.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--muted)">⏳ Chargement...</div>`;
  try {
    const [devoirs, classes] = await Promise.all([api.get('/devoirs'), api.getClasses()]);
    window._devoirsData = devoirs;
    window._devoirsClasses = classes;
    renderDevoirs(devoirs, classes);
  } catch(e) {
    v.innerHTML = `<div style="padding:3rem;text-align:center;color:#ef4444">❌ ${e.message}</div>`;
  }
}

function renderDevoirs(devoirs, classes) {
  const v = document.getElementById('view-devoirs');
  const now = new Date();
  const enCours  = devoirs.filter(d => !d.date_limite || new Date(d.date_limite) >= now);
  const termines = devoirs.filter(d => d.date_limite && new Date(d.date_limite) < now);

  const typeIcons = { devoir:'📝', exercice:'✏️', projet:'🚀', examen:'📋', lecture:'📖' };
  const typeColors = { devoir:'badge-blue', exercice:'badge-green', projet:'badge-purple', examen:'badge-rose', lecture:'badge-amber' };

  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">📚 Devoirs & Exercices</div>
      <div class="page-sub">${devoirs.length} devoir(s) — ${enCours.length} en cours</div>
    </div>
    <button class="btn btn-primary" onclick="modalDevoir()">+ Nouveau devoir</button>
  </div>

  <div class="dv-tabs">
    <button class="dv-tab active" id="tab-encours" onclick="switchDevoirTab('encours')">📌 En cours (${enCours.length})</button>
    <button class="dv-tab" id="tab-termines" onclick="switchDevoirTab('termines')">✅ Terminés (${termines.length})</button>
  </div>

  <div id="dv-encours" class="dv-grid">
    ${enCours.length ? enCours.map(d => renderDevoirCard(d, typeIcons, typeColors)).join('') 
      : `<div class="dv-empty">📝 Aucun devoir en cours.<br><small>Créez le premier !</small></div>`}
  </div>
  <div id="dv-termines" class="dv-grid" style="display:none">
    ${termines.length ? termines.map(d => renderDevoirCard(d, typeIcons, typeColors)).join('')
      : `<div class="dv-empty">✅ Aucun devoir terminé.</div>`}
  </div>`;
}

function renderDevoirCard(d, typeIcons, typeColors) {
  const expired = d.date_limite && new Date(d.date_limite) < new Date();
  const soon    = d.date_limite && !expired && (new Date(d.date_limite)-new Date()) < 2*24*3600*1000;
  const dlLabel = d.date_limite ? fmtDate(d.date_limite) : 'Sans limite';
  return `
  <div class="dv-card ${expired?'dv-expired':soon?'dv-soon':''}">
    <div class="dv-card-top">
      <span class="badge ${typeColors[d.type]||'badge-blue'}">${typeIcons[d.type]||'📝'} ${d.type||'devoir'}</span>
      <span class="dv-matiere">${d.matiere}</span>
    </div>
    <div class="dv-card-title">${d.titre}</div>
    ${d.description?`<div class="dv-card-desc">${d.description}</div>`:''}
    <div class="dv-card-footer">
      <div class="dv-meta">
        ${d.classe?`<span class="badge badge-gray">🏫 ${d.classe}</span>`:'<span class="badge badge-gray">Toutes classes</span>'}
        <span class="${soon?'dv-date-soon':expired?'dv-date-exp':'dv-date'}">
          📅 ${dlLabel}${soon?' — ⚠️ Bientôt':''}${expired?' — ❌ Expiré':''}
        </span>
      </div>
      <div class="dv-actions">
        <button class="btn btn-sm btn-ghost" onclick="voirRendus(${d.id},'${d.titre.replace(/'/g,"\\'")}')">👁 Rendus</button>
        <button class="btn btn-sm btn-ghost" onclick="modalDevoir(${d.id})">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deleteDevoir(${d.id})">🗑</button>
      </div>
    </div>
  </div>`;
}

function switchDevoirTab(tab) {
  document.getElementById('dv-encours').style.display  = tab==='encours'  ? '' : 'none';
  document.getElementById('dv-termines').style.display = tab==='termines' ? '' : 'none';
  document.getElementById('tab-encours').classList.toggle('active',  tab==='encours');
  document.getElementById('tab-termines').classList.toggle('active', tab==='termines');
}

// ── Modal créer/éditer devoir ─────────────────────────────────
function modalDevoir(id=null) {
  const d = id ? (window._devoirsData||[]).find(x=>x.id===id)||{} : {};
  const classes = window._devoirsClasses||[];
  const types = ['devoir','exercice','projet','examen','lecture'];
  openModal((id?'✏️ Modifier':'📝 Nouveau') + ' Devoir', `
  <div class="form-grid">
    <div class="form-group full"><label class="form-label">Titre *</label>
      <input class="form-control" id="dv-titre" value="${d.titre||''}" placeholder="Ex: Exercice chapitre 3 — Fractions"></div>
    <div class="form-group"><label class="form-label">Matière *</label>
      <input class="form-control" id="dv-matiere" value="${d.matiere||''}" placeholder="Mathématiques, Français..."></div>
    <div class="form-group"><label class="form-label">Type</label>
      <select class="form-control" id="dv-type">
        ${types.map(t=>`<option value="${t}" ${d.type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Classe</label>
      <select class="form-control" id="dv-classe">
        <option value="">Toutes les classes</option>
        ${classes.map(c=>`<option value="${c.nom}" ${d.classe===c.nom?'selected':''}>${c.nom}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Date limite</label>
      <input type="date" class="form-control" id="dv-date" value="${d.date_limite||''}"></div>
    <div class="form-group full"><label class="form-label">Description / Énoncé</label>
      <textarea class="form-control" id="dv-desc" rows="4" placeholder="Détails du devoir, questions, consignes...">${d.description||''}</textarea></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveDevoir(${id||'null'})">${id?'Enregistrer':'Publier le devoir'}</button>
  </div>`);
}

async function saveDevoir(id) {
  const data = {
    titre:       document.getElementById('dv-titre').value.trim(),
    matiere:     document.getElementById('dv-matiere').value.trim(),
    type:        document.getElementById('dv-type').value,
    classe:      document.getElementById('dv-classe').value,
    date_limite: document.getElementById('dv-date').value,
    description: document.getElementById('dv-desc').value.trim(),
  };
  if (!data.titre||!data.matiere) return showToast('Titre et matière requis','error');
  try {
    if (id) await api.put('/devoirs/'+id, data);
    else    await api.post('/devoirs', data);
    showToast(id?'✅ Devoir modifié':'✅ Devoir publié !','success');
    closeModal(); loadDevoirs();
  } catch(e) { showToast(e.message,'error'); }
}

async function deleteDevoir(id) {
  if (!confirm('Supprimer ce devoir ?')) return;
  try { await api.delete('/devoirs/'+id); showToast('Supprimé','success'); loadDevoirs(); }
  catch(e) { showToast(e.message,'error'); }
}

// ── Voir les rendus d'un devoir ───────────────────────────────
async function voirRendus(devoirId, titre) {
  const rendus = await api.get('/devoirs/'+devoirId+'/rendus');
  const rows = rendus.length ? rendus.map(r => `
    <div class="rendu-card">
      <div class="rendu-top">
        <div class="rendu-eleve">🎓 ${r.prenom} ${r.nom}</div>
        <div style="display:flex;align-items:center;gap:8px">
          ${r.note!==null&&r.note!==undefined?`<span class="badge badge-green">📊 ${r.note}/20</span>`:''}
          <span class="badge ${r.statut==='corrige'?'badge-green':'badge-amber'}">${r.statut==='corrige'?'✅ Corrigé':'⏳ Rendu'}</span>
          <span style="font-size:11px;color:var(--muted)">${fmtDate(r.rendu_at)}</span>
        </div>
      </div>
      ${r.contenu?`<div class="rendu-contenu">${r.contenu}</div>`:''}
      ${r.fichier_nom?`<div class="rendu-fichier">📎 ${r.fichier_nom}</div>`:''}
      ${r.commentaire_prof?`<div class="rendu-commentaire">💬 ${r.commentaire_prof}</div>`:''}
      <div class="rendu-noter">
        <input type="number" min="0" max="20" step="0.25" placeholder="Note /20" id="note-${r.id}" value="${r.note||''}" style="width:90px" class="form-control" style="width:90px;padding:6px 10px">
        <input type="text" placeholder="Commentaire..." id="comm-${r.id}" value="${r.commentaire_prof||''}" class="form-control" style="flex:1;padding:6px 10px">
        <button class="btn btn-sm btn-primary" onclick="noterRendu(${r.id})">💾 Noter</button>
      </div>
    </div>`).join('')
    : `<div class="dv-empty">📭 Aucun rendu pour ce devoir.</div>`;

  openModal(`📋 Rendus — ${titre}`, `<div class="rendus-list">${rows}</div>`, true);
}

async function noterRendu(rendId) {
  const note = parseFloat(document.getElementById('note-'+rendId).value);
  const comm = document.getElementById('comm-'+rendId).value;
  if (isNaN(note)||note<0||note>20) return showToast('Note invalide (0-20)','error');
  try {
    await api.put('/rendus/'+rendId, { note, commentaire_prof:comm, statut:'corrige' });
    showToast('✅ Rendu noté !','success');
  } catch(e) { showToast(e.message,'error'); }
}
