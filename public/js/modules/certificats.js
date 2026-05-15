// ══════════════════════════════════════════════════════════════
// MODULE CERTIFICATS & DOCUMENTS OFFICIELS
// ══════════════════════════════════════════════════════════════
async function loadCertificats() {
  const v = document.getElementById('view-certificats');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const eleves = await api.getEleves();
    renderCertificats(eleves);
  } catch(e) { v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`; }
}

function renderCertificats(eleves) {
  const v = document.getElementById('view-certificats');
  const docTypes = [
    { id:'scolarite',   icon:'📜', title:'Certificat de scolarité',      desc:'Atteste l\'inscription de l\'élève pour l\'année scolaire en cours' },
    { id:'bulletin',    icon:'📊', title:'Bulletin scolaire',             desc:'Relevé de notes par trimestre avec moyennes et appréciations' },
    { id:'absence',     icon:'📅', title:'Attestation de présence',       desc:'Récapitulatif des absences justifiées et non justifiées' },
    { id:'inscription', icon:'✅', title:'Reçu d\'inscription',           desc:'Confirmation d\'inscription avec montant payé' },
    { id:'carte',       icon:'🪪', title:'Carte d\'élève',                desc:'Carte d\'identité scolaire avec photo et informations' },
  ];

  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">📜 Certificats & Documents</div>
      <div class="page-sub">Génération et impression de documents officiels</div></div>
  </div>

  <!-- Choisir élève -->
  <div class="cert-search-bar">
    <label class="form-label" style="margin-bottom:8px;display:block">🎓 Sélectionner un élève</label>
    <select class="form-control" id="cert-eleve-sel" onchange="onCertEleveChange()" style="max-width:400px">
      <option value="">— Choisir un élève —</option>
      ${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom} — ${e.classe||'—'}</option>`).join('')}
    </select>
  </div>

  <!-- Types de documents -->
  <div class="cert-grid" id="cert-docs-grid">
    ${docTypes.map(d=>`
    <div class="cert-card" id="cert-${d.id}">
      <div class="cert-icon">${d.icon}</div>
      <div class="cert-info">
        <div class="cert-title">${d.title}</div>
        <div class="cert-desc">${d.desc}</div>
      </div>
      <button class="btn btn-primary cert-btn" disabled onclick="genererDoc('${d.id}')">
        🖨️ Générer & Imprimer
      </button>
    </div>`).join('')}
  </div>

  <!-- Zone aperçu / impression -->
  <div id="cert-preview" style="display:none" class="card" style="margin-top:1.5rem">
    <div class="card-header">
      <span class="card-title" id="cert-preview-title">Aperçu du document</span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('cert-preview').style.display='none'">✕ Fermer</button>
        <button class="btn btn-primary btn-sm" onclick="imprimerCert()">🖨️ Imprimer</button>
      </div>
    </div>
    <div class="card-body" id="cert-preview-content" style="padding:0"></div>
  </div>`;
}

function onCertEleveChange() {
  const id = document.getElementById('cert-eleve-sel').value;
  document.querySelectorAll('.cert-btn').forEach(b => b.disabled = !id);
}

async function genererDoc(type) {
  const eleveId = document.getElementById('cert-eleve-sel').value;
  if (!eleveId) return showToast('Sélectionnez un élève d\'abord','error');
  try {
    const data = await api.get('/certificats/eleve/'+eleveId);
    const html  = buildDocHTML(type, data);
    const titles = { scolarite:'Certificat de scolarité', bulletin:'Bulletin scolaire', absence:'Attestation de présence', inscription:'Reçu d\'inscription', carte:'Carte d\'élève' };
    document.getElementById('cert-preview-title').textContent = titles[type]||type;
    document.getElementById('cert-preview-content').innerHTML = `<div style="padding:1rem">${html}</div>`;
    document.getElementById('cert-preview').style.display = '';
    window._certHTML = html;
    window.scrollTo({top: document.getElementById('cert-preview').offsetTop - 80, behavior:'smooth'});
  } catch(e) { showToast(e.message,'error'); }
}

function buildDocHTML(type, data) {
  const { eleve, school, notes, paiements, absences } = data;
  const annee = new Date().getFullYear();
  const today = new Date().toLocaleDateString('fr-MA',{day:'2-digit',month:'long',year:'numeric'});
  const schoolName = school?.school || 'MadrasaTech';
  const logoEmoji = '🏫';

  const header = `
  <div style="text-align:center;border-bottom:3px double #1a56db;padding-bottom:20px;margin-bottom:20px">
    <div style="font-size:3rem">${logoEmoji}</div>
    <div style="font-size:20px;font-weight:800;color:#1a56db">${schoolName}</div>
    <div style="font-size:12px;color:#64748b">Année scolaire ${annee-1}/${annee}</div>
  </div>`;

  const footer = `
  <div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end">
    <div style="font-size:12px;color:#64748b">Délivré le ${today}</div>
    <div style="text-align:center">
      <div style="width:120px;height:60px;border:1px solid #e2e8f0;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">
        Cachet & Signature
      </div>
    </div>
  </div>`;

  const eleveInfo = `
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;font-weight:600;color:#374151;width:35%">Nom complet</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${eleve.prenom} ${eleve.nom}</td></tr>
    <tr><td style="padding:8px;font-weight:600;color:#374151">Date de naissance</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${eleve.date_naissance?fmtDate(eleve.date_naissance):'—'}</td></tr>
    <tr><td style="padding:8px;font-weight:600;color:#374151">Classe</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${eleve.classe||'—'}</td></tr>
    <tr><td style="padding:8px;font-weight:600;color:#374151">N° Massar</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${eleve.massar||'—'}</td></tr>
  </table>`;

  if (type === 'scolarite') return `
  ${header}
  <div style="text-align:center;margin:20px 0">
    <div style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a56db">Certificat de Scolarité</div>
  </div>
  <p style="line-height:2;font-size:14px">
    Je soussigné(e), Directeur(trice) de l'établissement <strong>${schoolName}</strong>, certifie par la présente que :
  </p>
  ${eleveInfo}
  <p style="line-height:2;font-size:14px">
    est régulièrement inscrit(e) dans notre établissement pour l'année scolaire <strong>${annee-1}/${annee}</strong> en classe de <strong>${eleve.classe||'—'}</strong>.
  </p>
  <p style="font-size:13px;color:#64748b;margin-top:16px">Ce certificat est délivré sur demande de l'intéressé(e) pour servir et valoir ce que de droit.</p>
  ${footer}`;

  if (type === 'bulletin') {
    const byTrim = {};
    (notes||[]).forEach(n => { const t='Trimestre '+n.trimestre; if(!byTrim[t])byTrim[t]=[]; byTrim[t].push(n); });
    const tableNotes = Object.entries(byTrim).map(([trim,ns]) => {
      const moy = ns.length ? (ns.reduce((s,n)=>s+parseFloat(n.note||0),0)/ns.length).toFixed(2) : '—';
      return `<div style="margin-bottom:20px">
      <div style="font-weight:700;color:#1a56db;margin-bottom:8px;padding:6px 12px;background:#eff6ff;border-radius:6px">${trim} — Moyenne: ${moy}/20</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px;text-align:left;border:1px solid #e2e8f0">Matière</th>
          <th style="padding:8px;text-align:center;border:1px solid #e2e8f0">Note</th>
          <th style="padding:8px;text-align:center;border:1px solid #e2e8f0">Coeff.</th>
          <th style="padding:8px;text-align:center;border:1px solid #e2e8f0">Mention</th>
        </tr></thead>
        <tbody>${ns.map(n=>`<tr>
          <td style="padding:8px;border:1px solid #e2e8f0">${n.matiere}</td>
          <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-weight:700;color:${n.note>=10?'#059669':'#dc2626'}">${n.note}/20</td>
          <td style="padding:8px;text-align:center;border:1px solid #e2e8f0">${n.coefficient||1}</td>
          <td style="padding:8px;text-align:center;border:1px solid #e2e8f0">${n.note>=16?'Excellent':n.note>=14?'Très Bien':n.note>=12?'Bien':n.note>=10?'Passable':'Insuffisant'}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }).join('') || '<p style="color:#94a3b8">Aucune note enregistrée</p>';

    return `${header}
    <div style="text-align:center;margin:20px 0"><div style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a56db">Bulletin Scolaire</div></div>
    ${eleveInfo}${tableNotes}${footer}`;
  }

  if (type === 'absence') return `
  ${header}
  <div style="text-align:center;margin:20px 0"><div style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a56db">Attestation de Présence</div></div>
  ${eleveInfo}
  <div style="background:#f8fafc;border-radius:10px;padding:16px;margin:16px 0">
    <div style="font-size:24px;font-weight:800;color:#1a56db;text-align:center">${absences || 0}</div>
    <div style="text-align:center;color:#64748b;font-size:13px">Absence(s) enregistrée(s) cette année</div>
  </div>
  <p style="line-height:2;font-size:14px">La présente attestation est délivrée à la demande de l'élève ou de son tuteur légal.</p>
  ${footer}`;

  if (type === 'inscription') {
    const totalPaye = (paiements||[]).reduce((s,p)=>s+parseFloat(p.montant||0),0);
    return `${header}
    <div style="text-align:center;margin:20px 0"><div style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a56db">Reçu d'Inscription</div></div>
    ${eleveInfo}
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
      <div style="font-size:28px;font-weight:800;color:#059669">${totalPaye.toLocaleString('fr-MA')} MAD</div>
      <div style="color:#64748b;font-size:13px">Total des paiements enregistrés</div>
    </div>
    ${footer}`;
  }

  if (type === 'carte') return `
  <div style="width:320px;margin:auto;border:2px solid #1a56db;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15)">
    <div style="background:linear-gradient(135deg,#1a56db,#7c3aed);padding:16px;text-align:center;color:#fff">
      <div style="font-size:1.5rem">🏫</div>
      <div style="font-weight:700">${schoolName}</div>
      <div style="font-size:11px;opacity:.8">CARTE D'ÉLÈVE ${annee-1}/${annee}</div>
    </div>
    <div style="padding:16px;background:#fff">
      <div style="font-size:48px;text-align:center;margin-bottom:12px">🎓</div>
      <div style="text-align:center;font-size:18px;font-weight:800;color:#0f172a">${eleve.prenom} ${eleve.nom}</div>
      <div style="text-align:center;color:#64748b;margin-bottom:12px">${eleve.classe||'—'}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:10px">
        <span>N° ${eleve.massar||'—'}</span>
        <span>${today}</span>
      </div>
    </div>
  </div>`;

  return `<p>Document non reconnu</p>`;
}

function imprimerCert() {
  const html = window._certHTML || '';
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Document</title>
  <style>body{font-family:'Cairo',Arial,sans-serif;padding:40px;max-width:800px;margin:auto}@media print{body{padding:20px}}</style>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  </head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(()=>win.print(), 500);
}
