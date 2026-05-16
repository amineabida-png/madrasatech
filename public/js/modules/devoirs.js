// ══════════════════════════════════════════════════════════════
// MODULE DEVOIRS — Gestion des devoirs + upload fichiers
// ══════════════════════════════════════════════════════════════
async function loadDevoirs() {
  const v = document.getElementById('view-devoirs');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const [devoirs, classes] = await Promise.all([api.get('/devoirs'), api.getClasses()]);
    window._devoirsData    = devoirs;
    window._devoirsClasses = classes;
    renderDevoirs(devoirs, classes);
  } catch(e) {
    v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`;
  }
}

function renderDevoirs(devoirs, classes) {
  const v = document.getElementById('view-devoirs');
  const now = new Date();
  const enCours  = devoirs.filter(d => !d.date_limite || new Date(d.date_limite) >= now);
  const termines = devoirs.filter(d => d.date_limite && new Date(d.date_limite) < now);
  const typeIcons  = { devoir:'📝', exercice:'✏️', projet:'🚀', examen:'📋', lecture:'📖' };
  const typeColors = { devoir:'badge-blue', exercice:'badge-green', projet:'badge-purple', examen:'badge-rose', lecture:'badge-amber' };

  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">📚 Devoirs & Exercices</div>
      <div class="page-sub">${devoirs.length} devoir(s) — ${enCours.length} en cours</div></div>
    <button class="btn btn-primary" onclick="modalDevoir()">+ Nouveau devoir</button>
  </div>
  <div class="dv-tabs">
    <button class="dv-tab active" id="tab-encours"  onclick="switchDevoirTab('encours')">📌 En cours (${enCours.length})</button>
    <button class="dv-tab"        id="tab-termines" onclick="switchDevoirTab('termines')">✅ Terminés (${termines.length})</button>
  </div>
  <div id="dv-encours"  class="dv-grid">${enCours.length  ? enCours.map(d=>renderDevoirCard(d,typeIcons,typeColors)).join('') : `<div class="dv-empty">📝 Aucun devoir en cours.</div>`}</div>
  <div id="dv-termines" class="dv-grid" style="display:none">${termines.length ? termines.map(d=>renderDevoirCard(d,typeIcons,typeColors)).join('') : `<div class="dv-empty">✅ Aucun devoir terminé.</div>`}</div>
  `;
}

function renderDevoirCard(d, typeIcons, typeColors) {
  const expired = d.date_limite && new Date(d.date_limite) < new Date();
  const soon    = d.date_limite && !expired && (new Date(d.date_limite)-new Date()) < 2*24*3600*1000;
  const hasFichier = d.fichier_nom;
  const isImage = hasFichier && /\.(jpg|jpeg|png|gif|webp)$/i.test(d.fichier_nom);

  return `
  <div class="dv-card ${expired?'dv-expired':soon?'dv-soon':''}">
    ${isImage ? `<img src="/api/devoirs/${d.id}/fichier" alt="${d.fichier_nom}" class="dv-card-image" onclick="previewFichier('/api/devoirs/${d.id}/fichier','${d.fichier_nom}')">` : ''}
    <div class="dv-card-top">
      <span class="badge ${typeColors[d.type]||'badge-blue'}">${typeIcons[d.type]||'📝'} ${d.type||'devoir'}</span>
      <span class="dv-matiere">${d.matiere}</span>
    </div>
    <div class="dv-card-title">${d.titre}</div>
    ${d.description?`<div class="dv-card-desc">${d.description}</div>`:''}
    ${hasFichier && !isImage ? `
    <div class="dv-fichier-badge" onclick="window.open('/api/devoirs/${d.id}/fichier')">
      <span>${fichierIcon(d.fichier_nom)}</span>
      <span>${d.fichier_nom}</span>
      <span class="dv-dl-btn">⬇️</span>
    </div>` : ''}
    <div class="dv-card-footer">
      <div class="dv-meta">
        ${d.classe?`<span class="badge badge-gray">🏫 ${d.classe}</span>`:'<span class="badge badge-gray">Toutes classes</span>'}
        <span class="${soon?'dv-date-soon':expired?'dv-date-exp':'dv-date'}">📅 ${d.date_limite?fmtDate(d.date_limite):'Sans limite'}${soon?' ⚠️':expired?' ❌':''}</span>
      </div>
      <div class="dv-actions">
        <button class="btn btn-sm btn-ghost" onclick="voirRendus(${d.id},'${(d.titre||'').replace(/'/g,"\\'")}')">👁 Rendus</button>
        <button class="btn btn-sm btn-ghost" onclick="modalDevoir(${d.id})">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="deleteDevoir(${d.id})">🗑</button>
      </div>
    </div>
  </div>`;
}

