/* emploi.js */
async function loadEmploi() {
  const v = document.getElementById('view-emploi');
  try {
    const classes = await API.getClasses();
    const classOpts = classes.map(c=>`<option value="${c.nom}">${c.nom}</option>`).join('');
    
    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🗓 Emploi du temps</div></div>
      <div class="page-actions">
        <select class="filter-input" id="edtClasse" onchange="renderEDT()">
          <option value="">Choisir une classe</option>${classOpts}
        </select>
        <button class="btn btn-primary" onclick="modalCours()">+ Ajouter cours</button>
      </div>
    </div>
    <div class="card">
      <div id="edt-container">
        <div class="empty" style="padding:60px"><div class="empty-ico">🗓</div><div class="empty-title">Sélectionnez une classe</div><div class="empty-sub">pour afficher l'emploi du temps</div></div>
      </div>
    </div>`;
    window._edtClasses = classes;
  } catch(e) { toast(e.message,'err'); }
}

const JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MAT_COLORS = {'Mathématiques':'#dbeafe','Français':'#dcfce7','Arabe':'#fef9c3','Anglais':'#fce7f3','SVT':'#ede9fe','Physique-Chimie':'#ffedd5','Histoire-Géo':'#f0fdf4','EPS':'#fef3c7','Informatique':'#e0f2fe','Philosophie':'#fdf4ff'};
function matColor(m) { return MAT_COLORS[m]||'#f1f5f9'; }

async function renderEDT() {
  const classe = document.getElementById('edtClasse').value;
  if (!classe) return;
  try {
    const cours = await API.getEmploi(qs({classe}));
    
    // Group by jour
    const byJour = {};
    JOURS.forEach(j => byJour[j]=[]);
    cours.forEach(c => { if(byJour[c.jour]) byJour[c.jour].push(c); });
    
    // Get all unique hours
    const heures = [...new Set(cours.map(c=>c.heure_debut))].sort();
    if (!heures.length) {
      document.getElementById('edt-container').innerHTML = `<div class="empty"><div class="empty-ico">📅</div><div class="empty-title">Aucun cours programmé</div><div class="empty-sub">Ajoutez des cours pour cette classe</div></div>`;
      return;
    }

    document.getElementById('edt-container').innerHTML = `
    <div style="overflow-x:auto;padding:16px">
      <table style="width:100%;border-collapse:separate;border-spacing:4px">
        <thead>
          <tr>
            <th style="background:#0f172a;color:#fff;padding:10px;border-radius:8px;font-size:12px;width:80px">Horaire</th>
            ${JOURS.map(j=>`<th style="background:#0f172a;color:#fff;padding:10px;border-radius:8px;font-size:12px">${j}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${heures.map(h=>`
            <tr>
              <td style="background:var(--bg);text-align:center;font-size:11px;font-weight:700;color:var(--muted);padding:8px;border-radius:8px">${h}</td>
              ${JOURS.map(j=>{
                const slot = byJour[j].find(c=>c.heure_debut===h);
                if (!slot) return `<td style="background:var(--bg);border-radius:8px;min-height:60px"></td>`;
                const bg = matColor(slot.matiere);
                return `<td style="background:${bg};border-radius:8px;padding:8px;cursor:pointer" title="Supprimer" onclick="if(confirm('Supprimer ce cours ?'))supprimerCours(${slot.id})">
                  <div style="font-size:12px;font-weight:700;color:#1e293b">${slot.matiere}</div>
                  <div style="font-size:11px;color:#475569">${slot.professeur||''}</div>
                  <div style="font-size:10px;color:#64748b">${slot.salle||''} · ${slot.heure_debut}–${slot.heure_fin}</div>
                </td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  } catch(e) { toast(e.message,'err'); }
}

async function modalCours() {
  const classes = window._edtClasses||[];
  const profs = await API.getProfesseurs();
  const matieres = ['Mathématiques','Français','Arabe','Anglais','SVT','Physique-Chimie','Histoire-Géo','Philosophie','Informatique','EPS'];
  const selectedClasse = document.getElementById('edtClasse')?.value||'';
  
  openModal('+ Ajouter un cours', `
  <div class="form-grid">
    <div class="form-group full">
      <label class="form-label">Classe *</label>
      <select class="form-control" id="cCls">
        ${classes.map(c=>`<option value="${c.nom}" ${c.nom===selectedClasse?'selected':''}>${c.nom}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Jour *</label>
      <select class="form-control" id="cJour">${JOURS.map(j=>`<option>${j}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Matière *</label>
      <select class="form-control" id="cMat">${matieres.map(m=>`<option>${m}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Heure début *</label>
      <input type="time" class="form-control" id="cDeb" value="08:00">
    </div>
    <div class="form-group">
      <label class="form-label">Heure fin *</label>
      <input type="time" class="form-control" id="cFin" value="10:00">
    </div>
    <div class="form-group">
      <label class="form-label">Professeur</label>
      <select class="form-control" id="cProf">
        <option value="">—</option>
        ${profs.map(p=>`<option>${p.prenom} ${p.nom}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Salle</label>
      <input class="form-control" id="cSalle" placeholder="ex: Salle A1">
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveCours()">Ajouter</button>
  </div>`);
}

async function saveCours() {
  const data = {
    classe: document.getElementById('cCls').value,
    jour: document.getElementById('cJour').value,
    matiere: document.getElementById('cMat').value,
    heure_debut: document.getElementById('cDeb').value,
    heure_fin: document.getElementById('cFin').value,
    professeur: document.getElementById('cProf').value,
    salle: document.getElementById('cSalle').value.trim(),
  };
  try {
    await API.createCours(data);
    toast('Cours ajouté','ok');
    closeModal();
    if(document.getElementById('edtClasse')?.value===data.classe) renderEDT();
  } catch(e) { toast(e.message,'err'); }
}

async function supprimerCours(id) {
  try { await API.deleteCours(id); toast('Cours supprimé','ok'); renderEDT(); } catch(e) { toast(e.message,'err'); }
}
