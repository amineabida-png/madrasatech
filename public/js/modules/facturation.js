// ══════════════════════════════════════════════════════════════
// MODULE FACTURATION — Ticket caisse & A4
// ══════════════════════════════════════════════════════════════
let _factures = [];

async function loadFacturation() {
  const v = document.getElementById('view-facturation');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const [factures, stats] = await Promise.all([
      api.get('/factures'),
      api.get('/factures/stats/resume')
    ]);
    _factures = factures;
    renderFacturation(factures, stats);
  } catch(e) {
    v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`;
  }
}

function renderFacturation(factures, stats) {
  const v = document.getElementById('view-facturation');
  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">🧾 Facturation</div>
      <div class="page-sub">${factures.length} facture(s) émise(s)</div></div>
    <button class="btn btn-primary" onclick="nouvelleFacture()">+ Nouvelle facture</button>
  </div>

  <!-- KPIs -->
  <div class="stats-grid" style="margin-bottom:1.5rem">
    <div class="stat-card"><div class="stat-icon blue">🧾</div><div><div class="stat-value">${stats.total||0}</div><div class="stat-label">Total factures</div></div></div>
    <div class="stat-card"><div class="stat-icon green">💰</div><div><div class="stat-value">${fmtMoney(stats.ca||0)}</div><div class="stat-label">CA total</div></div></div>
    <div class="stat-card"><div class="stat-icon amber">📅</div><div><div class="stat-value">${fmtMoney(stats.ce_mois||0)}</div><div class="stat-label">Ce mois</div></div></div>
    <div class="stat-card"><div class="stat-icon rose">❌</div><div><div class="stat-value">${stats.impayees||0}</div><div class="stat-label">Impayées</div></div></div>
  </div>

  <!-- Filtres -->
  <div class="card" style="margin-bottom:1rem">
    <div class="card-header" style="flex-wrap:wrap;gap:8px">
      <input class="form-control" style="max-width:220px" placeholder="🔍 Rechercher..." oninput="filtrerFactures(this.value)">
      <select class="form-control" style="max-width:160px" onchange="filtrerFacturesStatut(this.value)">
        <option value="">Tous statuts</option>
        <option value="payee">✅ Payées</option>
        <option value="impayee">❌ Impayées</option>
        <option value="annulee">🚫 Annulées</option>
      </select>
    </div>
  </div>

  <!-- Liste factures -->
  <div class="card">
    <div class="table-wrap">
      <table id="fact-table">
        <thead><tr>
          <th>N° Facture</th><th>Date</th><th>Client</th><th>Montant</th><th>Paiement</th><th>Statut</th><th>Actions</th>
        </tr></thead>
        <tbody id="fact-tbody">
          ${renderFactRows(factures)}
        </tbody>
      </table>
    </div>
  </div>

`;
  if (!document.getElementById('fact-modal')) {
    const div = document.createElement('div');
    div.id = 'fact-modal';
    div.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;align-items:center;justify-content:center';
    div.onclick = function(e){ if(e.target===this) closeFact(); };
    div.innerHTML = '<div class="modal-box" id="fact-modal-box" style="max-width:700px;max-height:92vh;overflow-y:auto"><div class="modal-header"><h3 id="fact-modal-title">Nouvelle facture</h3><button class="modal-close" onclick="closeFact()">✕</button></div><div class="modal-body" id="fact-modal-body"></div></div>';
    document.body.appendChild(div);
  }
}
function renderFactRows(factures) {
  if (!factures.length) return `<tr><td colspan="7"><div class="empty"><div class="empty-ico">🧾</div><div class="empty-title">Aucune facture</div><div class="empty-sub">Créez votre première facture</div></div></td></tr>`;
  const statutBadge = { payee:'badge-green', impayee:'badge-rose', annulee:'badge-gray' };
  const statutLabel = { payee:'✅ Payée', impayee:'❌ Impayée', annulee:'🚫 Annulée' };
  const modeIcon    = { especes:'💵', virement:'🏦', cheque:'📝', carte:'💳' };
  return factures.map(f => `
  <tr>
    <td><code style="background:var(--bg);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">${f.numero}</code></td>
    <td>${fmtDate(f.date_facture)}</td>
    <td>
      <strong>${f.client_nom}</strong>
      ${f.eleve_nom?`<br><small style="color:var(--muted)">${f.eleve_prenom} ${f.eleve_nom}</small>`:''}
    </td>
    <td><strong style="color:var(--primary)">${fmtMoney(f.total)}</strong></td>
    <td>${modeIcon[f.mode_paiement]||'💵'} ${f.mode_paiement}</td>
    <td><span class="badge ${statutBadge[f.statut]||'badge-gray'}">${statutLabel[f.statut]||f.statut}</span></td>
    <td>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-sm btn-ghost" onclick="imprimerTicket(${f.id})" title="Ticket caisse">🧾</button>
        <button class="btn btn-sm btn-ghost" onclick="imprimerA4(${f.id})" title="Imprimer A4">🖨️</button>
        <button class="btn btn-sm btn-ghost" onclick="modifierFacture(${f.id})" title="Modifier">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerFacture(${f.id})" title="Supprimer">🗑</button>
      </div>
    </td>
  </tr>`).join('');
}

