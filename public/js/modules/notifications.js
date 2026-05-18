// ══════════════════════════════════════════════════════════════
// MODULE NOTIFICATIONS SMS/EMAIL
// ══════════════════════════════════════════════════════════════
async function loadNotifications() {
  const v = document.getElementById('view-notifications');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const [notifs, eleves] = await Promise.all([api.get('/notifications'), api.getEleves()]);
    window._notifsData  = notifs;
    window._notifsEleves = eleves;
    renderNotifications(notifs, eleves);
  } catch(e) { v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`; }
}

function renderNotifications(notifs, eleves) {
  const v = document.getElementById('view-notifications');
  const envoyes  = notifs.length;
  const sms      = notifs.filter(n=>n.canal==='sms').length;
  const email    = notifs.filter(n=>n.canal==='email').length;
  const whatsapp = notifs.filter(n=>n.canal==='whatsapp').length;

  const templates = [
    { id:'absence',  icon:'📅', titre:'Alerte absence',        msg:'Votre enfant {prenom} {nom} a été absent(e) aujourd\'hui. Merci de justifier son absence.' },
    { id:'note',     icon:'📊', titre:'Nouvelle note',          msg:'Une nouvelle note a été publiée pour {prenom} {nom} en {matiere} : {note}/20.' },
    { id:'paiement', icon:'💰', titre:'Rappel paiement',        msg:'Rappel : Le paiement de la scolarité de {prenom} {nom} est dû. Montant : {montant} MAD.' },
    { id:'reunion',  icon:'👥', titre:'Convocation réunion',    msg:'Vous êtes convoqué(e) à une réunion parents-professeurs le {date}. Merci de confirmer votre présence.' },
    { id:'resultat', icon:'🏆', titre:'Résultats disponibles',  msg:'Les résultats du trimestre de {prenom} {nom} sont disponibles. Connectez-vous pour les consulter.' },
    { id:'custom',   icon:'✏️', titre:'Message personnalisé',   msg:'' },
  ];

  v.innerHTML = `
  <div class="page-header">
    <div><div class="page-title">🔔 Notifications SMS / Email</div>
      <div class="page-sub">Communiquez instantanément avec les parents et élèves</div></div>
    <button class="btn btn-primary" onclick="ouvrirEnvoi()">+ Nouvelle notification</button>
  </div>

  <!-- KPIs -->
  <div class="stats-grid" style="margin-bottom:1.5rem">
    <div class="stat-card"><div class="stat-icon blue">📨</div><div><div class="stat-value">${envoyes}</div><div class="stat-label">Total envoyés</div></div></div>
    <div class="stat-card"><div class="stat-icon green">📱</div><div><div class="stat-value">${sms}</div><div class="stat-label">SMS</div></div></div>
    <div class="stat-card"><div class="stat-icon amber">📧</div><div><div class="stat-value">${email}</div><div class="stat-label">Emails</div></div></div>
    <div class="stat-card"><div class="stat-icon purple">💬</div><div><div class="stat-value">${whatsapp}</div><div class="stat-label">WhatsApp</div></div></div>
  </div>

  <!-- Templates rapides -->
  <div class="card" style="margin-bottom:1.5rem">
    <div class="card-header"><span class="card-title">⚡ Envoi rapide par template</span></div>
    <div class="card-body">
      <div class="notif-templates">
        ${templates.map(t=>`
        <div class="notif-template" onclick="ouvrirEnvoi('${t.id}')">
          <div class="notif-tpl-icon">${t.icon}</div>
          <div class="notif-tpl-label">${t.titre}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Historique -->
  <div class="card">
    <div class="card-header"><span class="card-title">📋 Historique des notifications</span></div>
    <div class="table-wrap">
      ${notifs.length ? `<table>
        <thead><tr><th>Date</th><th>Canal</th><th>Destinataire</th><th>Objet</th><th>Statut</th></tr></thead>
        <tbody>
          ${notifs.map(n=>`<tr>
            <td style="font-size:12px;color:var(--muted)">${fmtDate(n.created_at)}</td>
            <td>${canalBadge(n.canal)}</td>
            <td style="font-size:13px">${n.destinataire}</td>
            <td><strong>${n.objet}</strong><div style="font-size:11px;color:var(--muted)">${(n.message||'').substring(0,60)}…</div></td>
            <td><span class="badge ${n.statut==='envoye'?'badge-green':'badge-amber'}">${n.statut==='envoye'?'✅ Envoyé':'⏳ En attente'}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`
      : `<div class="dv-empty">📭 Aucune notification envoyée pour l'instant.</div>`}
    </div>
  </div>

  <!-- Modal envoi -->
  <div class="modal-overlay" id="notif-modal" style="display:none" onclick="if(event.target===this)closeNotifModal()">
    <div class="modal" style="max-width:580px">
      <div class="modal-header">
        <h3 id="notif-modal-title">🔔 Nouvelle notification</h3>
        <button class="modal-close" onclick="closeNotifModal()">✕</button>
      </div>
      <div class="modal-body" id="notif-modal-body"></div>
    </div>
  </div>`;

  window._notifTemplates = templates;
}

function canalBadge(canal) {
  const map = { sms:'<span class="badge badge-green">📱 SMS</span>', email:'<span class="badge badge-blue">📧 Email</span>', whatsapp:'<span class="badge badge-green">💬 WhatsApp</span>' };
  return map[canal] || `<span class="badge badge-gray">${canal}</span>`;
}

function ouvrirEnvoi(templateId=null) {
  const eleves   = window._notifsEleves || [];
  const template = templateId && window._notifTemplates ? window._notifTemplates.find(t=>t.id===templateId) : null;

  document.getElementById('notif-modal-title').textContent = template ? template.icon+' '+template.titre : '🔔 Nouvelle notification';
  document.getElementById('notif-modal-body').innerHTML = `
  <div class="notif-canal-grid" style="margin-bottom:16px">
    <label class="notif-canal-opt"><input type="radio" name="notif-canal" value="sms" checked>
      <div class="notif-canal-card"><div style="font-size:1.5rem">📱</div><div>SMS</div></div></label>
    <label class="notif-canal-opt"><input type="radio" name="notif-canal" value="email">
      <div class="notif-canal-card"><div style="font-size:1.5rem">📧</div><div>Email</div></div></label>
    <label class="notif-canal-opt"><input type="radio" name="notif-canal" value="whatsapp">
      <div class="notif-canal-card"><div style="font-size:1.5rem">💬</div><div>WhatsApp</div></div></label>
  </div>

  <div class="form-group">
    <label class="form-label">Destinataires</label>
    <select class="form-control" id="notif-cible" onchange="updateNotifMsg()">
      <option value="tous">📢 Tous les parents/élèves (${eleves.length})</option>
      <option value="classe">🏫 Par classe</option>
      <option value="individuel">👤 Élève individuel</option>
    </select>
  </div>
  <div id="notif-cible-detail" style="margin-bottom:12px"></div>

  <div class="form-group">
    <label class="form-label">Objet / Titre *</label>
    <input class="form-control" id="notif-objet" value="${template?.titre||''}" placeholder="Ex: Alerte absence — ${new Date().toLocaleDateString('fr-MA')}">
  </div>

  <div class="form-group">
    <label class="form-label">Message *</label>
    <textarea class="form-control" id="notif-msg" rows="5" placeholder="Votre message...">${template?.msg||''}</textarea>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">
      Variables disponibles: {prenom} {nom} {classe} {date} {matiere} {note} {montant}
    </div>
  </div>

  <div class="notif-info-box" style="background:#f0fdf4;border-color:#86efac">
    <div style="font-size:1.2rem">✅</div>
    <div style="font-size:12px;line-height:1.6">
      <strong>Envoi réel gratuit :</strong><br>
      📱 <strong>SMS</strong> → ouvre votre application SMS (sélectionnez l'élève)<br>
      💬 <strong>WhatsApp</strong> → ouvre WhatsApp Web avec le message prêt<br>
      📧 <strong>Email</strong> → ouvre votre client email (Gmail, Outlook...)<br>
      Tous les envois sont aussi enregistrés dans l'historique.
    </div>
  </div>

  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeNotifModal()">Annuler</button>
    <button class="btn btn-primary" onclick="envoyerNotif()">🚀 Envoyer</button>
  </div>`;

  // Handle cible change
  document.getElementById('notif-cible').addEventListener('change', function() {
    const detail = document.getElementById('notif-cible-detail');
    if (this.value === 'classe') {
      const classes = [...new Set(eleves.map(e=>e.classe).filter(Boolean))];
      detail.innerHTML = `<select class="form-control" id="notif-classe"><option value="">Toutes</option>${classes.map(c=>`<option>${c}</option>`).join('')}</select>`;
    } else if (this.value === 'individuel') {
      detail.innerHTML = `<select class="form-control" id="notif-eleve-id"><option value="">Choisir un élève</option>${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom} — ${e.classe||'—'}</option>`).join('')}</select>`;
    } else { detail.innerHTML = ''; }
  });

  // Radio styling
  document.querySelectorAll('input[name="notif-canal"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.notif-canal-card').forEach(c=>c.classList.remove('selected'));
      r.nextElementSibling.classList.add('selected');
    });
  });
  document.querySelector('input[name="notif-canal"]:checked')?.nextElementSibling.classList.add('selected');

  document.getElementById('notif-modal').style.display='flex';
}

