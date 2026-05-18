/* depenses.js */
async function loadDepenses() {
  const v = document.getElementById('view-depenses');
  try {
    const depenses = await api.getDepenses();
    const total = depenses.reduce((a,d)=>a+d.montant,0);
    const parCat = {};
    depenses.forEach(d=>{parCat[d.categorie]=(parCat[d.categorie]||0)+d.montant;});
    const cats = ['fournitures','charges','salaires','travaux','pedagogique','autre'];
    const catLabels = {fournitures:'📦 Fournitures',charges:'⚡ Charges',salaires:'👥 Salaires',travaux:'🔧 Travaux',pedagogique:'📚 Pédagogie',autre:'📌 Autre'};

    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📤 Dépenses</div><div class="page-sub">${depenses.length} dépense(s)</div></div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="exportCSV(window._depenses||[],'depenses.csv')">📥 CSV</button>
        <button class="btn btn-primary" onclick="modalDepense()">+ Nouvelle dépense</button>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat-card"><div class="stat-icon rose">💸</div><div><div class="stat-value" style="font-size:16px">${fmtMoney(total)}</div><div class="stat-label">Total dépenses</div></div></div>
      ${Object.entries(parCat).map(([cat,val])=>`<div class="stat-card"><div class="stat-icon amber">${catLabels[cat]?.charAt(0)||'📌'}</div><div><div class="stat-value" style="font-size:14px">${fmtMoney(val)}</div><div class="stat-label">${catLabels[cat]||cat}</div></div></div>`).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Historique des dépenses</span>
        <div class="toolbar" style="margin:0">
          <select class="filter-input" id="fDCat" onchange="filterDepenses()">
            <option value="">Toutes catégories</option>
            ${cats.map(c=>`<option value="${c}">${catLabels[c]||c}</option>`).join('')}
          </select>
          <input type="date" class="filter-input" id="fDDeb">
          <input type="date" class="filter-input" id="fDFin">
          <button class="btn btn-ghost btn-sm" onclick="filterDepenses()">Filtrer</button>
        </div>
      </div>
      <div class="table-wrap">
        <table id="dep-table">
          <thead><tr><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Fournisseur</th><th>Date</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            ${depenses.length ? depenses.map(d=>`<tr data-cat="${d.categorie}">
              <td><strong>${d.libelle}</strong></td>
              <td><span class="badge badge-amber">${catLabels[d.categorie]||d.categorie}</span></td>
              <td><strong>${fmtMoney(d.montant)}</strong></td>
              <td>${d.fournisseur||'—'}</td>
              <td>${fmtDate(d.date_depense)}</td>
              <td style="color:var(--muted);font-size:12px">${d.notes||'—'}</td>
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-sm btn-ghost btn-icon" onclick="modalDepense(${d.id})">✏️</button>
                  <button class="btn btn-sm btn-danger btn-icon" onclick="supprimerDepense(${d.id})">🗑</button>
                </div>
              </td>
            </tr>`).join('') : '<tr><td colspan="7"><div class="empty"><div class="empty-ico">📤</div><div class="empty-title">Aucune dépense</div></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
    window._depenses = depenses;
  } catch(e) { console.error('[depenses]', e); toast(e.message,'err'); }
}

function filterDepenses() {
  const cat = document.getElementById('fDCat').value;
  document.querySelectorAll('#dep-table tbody tr').forEach(r=>{
    r.style.display = (!cat||r.dataset.cat===cat)?'':'none';
  });
}

async function modalDepense(id=null) {
  let d = {};
  if (id) {
    try { const all = await api.getDepenses(); d = all.find(x=>x.id===id)||{}; } catch {}
  }
  const cats = [{v:'fournitures',l:'Fournitures de bureau'},{v:'charges',l:'Charges (eau, électricité)'},{v:'salaires',l:'Salaires & primes'},{v:'travaux',l:'Travaux & entretien'},{v:'pedagogique',l:'Matériel pédagogique'},{v:'autre',l:'Autre'}];
  
  openModal((id?'✏️ Modifier':'+ Nouvelle') + ' Dépense', `
  <div class="form-grid">
    <div class="form-group full"><label class="form-label">Libellé *</label><input class="form-control" id="dLib" value="${d.libelle||''}" placeholder="Description de la dépense"></div>
    <div class="form-group">
      <label class="form-label">Catégorie *</label>
      <select class="form-control" id="dCat">
        ${cats.map(c=>`<option value="${c.v}" ${d.categorie===c.v?'selected':''}>${c.l}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Montant (MAD) *</label><input type="number" class="form-control" id="dMont" value="${d.montant||''}" min="0" step="0.01"></div>
    <div class="form-group"><label class="form-label">Fournisseur</label><input class="form-control" id="dFourn" value="${d.fournisseur||''}" placeholder="Nom du fournisseur"></div>
    <div class="form-group"><label class="form-label">Date *</label><input type="date" class="form-control" id="dDate" value="${d.date_depense||new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group full"><label class="form-label">Notes</label><input class="form-control" id="dNotes" value="${d.notes||''}" placeholder="Remarques..."></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveDepense(${id||'null'})">${id?'Enregistrer':'Ajouter'}</button>
  </div>`);
}

async function saveDepense(id) {
  const data = {
    libelle: document.getElementById('dLib').value.trim(),
    categorie: document.getElementById('dCat').value,
    montant: parseFloat(document.getElementById('dMont').value)||0,
    fournisseur: document.getElementById('dFourn').value.trim(),
    date_depense: document.getElementById('dDate').value,
    notes: document.getElementById('dNotes').value.trim(),
  };
  if (!data.libelle) { toast('Libellé requis','err'); return; }
  if (data.montant<=0) { toast('Montant invalide','err'); return; }
  try {
    if(id) await api.updateDepense(id,data); else await api.createDepense(data);
    toast(id?'Dépense modifiée':'Dépense ajoutée','ok');
    closeModal(); loadDepenses();
  } catch(e) { console.error('[depenses]', e); toast(e.message,'err'); }
}

async function supprimerDepense(id) {
  if (!confirm('Supprimer cette dépense ?')) return;
  try { await api.deleteDepense(id); toast('Dépense supprimée','ok'); loadDepenses(); } catch(e) { console.error('[depenses]', e); toast(e.message,'err'); }
}

function imprimerDepenseTicket(d) {
  const school = document.querySelector('.top-school')?.textContent || 'MadrasaTech';
  const win = window.open('','_blank','width=350,height=400');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>*{margin:0;padding:0}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:10px}
  .c{text-align:center}.b{font-weight:bold}.sep{border-top:1px dashed #000;margin:6px 0}
  .row{display:flex;justify-content:space-between;padding:2px 0}
  .total{display:flex;justify-content:space-between;font-weight:800;font-size:14px;border-top:2px solid #000;margin-top:4px;padding-top:4px}
  @media print{@page{size:80mm auto;margin:3mm}}</style></head><body>
  <div class="c b" style="font-size:15px">🏫 ${school}</div>
  <div class="c" style="font-size:10px;margin:3px 0">Bon de dépense</div>
  <div class="sep"></div>
  <div class="row"><span>Date:</span><span>${d.date_depense||new Date().toLocaleDateString('fr-MA')}</span></div>
  <div class="row"><span>Catégorie:</span><span>${d.categorie||'—'}</span></div>
  <div class="row"><span>Libellé:</span></div>
  <div style="font-weight:600;margin:4px 0">${d.libelle}</div>
  ${d.fournisseur?`<div class="row"><span>Fournisseur:</span><span>${d.fournisseur}</span></div>`:''}
  <div class="sep"></div>
  <div class="total"><span>MONTANT</span><span>${(d.montant||0).toLocaleString('fr-MA')} MAD</span></div>
  <div class="sep"></div>
  <div class="c" style="font-size:10px">Signature: _______________</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
  </body></html>`);
  win.document.close();
}

function imprimerDepenseA4(d) {
  const school = document.querySelector('.top-school')?.textContent || 'MadrasaTech';
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1e293b;font-size:13px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #ef4444}
  .logo{font-size:24px;font-weight:900;color:#ef4444}.sub{font-size:12px;color:#94a3b8}
  .box{background:#f8fafc;border-radius:12px;padding:24px;margin:20px 0;border:1px solid #e2e8f0}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .montant{background:#ef4444;color:#fff;border-radius:12px;padding:24px;text-align:center;margin:24px 0}
  .montant-val{font-size:36px;font-weight:900}
  .sign{text-align:center;width:160px;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:40px;font-size:11px;color:#64748b}
  @media print{body{padding:20px}@page{size:A4;margin:15mm}}</style></head><body>
  <div class="header">
    <div><div class="logo">📤 ${school}</div><div class="sub">Bon de Dépense</div></div>
    <div style="text-align:right;font-size:14px;font-weight:700">Date: ${d.date_depense||new Date().toLocaleDateString('fr-MA')}</div>
  </div>
  <div class="box">
    <div class="row"><span style="color:#64748b">Libellé</span><span style="font-weight:700">${d.libelle}</span></div>
    <div class="row"><span style="color:#64748b">Catégorie</span><span>${d.categorie||'—'}</span></div>
    ${d.fournisseur?`<div class="row"><span style="color:#64748b">Fournisseur</span><span>${d.fournisseur}</span></div>`:''}
    ${d.notes?`<div class="row"><span style="color:#64748b">Notes</span><span>${d.notes}</span></div>`:''}
  </div>
  <div class="montant">
    <div class="montant-val">${(d.montant||0).toLocaleString('fr-MA')} MAD</div>
    <div style="font-size:12px;opacity:.7;margin-top:4px">Montant de la dépense</div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:40px">
    <div class="sign">Établi par</div>
    <div class="sign">Approuvé par</div>
    <div class="sign">Signature & Cachet</div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  win.document.close();
}
