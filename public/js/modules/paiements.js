/* paiements.js */
async function loadPaiements() {
  const v = document.getElementById('view-paiements');
  try {
    const [paiements, eleves] = await Promise.all([api.getPaiements(), api.getEleves()]);
    const totalPaye = paiements.filter(p=>p.statut==='paye').reduce((a,p)=>a+p.montant,0);
    const totalImpaye = paiements.filter(p=>p.statut==='impaye').reduce((a,p)=>a+p.montant_du,0);
    const totalPartiel = paiements.filter(p=>p.statut==='partiel').reduce((a,p)=>a+p.montant,0);
    const nbImpaye = paiements.filter(p=>p.statut==='impaye').length;
    const MOIS = ['Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai','Juin'];

    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">💰 Paiements</div><div class="page-sub">${paiements.length} paiement(s)</div></div>
      <button class="btn btn-primary" onclick="modalPaiement()">+ Enregistrer paiement</button>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value" style="font-size:16px">${fmtMoney(totalPaye)}</div><div class="stat-label">Total encaissé</div></div></div>
      <div class="stat-card"><div class="stat-icon rose">❌</div><div><div class="stat-value" style="font-size:16px">${fmtMoney(totalImpaye)}</div><div class="stat-label">Total impayés</div></div></div>
      <div class="stat-card"><div class="stat-icon amber">⏳</div><div><div class="stat-value" style="font-size:16px">${fmtMoney(totalPartiel)}</div><div class="stat-label">Paiements partiels</div></div></div>
      <div class="stat-card"><div class="stat-icon rose">⚠️</div><div><div class="stat-value">${nbImpaye}</div><div class="stat-label">Dossiers impayés</div></div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Historique des paiements</span>
        <div class="toolbar" style="margin:0">
          <select class="filter-input" id="fPStatut" onchange="filterPaiements()">
            <option value="">Tous</option>
            <option value="paye">Payés</option>
            <option value="impaye">Impayés</option>
            <option value="partiel">Partiels</option>
          </select>
          <select class="filter-input" id="fPMois" onchange="filterPaiements()">
            <option value="">Tous les mois</option>
            ${MOIS.map(m=>`<option>${m}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" onclick="exportCSV(window._paiements||[],'paiements.csv')">📥 CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table id="paie-table">
          <thead><tr><th>Élève</th><th>Classe</th><th>Mois</th><th>Montant dû</th><th>Payé</th><th>Statut</th><th>Date paiement</th><th>Mode</th><th>Actions</th></tr></thead>
          <tbody>
            ${paiements.length ? paiements.map(p=>`<tr data-statut="${p.statut}" data-mois="${p.mois}">
              <td><strong>${p.prenom} ${p.nom}</strong></td>
              <td>${p.classe||'—'}</td>
              <td>${p.mois} ${p.annee}</td>
              <td>${fmtMoney(p.montant_du)}</td>
              <td><strong style="color:${p.montant>0?'var(--emerald)':'var(--rose)'}">${fmtMoney(p.montant)}</strong></td>
              <td><span class="badge ${p.statut==='paye'?'badge-green':p.statut==='partiel'?'badge-amber':'badge-rose'}">${p.statut}</span></td>
              <td>${fmtDate(p.date_paiement)||'—'}</td>
              <td>${p.mode_paiement||'—'}</td>
              <td>
                ${p.statut!=='paye'?`<button class="btn btn-sm btn-success" onclick="modalEncaisser(${p.id},${p.montant_du},'${p.prenom} ${p.nom}')">Encaisser</button>`:'<span style="font-size:18px">✅</span>'}
              </td>
            </tr>`).join('') : '<tr><td colspan="9"><div class="empty"><div class="empty-ico">💰</div><div class="empty-title">Aucun paiement</div></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
    window._paiements = paiements;
    window._paiementsEleves = eleves;
  } catch(e) { toast(e.message,'err'); }
}

function filterPaiements() {
  const statut = document.getElementById('fPStatut').value;
  const mois = document.getElementById('fPMois').value;
  document.querySelectorAll('#paie-table tbody tr').forEach(row => {
    let show = true;
    if (statut && row.dataset.statut !== statut) show = false;
    if (mois && row.dataset.mois !== mois) show = false;
    row.style.display = show ? '' : 'none';
  });
}

async function modalPaiement() {
  const eleves = window._paiementsEleves || await api.getEleves();
  const MOIS = ['Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai','Juin'];
  
  openModal('+ Enregistrer un paiement', `
  <div class="form-grid">
    <div class="form-group full">
      <label class="form-label">Élève *</label>
      <select class="form-control" id="pEleve">
        <option value="">Sélectionner...</option>
        ${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom} — ${e.classe}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Mois *</label>
      <select class="form-control" id="pMois">${MOIS.map(m=>`<option>${m}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Année</label>
      <input type="number" class="form-control" id="pAnnee" value="${new Date().getFullYear()}" min="2020" max="2030">
    </div>
    <div class="form-group">
      <label class="form-label">Montant dû (MAD) *</label>
      <input type="number" class="form-control" id="pDu" value="800" min="0">
    </div>
    <div class="form-group">
      <label class="form-label">Montant encaissé (MAD)</label>
      <input type="number" class="form-control" id="pPaye" value="0" min="0">
    </div>
    <div class="form-group">
      <label class="form-label">Mode de paiement</label>
      <select class="form-control" id="pMode">
        <option value="especes">Espèces</option>
        <option value="virement">Virement</option>
        <option value="cheque">Chèque</option>
        <option value="cmi">CMI/Carte</option>
      </select>
    </div>
    <div class="form-group full">
      <label class="form-label">Référence / Note</label>
      <input class="form-control" id="pRef" placeholder="N° chèque, référence...">
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="savePaiement()">Enregistrer</button>
  </div>`);
}

async function savePaiement() {
  const data = {
    eleve_id: document.getElementById('pEleve').value,
    mois: document.getElementById('pMois').value,
    annee: parseInt(document.getElementById('pAnnee').value),
    montant_du: parseFloat(document.getElementById('pDu').value)||0,
    montant: parseFloat(document.getElementById('pPaye').value)||0,
    mode_paiement: document.getElementById('pMode').value,
    reference: document.getElementById('pRef').value.trim(),
  };
  if (!data.eleve_id) { toast('Sélectionnez un élève','err'); return; }
  try {
    const r = await api.createPaiement(data);
    toast(`Paiement enregistré (${r.statut})`, 'ok');
    closeModal(); loadPaiements();
  } catch(e) { toast(e.message,'err'); }
}

function modalEncaisser(id, montantDu, eleve) {
  openModal(`💳 Encaisser — ${eleve}`, `
  <p style="margin-bottom:16px;color:var(--muted);font-size:13px">Montant dû : <strong>${fmtMoney(montantDu)}</strong></p>
  <div class="form-grid">
    <div class="form-group">
      <label class="form-label">Montant encaissé *</label>
      <input type="number" class="form-control" id="encMontant" value="${montantDu}" min="0">
    </div>
    <div class="form-group">
      <label class="form-label">Mode de paiement</label>
      <select class="form-control" id="encMode">
        <option value="especes">Espèces</option>
        <option value="virement">Virement</option>
        <option value="cheque">Chèque</option>
        <option value="cmi">CMI/Carte</option>
      </select>
    </div>
    <div class="form-group full">
      <label class="form-label">Référence</label>
      <input class="form-control" id="encRef" placeholder="Référence optionnelle">
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="encaisser(${id})">Confirmer</button>
  </div>`);
}

async function encaisser(id) {
  const data = {
    montant: parseFloat(document.getElementById('encMontant').value)||0,
    mode_paiement: document.getElementById('encMode').value,
    reference: document.getElementById('encRef').value.trim(),
  };
  try {
    const r = await api.updatePaiement(id, data);
    toast(`Encaissement confirmé (${r.statut})`, 'ok');
    closeModal(); loadPaiements();
  } catch(e) { toast(e.message,'err'); }
}
