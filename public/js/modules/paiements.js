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
                <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
                  ${p.statut!=='paye'?`<button class="btn btn-sm btn-success" onclick="modalEncaisser(${p.id},${p.montant_du},'${p.prenom} ${p.nom}')">💰 Encaisser</button>`:'<span style="font-size:16px">✅</span>'}
                  <button class="btn btn-sm btn-ghost" title="Ticket caisse" onclick='imprimerPaiementTicket(${JSON.stringify(p)})'>🧾</button>
                  <button class="btn btn-sm btn-ghost" title="Imprimer A4" onclick='imprimerPaiementA4(${JSON.stringify(p)})'>🖨️</button>
                </div>
              </td>
            </tr>`).join('') : '<tr><td colspan="9"><div class="empty"><div class="empty-ico">💰</div><div class="empty-title">Aucun paiement</div></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
    window._paiements = paiements;
    window._paiementsEleves = eleves;
  } catch(e) { console.error('[paiements]', e); toast(e.message,'err'); }
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
  } catch(e) { console.error('[paiements]', e); toast(e.message,'err'); }
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
  } catch(e) { console.error('[paiements]', e); toast(e.message,'err'); }
}

// ── IMPRESSION PAIEMENT ──────────────────────────────────────
function imprimerPaiementTicket(p) {
  const school = document.querySelector('.top-school')?.textContent || 'MadrasaTech';
  const win = window.open('','_blank','width=350,height=500');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:10px;background:#fff}
  .c{text-align:center}.b{font-weight:bold}.big{font-size:15px;font-weight:800}
  .sep{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;padding:2px 0}
  .total{display:flex;justify-content:space-between;font-weight:800;font-size:14px;border-top:2px solid #000;margin-top:4px;padding-top:4px}
  @media print{@page{size:80mm auto;margin:3mm}}</style></head><body>
  <div class="c big">🏫 ${school}</div>
  <div class="c" style="font-size:10px;margin:3px 0">Reçu de Paiement</div>
  <div class="sep"></div>
  <div class="row"><span>Élève:</span><span class="b">${p.prenom} ${p.nom}</span></div>
  <div class="row"><span>Classe:</span><span>${p.classe||'—'}</span></div>
  <div class="row"><span>Mois:</span><span>${p.mois} ${p.annee}</span></div>
  <div class="row"><span>Mode:</span><span>${p.mode_paiement||'Espèces'}</span></div>
  <div class="row"><span>Date:</span><span>${new Date().toLocaleDateString('fr-MA')}</span></div>
  <div class="sep"></div>
  <div class="total"><span>MONTANT</span><span>${(p.montant||0).toLocaleString('fr-MA')} MAD</span></div>
  <div class="row" style="margin-top:4px"><span>Dû:</span><span>${(p.montant_du||0).toLocaleString('fr-MA')} MAD</span></div>
  <div class="row"><span>Statut:</span><span class="b">${p.statut==='paye'?'✅ PAYÉ':p.statut==='partiel'?'⚠️ PARTIEL':'❌ IMPAYÉ'}</span></div>
  <div class="sep"></div>
  <div class="c" style="font-size:11px;margin-top:6px">Merci de votre confiance !<br>★ ${school} ★</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
  </body></html>`);
  win.document.close();
}

function imprimerPaiementA4(p) {
  const school = document.querySelector('.top-school')?.textContent || 'MadrasaTech';
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1e293b;font-size:13px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #1a56db}
  .logo{font-size:28px;font-weight:900;color:#1a56db}.sub{font-size:12px;color:#94a3b8}
  .recu-title{font-size:20px;font-weight:800;color:#0f172a}.recu-num{font-size:12px;color:#64748b}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0;padding:20px;background:#f8fafc;border-radius:12px}
  .info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:4px}
  .info-val{font-size:14px;font-weight:600;color:#0f172a}
  .montant-box{background:#0f172a;color:#fff;border-radius:12px;padding:24px;text-align:center;margin:24px 0}
  .montant-val{font-size:36px;font-weight:900;color:#fff}
  .montant-lbl{font-size:12px;color:rgba(255,255,255,.6);margin-top:4px}
  .statut{display:inline-block;padding:6px 16px;border-radius:99px;font-weight:700;font-size:13px}
  .statut-paye{background:#dcfce7;color:#059669}.statut-partiel{background:#fef9c3;color:#d97706}.statut-impaye{background:#fee2e2;color:#dc2626}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
  .sign{text-align:center;width:160px;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:40px;font-size:11px;color:#64748b}
  @media print{body{padding:20px}@page{size:A4;margin:15mm}}</style></head><body>
  <div class="header">
    <div><div class="logo">🏫 ${school}</div><div class="sub">Système de Gestion Scolaire</div></div>
    <div style="text-align:right"><div class="recu-title">REÇU DE PAIEMENT</div>
    <div class="recu-num">Date: ${new Date().toLocaleDateString('fr-MA',{day:'2-digit',month:'long',year:'numeric'})}</div>
    <div style="margin-top:8px"><span class="statut statut-${p.statut||'paye'}">${p.statut==='paye'?'✅ PAYÉ':p.statut==='partiel'?'⚠️ PARTIEL':'❌ IMPAYÉ'}</span></div>
    </div>
  </div>
  <div class="info-grid">
    <div><div class="info-label">Élève</div><div class="info-val">${p.prenom} ${p.nom}</div></div>
    <div><div class="info-label">Classe</div><div class="info-val">${p.classe||'—'}</div></div>
    <div><div class="info-label">Période</div><div class="info-val">${p.mois} ${p.annee}</div></div>
    <div><div class="info-label">Mode de paiement</div><div class="info-val">${p.mode_paiement||'Espèces'}</div></div>
    <div><div class="info-label">Montant dû</div><div class="info-val">${(p.montant_du||0).toLocaleString('fr-MA')} MAD</div></div>
    <div><div class="info-label">N° Massar</div><div class="info-val">${p.massar||'—'}</div></div>
  </div>
  <div class="montant-box">
    <div class="montant-val">${(p.montant||0).toLocaleString('fr-MA')} MAD</div>
    <div class="montant-lbl">Montant encaissé</div>
  </div>
  <div class="footer">
    <div><div>Merci de votre confiance</div><div>${school} — Système de Gestion Scolaire</div></div>
    <div class="sign">Signature & Cachet</div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  win.document.close();
}