function filtrerFactures(q) {
  document.querySelectorAll('#fact-table tbody tr[data-id]').forEach(r => {
    r.style.display = !q || r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

async function filtrerFacturesStatut(statut) {
  try {
    const url = statut ? `/factures?statut=${statut}` : '/factures';
    _factures = await api.get(url);
    document.getElementById('fact-tbody').innerHTML = renderFactRows(_factures);
  } catch(e) { showToast(e.message,'error'); }
}

// ── Nouvelle / Modifier facture ──────────────────────────────
async function nouvelleFacture() {
  const eleves = await api.getEleves().catch(()=>[]);
  window._factEleves = eleves;
  window._factId = null;
  window._factItems = [{ desc:'Scolarité', qte:1, prix:0 }];
  renderFactModal(null);
}

async function modifierFacture(id) {
  const f = await api.get('/factures/'+id);
  window._factId = id;
  window._factItems = f.items || [];
  window._factEleves = await api.getEleves().catch(()=>[]);
  renderFactModal(f);
}

function renderFactModal(f={}) {
  const eleves = window._factEleves || [];
  const titre = f.id ? '✏️ Modifier facture' : '🧾 Nouvelle facture';
  const bodyHtml = `
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Client / Nom *</label>
      <input class="form-control" id="f-client" value="${f.client_nom||''}" placeholder="Nom du client ou parent">
    </div>
    <div class="form-group"><label class="form-label">Élève lié</label>
      <select class="form-control" id="f-eleve" onchange="autoFillClient(this)">
        <option value="">— Aucun élève —</option>
        ${eleves.map(e=>'<option value="'+e.id+'" data-nom="'+e.prenom+' '+e.nom+'" data-tel="'+(e.telephone||'')+'"'+(f.eleve_id==e.id?' selected':'')+'>'+e.prenom+' '+e.nom+' — '+(e.classe||'—')+'</option>').join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Téléphone</label>
      <input class="form-control" id="f-tel" value="${f.client_tel||''}" placeholder="0600000000">
    </div>
    <div class="form-group"><label class="form-label">Date</label>
      <input type="date" class="form-control" id="f-date" value="${f.date_facture||new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group full"><label class="form-label">Adresse</label>
      <input class="form-control" id="f-addr" value="${f.client_adresse||''}" placeholder="Adresse (optionnel)">
    </div>
  </div>

  <!-- Articles -->
  <div style="margin:16px 0 8px;font-weight:700;font-size:14px;color:#374151">📋 Articles</div>
  <div id="f-items"></div>
  <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ajouterItem()">+ Ajouter un article</button>

  <!-- Totaux + options -->
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Remise (MAD)</label>
      <input type="number" class="form-control" id="f-remise" value="${f.remise||0}" min="0" oninput="calcTotal()">
    </div>
    <div class="form-group"><label class="form-label">Mode de paiement</label>
      <select class="form-control" id="f-mode">
        ${['especes','virement','cheque','carte'].map(m=>{const labels={especes:'💵 Espèces',virement:'🏦 Virement',cheque:'📝 Chèque',carte:'💳 Carte'};return '<option value="'+m+'"'+(f.mode_paiement===m?' selected':'')+'>'+labels[m]+'</option>';}).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Statut</label>
      <select class="form-control" id="f-statut">
        <option value="payee" ${f.statut==='payee'||!f.statut?'selected':''}>✅ Payée</option>
        <option value="impayee" ${f.statut==='impayee'?'selected':''}>❌ Impayée</option>
        <option value="annulee" ${f.statut==='annulee'?'selected':''}>🚫 Annulée</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Notes</label>
      <input class="form-control" id="f-notes" value="${f.notes||''}" placeholder="Remarques...">
    </div>
  </div>

  <div class="fact-total-box">
    <div class="fact-total-row"><span>Sous-total</span><span id="f-sous-total">0 MAD</span></div>
    <div class="fact-total-row"><span>Remise</span><span id="f-remise-display">0 MAD</span></div>
    <div class="fact-total-row fact-total-final"><span>Total TTC</span><span id="f-total">0 MAD</span></div>
  </div>

  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeFact()">Annuler</button>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" onclick="saveFacture(true)">💾 Enregistrer</button>
      <button class="btn btn-primary" onclick="saveFacture(false,true)">🧾 Enreg. + Ticket</button>
      <button class="btn btn-primary" onclick="saveFacture(false,false,true)">🖨️ Enreg. + A4</button>
    </div>
  </div>`;

  openModal(titre, bodyHtml, true);
  renderItems();
  calcTotal();
}

function autoFillClient(sel) {
  const opt = sel.selectedOptions[0];
  if (opt && opt.value) {
    document.getElementById('f-client').value = opt.dataset.nom || '';
    document.getElementById('f-tel').value    = opt.dataset.tel || '';
  }
}

function renderItems() {
  const items = window._factItems || [];
  document.getElementById('f-items').innerHTML = items.map((item, i) => `
  <div class="fact-item-row" id="fitem-${i}">
    <input class="form-control" value="${item.desc||''}" placeholder="Description" oninput="updateItem(${i},'desc',this.value)" style="flex:3;min-width:150px">
    <input type="number" class="form-control" value="${item.qte||1}" min="1" placeholder="Qté" oninput="updateItem(${i},'qte',+this.value)" style="width:70px;flex-shrink:0">
    <input type="number" class="form-control" value="${item.prix||0}" min="0" placeholder="Prix MAD" oninput="updateItem(${i},'prix',+this.value)" style="width:110px;flex-shrink:0">
    <span style="font-weight:700;color:var(--primary);min-width:80px;text-align:right;padding:8px">${fmtMoney((item.qte||1)*(item.prix||0))}</span>
    <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerItem(${i})" style="flex-shrink:0">✕</button>
  </div>`).join('');
}

function updateItem(i, field, val) {
  window._factItems[i][field] = val;
  const row = document.getElementById('fitem-'+i);
  if (row) {
    const spans = row.querySelectorAll('span');
    if (spans.length) spans[0].textContent = fmtMoney((window._factItems[i].qte||1)*(window._factItems[i].prix||0));
  }
  calcTotal();
}

function ajouterItem() {
  window._factItems.push({ desc:'', qte:1, prix:0 });
  renderItems();
  calcTotal();
}

function supprimerItem(i) {
  window._factItems.splice(i, 1);
  renderItems();
  calcTotal();
}

function calcTotal() {
  const items = window._factItems || [];
  const sous  = items.reduce((s,i) => s + ((+i.qte||1) * (+i.prix||0)), 0);
  const remise= +(document.getElementById('f-remise')?.value||0);
  const total = Math.max(0, sous - remise);
  const fmt = n => n.toLocaleString('fr-MA') + ' MAD';
  document.getElementById('f-sous-total') && (document.getElementById('f-sous-total').textContent = fmt(sous));
  document.getElementById('f-remise-display') && (document.getElementById('f-remise-display').textContent = fmt(remise));
  document.getElementById('f-total') && (document.getElementById('f-total').textContent = fmt(total));
}

async function saveFacture(onlySave=false, printTicket=false, printA4=false) {
  const items = window._factItems || [];
  if (!document.getElementById('f-client').value.trim()) return showToast('Nom client requis','error');
  if (!items.length) return showToast('Ajoutez au moins un article','error');

  const data = {
    eleve_id:       document.getElementById('f-eleve').value || null,
    client_nom:     document.getElementById('f-client').value.trim(),
    client_tel:     document.getElementById('f-tel').value.trim(),
    client_adresse: document.getElementById('f-addr').value.trim(),
    items,
    remise:         +(document.getElementById('f-remise').value||0),
    mode_paiement:  document.getElementById('f-mode').value,
    statut:         document.getElementById('f-statut').value,
    notes:          document.getElementById('f-notes').value.trim(),
    date_facture:   document.getElementById('f-date').value,
  };

  try {
    let id = window._factId;
    let numero;
    if (id) {
      await api.put('/factures/'+id, data);
      numero = _factures.find(f=>f.id==id)?.numero;
    } else {
      const r = await api.post('/factures', data);
      id = r.id; numero = r.numero;
    }
    showToast('✅ Facture '+(window._factId?'modifiée':'créée')+' — '+numero,'success');
    closeFact();
    await loadFacturation();
    if (printTicket) setTimeout(()=>imprimerTicket(id), 300);
    if (printA4)     setTimeout(()=>imprimerA4(id), 300);
  } catch(e) { showToast(e.message,'error'); }
}

function closeFact() {
  closeModal();
}

async function supprimerFacture(id) {
  if (!confirm('Supprimer cette facture ?')) return;
  try { await api.delete('/factures/'+id); showToast('Supprimée','success'); loadFacturation(); }
  catch(e) { showToast(e.message,'error'); }
}

// ════════════════════════════════════════════════════════════════
// IMPRESSION TICKET DE CAISSE (format 80mm)
// ════════════════════════════════════════════════════════════════
async function imprimerTicket(id) {
  const f = await api.get('/factures/'+id);
  const items = Array.isArray(f.items) ? f.items : JSON.parse(f.items||'[]');
  const lines = items.map(i => {
    const total = (i.qte*i.prix).toLocaleString('fr-MA');
    const desc  = (i.desc||'Article').substring(0,22);
    return `<div class="tl">${desc}</div><div class="tr">${i.qte}x${i.prix} = ${total}</div>`;
  }).join('');

  const win = window.open('','_blank','width=350,height=600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:8px;background:#fff;color:#000}
    .center{text-align:center}
    .bold{font-weight:bold}
    .big{font-size:16px;font-weight:800}
    .sep{border:none;border-top:1px dashed #000;margin:6px 0}
    .row{display:flex;justify-content:space-between;padding:2px 0}
    .tl{flex:1;font-size:11px}
    .tr{font-size:11px;text-align:right;white-space:nowrap;margin-left:4px}
    .total-line{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;padding:3px 0}
    .merci{text-align:center;font-size:11px;margin-top:8px}
    @media print{body{padding:0}@page{size:80mm auto;margin:4mm}}
  </style></head><body>
  <div class="center bold big">🏫 ${f.school||'MadrasaTech'}</div>
  <div class="center" style="font-size:10px;margin:4px 0">Système de Gestion Scolaire</div>
  <hr class="sep">
  <div class="row"><span>Facture N°:</span><span class="bold">${f.numero}</span></div>
  <div class="row"><span>Date:</span><span>${fmtDate(f.date_facture)}</span></div>
  <div class="row"><span>Client:</span><span class="bold">${f.client_nom}</span></div>
  ${f.client_tel?`<div class="row"><span>Tél:</span><span>${f.client_tel}</span></div>`:''}
  ${f.eleve_nom?`<div class="row"><span>Élève:</span><span>${f.eleve_prenom} ${f.eleve_nom}</span></div>`:''}
  <hr class="sep">
  <div class="row bold"><span>ARTICLE</span><span>MONTANT</span></div>
  <hr class="sep">
  ${lines}
  <hr class="sep">
  ${f.remise>0?`<div class="row"><span>Sous-total:</span><span>${f.sous_total.toLocaleString('fr-MA')} MAD</span></div>
  <div class="row"><span>Remise:</span><span>-${f.remise.toLocaleString('fr-MA')} MAD</span></div>`:''}
  <div class="total-line" style="font-size:15px;border-top:2px solid #000;margin-top:4px;padding-top:4px">
    <span>TOTAL</span><span>${f.total.toLocaleString('fr-MA')} MAD</span>
  </div>
  <div class="row" style="margin-top:4px"><span>Paiement:</span><span>${{especes:'Espèces 💵',virement:'Virement 🏦',cheque:'Chèque 📝',carte:'Carte 💳'}[f.mode_paiement]||f.mode_paiement}</span></div>
  <div class="row"><span>Statut:</span><span class="bold">${f.statut==='payee'?'✅ PAYÉE':'❌ IMPAYÉE'}</span></div>
  ${f.notes?`<hr class="sep"><div style="font-size:10px">Note: ${f.notes}</div>`:''}
  <hr class="sep">
  <div class="merci">Merci de votre confiance !</div>
  <div class="merci" style="margin-top:2px">★ MadrasaTech ★</div>
  <div style="height:20px"></div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
  </body></html>`);
  win.document.close();
}

// ════════════════════════════════════════════════════════════════
// IMPRESSION A4
// ════════════════════════════════════════════════════════════════
async function imprimerA4(id) {
  const f = await api.get('/factures/'+id);
  const items = Array.isArray(f.items) ? f.items : JSON.parse(f.items||'[]');

  const rows = items.map((i,idx) => `
  <tr>
    <td style="padding:10px 14px">${idx+1}</td>
    <td style="padding:10px 14px">${i.desc||'—'}</td>
    <td style="padding:10px 14px;text-align:center">${i.qte||1}</td>
    <td style="padding:10px 14px;text-align:right">${(i.prix||0).toLocaleString('fr-MA')} MAD</td>
    <td style="padding:10px 14px;text-align:right;font-weight:700">
      ${((i.qte||1)*(i.prix||0)).toLocaleString('fr-MA')} MAD
    </td>
  </tr>`).join('');

  const statutColor = f.statut==='payee'?'#059669':f.statut==='impayee'?'#dc2626':'#6b7280';
  const statutLabel = f.statut==='payee'?'PAYÉE':f.statut==='impayee'?'IMPAYÉE':'ANNULÉE';

  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
    .logo-box{display:flex;align-items:center;gap:14px}
    .logo-icon{width:52px;height:52px;background:linear-gradient(135deg,#1a56db,#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff}
    .company-name{font-size:22px;font-weight:800;color:#0f172a}
    .company-sub{font-size:11px;color:#94a3b8;margin-top:2px}
    .fact-meta{text-align:right}
    .fact-num{font-size:20px;font-weight:800;color:#1a56db}
    .fact-date{font-size:12px;color:#64748b;margin-top:4px}
    .statut-badge{display:inline-block;padding:4px 14px;border-radius:99px;font-size:12px;font-weight:700;color:#fff;background:${statutColor};margin-top:8px}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:30px;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
    .partie-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:8px}
    .partie-name{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .partie-detail{font-size:12px;color:#64748b;line-height:1.6}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    thead{background:#0f172a;color:#fff}
    thead th{padding:12px 14px;text-align:left;font-size:12px;font-weight:600;letter-spacing:.05em}
    thead th:last-child,thead th:nth-child(4){text-align:right}
    thead th:nth-child(3){text-align:center}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#f8fafc}
    .totaux{display:flex;justify-content:flex-end}
    .totaux-box{width:280px}
    .totaux-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
    .totaux-final{display:flex;justify-content:space-between;padding:12px 16px;background:#0f172a;color:#fff;border-radius:10px;margin-top:8px;font-size:16px;font-weight:800}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
    .sign-box{text-align:center;width:180px}
    .sign-line{border-top:1px solid #e2e8f0;margin-top:40px;padding-top:8px;font-size:11px;color:#64748b}
    @media print{body{padding:20px}@page{size:A4;margin:15mm}}
  </style></head><body>

  <!-- EN-TÊTE -->
  <div class="header">
    <div class="logo-box">
      <div class="logo-icon">🏫</div>
      <div>
        <div class="company-name">${f.school||'MadrasaTech'}</div>
        <div class="company-sub">Système de Gestion Scolaire — Maroc</div>
      </div>
    </div>
    <div class="fact-meta">
      <div class="fact-num">${f.numero}</div>
      <div class="fact-date">Date : ${fmtDate(f.date_facture)}</div>
      <div class="statut-badge">${statutLabel}</div>
    </div>
  </div>

  <!-- ÉMETTEUR / DESTINATAIRE -->
  <div class="parties">
    <div>
      <div class="partie-label">Émetteur</div>
      <div class="partie-name">${f.school||'MadrasaTech'}</div>
      <div class="partie-detail">Système de Gestion Scolaire<br>Maroc</div>
    </div>
    <div>
      <div class="partie-label">Destinataire</div>
      <div class="partie-name">${f.client_nom}</div>
      <div class="partie-detail">
        ${f.client_tel ? ('📞 ' + f.client_tel + '<br>') : ''}
        ${f.client_adresse ? ('📍 ' + f.client_adresse + '<br>') : ''}
        ${f.eleve_nom ? ('🎓 ' + f.eleve_prenom + ' ' + f.eleve_nom + (f.classe ? ' (' + f.classe + ')' : '')) : ''}
      </div>
    </div>
  </div>

  <!-- MODE PAIEMENT -->
  <div style="margin-bottom:16px;font-size:12px;color:#64748b">
    Mode de paiement : <strong>${f.mode_paiement === 'especes' ? 'Espèces 💵' : f.mode_paiement === 'virement' ? 'Virement 🏦' : f.mode_paiement === 'cheque' ? 'Chèque 📝' : 'Carte 💳'}</strong>
  </div>

  <!-- TABLEAU ARTICLES -->
  <table>
    <thead><tr>
      <th style="width:40px">#</th>
      <th>Désignation</th>
      <th style="width:60px;text-align:center">Qté</th>
      <th style="width:120px;text-align:right">Prix unitaire</th>
      <th style="width:120px;text-align:right">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- TOTAUX -->
  <div class="totaux">
    <div class="totaux-box">
      ${f.remise>0?`
      <div class="totaux-row"><span>Sous-total HT</span><span>${f.sous_total.toLocaleString('fr-MA')} MAD</span></div>
      <div class="totaux-row" style="color:#dc2626"><span>Remise</span><span>- ${f.remise.toLocaleString('fr-MA')} MAD</span></div>`:''}
      <div class="totaux-final">
        <span>TOTAL TTC</span>
        <span>${f.total.toLocaleString('fr-MA')} MAD</span>
      </div>
    </div>
  </div>

  ${f.notes?`<div style="margin-top:20px;padding:12px 16px;background:#fefce8;border-left:3px solid #d97706;border-radius:8px;font-size:12px;color:#78350f"><strong>Note :</strong> ${f.notes}</div>`:''}

  <!-- PIED DE PAGE -->
  <div class="footer">
    <div>
      <div>Merci de votre confiance</div>
      <div style="margin-top:4px">MadrasaTech — Système de Gestion Scolaire Maroc</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">Signature & Cachet</div>
    </div>
  </div>

  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  win.document.close();
}
