// ══════════════════════════════════════════════════════════════
// MODULE MESSAGERIE — Design moderne style chat
// ══════════════════════════════════════════════════════════════
let _msgs = [], _msgUsers = [], _activeMsg = null, _boite = 'reception';

async function loadMessagerie() {
  const v = document.getElementById('view-messagerie');
  if (!v) return;
  v.innerHTML = `<div class="loading-center">⏳ Chargement...</div>`;
  try {
    const [msgs, users, nonLus] = await Promise.all([
      api.get('/messages'),
      api.get('/school-users').catch(() => ({ users: [] })),
      api.get('/messages/non-lus').catch(() => ({ count: 0 }))
    ]);
    _msgs = msgs;
    _msgUsers = users.users || [];
    renderMessagerie(nonLus.count || 0);
  } catch(e) {
    v.innerHTML = `<div class="loading-center error">❌ ${e.message}</div>`;
  }
}

function renderMessagerie(nonLus) {
  const v = document.getElementById('view-messagerie');
  v.innerHTML = `
  <div class="msg2-layout">

    <!-- SIDEBAR GAUCHE -->
    <div class="msg2-sidebar">
      <!-- Header sidebar -->
      <div class="msg2-sidebar-header">
        <div class="msg2-sidebar-title">Messages</div>
        <button class="msg2-compose-btn" onclick="ouvrirCompose()" title="Nouveau message">✏️</button>
      </div>

      <!-- Recherche -->
      <div class="msg2-search-wrap">
        <input class="msg2-search" placeholder="🔍 Rechercher..." oninput="searchMsg(this.value)">
      </div>

      <!-- Tabs -->
      <div class="msg2-tabs">
        <button class="msg2-tab active" id="mtab-reception" onclick="switchMBoite('reception')">
          Réception
          ${nonLus > 0 ? `<span class="msg2-badge">${nonLus}</span>` : ''}
        </button>
        <button class="msg2-tab" id="mtab-envoyes" onclick="switchMBoite('envoyes')">Envoyés</button>
      </div>

      <!-- Liste messages -->
      <div class="msg2-list" id="msg2-list">
        ${renderMsgList(_msgs)}
      </div>
    </div>

    <!-- ZONE CENTRALE - Détail message -->
    <div class="msg2-main" id="msg2-main">
      <div class="msg2-empty-state">
        <div class="msg2-empty-icon">💬</div>
        <div class="msg2-empty-title">Vos messages</div>
        <div class="msg2-empty-sub">Sélectionnez un message pour le lire<br>ou composez un nouveau message</div>
        <button class="btn btn-primary" onclick="ouvrirCompose()" style="margin-top:20px">✏️ Nouveau message</button>
      </div>
    </div>

    <!-- CONTACTS / PANEL DROIT -->
    <div class="msg2-contacts" id="msg2-contacts">
      <div class="msg2-contacts-title">👥 Contacts</div>
      ${_msgUsers.length === 0
        ? `<div class="msg2-no-contacts">
            <div style="font-size:2rem;margin-bottom:8px">👤</div>
            <div style="font-size:13px;color:#94a3b8;text-align:center">Aucun contact.<br>Créez des utilisateurs d'abord.</div>
           </div>`
        : _msgUsers.map(u => `
          <div class="msg2-contact" onclick="ouvrirCompose(${u.id},'${(u.prenom+' '+u.nom).replace(/'/g,"\\'")}','${u.role}')">
            <div class="msg2-contact-av ${roleColor(u.role)}">${(u.prenom||'?').charAt(0).toUpperCase()}</div>
            <div class="msg2-contact-info">
              <div class="msg2-contact-name">${u.prenom} ${u.nom}</div>
              <div class="msg2-contact-role">${roleLabel(u.role)}</div>
            </div>
            <button class="msg2-contact-btn" title="Envoyer un message">→</button>
          </div>`).join('')}
    </div>
  </div>

  <!-- MODAL COMPOSER -->
  <div class="modal-backdrop" id="compose-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;align-items:center;justify-content:center" onclick="if(event.target===this)closeCompose()">
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <h3 id="compose-title">✉️ Nouveau message</h3>
        <button class="modal-close" onclick="closeCompose()">✕</button>
      </div>
      <div class="modal-body" id="compose-body"></div>
    </div>
  </div>`;
}

function roleColor(role) {
  return { admin_ecole:'av-purple', professeur:'av-blue', parent:'av-green', eleve:'av-amber', admin:'av-blue' }[role] || 'av-blue';
}
function roleLabel(role) {
  const icons = { admin_ecole:'🛡️ Admin', professeur:'👨‍🏫 Professeur', parent:'👨‍👩‍👧 Parent', eleve:'🎓 Élève', superadmin:'👑 Super Admin' };
  return icons[role] || role;
}