function fichierIcon(nom) {
  if (!nom) return '📎';
  const ext = nom.split('.').pop().toLowerCase();
  const icons = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', txt:'📃', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', webp:'🖼️' };
  return icons[ext] || '📎';
}

function previewFichier(url, nom) {
  openModal(`🖼️ ${nom}`, `<div style="text-align:center"><img src="${url}" style="max-width:100%;max-height:70vh;border-radius:8px"><br><a href="${url}" download="${nom}" class="btn btn-primary" style="margin-top:12px;display:inline-block">⬇️ Télécharger</a></div>`, true);
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
      <textarea class="form-control" id="dv-desc" rows="3" placeholder="Détails du devoir, questions, consignes...">${d.description||''}</textarea></div>
    <div class="form-group full">
      <label class="form-label">📎 Joindre un fichier ou image</label>
      <div class="upload-zone" id="dv-upload-zone" onclick="document.getElementById('dv-fichier').click()">
        <input type="file" id="dv-fichier" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display:none" onchange="onDevoirFichier(this)">
        <div id="dv-upload-preview">
          ${d.fichier_nom ? `<div class="upload-current">${fichierIcon(d.fichier_nom)} ${d.fichier_nom} <small>(cliquez pour changer)</small></div>` : `<div class="upload-placeholder"><div style="font-size:2rem">📎</div><div>Cliquez ou glissez un fichier ici</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">Images, PDF, Word, Excel — max 10 MB</div></div>`}
        </div>
      </div>
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveDevoir(${id||'null'})">${id?'Enregistrer':'Publier le devoir'}</button>
  </div>`, true);

  // Drag & drop
  const zone = document.getElementById('dv-upload-zone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('upload-drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('upload-drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('upload-drag');
      const file = e.dataTransfer.files[0];
      if (file) { document.getElementById('dv-fichier').files = e.dataTransfer.files; onDevoirFichier({ files: e.dataTransfer.files }); }
    });
  }
}

function onDevoirFichier(input) {
  const file = input.files?.[0];
  if (!file) return;
  const isImg = file.type.startsWith('image/');
  const preview = document.getElementById('dv-upload-preview');
  if (isImg) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `<div class="upload-img-preview"><img src="${e.target.result}" style="max-height:120px;border-radius:8px"><div style="margin-top:6px;font-size:12px;color:#374151">${fichierIcon(file.name)} ${file.name} (${(file.size/1024).toFixed(0)} KB)</div></div>`;
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = `<div class="upload-file-preview">${fichierIcon(file.name)} <strong>${file.name}</strong> <span style="color:#94a3b8">(${(file.size/1024).toFixed(0)} KB)</span></div>`;
  }
}

async function saveDevoir(id) {
  const titre  = document.getElementById('dv-titre').value.trim();
  const matiere= document.getElementById('dv-matiere').value.trim();
  if (!titre||!matiere) return showToast('Titre et matière requis','error');

  const formData = new FormData();
  formData.append('titre', titre);
  formData.append('matiere', matiere);
  formData.append('type',   document.getElementById('dv-type').value);
  formData.append('classe', document.getElementById('dv-classe').value);
  formData.append('date_limite', document.getElementById('dv-date').value);
  formData.append('description', document.getElementById('dv-desc').value.trim());
  const fichierInput = document.getElementById('dv-fichier');
  if (fichierInput?.files?.[0]) formData.append('fichier', fichierInput.files[0]);

  try {
    const token = localStorage.getItem('mt_token');
    const url = id ? `/api/devoirs/${id}` : '/api/devoirs';
    const method = id ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Authorization': 'Bearer ' + token }, body: formData });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur');
    showToast(id ? '✅ Devoir modifié' : '✅ Devoir publié !', 'success');
    closeModal(); loadDevoirs();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteDevoir(id) {
  if (!confirm('Supprimer ce devoir ?')) return;
  try { await api.delete('/devoirs/'+id); showToast('Supprimé','success'); loadDevoirs(); }
  catch(e) { showToast(e.message,'error'); }
}

// ── Voir les rendus ───────────────────────────────────────────
async function voirRendus(devoirId, titre) {
  const rendus = await api.get('/devoirs/'+devoirId+'/rendus');
  const rows = rendus.length ? rendus.map(r => {
    const hasFichier = r.fichier_nom;
    const isImg = hasFichier && /\.(jpg|jpeg|png|gif|webp)$/i.test(r.fichier_nom);
    return `
    <div class="rendu-card">
      <div class="rendu-top">
        <div class="rendu-eleve">🎓 ${r.prenom} ${r.nom}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${r.note!=null?`<span class="badge badge-green">📊 ${r.note}/20</span>`:''}
          <span class="badge ${r.statut==='corrige'?'badge-green':'badge-amber'}">${r.statut==='corrige'?'✅ Corrigé':'⏳ Rendu'}</span>
          <span style="font-size:11px;color:var(--muted)">${fmtDate(r.rendu_at)}</span>
        </div>
      </div>
      ${r.contenu?`<div class="rendu-contenu">${r.contenu}</div>`:''}
      ${isImg ? `<div style="margin:8px 0"><img src="/api/rendus/${r.id}/fichier" style="max-width:100%;max-height:200px;border-radius:8px;cursor:pointer" onclick="previewFichier('/api/rendus/${r.id}/fichier','${r.fichier_nom}')"></div>` : ''}
      ${hasFichier && !isImg ? `<div class="dv-fichier-badge" onclick="window.open('/api/rendus/${r.id}/fichier')">${fichierIcon(r.fichier_nom)} ${r.fichier_nom} <span class="dv-dl-btn">⬇️</span></div>` : ''}
      ${r.commentaire_prof?`<div class="rendu-commentaire">💬 ${r.commentaire_prof}</div>`:''}
      <div class="rendu-noter">
        <input type="number" min="0" max="20" step="0.25" placeholder="Note /20" id="note-${r.id}" value="${r.note||''}" class="form-control" style="width:90px;padding:6px 10px">
        <input type="text" placeholder="Commentaire..." id="comm-${r.id}" value="${r.commentaire_prof||''}" class="form-control" style="flex:1;padding:6px 10px">
        <button class="btn btn-sm btn-primary" onclick="noterRendu(${r.id})">💾 Noter</button>
      </div>
    </div>`;
  }).join('')
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

// ── Espace élève : rendre un devoir avec fichier ──────────────
function ouvrirRendu(devoirId, titre) {
  const modal = document.getElementById('rendu-modal');
  document.getElementById('rendu-modal-title').textContent = '📤 ' + titre;
  document.getElementById('rendu-modal-body').innerHTML = `
  <div class="form-group">
    <label class="form-label">Votre réponse</label>
    <textarea class="form-control" id="rendu-contenu" rows="5" placeholder="Écrivez votre réponse ici..."></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">📎 Joindre un fichier ou image</label>
    <div class="upload-zone" id="rendu-upload-zone" onclick="document.getElementById('rendu-fichier').click()">
      <input type="file" id="rendu-fichier" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt" style="display:none" onchange="onRenduFichier(this)">
      <div id="rendu-upload-preview">
        <div class="upload-placeholder"><div style="font-size:2rem">📎</div><div>Cliquez ou glissez un fichier</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">Images, PDF, Word — max 10 MB</div></div>
      </div>
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeRenduModal()">Annuler</button>
    <button class="btn btn-primary" onclick="soumettreRendu(${devoirId})">📤 Soumettre</button>
  </div>`;
  modal.style.display = 'flex';

  const zone = document.getElementById('rendu-upload-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('upload-drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('upload-drag'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('upload-drag');
    if (e.dataTransfer.files[0]) { document.getElementById('rendu-fichier').files = e.dataTransfer.files; onRenduFichier({ files: e.dataTransfer.files }); }
  });
}

function onRenduFichier(input) {
  const file = input.files?.[0];
  if (!file) return;
  const preview = document.getElementById('rendu-upload-preview');
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}" style="max-height:120px;border-radius:8px"><div style="font-size:12px;margin-top:6px">${file.name}</div>`; };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = `<div class="upload-file-preview">${fichierIcon(file.name)} <strong>${file.name}</strong> (${(file.size/1024).toFixed(0)} KB)</div>`;
  }
}

function closeRenduModal() { document.getElementById('rendu-modal').style.display='none'; }

async function soumettreRendu(devoirId) {
  const contenu = document.getElementById('rendu-contenu').value.trim();
  const fichierInput = document.getElementById('rendu-fichier');
  const su = window._currentSchoolUser;
  if (!contenu && !fichierInput?.files?.[0]) return showToast('Ajoutez une réponse ou un fichier','error');
  if (!su) return showToast('Compte élève non lié. Contactez l\'administrateur.','error');

  const formData = new FormData();
  formData.append('eleve_user_id', su.id);
  formData.append('contenu', contenu);
  if (fichierInput?.files?.[0]) formData.append('fichier', fichierInput.files[0]);

  try {
    const token = localStorage.getItem('mt_token');
    const r = await fetch(`/api/devoirs/${devoirId}/rendus`, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    showToast('✅ Devoir soumis avec succès !','success');
    closeRenduModal(); loadEspaceEleve();
  } catch(e) { showToast(e.message||'Erreur','error'); }
}
