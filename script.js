const STORAGE_KEY = 'kapo_uri_pa_v2';
let appData = null;
let currentPaId = null;
let sessionCode = '';
let pendingToggle = null; // Speichert das temporäre Ziel fürs Popup

const viewList = document.getElementById('view-list');
const viewDetail = document.getElementById('view-detail');
const btnBack = document.getElementById('btn-back');
const modal = document.getElementById('task-modal');

// 1. LOGIN
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('access-code-input').value;
  try {
    const res = await fetch('/api/data', { headers: { 'x-access-code': code } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    sessionCode = code;
    // Lokale Daten laden oder Serverdaten übernehmen
    const local = localStorage.getItem(STORAGE_KEY);
    appData = local ? JSON.parse(local) : data;
    
    renderList();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
  } catch (err) {
    document.getElementById('login-error').textContent = err.message;
    document.getElementById('login-error').classList.remove('hidden');
  }
});

function saveToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// 2. ÜBERSICHTS-TABELLE
function renderList() {
  const tbody = document.getElementById('pa-tbody');
  tbody.innerHTML = '';
  
  appData.aspiranten.forEach(pa => {
    const score = calcGlobalScore(pa);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${pa.name}</strong></td>
      <td>${pa.kuerzel}</td>
      <td>${pa.lehrgang}</td>
      <td>${pa.praxisbegleiter}</td>
      <td>
        <div style="background:#e2e8f0; border-radius:4px; height:8px; width:120px; overflow:hidden;">
          <div style="background:#10b981; height:100%; width:${score}%;"></div>
        </div>
      </td>
      <td><button class="btn-open" onclick="openDetail('${pa.id}')">Akte öffnen</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function calcGlobalScore(pa) {
  let total = 0, done = 0;
  Object.values(pa.meilensteine).forEach(m => { total++; if(m.done) done++; });
  Object.values(pa.praxisziele).forEach(cat => {
    cat.forEach(t => { total++; if(t.done) done++; });
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// 3. DETAILANSICHT (AKTE)
window.openDetail = function(paId) {
  currentPaId = paId;
  const pa = appData.aspiranten.find(p => p.id === paId);
  
  document.getElementById('det-name').textContent = pa.name;
  document.getElementById('det-avatar').textContent = pa.name.substring(0,2).toUpperCase();
  document.getElementById('det-meta').textContent = `${pa.lehrgang} | PB: ${pa.praxisbegleiter} | GC: ${pa.gruppenchef}`;
  document.getElementById('det-score').textContent = calcGlobalScore(pa) + '%';

  // Meilensteine rendern
  const msList = document.getElementById('det-milestones');
  msList.innerHTML = '';
  Object.entries(pa.meilensteine).forEach(([key, ms]) => {
    const metaText = ms.done ? `${ms.date} | ${ms.info}` : '';
    msList.innerHTML += `
      <div class="check-item">
        <div class="check-box ${ms.done ? 'done' : ''}" onclick="toggleMs('${key}')"></div>
        <div class="check-label">${ms.label}</div>
        <div class="check-date" style="display:${ms.done ? 'block' : 'none'}">${metaText}</div>
      </div>
    `;
  });

  // Praxisziele rendern
  const pxGrid = document.getElementById('det-praxis');
  pxGrid.innerHTML = '';
  Object.entries(pa.praxisziele).forEach(([catKey, tasks]) => {
    let catHtml = `<div class="praxis-cat"><h4>${catKey.toUpperCase()}</h4>`;
    tasks.forEach((task, idx) => {
      const metaText = task.done ? `${task.date} | ${task.info}` : '';
      catHtml += `
        <div class="check-item">
          <div class="check-box ${task.done ? 'done' : ''}" onclick="togglePx('${catKey}', ${idx})"></div>
          <div class="check-label">${task.task}</div>
          <div class="check-date" style="display:${task.done ? 'block' : 'none'}">${metaText}</div>
        </div>
      `;
    });
    catHtml += `</div>`;
    pxGrid.innerHTML += catHtml;
  });

  viewList.classList.add('hidden');
  viewDetail.classList.remove('hidden');
  btnBack.classList.remove('hidden');
}

// 4. POPUP LOGIK (DATUM & KÜRZEL)
window.toggleMs = function(key) {
  const pa = appData.aspiranten.find(p => p.id === currentPaId);
  const ms = pa.meilensteine[key];
  if (ms.done) {
    // Wenn schon erledigt -> Haken entfernen & Daten löschen
    ms.done = false; ms.date = ""; ms.info = "";
    saveToLocal(); openDetail(currentPaId);
  } else {
    // Wenn offen -> Popup anzeigen
    openTaskModal(ms.label, { isMs: true, key });
  }
}

window.togglePx = function(cat, idx) {
  const pa = appData.aspiranten.find(p => p.id === currentPaId);
  const px = pa.praxisziele[cat][idx];
  if (px.done) {
    px.done = false; px.date = ""; px.info = "";
    saveToLocal(); openDetail(currentPaId);
  } else {
    openTaskModal(px.task, { isMs: false, cat, idx });
  }
}

function openTaskModal(taskName, payload) {
  pendingToggle = payload;
  document.getElementById('modal-task-name').textContent = taskName;
  // Datumsauswahl standardmässig auf den heutigen Tag setzen
  document.getElementById('modal-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-kuerzel').value = '';
  modal.classList.remove('hidden');
  document.getElementById('modal-kuerzel').focus();
}

window.closeModal = function() {
  modal.classList.add('hidden');
  pendingToggle = null;
}

window.confirmTask = function() {
  const dateVal = document.getElementById('modal-date').value;
  const kuerzelVal = document.getElementById('modal-kuerzel').value.trim() || 'Visum fehlt';
  
  const pa = appData.aspiranten.find(p => p.id === currentPaId);
  
  // Datum schöner formatieren (JJJJ-MM-TT -> TT.MM.JJJJ)
  let displayDate = dateVal;
  if (dateVal) {
    const [y, m, d] = dateVal.split('-');
    displayDate = `${d}.${m}.${y}`;
  } else {
    displayDate = "Kein Datum";
  }

  // Daten in das entsprechende Objekt speichern
  if (pendingToggle.isMs) {
    pa.meilensteine[pendingToggle.key].done = true;
    pa.meilensteine[pendingToggle.key].date = displayDate;
    pa.meilensteine[pendingToggle.key].info = kuerzelVal;
  } else {
    pa.praxisziele[pendingToggle.cat][pendingToggle.idx].done = true;
    pa.praxisziele[pendingToggle.cat][pendingToggle.idx].date = displayDate;
    pa.praxisziele[pendingToggle.cat][pendingToggle.idx].info = kuerzelVal;
  }

  saveToLocal();
  closeModal();
  openDetail(currentPaId);
}

// 5. BUTTON EVENTS
btnBack.addEventListener('click', () => {
  viewDetail.classList.add('hidden');
  btnBack.classList.add('hidden');
  viewList.classList.remove('hidden');
  renderList();
});

document.getElementById('btn-save').addEventListener('click', () => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appData, null, 2));
  const a = document.createElement('a');
  a.href = dataStr; a.download = 'pa_cockpit_backup.json';
  document.body.appendChild(a); a.click(); a.remove();
});

document.getElementById('btn-logout').addEventListener('click', () => location.reload());
