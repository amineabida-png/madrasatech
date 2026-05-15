/* eleves.js */
let _eleves = [], _elevesFilter = { search:'', classe:'', statut:'' };

async function loadEleves() {
  const v = document.getElementById('view-eleves');
  v.innerHTML = `<div class="page-header"><div><div class="page-title">👨‍🎓 Élèves</div></div><button class="btn btn-primary" onclick="modalEleve()">+ Ajouter élève</button></div><div class="card"><div class="card-body" style="text-align:center;padding:40px"><div class="skeleton" style="height:200px;border-radius:8px"></div></div></div>`;
  
  try {
    const [eleves, classes] = await Promise.all([API.getEleves(), API.getClasses()]);
    _eleves = eleves || [];
    document.getElementById('badge-eleves').textContent = _eleves.filter(e=>e.statut==='actif').length;
    renderEleves(classes);
  } catch(e) { toast(e.message,'err'); }
}

function renderEleves(classesList) {
  const v = document.getElementById('view-eleves');
  const { search, classe, statut } = _elevesFilter;
  let data = _eleves;
  if (search) data = data.filter(e => `${e.nom} ${e.prenom} ${e.massar||''}`.toLowerCase().includes(search.toLowerCase()));
  if (classe) data = data.filter(e => e.classe === classe);
  if (statut) data = data.filter(e => e.statut === statut);

  const classes = classesList || [...new Set(_eleves.map(e=>e.classe).filter(Boolean))].sort();
  const classOpts = classes.map ? classes.map(c=>c.nom||c) : classes;

  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">👨‍🎓 Élèves</div><div class="page-sub">${data.length} élève(s) trouvé(s)</div></div>
    <div class="page-actions">
      <button class="btn btn-ghost btn-sm" onclick="exportCSV(_eleves,'eleves.csv')">📥 Export CSV</button>
      <button class="btn btn-primary" onclick="modalEleve()">+ Ajouter</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header">
      <div class="toolbar" style="margin:0">
        <input class="filter-input" placeholder="🔍 Rechercher..." value="${search}" oninput="_elevesFilter.search=this.value;loadEleves()">
        <select class="filter-input" onchange="_elevesFilter.classe=this.value;loadEleves()">
          <option value="">Toutes les classes</option>
          ${classOpts.map(c=>`<option value="${c}" ${classe===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select class="filter-input" onchange="_elevesFilter.statut=this.value;loadEleves()">
          <option value="">Tous statuts</option>
          <option value="actif" ${statut==='actif'?'selected':''}>Actif</option>
          <option value="inactif" ${statut==='inactif'?'selected':''}>Inactif</option>
        </select>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Élève</th><th>Classe</th><th>N° MASSAR</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.length ? data.map(e => `
            <tr>
              <td style="display:flex;align-items:center;gap:10px">
                <div class="avatar ${avColor(e.id)}">${initials(e.nom,e.prenom)}</div>
                <div><strong>${e.prenom} ${e.nom}</strong><br><small style="color:var(--muted)">${e.genre==='F'?'♀':'♂'} · ${e.niveau||'—'}</small></div>
              </td>
              <td>${e.classe||'—'}</td>
              <td><code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px">${e.massar||'—'}</code></td>
              <td>${e.telephone||'—'}</td>
              <td><span class="badge ${e.statut==='actif'?'badge-green':'badge-muted'}">${e.statut}</span></td>
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-sm btn-ghost btn-icon" onclick="voirEleve(${e.id})" title="Détails">👁</button>
                  <button class="btn btn-sm btn-ghost btn-icon" onclick="modalEleve(${e.id})" title="Modifier">✏️</button>
                  <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerEleve(${e.id},'${e.prenom} ${e.nom}')" title="Supprimer">🗑</button>
                </div>
              </td>
            </tr>`).join('') : `<tr><td colspan="6"><div class="empty"><div class="empty-ico">👨‍🎓</div><div class="empty-title">Aucun élève</div><div class="empty-sub">Ajoutez votre premier élève</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function modalEleve(id=null) {
  const [classes] = await Promise.all([API.getClasses()]);
  let e = {};
  if (id) {
    try { e = await API.getEleve(id); } catch {}
  }
  const classOpts = (classes||[]).map(c=>`<option value="${c.nom}" ${e.classe===c.nom?'selected':''}>${c.nom}</option>`).join('');

  openModal((id?'✏️ Modifier':'+ Ajouter') + ' Élève', `
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Prénom *</label><input class="form-control" id="ePrenom" value="${e.prenom||''}" placeholder="Prénom"></div>
    <div class="form-group"><label class="form-label">Nom *</label><input class="form-control" id="eNom" value="${e.nom||''}" placeholder="Nom"></div>
    <div class="form-group"><label class="form-label">Date de naissance</label><input type="date" class="form-control" id="eDob" value="${e.date_naissance||''}"></div>
    <div class="form-group"><label class="form-label">Genre</label>
      <select class="form-control" id="eGenre"><option value="M" ${e.genre==='M'||!e.genre?'selected':''}>Masculin</option><option value="F" ${e.genre==='F'?'selected':''}>Féminin</option></select></div>
    <div class="form-group"><label class="form-label">Classe *</label>
      <select class="form-control" id="eClasse"><option value="">Choisir...</option>${classOpts}</select></div>
    <div class="form-group"><label class="form-label">Niveau</label>
      <select class="form-control" id="eNiveau"><option value="primaire" ${e.niveau==='primaire'?'selected':''}>Primaire</option><option value="college" ${e.niveau==='college'?'selected':''}>Collège</option><option value="lycee" ${e.niveau==='lycee'?'selected':''}>Lycée</option></select></div>
    <div class="form-group"><label class="form-label">N° MASSAR</label><input class="form-control" id="eMassar" value="${e.massar||''}" placeholder="G140000000"></div>
    <div class="form-group"><label class="form-label">Téléphone parent</label><input class="form-control" id="eTel" value="${e.telephone||''}" placeholder="0661234567"></div>
    <div class="form-group"><label class="form-label">CIN parent</label><input class="form-control" id="eCin" value="${e.cin_parent||''}" placeholder="AB123456"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="eEmail" value="${e.email||''}" placeholder="email@exemple.com"></div>
    ${id?`<div class="form-group"><label class="form-label">Statut</label><select class="form-control" id="eStatut"><option value="actif" ${e.statut==='actif'?'selected':''}>Actif</option><option value="inactif" ${e.statut==='inactif'?'selected':''}>Inactif</option></select></div>`:''}
    <div class="form-group full"><label class="form-label">Adresse</label><input class="form-control" id="eAddr" value="${e.adresse||''}" placeholder="Adresse"></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveEleve(${id||'null'})">${id?'Enregistrer':'Ajouter'}</button>
  </div>`, true);
}

async function saveEleve(id) {
  const data = {
    prenom: document.getElementById('ePrenom').value.trim(),
    nom: document.getElementById('eNom').value.trim(),
    date_naissance: document.getElementById('eDob').value,
    genre: document.getElementById('eGenre').value,
    classe: document.getElementById('eClasse').value,
    niveau: document.getElementById('eNiveau').value,
    massar: document.getElementById('eMassar').value.trim(),
    telephone: document.getElementById('eTel').value.trim(),
    cin_parent: document.getElementById('eCin').value.trim(),
    email: document.getElementById('eEmail').value.trim(),
    adresse: document.getElementById('eAddr').value.trim(),
  };
  if (id) data.statut = document.getElementById('eStatut').value;
  if (!data.prenom || !data.nom) { toast('Prénom et nom requis','err'); return; }
  try {
    if (id) { await API.updateEleve(id, data); toast('Élève modifié','ok'); }
    else { await API.createEleve(data); toast('Élève ajouté','ok'); }
    closeModal();
    loadEleves();
  } catch(e) { toast(e.message,'err'); }
}

async function supprimerEleve(id, nom) {
  if (!confirm(`Supprimer ${nom} ?`)) return;
  try { await API.deleteEleve(id); toast('Élève supprimé','ok'); loadEleves(); } catch(e) { toast(e.message,'err'); }
}

async function voirEleve(id) {
  try {
    const e = await API.getEleve(id);
    const moy1 = calculMoyenne(e.notes, 1);
    const moy2 = calculMoyenne(e.notes, 2);
    const moy3 = calculMoyenne(e.notes, 3);
    const totalAbs = e.absences?.length || 0;
    const absJust = e.absences?.filter(a=>a.justifiee).length || 0;
    const totalPaye = e.paiements?.filter(p=>p.statut==='paye').reduce((a,p)=>a+p.montant,0)||0;
    const totalDu = e.paiements?.filter(p=>p.statut==='impaye'||p.statut==='partiel').reduce((a,p)=>a+(p.montant_du-p.montant),0)||0;

    openModal(`👨‍🎓 Fiche — ${e.prenom} ${e.nom}`, `
    <div class="tabs">
      <button class="tab active" onclick="switchTab(event,'tab-info')">Informations</button>
      <button class="tab" onclick="switchTab(event,'tab-notes')">Notes</button>
      <button class="tab" onclick="switchTab(event,'tab-abs')">Absences</button>
      <button class="tab" onclick="switchTab(event,'tab-paie')">Paiements</button>
    </div>
    
    <div id="tab-info">
      <div class="grid-2">
        <div>
          <div class="info-row"><span class="info-label">Nom complet</span><span class="info-value">${e.prenom} ${e.nom}</span></div>
          <div class="info-row"><span class="info-label">Genre</span><span class="info-value">${e.genre==='F'?'Féminin':'Masculin'}</span></div>
          <div class="info-row"><span class="info-label">Date naissance</span><span class="info-value">${fmtDate(e.date_naissance)}</span></div>
          <div class="info-row"><span class="info-label">MASSAR</span><span class="info-value"><code>${e.massar||'—'}</code></span></div>
          <div class="info-row"><span class="info-label">Classe</span><span class="info-value">${e.classe||'—'}</span></div>
          <div class="info-row"><span class="info-label">Niveau</span><span class="info-value">${e.niveau||'—'}</span></div>
        </div>
        <div>
          <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${e.telephone||'—'}</span></div>
          <div class="info-row"><span class="info-label">CIN parent</span><span class="info-value">${e.cin_parent||'—'}</span></div>
          <div class="info-row"><span class="info-label">Email</span><span class="info-value">${e.email||'—'}</span></div>
          <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${e.adresse||'—'}</span></div>
          <div class="info-row"><span class="info-label">Inscription</span><span class="info-value">${fmtDate(e.date_inscription)}</span></div>
          <div class="info-row"><span class="info-label">Statut</span><span class="info-value"><span class="badge ${e.statut==='actif'?'badge-green':'badge-muted'}">${e.statut}</span></span></div>
        </div>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="imprimerBulletin(${e.id},1)">🖨 Bulletin T1</button>
        <button class="btn btn-ghost btn-sm" onclick="imprimerBulletin(${e.id},2)">🖨 Bulletin T2</button>
        <button class="btn btn-ghost btn-sm" onclick="imprimerBulletin(${e.id},3)">🖨 Bulletin T3</button>
      </div>
    </div>

    <div id="tab-notes" style="display:none">
      <div class="grid-3" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-icon blue">T1</div><div><div class="stat-value">${moy1||'—'}</div><div class="stat-label">Trimestre 1</div></div></div>
        <div class="stat-card"><div class="stat-icon green">T2</div><div><div class="stat-value">${moy2||'—'}</div><div class="stat-label">Trimestre 2</div></div></div>
        <div class="stat-card"><div class="stat-icon amber">T3</div><div><div class="stat-value">${moy3||'—'}</div><div class="stat-label">Trimestre 3</div></div></div>
      </div>
      <table><thead><tr><th>Matière</th><th>Note</th><th>Coef</th><th>Trimestre</th><th>Type</th></tr></thead><tbody>
        ${(e.notes||[]).map(n=>`<tr><td>${n.matiere}</td><td><strong>${fmtNote(n.note)}</strong></td><td>${n.coefficient}</td><td>T${n.trimestre}</td><td>${n.type_eval||'—'}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--muted)">Aucune note</td></tr>'}
      </tbody></table>
    </div>

    <div id="tab-abs" style="display:none">
      <div class="grid-2" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-icon rose">📅</div><div><div class="stat-value">${totalAbs}</div><div class="stat-label">Total absences</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${absJust}</div><div class="stat-label">Justifiées</div></div></div>
      </div>
      <table><thead><tr><th>Date</th><th>Matière</th><th>Motif</th><th>Justifiée</th></tr></thead><tbody>
        ${(e.absences||[]).map(a=>`<tr><td>${fmtDate(a.date_absence)}</td><td>${a.matiere||'—'}</td><td>${a.motif||'—'}</td><td><span class="badge ${a.justifiee?'badge-green':'badge-rose'}">${a.justifiee?'Oui':'Non'}</span></td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--muted)">Aucune absence</td></tr>'}
      </tbody></table>
    </div>

    <div id="tab-paie" style="display:none">
      <div class="grid-2" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-icon green">💰</div><div><div class="stat-value">${fmtMoney(totalPaye)}</div><div class="stat-label">Total payé</div></div></div>
        <div class="stat-card"><div class="stat-icon rose">⚠️</div><div><div class="stat-value">${fmtMoney(totalDu)}</div><div class="stat-label">Reste dû</div></div></div>
      </div>
      <table><thead><tr><th>Mois</th><th>Montant dû</th><th>Payé</th><th>Statut</th></tr></thead><tbody>
        ${(e.paiements||[]).map(p=>`<tr><td>${p.mois} ${p.annee}</td><td>${fmtMoney(p.montant_du)}</td><td>${fmtMoney(p.montant)}</td><td><span class="badge ${p.statut==='paye'?'badge-green':p.statut==='partiel'?'badge-amber':'badge-rose'}">${p.statut}</span></td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--muted)">Aucun paiement</td></tr>'}
      </tbody></table>
    </div>
    `, true);
  } catch(e) { toast(e.message,'err'); }
}

function calculMoyenne(notes, trimestre) {
  const n = (notes||[]).filter(n=>n.trimestre===trimestre);
  if(!n.length) return null;
  const pts = n.reduce((a,b)=>a+b.note*b.coefficient,0);
  const coef = n.reduce((a,b)=>a+b.coefficient,0);
  return coef>0 ? (pts/coef).toFixed(2)+'/20' : null;
}

function switchTab(e, id) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  ['tab-info','tab-notes','tab-abs','tab-paie'].forEach(t=>{
    const el=document.getElementById(t);
    if(el) el.style.display=t===id?'block':'none';
  });
}

async function imprimerBulletin(eleveId, trimestre) {
  try {
    const b = await API.getBulletin(eleveId, trimestre);
    const html = `
    <div class="print-bulletin" style="font-family:Arial,sans-serif;padding:20px">
      <div style="text-align:center;border-bottom:2px solid #1a56db;padding-bottom:16px;margin-bottom:20px">
        <h1 style="font-size:20px;color:#1a56db;margin:0">BULLETIN SCOLAIRE</h1>
        <h2 style="font-size:14px;font-weight:400;margin:4px 0">Trimestre ${trimestre} — Année ${b.annee_scolaire}</h2>
        <p style="margin:0;font-size:12px;color:#666">${document.getElementById('schoolName').textContent}</p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px">
        <div><strong>Élève :</strong> ${b.eleve.prenom} ${b.eleve.nom}</div>
        <div><strong>Classe :</strong> ${b.eleve.classe}</div>
        <div><strong>N° MASSAR :</strong> ${b.eleve.massar||'—'}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <thead><tr style="background:#1a56db;color:#fff"><th style="padding:8px;text-align:left">Matière</th><th style="padding:8px;text-align:center">Nb notes</th><th style="padding:8px;text-align:center">Coefficient</th><th style="padding:8px;text-align:center">Moyenne</th><th style="padding:8px;text-align:center">Appréciation</th></tr></thead>
        <tbody>
          ${b.matieres.map((m,i)=>`<tr style="background:${i%2?'#f9fafb':'#fff'}"><td style="padding:8px;border-bottom:1px solid #e5e7eb">${m.matiere}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb">${m.nb_notes}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb">${m.coefficient}</td><td style="padding:8px;text-align:center;font-weight:700;border-bottom:1px solid #e5e7eb;color:${m.moyenne>=10?'#059669':'#dc2626'}">${m.moyenne}/20</td><td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb;font-size:11px">${m.moyenne>=16?'Excellent':m.moyenne>=14?'Très Bien':m.moyenne>=12?'Bien':m.moyenne>=10?'Passable':'Insuffisant'}</td></tr>`).join('')}
        </tbody>
      </table>
      <div style="background:#f0fdf4;border:2px solid #059669;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
        <div><strong>Moyenne Générale :</strong> <span style="font-size:24px;font-weight:800;color:${b.moyenneGenerale>=10?'#059669':'#dc2626'}">${b.moyenneGenerale}/20</span></div>
        <div style="font-size:18px;font-weight:700;color:#1a56db">${b.mention}</div>
      </div>
      <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:12px;color:#666">
        <div>Date : ${new Date().toLocaleDateString('fr-MA')}</div>
        <div>Signature du Directeur</div>
        <div>Signature du Parent</div>
      </div>
    </div>`;
    printZone(html);
  } catch(e) { toast(e.message,'err'); }
}