async function envoyerNotif() {
  const canal   = document.querySelector('input[name="notif-canal"]:checked')?.value || 'sms';
  const cible   = document.getElementById('notif-cible').value;
  const objet   = document.getElementById('notif-objet').value.trim();
  const message = document.getElementById('notif-msg').value.trim();
  const classe  = document.getElementById('notif-classe')?.value;
  const eleveId = document.getElementById('notif-eleve-id')?.value;

  if (!objet||!message) return showToast('Objet et message requis','error');

  let destinataire = 'Tous les parents/élèves';
  if (cible==='classe' && classe) destinataire = `Classe ${classe}`;
  if (cible==='individuel' && eleveId) {
    const e = (window._notifsEleves||[]).find(x=>x.id==eleveId);
    destinataire = e ? `${e.prenom} ${e.nom}` : 'Élève sélectionné';
  }

  try {
    await api.post('/notifications/envoyer', { destinataire, canal, objet, message, statut:'envoye' });

    // Solution GRATUITE: ouvrir l'app directement
    if (canal === 'whatsapp') {
      const tel = document.getElementById('notif-eleve-id') 
        ? (window._notifsEleves||[]).find(e=>e.id==document.getElementById('notif-eleve-id')?.value)?.telephone
        : null;
      const txt = encodeURIComponent(objet + '\n\n' + message);
      const url = tel 
        ? `https://wa.me/212${tel.replace(/^0/,'').replace(/\s/g,'')}?text=${txt}`
        : `https://web.whatsapp.com/send?text=${txt}`;
      window.open(url, '_blank');
      showToast('✅ WhatsApp ouvert — envoyez le message depuis votre téléphone', 'success');
    } else if (canal === 'sms') {
      const tel = (window._notifsEleves||[]).find(e=>e.id==document.getElementById('notif-eleve-id')?.value)?.telephone;
      if (tel) {
        window.open(`sms:${tel}?body=${encodeURIComponent(objet+': '+message)}`, '_blank');
        showToast('✅ Application SMS ouverte', 'success');
      } else {
        showToast('✅ SMS enregistré — sélectionnez un élève pour envoi direct', 'success');
      }
    } else if (canal === 'email') {
      const email = (window._notifsEleves||[]).find(e=>e.id==document.getElementById('notif-eleve-id')?.value)?.email;
      if (email) {
        window.open(`mailto:${email}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(message)}`, '_blank');
        showToast('✅ Client email ouvert', 'success');
      } else {
        showToast('✅ Email enregistré — sélectionnez un élève pour envoi direct', 'success');
      }
    } else {
      showToast(`✅ Notification enregistrée`, 'success');
    }
    closeNotifModal();
    loadNotifications();
  } catch(e) { showToast(e.message,'error'); }
}

function closeNotifModal() {
  document.getElementById('notif-modal').style.display='none';
}
