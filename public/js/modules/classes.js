/* classes.js */
async function loadClasses() {
  const v = document.getElementById('view-classes');
  try {
    const classes = await API.getClasses();
    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🏫 Classes</div><div class="page-sub">${classes.length} classe(s)</div></div>
      <button class="btn btn-primary" onclick="modalClasse()">+ Nouvelle classe</button>
    </div>
    <div class="grid-3">
      ${classes.length ? classes.map(c=>`
        <div class="card">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
              <div style="font-size:18px;font-weight:800;color:var(--primary)">${c.nom}</div>
              <span class="badge badge-blue">${c.niveau||'—'}</span>
            </div>
            <div class="info-row"><span class="info-label">Élèves</span><span class="info-value">${c.nb_eleves||0} / ${c.max_eleves}</span></div>
            <div style="margin:8px 0"><div class="progress"><div class="progress-bar pb-blue" style="width:${Math.min(100,((c.nb_eleves||0)/c.max_eleves)*100)}%"></div></div></div>
            <div class="info-row"><span class="info-label">Prof principal</span><span class="info-value">${c.professeur_principal||'—'}</span></div>
            <div class="info-row"><span class="info-label">Salle</span><span class="info-value">${c.salle||'—'}</span></div>
            <div class="info-row"><span class="info-label">Année</span><span class="info-value">${c.annee_scolaire||'—'}</span></div>
            <div style="display:flex;gap:6px;margin-top:12px">
              <button class="btn btn-sm btn-ghost" style="flex:1" onclick="modalClasse(${c.id},${JSON.stringify(c).replace(/"/g,'&quot;')})">✏️ Modifier</button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerClasse(${c.id},'${c.nom}')">🗑</button>
            </div>
          </div>
        </div>`).join('') : `<div class="card" style="grid-column:1/-1"><div class="empty"><div class="empty-ico">🏫</div><div class="empty-title">Aucune classe</div><div class="empty-sub">Ajoutez votre première classe</div></div></div>`}
    </div>`;
  } catch(e) { toast(e.message,'err'); }
}

function modalClasse(id=null, c={}) {
  openModal((id?'✏️ Modifier':'+ Nouvelle') + ' Classe', `
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Nom de la classe *</label><input class="form-control" id="cNom" value="${c.nom||''}" placeholder="ex: 2ème BAC SPC"></div>
    <div class="form-group"><label class="form-label">Niveau</label>
      <select class="form-control" id="cNiveau">
        <option value="primaire" ${c.niveau==='primaire'?'selected':''}>Primaire</option>
        <option value="college" ${c.niveau==='college'?'selected':''}>Collège</option>
        <option value="lycee" ${c.niveau==='lycee'?'selected':''}>Lycée</option>
      </select></div>
    <div class="form-group"><label class="form-label">Capacité max</label><input type="number" class="form-control" id="cMax" value="${c.max_eleves||35}" min="1" max="50"></div>
    <div class="form-group"><label class="form-label">Année scolaire</label><input class="form-control" id="cAnnee" value="${c.annee_scolaire||'2024-2025'}" placeholder="2024-2025"></div>
    <div class="form-group"><label class="form-label">Prof principal</label><input class="form-control" id="cProf" value="${c.professeur_principal||''}" placeholder="Nom du professeur principal"></div>
    <div class="form-group"><label class="form-label">Salle</label><input class="form-control" id="cSalle" value="${c.salle||''}" placeholder="ex: Salle A1"></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveClasse(${id||'null'})">${id?'Enregistrer':'Créer'}</button>
  </div>`);
}

async function saveClasse(id) {
  const data = {
    nom: document.getElementById('cNom').value.trim(),
    niveau: document.getElementById('cNiveau').value,
    max_eleves: parseInt(document.getElementById('cMax').value)||35,
    annee_scolaire: document.getElementById('cAnnee').value.trim(),
    professeur_principal: document.getElementById('cProf').value.trim(),
    salle: document.getElementById('cSalle').value.trim(),
  };
  if (!data.nom) { toast('Nom de la classe requis','err'); return; }
  try {
    if (id) await API.updateClasse(id, data); else await API.createClasse(data);
    toast(id?'Classe modifiée':'Classe créée','ok');
    closeModal(); loadClasses();
  } catch(e) { toast(e.message,'err'); }
}

async function supprimerClasse(id, nom) {
  if (!confirm(`Supprimer la classe "${nom}" ?`)) return;
  try { await API.deleteClasse(id); toast('Classe supprimée','ok'); loadClasses(); } catch(e) { toast(e.message,'err'); }
}
