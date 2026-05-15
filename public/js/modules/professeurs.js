/* professeurs.js */
async function loadProfesseurs() {
  const v = document.getElementById('view-professeurs');
  try {
    const profs = await api.getProfesseurs();
    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">👨‍🏫 Professeurs</div><div class="page-sub">${profs.length} professeur(s)</div></div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="exportCSV(window._profs||[],'professeurs.csv')">📥 Export</button>
        <button class="btn btn-primary" onclick="modalProf()">+ Ajouter</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Professeur</th><th>Matière</th><th>Contact</th><th>Contrat</th><th>Salaire</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${profs.length ? profs.map(p=>`
              <tr>
                <td style="display:flex;align-items:center;gap:10px">
                  <div class="avatar ${avColor(p.id)}">${initials(p.nom,p.prenom)}</div>
                  <div><strong>${p.prenom} ${p.nom}</strong><br><small style="color:var(--muted)">${p.cin||'—'}</small></div>
                </td>
                <td><span class="badge badge-blue">${p.matiere||'—'}</span></td>
                <td>${p.telephone||'—'}<br><small style="color:var(--muted)">${p.email||''}</small></td>
                <td>${p.type_contrat||'CDI'}</td>
                <td><strong>${fmtMoney(p.salaire)}</strong></td>
                <td><span class="badge ${p.statut==='actif'?'badge-green':'badge-muted'}">${p.statut||'actif'}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-sm btn-ghost btn-icon" onclick="modalProf(${p.id})" title="Modifier">✏️</button>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerProf(${p.id},'${p.prenom} ${p.nom}')" title="Supprimer">🗑</button>
                  </div>
                </td>
              </tr>`).join('') : `<tr><td colspan="7"><div class="empty"><div class="empty-ico">👨‍🏫</div><div class="empty-title">Aucun professeur</div></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
    window._profs = profs;
  } catch(e) { toast(e.message,'err'); }
}

async function modalProf(id=null) {
  let p = {};
  if (id) { try { const all = await api.getProfesseurs(); p = all.find(x=>x.id===id)||{}; } catch {} }
  openModal((id?'✏️ Modifier':'+ Ajouter') + ' Professeur', `
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Prénom *</label><input class="form-control" id="pPrenom" value="${p.prenom||''}"></div>
    <div class="form-group"><label class="form-label">Nom *</label><input class="form-control" id="pNom" value="${p.nom||''}"></div>
    <div class="form-group"><label class="form-label">CIN</label><input class="form-control" id="pCin" value="${p.cin||''}" placeholder="AB123456"></div>
    <div class="form-group"><label class="form-label">Matière *</label>
      <select class="form-control" id="pMatiere">
        ${['Mathématiques','Français','Arabe','Anglais','SVT','Physique-Chimie','Histoire-Géo','Philosophie','Informatique','EPS','Arts Plastiques','Musique','Économie'].map(m=>`<option ${p.matiere===m?'selected':''}>${m}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Téléphone</label><input class="form-control" id="pTel" value="${p.telephone||''}"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="pEmail" value="${p.email||''}"></div>
    <div class="form-group"><label class="form-label">Type contrat</label>
      <select class="form-control" id="pContrat">
        <option ${p.type_contrat==='CDI'||!p.type_contrat?'selected':''}>CDI</option>
        <option ${p.type_contrat==='CDD'?'selected':''}>CDD</option>
        <option ${p.type_contrat==='Vacataire'?'selected':''}>Vacataire</option>
        <option ${p.type_contrat==='Fonctionnaire'?'selected':''}>Fonctionnaire</option>
      </select></div>
    <div class="form-group"><label class="form-label">Salaire (MAD)</label><input type="number" class="form-control" id="pSalaire" value="${p.salaire||0}"></div>
    <div class="form-group"><label class="form-label">Date recrutement</label><input type="date" class="form-control" id="pDate" value="${p.date_recrutement||''}"></div>
    ${id?`<div class="form-group"><label class="form-label">Statut</label><select class="form-control" id="pStatut"><option value="actif" ${p.statut==='actif'||!p.statut?'selected':''}>Actif</option><option value="inactif" ${p.statut==='inactif'?'selected':''}>Inactif</option></select></div>`:''}
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveProf(${id||'null'})">${id?'Enregistrer':'Ajouter'}</button>
  </div>`);
}

async function saveProf(id) {
  const data = {
    prenom: document.getElementById('pPrenom').value.trim(),
    nom: document.getElementById('pNom').value.trim(),
    cin: document.getElementById('pCin').value.trim(),
    matiere: document.getElementById('pMatiere').value,
    telephone: document.getElementById('pTel').value.trim(),
    email: document.getElementById('pEmail').value.trim(),
    type_contrat: document.getElementById('pContrat').value,
    salaire: parseFloat(document.getElementById('pSalaire').value)||0,
    date_recrutement: document.getElementById('pDate').value,
  };
  if(id) data.statut = document.getElementById('pStatut')?.value||'actif';
  if (!data.prenom || !data.nom) { toast('Prénom et nom requis','err'); return; }
  try {
    if(id) await api.updateProfesseur(id,data); else await api.createProfesseur(data);
    toast(id?'Professeur modifié':'Professeur ajouté','ok');
    closeModal(); loadProfesseurs();
  } catch(e) { toast(e.message,'err'); }
}

async function supprimerProf(id, nom) {
  if (!confirm(`Supprimer ${nom} ?`)) return;
  try { await api.deleteProfesseur(id); toast('Professeur supprimé','ok'); loadProfesseurs(); } catch(e) { toast(e.message,'err'); }
}
