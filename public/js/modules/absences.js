/* absences.js */
async function loadAbsences() {
  const v = document.getElementById('view-absences');
  try {
    const [absences, classes, eleves] = await Promise.all([API.getAbsences(), API.getClasses(), API.getEleves()]);
    const classOpts = classes.map(c=>`<option value="${c.nom}">${c.nom}</option>`).join('');
    const totalJust = absences.filter(a=>a.justifiee).length;
    const totalInjust = absences.filter(a=>!a.justifiee).length;

    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📅 Absences</div><div class="page-sub">${absences.length} absence(s) enregistrée(s)</div></div>
      <button class="btn btn-primary" onclick="modalAbsence()">+ Saisir absence</button>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="stat-icon rose">📅</div><div><div class="stat-value">${absences.length}</div><div class="stat-label">Total absences</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${totalJust}</div><div class="stat-label">Justifiées</div></div></div>
      <div class="stat-card"><div class="stat-icon amber">⚠️</div><div><div class="stat-value">${totalInjust}</div><div class="stat-label">Non justifiées</div></div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="toolbar" style="margin:0">
          <input type="date" class="filter-input" id="fADate" onchange="filterAbsences()">
          <select class="filter-input" id="fAClasse" onchange="filterAbsences()">
            <option value="">Toutes les classes</option>${classOpts}
          </select>
          <select class="filter-input" id="fAJust" onchange="filterAbsences()">
            <option value="">Tous</option>
            <option value="1">Justifiées</option>
            <option value="0">Non justifiées</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table id="abs-table">
          <thead><tr><th>Élève</th><th>Classe</th><th>Date</th><th>Matière</th><th>Motif</th><th>Justifiée</th><th>Actions</th></tr></thead>
          <tbody>
            ${absences.length ? absences.map(a=>`<tr data-classe="${a.classe}" data-just="${a.justifiee}" data-date="${a.date_absence}">
              <td><strong>${a.prenom} ${a.nom}</strong></td>
              <td>${a.classe||'—'}</td>
              <td>${fmtDate(a.date_absence)}</td>
              <td>${a.matiere||'—'}</td>
              <td>${a.motif||'—'}</td>
              <td>
                <span class="badge ${a.justifiee?'badge-green':'badge-rose'}">${a.justifiee?'Oui':'Non'}</span>
              </td>
              <td>
                <div style="display:flex;gap:4px">
                  ${!a.justifiee?`<button class="btn btn-sm btn-success btn-icon" onclick="justifierAbsence(${a.id})" title="Justifier">✅</button>`:''}
                  <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerAbsence(${a.id})" title="Supprimer">🗑</button>
                </div>
              </td>
            </tr>`).join('') : '<tr><td colspan="7"><div class="empty"><div class="empty-ico">📅</div><div class="empty-title">Aucune absence</div></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
    window._absEleves = eleves;
  } catch(e) { toast(e.message,'err'); }
}

function filterAbsences() {
  const date = document.getElementById('fADate').value;
  const classe = document.getElementById('fAClasse').value;
  const just = document.getElementById('fAJust').value;
  document.querySelectorAll('#abs-table tbody tr').forEach(row => {
    let show = true;
    if (date && row.dataset.date !== date) show = false;
    if (classe && row.dataset.classe !== classe) show = false;
    if (just !== '' && row.dataset.just !== just) show = false;
    row.style.display = show ? '' : 'none';
  });
}

async function modalAbsence() {
  const eleves = window._absEleves || await API.getEleves();
  const matieres = ['Mathématiques','Français','Arabe','Anglais','SVT','Physique-Chimie','Histoire-Géo','Philosophie','Informatique','EPS'];
  
  openModal('+ Saisir une absence', `
  <div class="form-grid">
    <div class="form-group full">
      <label class="form-label">Élève *</label>
      <select class="form-control" id="aEleve">
        <option value="">Sélectionner...</option>
        ${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom} — ${e.classe}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Date *</label><input type="date" class="form-control" id="aDate" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label class="form-label">Matière</label>
      <select class="form-control" id="aMatiere"><option value="">—</option>${matieres.map(m=>`<option>${m}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Heure début</label><input type="time" class="form-control" id="aHDeb" value="08:00"></div>
    <div class="form-group"><label class="form-label">Heure fin</label><input type="time" class="form-control" id="aHFin" value="10:00"></div>
    <div class="form-group"><label class="form-label">Justifiée</label>
      <select class="form-control" id="aJust"><option value="0">Non</option><option value="1">Oui</option></select></div>
    <div class="form-group full"><label class="form-label">Motif</label><input class="form-control" id="aMotif" placeholder="Ex: Maladie, Sans motif..."></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveAbsence()">Enregistrer</button>
  </div>`);
}

async function saveAbsence() {
  const data = {
    eleve_id: document.getElementById('aEleve').value,
    date_absence: document.getElementById('aDate').value,
    matiere: document.getElementById('aMatiere').value,
    heure_debut: document.getElementById('aHDeb').value,
    heure_fin: document.getElementById('aHFin').value,
    justifiee: document.getElementById('aJust').value==='1',
    motif: document.getElementById('aMotif').value.trim(),
  };
  if (!data.eleve_id) { toast('Sélectionnez un élève','err'); return; }
  if (!data.date_absence) { toast('Date requise','err'); return; }
  try {
    await API.createAbsence(data);
    toast('Absence enregistrée','ok');
    closeModal(); loadAbsences();
  } catch(e) { toast(e.message,'err'); }
}

async function justifierAbsence(id) {
  try {
    await API.updateAbsence(id, { justifiee: true, motif: 'Justifiée' });
    toast('Absence justifiée','ok'); loadAbsences();
  } catch(e) { toast(e.message,'err'); }
}

async function supprimerAbsence(id) {
  if (!confirm('Supprimer cette absence ?')) return;
  try { await API.deleteAbsence(id); toast('Absence supprimée','ok'); loadAbsences(); } catch(e) { toast(e.message,'err'); }
}
