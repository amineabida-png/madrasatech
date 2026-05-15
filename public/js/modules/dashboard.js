/* dashboard.js */
async function loadDashboard() {
  const v = document.getElementById('view-dashboard');
  v.innerHTML = `<div class="stats-grid">${[1,2,3,4,5].map(()=>`<div class="stat-card"><div class="skeleton" style="width:50px;height:50px;border-radius:12px"></div><div><div class="skeleton" style="width:80px;height:28px;border-radius:6px;margin-bottom:6px"></div><div class="skeleton" style="width:100px;height:14px;border-radius:4px"></div></div></div>`).join('')}</div>`;
  
  try {
    const s = await api.getStats();
    
    v.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📊 Tableau de Bord</div><div class="page-sub">Vue d'ensemble de l'établissement</div></div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">👨‍🎓</div>
        <div><div class="stat-value">${s.totalEleves}</div><div class="stat-label">Élèves actifs</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">🏫</div>
        <div><div class="stat-value">${s.totalClasses}</div><div class="stat-label">Classes</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">👨‍🏫</div>
        <div><div class="stat-value">${s.totalProfs}</div><div class="stat-label">Professeurs</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div><div class="stat-value">${Number(s.recettes).toLocaleString('fr-MA')}</div><div class="stat-label">Recettes MAD</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon rose">📤</div>
        <div><div class="stat-value">${Number(s.depenses).toLocaleString('fr-MA')}</div><div class="stat-label">Dépenses MAD</div></div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">💳 Situation financière</span>
          <button class="btn btn-sm btn-ghost" onclick="goView('paiements')">Voir tout</button>
        </div>
        <div class="card-body">
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;color:var(--muted)">Bénéfice net</span><strong style="color:${s.benefice>=0?'var(--emerald)':'var(--rose)'}">${fmtMoney(s.benefice)}</strong></div>
            <div class="progress"><div class="progress-bar pb-green" style="width:${Math.min(100,s.recettes>0?s.recettes/(s.recettes+s.depenses)*100:0)}%"></div></div>
          </div>
          <div class="info-row"><span class="info-label">Recettes totales</span><span class="info-value" style="color:var(--emerald)">${fmtMoney(s.recettes)}</span></div>
          <div class="info-row"><span class="info-label">Dépenses totales</span><span class="info-value" style="color:var(--rose)">${fmtMoney(s.depenses)}</span></div>
          <div class="info-row"><span class="info-label">Impayés (nb)</span><span class="info-value">${s.impayesCount} paiements</span></div>
          <div class="info-row"><span class="info-label">Total dû</span><span class="info-value" style="color:var(--amber)">${fmtMoney(s.impayesTotal)}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📅 Absences</span>
          <button class="btn btn-sm btn-ghost" onclick="goView('absences')">Voir tout</button>
        </div>
        <div class="card-body">
          <div style="text-align:center;padding:16px 0 20px">
            <div style="font-size:48px;font-weight:800;color:${s.absAujourd>5?'var(--rose)':'var(--emerald)'}">${s.absAujourd}</div>
            <div style="font-size:12px;color:var(--muted)">absences aujourd'hui</div>
          </div>
          <div class="info-row"><span class="info-label">Total ce mois</span><span class="info-value">${s.totalAbsences}</span></div>
          <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${s.absAujourd===0?'<span class="badge badge-green">Bonne présence</span>':'<span class="badge badge-amber">À surveiller</span>'}</span></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">🏫 Répartition par classe</span>
        <button class="btn btn-sm btn-ghost" onclick="goView('eleves')">Gérer les élèves</button>
      </div>
      <div class="card-body">
        <div style="display:flex;flex-direction:column;gap:10px">
          ${s.parClasse.map(c=>{
            const pct = s.totalEleves>0?Math.round(c.nb/s.totalEleves*100):0;
            return `<div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:13px;font-weight:600">${c.classe}</span>
                <span style="font-size:12px;color:var(--muted)">${c.nb} élèves (${pct}%)</span>
              </div>
              <div class="progress"><div class="progress-bar pb-blue" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

    // Update badge
    document.getElementById('badge-eleves').textContent = s.totalEleves;

  } catch(e) { v.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-title">Erreur de chargement</div><div class="empty-sub">${e.message}</div></div>`; }
}
