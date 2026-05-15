// ══════════════════════════════════════════════════════════════
// ESPACE ÉLÈVE — Notes, emploi du temps, devoirs à rendre
// ══════════════════════════════════════════════════════════════
async function loadEspaceEleve() {
  const v = document.getElementById('view-espace-eleve');
  if (!v) return;
  v.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--muted)">⏳ Chargement de votre espace...</div>`;
  try {
    const [notes, emploi, devoirs, absences] = await Promise.all([
      api.get('/eleve-space/notes'),
      api.get('/eleve-space/emploi'),
      api.get('/eleve-space/devoirs'),
      api.get('/eleve-space/absences'),
    ]);
    renderEspaceEleve({ notes, emploi, devoirs, absences });
  } catch(e) {
    v.innerHTML = `<div style="padding:3rem;text-align:center;color:#ef4444">❌ ${e.message}</div>`;
  }
}

function renderEspaceEleve({ notes, emploi, devoirs, absences }) {
  const v = document.getElementById('view-espace-eleve');
  const user = window.currentUser || {};

  // Stats rapides
  const moyennes = {};
  notes.forEach(n => {
    if (!moyennes[n.matiere]) moyennes[n.matiere] = [];
    moyennes[n.matiere].push(n.note);
  });
  const moyGlobale = notes.length ? (notes.reduce((s,n)=>s+n.note,0)/notes.length).toFixed(2) : '—';
  const devoirsRendus = devoirs.filter(d=>d.rendu).length;
  const devoirsPending = devoirs.filter(d=>!d.rendu && (!d.date_limite || new Date(d.date_limite) >= new Date())).length;

  v.innerHTML = `
  <div class="page-header">
    <div>
      <div class="page-title">🎓 Mon Espace Élève</div>
      <div class="page-sub">Bonjour ${user.prenom||''}${user.nom?' '+user.nom:''} 👋</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="stats-grid" style="margin-bottom:1.5rem">
    <div class="stat-card"><div class="stat-icon blue">📊</div>
      <div><div class="stat-value">${moyGlobale}</div><div class="stat-label">Moyenne générale</div></div></div>
    <div class="stat-card"><div class="stat-icon amber">📝</div>
      <div><div class="stat-value">${notes.length}</div><div class="stat-label">Notes reçues</div></div></div>
    <div class="stat-card"><div class="stat-icon rose">📅</div>
      <div><div class="stat-value">${absences.length}</div><div class="stat-label">Absences</div></div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div>
      <div><div class="stat-value">${devoirsRendus}/${devoirs.length}</div><div class="stat-label">Devoirs rendus</div></div></div>
  </div>

  <!-- Tabs -->
  <div class="dv-tabs" style="margin-bottom:1.25rem">
    <button class="dv-tab active" id="el-tab-devoirs"   onclick="switchElTab('devoirs')">📝 Devoirs ${devoirsPending>0?`<span class="sa-tab-badge">${devoirsPending}</span>`:''}</button>
    <button class="dv-tab" id="el-tab-notes"    onclick="switchElTab('notes')">📊 Mes notes</button>
    <button class="dv-tab" id="el-tab-emploi"   onclick="switchElTab('emploi')">📆 Emploi du temps</button>
    <button class="dv-tab" id="el-tab-absences" onclick="switchElTab('absences')">📅 Mes absences</button>
  </div>

  <!-- DEVOIRS -->
  <div id="el-devoirs">
    ${renderEleveDevoirs(devoirs)}
  </div>

  <!-- NOTES -->
  <div id="el-notes" style="display:none">
    ${renderEleveNotes(notes)}
  </div>

  <!-- EMPLOI DU TEMPS -->
  <div id="el-emploi" style="display:none">
    ${renderEleveEmploi(emploi)}
  </div>

  <!-- ABSENCES -->
  <div id="el-absences" style="display:none">
    ${renderEleveAbsences(absences)}
  </div>

  <!-- Modal rendu devoir -->
  <div id="rendu-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeRenduModal()">
    <div class="modal" style="max-width:540px">
      <div class="modal-header">
        <h3 id="rendu-modal-title">Rendre le devoir</h3>
        <button class="modal-close" onclick="closeRenduModal()">✕</button>
      </div>
      <div class="modal-body" id="rendu-modal-body"></div>
    </div>
  </div>
  `;

  window._eleveDevoirs = devoirs;
}

