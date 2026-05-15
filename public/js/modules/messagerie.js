// ══════════════════════════════════════════════════════════════
// MODULE MESSAGERIE INTERNE
// ══════════════════════════════════════════════════════════════
async function loadMessagerie() {
  const v = document.getElementById('view-messagerie');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const [msgs, users] = await Promise.all([api.get('/messages'), api.get('/school-users')]);
    window._msgUsers = users.users || [];
    window._msgData  = msgs;
    renderMessagerie(msgs);
  } catch(e) {
    v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`;
  }
}

function renderMessagerie(msgs) {
  const v = document.getElementById('view-messagerie');
  const nonLus = msgs.filter(m => !m.lu).length;
  const users  = window._msgUsers || [];

  const roleIcon = { admin_ecole:'🛡️', professeur:'👨‍🏫', parent:'👨‍👩‍👧', eleve:'🎓', admin:'👑' };
  const typeColors = { reception:'', envoyes:'msg-sent' };

  v.innerHTML = `
  <div class="msg-layout">
    <!-- Sidebar gauche -->
    <div class="msg-sidebar">
      <button class="msg-compose-btn" onclick="composeMessage()">✉️ Nouveau message</button>
      <div class="msg-nav">
        <div class="msg-nav-item active" id="mnav-reception" onclick="switchBoite('reception')">
          <span>📥 Réception</span>
          ${nonLus>0?`<span class="msg-badge">${nonLus}</span>`:''}
        </div>
        <div class="msg-nav-item" id="mnav-envoyes" onclick="switchBoite('envoyes')">
          <span>📤 Envoyés</span>
        </div>
      </div>
      <div class="msg-users-list">
        <div class="msg-users-title">Contacts</div>
        ${users.length===0
          ? `<div style="padding:12px;font-size:12px;color:var(--muted)">Aucun contact.<br>Créez des utilisateurs d'abord.</div>`
          : users.map(u => `
          <div class="msg-user-item" onclick="composeMessage(${u.id},'${u.prenom} ${u.nom}','${u.role}')">
            <div class="msg-user-avatar">${(u.prenom||'?').charAt(0).toUpperCase()}</div>
            <div>
              <div class="msg-user-name">${u.prenom} ${u.nom}</div>
              <div class="msg-user-role">${roleIcon[u.role]||'👤'} ${u.role}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Liste messages -->
    <div class="msg-list" id="msg-list">
      ${renderMsgList(msgs)}
    </div>

    <!-- Détail message -->
    <div class="msg-detail" id="msg-detail">
      <div class="msg-detail-empty">
        <div style="font-size:3rem">💬</div>
        <div>Sélectionnez un message</div>
      </div>
    </div>
  </div>

  <!-- Modal composer -->
  <div class="modal-overlay" id="compose-modal" style="display:none" onclick="if(event.target===this)closeCompose()">
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <h3>✉️ Nouveau message</h3>
        <button class="modal-close" onclick="closeCompose()">✕</button>
      </div>
      <div class="modal-body" id="compose-body"></div>
    </div>
  </div>`;
}

function renderMsgList(msgs) {
  if (!msgs.length) return `<div class="msg-list-empty">📭 Aucun message</div>`;
  return msgs.map(m => `
  <div class="msg-item ${!m.lu?'msg-unread':''}" onclick="openMessage(${m.id})">
    <div class="msg-item-avatar">${(m.from_type==='admin'?'A':m.sujet||'M').charAt(0).toUpperCase()}</div>
    <div class="msg-item-content">
      <div class="msg-item-top">
        <span class="msg-item-from">${m.from_type==='admin'?'Moi':m.from_type}</span>
        <span class="msg-item-date">${fmtDate(m.created_at)}</span>
      </div>
      <div class="msg-item-sujet">${m.sujet}</div>
      <div class="msg-item-preview">${(m.contenu||'').substring(0,80)}${m.contenu?.length>80?'...':''}</div>
    </div>
    ${!m.lu?'<div class="msg-unread-dot"></div>':''}
  </div>`).join('');
}

async function openMessage(id) {
  const msg = window._msgData.find(m=>m.id===id);
  if (!msg) return;
  // Marquer lu
  if (!msg.lu) {
    await api.put('/messages/'+id+'/lu', {});
    msg.lu = 1;
    document.querySelector(`[onclick="openMessage(${id})"]`)?.classList.remove('msg-unread');
    document.querySelector(`[onclick="openMessage(${id})"] .msg-unread-dot`)?.remove();
  }
  const detail = document.getElementById('msg-detail');
  detail.innerHTML = `
  <div class="msg-detail-header">
    <div class="msg-detail-sujet">${msg.sujet}</div>
    <div class="msg-detail-meta">
      <span>📅 ${new Date(msg.created_at).toLocaleString('fr-MA')}</span>
      <span>👥 ${msg.to_type==='tous'?'Tous les utilisateurs':msg.to_type||'—'}</span>
    </div>
  </div>
  <div class="msg-detail-body">${(msg.contenu||'').replace(/\n/g,'<br>')}</div>
  <div class="msg-detail-actions">
    <button class="btn btn-ghost btn-sm" onclick="composeMessage(null,null,null,'${msg.sujet}',${msg.id})">↩️ Répondre</button>
    <button class="btn btn-danger btn-sm" onclick="deleteMsg(${msg.id})">🗑 Supprimer</button>
  </div>`;
}

async function switchBoite(boite) {
  document.querySelectorAll('.msg-nav-item').forEach(i=>i.classList.remove('active'));
  document.getElementById('mnav-'+boite)?.classList.add('active');
  try {
    const msgs = await api.get('/messages?boite='+boite);
    window._msgData = msgs;
    document.getElementById('msg-list').innerHTML = renderMsgList(msgs);
    document.getElementById('msg-detail').innerHTML = `<div class="msg-detail-empty"><div style="font-size:3rem">💬</div><div>Sélectionnez un message</div></div>`;
  } catch(e) { showToast(e.message,'error'); }
}

function composeMessage(toId=null, toName=null, toRole=null, replySubject=null, parentId=null) {
  const users = window._msgUsers || [];
  document.getElementById('compose-body').innerHTML = `
  <div class="form-group">
    <label class="form-label">Destinataire</label>
    <select class="form-control" id="msg-to">
      <option value="" data-type="tous">📢 Tous les utilisateurs</option>
      ${users.map(u=>`<option value="${u.id}" data-type="${u.role}" ${u.id===toId?'selected':''}>${u.prenom} ${u.nom} (${u.role})</option>`).join('')}
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Sujet *</label>
    <input class="form-control" id="msg-sujet" value="${replySubject?'Re: '+replySubject:''}" placeholder="Sujet du message">
  </div>
  <div class="form-group">
    <label class="form-label">Message *</label>
    <textarea class="form-control" id="msg-contenu" rows="6" placeholder="Écrivez votre message..."></textarea>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeCompose()">Annuler</button>
    <button class="btn btn-primary" onclick="sendMessage(${parentId||null})">📤 Envoyer</button>
  </div>`;
  document.getElementById('compose-modal').style.display = 'flex';
}

async function sendMessage(parentId) {
  const sel    = document.getElementById('msg-to');
  const toId   = sel.value || null;
  const toType = sel.selectedOptions[0]?.dataset.type || 'tous';
  const sujet  = document.getElementById('msg-sujet').value.trim();
  const contenu= document.getElementById('msg-contenu').value.trim();
  if (!sujet||!contenu) return showToast('Sujet et message requis','error');
  try {
    await api.post('/messages', { to_id:toId, to_type:toType, sujet, contenu, parent_id:parentId });
    showToast('✅ Message envoyé !','success');
    closeCompose();
    loadMessagerie();
  } catch(e) { showToast(e.message,'error'); }
}

async function deleteMsg(id) {
  if (!confirm('Supprimer ce message ?')) return;
  try {
    await api.delete('/messages/'+id);
    showToast('Message supprimé','success');
    loadMessagerie();
  } catch(e) { showToast(e.message,'error'); }
}

function closeCompose() {
  document.getElementById('compose-modal').style.display='none';
}