function renderMsgList(msgs) {
  if (!msgs.length) return `
  <div class="msg2-no-msgs">
    <div style="font-size:2.5rem;margin-bottom:8px">📭</div>
    <div>Aucun message</div>
  </div>`;

  return msgs.map(m => {
    const isUnread = !m.lu;
    const time = formatMsgTime(m.created_at);
    const preview = (m.contenu || '').substring(0, 55) + (m.contenu?.length > 55 ? '…' : '');
    const initiale = (m.from_type === 'admin' ? 'M' : m.sujet || 'M').charAt(0).toUpperCase();

    return `
    <div class="msg2-item ${isUnread ? 'msg2-unread' : ''} ${_activeMsg === m.id ? 'msg2-active' : ''}"
         onclick="openMsg(${m.id})" data-id="${m.id}"
         data-sujet="${(m.sujet||'').toLowerCase()}" data-contenu="${(m.contenu||'').toLowerCase()}">
      <div class="msg2-item-av ${m.from_type==='admin'?'av-blue':'av-purple'}">${initiale}</div>
      <div class="msg2-item-body">
        <div class="msg2-item-top">
          <span class="msg2-item-from">${m.from_type === 'admin' ? 'Moi' : (m.from_type || '—')}</span>
          <span class="msg2-item-time">${time}</span>
        </div>
        <div class="msg2-item-sujet ${isUnread ? 'msg2-item-sujet-bold' : ''}">${m.sujet || '(Sans sujet)'}</div>
        <div class="msg2-item-preview">${preview}</div>
      </div>
      ${isUnread ? '<div class="msg2-unread-dot"></div>' : ''}
    </div>`;
  }).join('');
}

function formatMsgTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return Math.floor(diff/60000) + 'min';
  if (diff < 86400000) return d.toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'});
  if (diff < 604800000) return ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()];
  return d.toLocaleDateString('fr-MA',{day:'2-digit',month:'2-digit'});
}

async function openMsg(id) {
  _activeMsg = id;
  // Highlight active
  document.querySelectorAll('.msg2-item').forEach(el => el.classList.toggle('msg2-active', +el.dataset.id === id));

  const m = _msgs.find(x => x.id === id);
  if (!m) return;

  // Marquer lu
  if (!m.lu) {
    await api.put('/messages/'+id+'/lu', {}).catch(()=>{});
    m.lu = 1;
    const item = document.querySelector(`.msg2-item[data-id="${id}"]`);
    if (item) {
      item.classList.remove('msg2-unread');
      item.querySelector('.msg2-unread-dot')?.remove();
      item.querySelector('.msg2-item-sujet')?.classList.remove('msg2-item-sujet-bold');
    }
  }

  document.getElementById('msg2-main').innerHTML = `
  <div class="msg2-detail">
    <!-- Header -->
    <div class="msg2-detail-header">
      <div class="msg2-detail-av ${m.from_type==='admin'?'av-blue':'av-purple'}">${(m.sujet||'M').charAt(0).toUpperCase()}</div>
      <div class="msg2-detail-meta">
        <div class="msg2-detail-sujet">${m.sujet || '(Sans sujet)'}</div>
        <div class="msg2-detail-info">
          <span>De : <strong>${m.from_type==='admin'?'Moi':m.from_type}</strong></span>
          <span>·</span>
          <span>À : <strong>${m.to_type==='tous'?'Tous les utilisateurs':m.to_type||'—'}</strong></span>
          <span>·</span>
          <span>${new Date(m.created_at).toLocaleString('fr-MA',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      </div>
      <div class="msg2-detail-actions">
        <button class="msg2-action-btn" onclick="repondre(${m.id},'${(m.sujet||'').replace(/'/g,"\\'")}')">↩️ Répondre</button>
        <button class="msg2-action-btn msg2-action-delete" onclick="supprimerMsg(${m.id})">🗑</button>
      </div>
    </div>
    <!-- Corps -->
    <div class="msg2-detail-body">${(m.contenu||'').replace(/\n/g,'<br>')}</div>
    <!-- Répondre rapide -->
    <div class="msg2-reply-bar">
      <div class="msg2-reply-av av-blue">${(window.currentUser?.prenom||'A').charAt(0).toUpperCase()}</div>
      <input class="msg2-reply-input" id="reply-input" placeholder="Répondre…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();envoyerReponse(${m.id},'${(m.sujet||'').replace(/'/g,"\\'")}')}" />
      <button class="msg2-reply-send" onclick="envoyerReponse(${m.id},'${(m.sujet||'').replace(/'/g,"\\'")}')">➤</button>
    </div>
  </div>`;
}

