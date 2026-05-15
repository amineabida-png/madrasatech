// ══════════════════════════════════════════════════════════════
// MODULE CALENDRIER SCOLAIRE
// ══════════════════════════════════════════════════════════════
let calCurrentDate = new Date();

async function loadCalendrier() {
  const v = document.getElementById('view-calendrier');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const events = await api.get(`/calendrier?mois=${calCurrentDate.getMonth()+1}&annee=${calCurrentDate.getFullYear()}`);
    window._calEvents = events;
    renderCalendrier(events);
  } catch(e) { v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`; }
}

function renderCalendrier(events) {
  const v = document.getElementById('view-calendrier');
  const mois = calCurrentDate.getMonth();
  const annee= calCurrentDate.getFullYear();
  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const joursNoms = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const typeColors = { evenement:'#6366f1', examen:'#ef4444', vacances:'#10b981', reunion:'#f59e0b', sortie:'#0ea5e9', autre:'#8b5cf6' };
  const typeIcons  = { evenement:'📅', examen:'📋', vacances:'🏖️', reunion:'👥', sortie:'🚌', autre:'📌' };

  // Prochain événements (5 prochains)
  const now = new Date();
  const prochains = events.filter(e => new Date(e.date_debut) >= now).slice(0,5);

  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">📅 Calendrier Scolaire</div>
      <div class="page-sub">${events.length} événement(s) ce mois</div></div>
    <button class="btn btn-primary" onclick="modalCalEvent()">+ Ajouter événement</button>
  </div>

  <div class="cal-layout">
    <!-- Calendrier grille -->
    <div class="cal-main">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="calNavMois(-1)">‹</button>
        <div class="cal-month-label">${moisNoms[mois]} ${annee}</div>
        <button class="cal-nav-btn" onclick="calNavMois(1)">›</button>
      </div>

      <div class="cal-grid-header">
        ${joursNoms.map(j=>`<div class="cal-day-name">${j}</div>`).join('')}
      </div>

      <div class="cal-grid" id="cal-grid">
        ${buildCalGrid(mois, annee, events, typeColors, typeIcons)}
      </div>
    </div>

    <!-- Panneau droite -->
    <div class="cal-panel">
      <div class="cal-panel-title">📌 Prochains événements</div>
      ${prochains.length ? prochains.map(e => `
      <div class="cal-event-item" style="border-left:3px solid ${typeColors[e.type]||'#6366f1'}">
        <div class="cal-event-top">
          <span style="font-size:1.1rem">${typeIcons[e.type]||'📅'}</span>
          <div>
            <div class="cal-event-titre">${e.titre}</div>
            <div class="cal-event-date">${fmtDate(e.date_debut)}${e.heure_debut?' à '+e.heure_debut:''}</div>
          </div>
        </div>
        ${e.description?`<div class="cal-event-desc">${e.description}</div>`:''}
        ${e.classes?`<span class="badge badge-gray" style="font-size:10px">🏫 ${e.classes}</span>`:''}
        <div class="cal-event-actions">
          <button class="btn btn-sm btn-ghost" onclick="modalCalEvent(${e.id})">✏️</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteCalEvent(${e.id})">🗑</button>
        </div>
      </div>`).join('')
      : `<div class="cal-panel-empty">Aucun événement à venir</div>`}

      <div class="cal-legend">
        <div class="cal-panel-title" style="margin-top:1rem">Légende</div>
        ${Object.entries(typeColors).map(([type,color])=>`
        <div class="cal-leg-item">
          <div style="width:12px;height:12px;border-radius:3px;background:${color};flex-shrink:0"></div>
          <span>${typeIcons[type]} ${type.charAt(0).toUpperCase()+type.slice(1)}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Modal événement -->
  <div class="modal-overlay" id="cal-modal" style="display:none" onclick="if(event.target===this)closeCalModal()">
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3 id="cal-modal-title">Nouvel événement</h3>
        <button class="modal-close" onclick="closeCalModal()">✕</button>
      </div>
      <div class="modal-body" id="cal-modal-body"></div>
    </div>
  </div>`;
}

function buildCalGrid(mois, annee, events, typeColors, typeIcons) {
  const premier = new Date(annee, mois, 1);
  const dernier = new Date(annee, mois+1, 0);
  const startDow = (premier.getDay()+6)%7; // Lundi=0
  let html = '';
  const today = new Date();

  // Jours vides avant
  for(let i=0;i<startDow;i++) html += '<div class="cal-day cal-day-empty"></div>';

  for(let d=1;d<=dernier.getDate();d++) {
    const dateStr = `${annee}-${String(mois+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => e.date_debut<=dateStr && (e.date_fin||e.date_debut)>=dateStr);
    const isToday = today.getDate()===d && today.getMonth()===mois && today.getFullYear()===annee;
    html += `
    <div class="cal-day ${isToday?'cal-today':''}" onclick="calDayClick('${dateStr}')">
      <div class="cal-day-num ${isToday?'cal-today-num':''}">${d}</div>
      <div class="cal-day-events">
        ${dayEvents.slice(0,3).map(e=>`
        <div class="cal-day-event" style="background:${typeColors[e.type]||'#6366f1'}20;color:${typeColors[e.type]||'#6366f1'};border-left:2px solid ${typeColors[e.type]||'#6366f1'}" onclick="event.stopPropagation();modalCalEvent(${e.id})">
          ${typeIcons[e.type]||'📅'} ${e.titre.length>12?e.titre.substring(0,12)+'…':e.titre}
        </div>`).join('')}
        ${dayEvents.length>3?`<div style="font-size:10px;color:var(--muted)">+${dayEvents.length-3} autres</div>`:''}
      </div>
    </div>`;
  }
  return html;
}