function switchElTab(tab) {
  ['devoirs','notes','emploi','absences'].forEach(t => {
    const el = document.getElementById('el-'+t);
    const btn = document.getElementById('el-tab-'+t);
    if (el) el.style.display = t===tab ? '' : 'none';
    if (btn) btn.classList.toggle('active', t===tab);
  });
}

// ── Devoirs ───────────────────────────────────────────────────
function renderEleveDevoirs(devoirs) {
  if (!devoirs.length) return `<div class="dv-empty">📝 Aucun devoir assigné pour l'instant.</div>`;
  const now = new Date();
  const pending = devoirs.filter(d => !d.rendu && (!d.date_limite||new Date(d.date_limite)>=now));
  const rendu   = devoirs.filter(d => d.rendu);
  const expired = devoirs.filter(d => !d.rendu && d.date_limite && new Date(d.date_limite)<now);

  return `
  ${pending.length?`<h3 class="el-section-title">⏳ À rendre (${pending.length})</h3>
  <div class="dv-grid">${pending.map(d=>renderElDevCard(d)).join('')}</div>`:''}
  ${rendu.length?`<h3 class="el-section-title" style="margin-top:1.5rem">✅ Rendus (${rendu.length})</h3>
  <div class="dv-grid">${rendu.map(d=>renderElDevCard(d)).join('')}</div>`:''}
  ${expired.length?`<h3 class="el-section-title" style="margin-top:1.5rem;color:#ef4444">❌ Expirés sans rendu (${expired.length})</h3>
  <div class="dv-grid">${expired.map(d=>renderElDevCard(d)).join('')}</div>`:''}`;
}