async function switchMBoite(boite) {
  _boite = boite;
  document.querySelectorAll('.msg2-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('mtab-'+boite)?.classList.add('active');
  try {
    _msgs = await api.get('/messages' + (boite==='envoyes'?'?boite=envoyes':''));
    document.getElementById('msg2-list').innerHTML = renderMsgList(_msgs);
    _activeMsg = null;
    document.getElementById('msg2-main').innerHTML = `<div class="msg2-empty-state"><div class="msg2-empty-icon">💬</div><div class="msg2-empty-title">Sélectionnez un message</div></div>`;
  } catch(e) { showToast(e.message,'error'); }
}

function searchMsg(q) {
  const ql = q.toLowerCase();
  document.querySelectorAll('.msg2-item').forEach(el => {
    const match = !ql || el.dataset.sujet.includes(ql) || el.dataset.contenu.includes(ql);
    el.style.display = match ? '' : 'none';
  });
}

// ── Composer ─────────────────────────────────────────────────
function ouvrirCompose(toId=null, toName=null, toRole=null, replySubject=null, parentId=null) {
  const users = _msgUsers;
  document.getElementById('compose-title').textContent = replySubject ? '↩️ Répondre' : '✉️ Nouveau message';
  document.getElementById('compose-body').innerHTML = `
  <div class="form-group">
    <label class="form-label">Destinataire</label>
    <select class="form-control" id="msg-to" style="font-size:14px">
      <option value="" data-type="tous">📢 Tous les utilisateurs</option>
      ${users.map(u=>`<option value="${u.id}" data-type="${u.role}" ${u.id==toId?'selected':''}>${roleLabel(u.role)} — ${u.prenom} ${u.nom}</option>`).join('')}
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Sujet *</label>
    <input class="form-control" id="msg-sujet" value="${replySubject?'Re: '+replySubject:''}" placeholder="Sujet du message">
  </div>
  <div class="form-group">
    <label class="form-label">Message *</label>
    <textarea class="form-control" id="msg-contenu" rows="6" placeholder="Rédigez votre message…" style="resize:vertical"></textarea>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="closeCompose()">Annuler</button>
    <button class="btn btn-primary" onclick="sendMsg(${parentId||'null'})">📤 Envoyer</button>
  </div>`;
  document.getElementById('compose-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('msg-contenu')?.focus(), 100);
}

function repondre(parentId, sujet) { ouvrirCompose(null, null, null, sujet, parentId); }

async function envoyerReponse(parentId, sujet) {
  const contenu = document.getElementById('reply-input')?.value.trim();
  if (!contenu) return;
  try {
    await api.post('/messages', { to_type:'tous', sujet:'Re: '+sujet, contenu, parent_id:parentId });
    showToast('✅ Réponse envoyée','success');
    document.getElementById('reply-input').value = '';
    _msgs = await api.get('/messages');
    document.getElementById('msg2-list').innerHTML = renderMsgList(_msgs);
  } catch(e) { showToast(e.message,'error'); }
}

async function sendMsg(parentId) {
  const sel    = document.getElementById('msg-to');
  const toId   = sel.value || null;
  const toType = sel.selectedOptions[0]?.dataset.type || 'tous';
  const sujet  = document.getElementById('msg-sujet').value.trim();
  const contenu= document.getElementById('msg-contenu').value.trim();
  if (!sujet || !contenu) return showToast('Sujet et message requis','error');
  try {
    await api.post('/messages', { to_id:toId, to_type:toType, sujet, contenu, parent_id:parentId });
    showToast('✅ Message envoyé !','success');
    closeCompose();
    _msgs = await api.get('/messages');
    document.getElementById('msg2-list').innerHTML = renderMsgList(_msgs);
  } catch(e) { showToast(e.message,'error'); }
}

async function supprimerMsg(id) {
  if (!confirm('Supprimer ce message ?')) return;
  try {
    await api.delete('/messages/'+id);
    showToast('Message supprimé','success');
    _msgs = _msgs.filter(m=>m.id!==id);
    document.getElementById('msg2-list').innerHTML = renderMsgList(_msgs);
    document.getElementById('msg2-main').innerHTML = `<div class="msg2-empty-state"><div class="msg2-empty-icon">💬</div><div class="msg2-empty-title">Sélectionnez un message</div></div>`;
    _activeMsg = null;
  } catch(e) { showToast(e.message,'error'); }
}

function closeCompose() { document.getElementById('compose-modal').style.display='none'; }