function calNavMois(dir) {
  calCurrentDate.setMonth(calCurrentDate.getMonth()+dir);
  loadCalendrier();
}

function calDayClick(dateStr) {
  modalCalEvent(null, dateStr);
}

function modalCalEvent(id=null, defaultDate=null) {
  const e = id ? (window._calEvents||[]).find(x=>x.id===id)||{} : {};
  const types = ['evenement','examen','vacances','reunion','sortie','autre'];
  const typeColors = { evenement:'#6366f1', examen:'#ef4444', vacances:'#10b981', reunion:'#f59e0b', sortie:'#0ea5e9', autre:'#8b5cf6' };
  document.getElementById('cal-modal-title').textContent = id ? '✏️ Modifier événement' : '📅 Nouvel événement';
  document.getElementById('cal-modal-body').innerHTML = `
  <div class="form-grid">
    <div class="form-group full"><label class="form-label">Titre *</label>
      <input class="form-control" id="cal-titre" value="${e.titre||''}" placeholder="Ex: Examens de mi-trimestre"></div>
    <div class="form-group"><label class="form-label">Type</label>
      <select class="form-control" id="cal-type" onchange="updateCalColor()">
        ${types.map(t=>`<option value="${t}" ${e.type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Couleur</label>
      <input type="color" class="form-control" id="cal-couleur" value="${e.couleur||'#6366f1'}" style="height:42px;padding:4px"></div>
    <div class="form-group"><label class="form-label">Date début *</label>
      <input type="date" class="form-control" id="cal-debut" value="${e.date_debut||defaultDate||''}"></div>
    <div class="form-group"><label class="form-label">Date fin</label>
      <input type="date" class="form-control" id="cal-fin" value="${e.date_fin||defaultDate||''}"></div>
    <div class="form-group"><label class="form-label">Heure début</label>
      <input type="time" class="form-control" id="cal-hdebut" value="${e.heure_debut||''}"></div>
    <div class="form-group"><label class="form-label">Heure fin</label>
      <input type="time" class="form-control" id="cal-hfin" value="${e.heure_fin||''}"></div>
    <div class="form-group full"><label class="form-label">Classes concernées</label>
      <input class="form-control" id="cal-classes" value="${e.classes||''}" placeholder="Ex: 6ème A, 5ème B (vide = toutes)"></div>
    <div class="form-group full"><label class="form-label">Description</label>
      <textarea class="form-control" id="cal-desc" rows="3" placeholder="Détails de l'événement...">${e.description||''}</textarea></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeCalModal()">Annuler</button>
    <button class="btn btn-primary" onclick="saveCalEvent(${id||'null'})">${id?'Enregistrer':'Créer'}</button>
  </div>`;
  document.getElementById('cal-modal').style.display='flex';
}

function updateCalColor() {
  const colors = { evenement:'#6366f1', examen:'#ef4444', vacances:'#10b981', reunion:'#f59e0b', sortie:'#0ea5e9', autre:'#8b5cf6' };
  const type = document.getElementById('cal-type').value;
  document.getElementById('cal-couleur').value = colors[type]||'#6366f1';
}

async function saveCalEvent(id) {
  const data = {
    titre:       document.getElementById('cal-titre').value.trim(),
    type:        document.getElementById('cal-type').value,
    couleur:     document.getElementById('cal-couleur').value,
    date_debut:  document.getElementById('cal-debut').value,
    date_fin:    document.getElementById('cal-fin').value,
    heure_debut: document.getElementById('cal-hdebut').value,
    heure_fin:   document.getElementById('cal-hfin').value,
    classes:     document.getElementById('cal-classes').value,
    description: document.getElementById('cal-desc').value.trim(),
  };
  if (!data.titre||!data.date_debut) return showToast('Titre et date requis','error');
  try {
    if (id) await api.put('/calendrier/'+id, data);
    else    await api.post('/calendrier', data);
    showToast(id?'✅ Événement modifié':'✅ Événement créé !','success');
    closeCalModal(); loadCalendrier();
  } catch(e) { showToast(e.message,'error'); }
}

async function deleteCalEvent(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  try { await api.delete('/calendrier/'+id); showToast('Supprimé','success'); loadCalendrier(); }
  catch(e) { showToast(e.message,'error'); }
}

function closeCalModal() {
  document.getElementById('cal-modal').style.display='none';
}