function renderElDevCard(d) {
  const expired = d.date_limite && new Date(d.date_limite) < new Date();
  const soon = d.date_limite && !expired && (new Date(d.date_limite)-new Date()) < 2*24*3600*1000;
  const rendu = d.rendu;
  return `
  <div class="dv-card ${rendu?'dv-card-done':expired?'dv-expired':soon?'dv-soon':''}">
    <div class="dv-card-top">
      <span class="badge badge-blue">📝 ${d.type||'devoir'}</span>
      <span class="dv-matiere">${d.matiere}</span>
    </div>
    <div class="dv-card-title">${d.titre}</div>
    ${d.description?`<div class="dv-card-desc">${d.description}</div>`:''}
    <div class="dv-card-footer">
      <span class="${soon?'dv-date-soon':expired?'dv-date-exp':'dv-date'}">📅 ${d.date_limite?fmtDate(d.date_limite):'Sans limite'}</span>
      ${rendu
        ? `<div style="text-align:right">
            <span class="badge badge-green">✅ Rendu</span>
            ${rendu.note!==null&&rendu.note!==undefined?`<span class="badge badge-blue">📊 ${rendu.note}/20</span>`:''}
            ${rendu.commentaire_prof?`<div style="font-size:11px;color:var(--muted);margin-top:4px">💬 ${rendu.commentaire_prof}</div>`:''}
           </div>`
        : expired
          ? `<span class="badge badge-rose">❌ Expiré</span>`
          : `<button class="btn btn-sm btn-primary" onclick="ouvrirRendu(${d.id},'${(d.titre||'').replace(/'/g,"\\'")}')">📤 Rendre le devoir</button>`
      }
    </div>
  </div>`;
}

// ── Notes ─────────────────────────────────────────────────────
function renderEleveNotes(notes) {
  if (!notes.length) return `<div class="dv-empty">📊 Aucune note disponible.</div>`;
  const byTrimestre = {};
  notes.forEach(n => {
    const t = 'Trimestre '+n.trimestre;
    if (!byTrimestre[t]) byTrimestre[t] = [];
    byTrimestre[t].push(n);
  });

  return Object.entries(byTrimestre).map(([trim, ns]) => {
    const moy = (ns.reduce((s,n)=>s+n.note,0)/ns.length).toFixed(2);
    return `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-header">
        <span class="card-title">📅 ${trim}</span>
        <span class="badge badge-blue">Moy. ${moy}/20</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Matière</th><th>Type</th><th>Note</th><th>Mention</th></tr></thead>
        <tbody>
          ${ns.map(n=>`<tr>
            <td><strong>${n.matiere}</strong></td>
            <td><span class="badge badge-gray">${n.type||'—'}</span></td>
            <td><strong style="font-size:16px;color:${n.note>=10?'var(--emerald)':'var(--rose)'}">
              ${n.note}/20</strong></td>
            <td>${mention(n.note)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  }).join('');
}

// ── Emploi du temps ───────────────────────────────────────────
function renderEleveEmploi(cours) {
  if (!cours.length) return `<div class="dv-empty">📆 Aucun cours planifié.</div>`;
  const jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444'];
  const matColors = {};
  let ci = 0;
  cours.forEach(c => { if(!matColors[c.matiere]) matColors[c.matiere]=colors[ci++%colors.length]; });

  return `<div class="card"><div class="card-body" style="padding:0">
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:600px">
        <thead><tr>
          <th style="padding:12px;background:#f8fafc;width:80px">Heure</th>
          ${jours.map(j=>`<th style="padding:12px;background:#f8fafc;text-align:center;text-transform:capitalize">${j}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${['08:00','09:00','10:00','11:00','14:00','15:00','16:00'].map(h => `
          <tr style="border-top:1px solid #f1f5f9">
            <td style="padding:8px 12px;font-size:12px;color:var(--muted);font-weight:600">${h}</td>
            ${jours.map(j => {
              const c = cours.find(x=>x.jour===j&&x.heure_debut===h);
              return c
                ? `<td style="padding:6px;text-align:center">
                    <div style="background:${matColors[c.matiere]}18;border-left:3px solid ${matColors[c.matiere]};border-radius:6px;padding:6px 8px;font-size:12px">
                      <div style="font-weight:700;color:${matColors[c.matiere]}">${c.matiere}</div>
                      <div style="color:#64748b;font-size:11px">${c.professeur||''}</div>
                      <div style="color:#94a3b8;font-size:10px">${c.salle||''}</div>
                    </div></td>`
                : `<td></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div></div>`;
}

// ── Absences ──────────────────────────────────────────────────
function renderEleveAbsences(absences) {
  if (!absences.length) return `<div class="dv-empty">✅ Aucune absence enregistrée. Bravo !</div>`;
  return `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Horaire</th><th>Matière</th><th>Statut</th><th>Motif</th></tr></thead>
    <tbody>
      ${absences.map(a=>`<tr>
        <td>${fmtDate(a.date_absence)}</td>
        <td>${a.heure_debut&&a.heure_fin?a.heure_debut+' → '+a.heure_fin:'—'}</td>
        <td>${a.matiere||'—'}</td>
        <td>${a.justifiee?'<span class="badge badge-green">✅ Justifiée</span>':'<span class="badge badge-rose">❌ Non justifiée</span>'}</td>
        <td style="color:var(--muted)">${a.motif||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table></div></div>`;
}

// ── Rendre un devoir ──────────────────────────────────────────
function ouvrirRendu(devoirId, titre) {
  const modal = document.getElementById('rendu-modal');
  document.getElementById('rendu-modal-title').textContent = '📤 ' + titre;
  document.getElementById('rendu-modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Votre réponse *</label>
      <textarea class="form-control" id="rendu-contenu" rows="6" placeholder="Écrivez votre réponse ici, expliquez votre démarche..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Ou joindre un fichier (nom)</label>
      <input class="form-control" id="rendu-fichier" placeholder="Ex: devoir_maths_trim1.pdf">
      <div style="font-size:11px;color:var(--muted);margin-top:4px">ℹ️ Indiquez le nom du fichier que vous avez envoyé au professeur</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeRenduModal()">Annuler</button>
      <button class="btn btn-primary" onclick="soumettreRendu(${devoirId})">📤 Soumettre le devoir</button>
    </div>`;
  modal.style.display = 'flex';
}

function closeRenduModal() {
  document.getElementById('rendu-modal').style.display = 'none';
}

async function soumettreRendu(devoirId) {
  const contenu    = document.getElementById('rendu-contenu').value.trim();
  const fichierNom = document.getElementById('rendu-fichier').value.trim();
  if (!contenu && !fichierNom) return showToast('Veuillez écrire une réponse ou indiquer un fichier', 'error');

  // Get current school_user id
  const su = window._currentSchoolUser;
  if (!su) return showToast('Compte élève non lié. Contactez l\'administrateur.', 'error');

  try {
    await api.post(`/devoirs/${devoirId}/rendus`, {
      eleve_user_id: su.id, contenu, fichier_nom: fichierNom
    });
    showToast('✅ Devoir soumis avec succès !', 'success');
    closeRenduModal();
    loadEspaceEleve();
  } catch(e) { showToast(e.message||'Erreur', 'error'); }
}

// Section title helper
const _elSectionStyle = `style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid #f1f5f9"`;
const el = (s) => `<h3 class="el-section-title">${s}</h3>`;
