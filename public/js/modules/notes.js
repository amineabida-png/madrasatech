/* notes.js */
let _notesFiltres = { classe:'', matiere:'', trimestre:'' };

async function loadNotes() {
  const v = document.getElementById('view-notes');
  try {
    const [classes, eleves] = await Promise.all([API.getClasses(), API.getEleves()]);
    const classOpts = classes.map(c=>`<option value="${c.nom}">${c.nom}</option>`).join('');
    const matieres = ['Mathématiques','Français','Arabe','Anglais','SVT','Physique-Chimie','Histoire-Géo','Philosophie','Informatique','EPS'];

    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📝 Notes & Bulletins</div></div>
      <button class="btn btn-primary" onclick="modalNote()">+ Saisir note</button>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="switchNoteTab(event,'notes-list')">📋 Notes</button>
      <button class="tab" onclick="switchNoteTab(event,'notes-bulletin')">📄 Bulletins</button>
    </div>

    <div id="notes-list">
      <div class="card">
        <div class="card-header">
          <div class="toolbar" style="margin:0">
            <select class="filter-input" id="fNClasse" onchange="_notesFiltres.classe=this.value;fetchNotes()">
              <option value="">Toutes les classes</option>${classOpts}
            </select>
            <select class="filter-input" id="fNMat" onchange="_notesFiltres.matiere=this.value;fetchNotes()">
              <option value="">Toutes les matières</option>
              ${matieres.map(m=>`<option>${m}</option>`).join('')}
            </select>
            <select class="filter-input" id="fNTrim" onchange="_notesFiltres.trimestre=this.value;fetchNotes()">
              <option value="">Tous les trimestres</option>
              <option value="1">Trimestre 1</option>
              <option value="2">Trimestre 2</option>
              <option value="3">Trimestre 3</option>
            </select>
          </div>
        </div>
        <div id="notes-table-body"><div class="card-body" style="text-align:center;padding:40px;color:var(--muted)">Sélectionnez un filtre pour afficher les notes</div></div>
      </div>
    </div>

    <div id="notes-bulletin" style="display:none">
      <div class="card">
        <div class="card-body">
          <div class="form-grid" style="max-width:500px">
            <div class="form-group">
              <label class="form-label">Classe</label>
              <select class="form-control" id="bClasse" onchange="loadElevesForBulletin()">
                <option value="">Sélectionner une classe</option>${classOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Élève</label>
              <select class="form-control" id="bEleve"><option value="">D'abord choisir une classe</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Trimestre</label>
              <select class="form-control" id="bTrimestre">
                <option value="1">Trimestre 1</option>
                <option value="2">Trimestre 2</option>
                <option value="3">Trimestre 3</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-primary" onclick="previewBulletin()">👁 Prévisualiser</button>
            <button class="btn btn-ghost" onclick="printBulletinSelected()">🖨 Imprimer</button>
          </div>
          <div id="bulletin-preview" style="margin-top:20px"></div>
        </div>
      </div>
    </div>`;
    
    window._elevesForNotes = eleves;
  } catch(e) { toast(e.message,'err'); }
}

async function fetchNotes() {
  const params = qs({classe:_notesFiltres.classe,matiere:_notesFiltres.matiere,trimestre:_notesFiltres.trimestre});
  if(!params) return;
  try {
    const notes = await API.getNotes(params);
    const tbody = document.getElementById('notes-table-body');
    tbody.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Élève</th><th>Classe</th><th>Matière</th><th>Note</th><th>Coef</th><th>Trimestre</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>
        ${notes.length ? notes.map(n=>`<tr>
          <td><strong>${n.prenom} ${n.nom}</strong></td>
          <td>${n.classe}</td>
          <td>${n.matiere}</td>
          <td><strong style="color:${n.note>=10?'var(--emerald)':'var(--rose)'}">${fmtNote(n.note)}</strong></td>
          <td>${n.coefficient}</td>
          <td>T${n.trimestre}</td>
          <td>${n.type_eval||'—'}</td>
          <td>${fmtDate(n.date_eval)}</td>
          <td><button class="btn btn-sm btn-danger btn-icon" onclick="supprimerNote(${n.id})">🗑</button></td>
        </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">Aucune note trouvée</td></tr>'}
      </tbody></table></div>`;
  } catch(e) { toast(e.message,'err'); }
}

function switchNoteTab(e, id) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById('notes-list').style.display=id==='notes-list'?'block':'none';
  document.getElementById('notes-bulletin').style.display=id==='notes-bulletin'?'block':'none';
}

async function modalNote() {
  const [classes, eleves] = await Promise.all([API.getClasses(), API.getEleves()]);
  const matieres = ['Mathématiques','Français','Arabe','Anglais','SVT','Physique-Chimie','Histoire-Géo','Philosophie','Informatique','EPS'];
  
  openModal('+ Saisir une note', `
  <div class="form-grid">
    <div class="form-group full">
      <label class="form-label">Classe (filtre)</label>
      <select class="form-control" id="nClasse" onchange="filterElevesNote()">
        <option value="">Toutes</option>
        ${classes.map(c=>`<option>${c.nom}</option>`).join('')}
      </select>
    </div>
    <div class="form-group full">
      <label class="form-label">Élève *</label>
      <select class="form-control" id="nEleve">
        <option value="">Sélectionner...</option>
        ${eleves.map(e=>`<option value="${e.id}" data-classe="${e.classe}">${e.prenom} ${e.nom} — ${e.classe}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Matière *</label>
      <select class="form-control" id="nMatiere">${matieres.map(m=>`<option>${m}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Note * (/20)</label>
      <input type="number" class="form-control" id="nNote" min="0" max="20" step="0.25" placeholder="12.50">
    </div>
    <div class="form-group">
      <label class="form-label">Coefficient</label>
      <input type="number" class="form-control" id="nCoef" value="2" min="0.5" max="5" step="0.5">
    </div>
    <div class="form-group">
      <label class="form-label">Trimestre *</label>
      <select class="form-control" id="nTrim">
        <option value="1">Trimestre 1</option>
        <option value="2">Trimestre 2</option>
        <option value="3">Trimestre 3</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Type d'évaluation</label>
      <select class="form-control" id="nType">
        <option value="controle">Contrôle</option>
        <option value="examen">Examen</option>
        <option value="oral">Oral</option>
        <option value="devoir">Devoir maison</option>
        <option value="tp">TP</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" class="form-control" id="nDate" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group full">
      <label class="form-label">Observations</label>
      <input class="form-control" id="nObs" placeholder="Commentaire optionnel">
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveNote()">Enregistrer</button>
  </div>`);
}

function filterElevesNote() {
  const cls = document.getElementById('nClasse').value;
  document.querySelectorAll('#nEleve option').forEach(o=>{
    if(!o.value) return;
    o.style.display = !cls || o.dataset.classe===cls ? '' : 'none';
  });
}

async function saveNote() {
  const data = {
    eleve_id: document.getElementById('nEleve').value,
    matiere: document.getElementById('nMatiere').value,
    note: parseFloat(document.getElementById('nNote').value),
    coefficient: parseFloat(document.getElementById('nCoef').value)||1,
    trimestre: parseInt(document.getElementById('nTrim').value),
    type_eval: document.getElementById('nType').value,
    date_eval: document.getElementById('nDate').value,
    observations: document.getElementById('nObs').value.trim(),
    annee_scolaire: '2024-2025',
  };
  if (!data.eleve_id) { toast('Sélectionnez un élève','err'); return; }
  if (isNaN(data.note)||data.note<0||data.note>20) { toast('Note invalide (0-20)','err'); return; }
  try {
    await API.createNote(data);
    toast('Note enregistrée','ok');
    closeModal(); fetchNotes();
  } catch(e) { toast(e.message,'err'); }
}

async function supprimerNote(id) {
  if (!confirm('Supprimer cette note ?')) return;
  try { await API.deleteNote(id); toast('Note supprimée','ok'); fetchNotes(); } catch(e) { toast(e.message,'err'); }
}

async function loadElevesForBulletin() {
  const cls = document.getElementById('bClasse').value;
  if (!cls) return;
  const eleves = window._elevesForNotes?.filter(e=>e.classe===cls)||[];
  document.getElementById('bEleve').innerHTML = `<option value="">Sélectionner...</option>${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom}</option>`).join('')}`;
}

async function previewBulletin() {
  const eleveId = document.getElementById('bEleve').value;
  const trimestre = document.getElementById('bTrimestre').value;
  if (!eleveId) { toast('Sélectionnez un élève','err'); return; }
  try {
    const b = await API.getBulletin(eleveId, trimestre);
    document.getElementById('bulletin-preview').innerHTML = `
    <div style="border:2px solid var(--primary);border-radius:12px;padding:20px">
      <h3 style="margin-bottom:12px;color:var(--primary)">📄 Bulletin — Trimestre ${trimestre}</h3>
      <div style="display:flex;gap:16px;margin-bottom:12px;font-size:13px;flex-wrap:wrap">
        <span><strong>Élève :</strong> ${b.eleve.prenom} ${b.eleve.nom}</span>
        <span><strong>Classe :</strong> ${b.eleve.classe}</span>
        <span><strong>MASSAR :</strong> ${b.eleve.massar||'—'}</span>
      </div>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <thead><tr style="background:var(--primary);color:#fff"><th style="padding:6px 10px;text-align:left">Matière</th><th style="padding:6px 10px;text-align:center">Moyenne</th><th style="padding:6px 10px;text-align:center">Coef</th></tr></thead>
        <tbody>${b.matieres.map((m,i)=>`<tr style="background:${i%2?'var(--bg)':'#fff'}"><td style="padding:6px 10px;border-bottom:1px solid var(--border)">${m.matiere}</td><td style="padding:6px 10px;text-align:center;font-weight:700;color:${m.moyenne>=10?'var(--emerald)':'var(--rose)'};">${m.moyenne}/20</td><td style="padding:6px 10px;text-align:center">${m.coefficient}</td></tr>`).join('')}</tbody>
      </table>
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;background:var(--primary-light);padding:12px;border-radius:8px">
        <div><strong>Moyenne générale :</strong> <span style="font-size:20px;font-weight:800;color:var(--primary)">${b.moyenneGenerale}/20</span></div>
        <div style="font-weight:700;color:var(--primary)">${b.mention}</div>
      </div>
    </div>`;
    window._lastBulletin = b;
  } catch(e) { toast(e.message,'err'); }
}

function printBulletinSelected() {
  const b = window._lastBulletin;
  if (!b) { toast('Prévisualisez d\'abord le bulletin','err'); return; }
  imprimerBulletin(b.eleve.id, b.trimestre);
}
