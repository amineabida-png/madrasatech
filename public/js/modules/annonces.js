// ============================================================
// ANNONCES MODULE
// ============================================================

window.AnnoncesMod = (() => {
  let annonces = [];

  async function init() {
    await load();
    render();
    bindEvents();
  }

  async function load() {
    try {
      annonces = await api.get('/annonces');
    } catch(e) {
      showToast('Erreur chargement annonces', 'error');
    }
  }

  function render() {
    const view = document.getElementById('view-annonces');
    if (!view) return;

    view.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-title">📢 Annonces</h2>
          <p class="view-subtitle">${annonces.length} annonce(s) publiée(s)</p>
        </div>
        <button class="btn btn-primary" onclick="AnnoncesMod.openModal()">
          + Nouvelle annonce
        </button>
      </div>

      <div class="search-bar">
        <input type="text" id="annonces-search" placeholder="Rechercher une annonce..." 
               oninput="AnnoncesMod.search(this.value)" class="search-input">
      </div>

      <div id="annonces-list" class="annonces-grid">
        ${renderCards(annonces)}
      </div>

      <!-- Modal -->
      <div id="annonce-modal" class="modal-overlay" style="display:none">
        <div class="modal" style="max-width:560px">
          <div class="modal-header">
            <h3 id="modal-annonce-title">Nouvelle annonce</h3>
            <button class="modal-close" onclick="AnnoncesMod.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="annonce-id">
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" id="annonce-titre" class="form-input" placeholder="Titre de l'annonce">
            </div>
            <div class="form-group">
              <label>Contenu *</label>
              <textarea id="annonce-contenu" class="form-input" rows="5" placeholder="Contenu de l'annonce..."></textarea>
            </div>
            <div class="form-group">
              <label>Destinataires</label>
              <select id="annonce-destinataires" class="form-input">
                <option value="tous">Tous</option>
                <option value="eleves">Élèves</option>
                <option value="professeurs">Professeurs</option>
                <option value="parents">Parents</option>
              </select>
            </div>
            <div class="form-group">
              <label>Priorité</label>
              <select id="annonce-priorite" class="form-input">
                <option value="normale">Normale</option>
                <option value="importante">Importante</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="AnnoncesMod.closeModal()">Annuler</button>
            <button class="btn btn-primary" onclick="AnnoncesMod.save()">Publier</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderCards(list) {
    if (!list.length) return `<div class="empty-state">Aucune annonce publiée</div>`;
    return list.map(a => {
      const prioriteClass = a.priorite === 'urgente' ? 'badge-rose' : a.priorite === 'importante' ? 'badge-amber' : 'badge-blue';
      const prioriteLabel = a.priorite === 'urgente' ? '🔴 Urgente' : a.priorite === 'importante' ? '🟡 Importante' : '🔵 Normale';
      const date = new Date(a.created_at).toLocaleDateString('fr-MA', { day:'2-digit', month:'short', year:'numeric' });
      return `
        <div class="annonce-card">
          <div class="annonce-card-header">
            <span class="badge ${prioriteClass}">${prioriteLabel}</span>
            <span class="annonce-date">${date}</span>
          </div>
          <h3 class="annonce-card-title">${a.titre}</h3>
          <p class="annonce-card-content">${a.contenu}</p>
          <div class="annonce-card-footer">
            <span class="badge badge-gray">👥 ${a.destinataires || 'Tous'}</span>
            <div class="annonce-actions">
              <button class="btn-icon btn-edit" onclick="AnnoncesMod.openModal(${a.id})" title="Modifier">✏️</button>
              <button class="btn-icon btn-delete" onclick="AnnoncesMod.remove(${a.id})" title="Supprimer">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function search(q) {
    const filtered = q.trim()
      ? annonces.filter(a => a.titre.toLowerCase().includes(q.toLowerCase()) || a.contenu.toLowerCase().includes(q.toLowerCase()))
      : annonces;
    document.getElementById('annonces-list').innerHTML = renderCards(filtered);
  }

  function openModal(id) {
    const modal = document.getElementById('annonce-modal');
    if (!modal) return;
    document.getElementById('annonce-id').value = '';
    document.getElementById('annonce-titre').value = '';
    document.getElementById('annonce-contenu').value = '';
    document.getElementById('annonce-destinataires').value = 'tous';
    document.getElementById('annonce-priorite').value = 'normale';
    document.getElementById('modal-annonce-title').textContent = 'Nouvelle annonce';

    if (id) {
      const a = annonces.find(x => x.id === id);
      if (a) {
        document.getElementById('annonce-id').value = a.id;
        document.getElementById('annonce-titre').value = a.titre;
        document.getElementById('annonce-contenu').value = a.contenu;
        document.getElementById('annonce-destinataires').value = a.destinataires || 'tous';
        document.getElementById('annonce-priorite').value = a.priorite || 'normale';
        document.getElementById('modal-annonce-title').textContent = 'Modifier l\'annonce';
      }
    }
    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('annonce-modal');
    if (modal) modal.style.display = 'none';
  }

  async function save() {
    const id = document.getElementById('annonce-id').value;
    const titre = document.getElementById('annonce-titre').value.trim();
    const contenu = document.getElementById('annonce-contenu').value.trim();
    const destinataires = document.getElementById('annonce-destinataires').value;
    const priorite = document.getElementById('annonce-priorite').value;

    if (!titre || !contenu) return showToast('Titre et contenu requis', 'error');

    try {
      if (id) {
        await api.put(`/annonces/${id}`, { titre, contenu, destinataires, priorite });
        showToast('Annonce mise à jour', 'success');
      } else {
        await api.post('/annonces', { titre, contenu, destinataires, priorite });
        showToast('Annonce publiée', 'success');
      }
      closeModal();
      await load();
      render();
    } catch(e) {
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  }

  async function remove(id) {
    if (!confirm('Supprimer cette annonce ?')) return;
    try {
      await api.delete(`/annonces/${id}`);
      showToast('Annonce supprimée', 'success');
      await load();
      render();
    } catch(e) {
      showToast('Erreur suppression', 'error');
    }
  }

  function bindEvents() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  return { init, openModal, closeModal, save, remove, search };
})();
