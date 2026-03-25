/* ═══════════════════════════════════════════
   GolfGives — app.js
═══════════════════════════════════════════ */

const API = 'http://localhost:3000/api';
let token = localStorage.getItem('gg_token') || null;
let user = null;
let charities = [];

// ─── API Helper ───────────────────────────────────────────────────────────────
async function api(method, path, data) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(API + path, opts);
  return res.json();
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const showPage = id => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(id).classList.add('active');
};
const setVisible = (id, show) => $(id).classList.toggle('hidden', !show);
const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };

// ─── Auth State ───────────────────────────────────────────────────────────────
function applyAuthState() {
  const loggedIn = !!user;
  setVisible('loginBtn', !loggedIn);
  setVisible('signupBtn', !loggedIn);
  setVisible('dashBtn', loggedIn);
  setVisible('logoutBtn', loggedIn);
}

async function loadUser() {
  if (!token) { user = null; return; }
  const res = await api('GET', '/me');
  if (res.error) { token = null; localStorage.removeItem('gg_token'); user = null; return; }
  user = res;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
$('loginBtn').onclick = () => openModal('login');
$('signupBtn').onclick = () => openModal('signup');
$('heroJoin').onclick = () => user ? goToDash() : openModal('signup');
$('ctaJoin').onclick = () => user ? goToDash() : openModal('signup');
$('dashBtn').onclick = goToDash;
$('logoutBtn').onclick = doLogout;
$('dashLogout').onclick = doLogout;
$('adminLogout').onclick = doLogout;

function goToDash() {
  if (!user) return openModal('login');
  if (user.role === 'admin') {
    showPage('adminPage');
    loadAdminStats();
  } else {
    showPage('dashPage');
    loadDashboard();
  }
}

async function doLogout() {
  await api('POST', '/auth/logout');
  token = null; user = null;
  localStorage.removeItem('gg_token');
  applyAuthState();
  showPage('homePage');
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openModal(type) {
  $('modalOverlay').classList.remove('hidden');
  if (type === 'login') { $('loginForm').classList.remove('hidden'); $('signupForm').classList.add('hidden'); }
  else { $('signupForm').classList.remove('hidden'); $('loginForm').classList.add('hidden'); }
}
function closeModal() { $('modalOverlay').classList.add('hidden'); }

$('closeModal').onclick = closeModal;
$('closeModal2').onclick = closeModal;
$('modalOverlay').onclick = e => { if (e.target === $('modalOverlay')) closeModal(); };
$('switchToSignup').onclick = e => { e.preventDefault(); openModal('signup'); };
$('switchToLogin').onclick = e => { e.preventDefault(); openModal('login'); };

// Login
$('loginSubmit').onclick = async () => {
  const email = $('loginEmail').value.trim();
  const password = $('loginPass').value;
  const errEl = $('loginError');
  errEl.classList.add('hidden');
  if (!email || !password) { errEl.textContent = 'Please fill all fields.'; errEl.classList.remove('hidden'); return; }
  const res = await api('POST', '/auth/login', { email, password });
  if (res.error) { errEl.textContent = res.error; errEl.classList.remove('hidden'); return; }
  token = res.token; user = res.user;
  localStorage.setItem('gg_token', token);
  applyAuthState(); closeModal(); goToDash();
};

// Signup
$('signupSubmit').onclick = async () => {
  const name = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const password = $('regPass').value;
  const plan = $('regPlan').value;
  const charityId = $('regCharity').value;
  const errEl = $('signupError');
  errEl.classList.add('hidden');
  if (!name || !email || !password) { errEl.textContent = 'Please fill all fields.'; errEl.classList.remove('hidden'); return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  const res = await api('POST', '/auth/signup', { name, email, password, plan, charityId });
  if (res.error) { errEl.textContent = res.error; errEl.classList.remove('hidden'); return; }
  token = res.token; user = res.user;
  localStorage.setItem('gg_token', token);
  applyAuthState(); closeModal(); goToDash();
};

// ─── Dashboard Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('#dashPage .dash-nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#dashPage .dash-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('#dashPage .tab-content').forEach(t => t.classList.remove('active'));
    $('tab-' + tab).classList.add('active');
    if (tab === 'draws') loadDraws();
    if (tab === 'charity') renderCharitySelect();
    if (tab === 'scores') renderScores();
    if (tab === 'settings') renderSettings();
  };
});

document.querySelectorAll('#adminPage .dash-nav-item').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#adminPage .dash-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('#adminPage .tab-content').forEach(t => t.classList.remove('active'));
    $('tab-' + tab).classList.add('active');
    if (tab === 'astats') loadAdminStats();
    if (tab === 'ausers') loadAdminUsers();
    if (tab === 'awinners') loadAdminWinners();
  };
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  await loadUser();
  if (!user) return;
  setText('dashGreeting', `Welcome, ${user.name}! 👋`);
  setText('dashSub', `Member since ${new Date(user.joined).toLocaleDateString()}`);
  setText('subStatus', user.active ? `✅ Active (${user.plan})` : '❌ Inactive');
  setText('scoresCount', `${user.scores.length} / 5`);
  setText('totalWon', `£${(user.totalWon || 0).toFixed(2)}`);
  // Pool
  const pool = await api('GET', '/pool');
  setText('poolVal', `£${pool.total.toFixed(2)}`);
  // Charity contrib
  const fee = user.plan === 'monthly' ? 10 : (100 / 12);
  setText('charityContrib', `£${(fee * (user.charityPct / 100)).toFixed(2)}/mo to ${getCharityName(user.charityId)}`);
  renderScores();
}

function getCharityName(id) {
  const c = charities.find(c => c.id === id);
  return c ? c.name : 'Unknown';
}

// ─── Scores ───────────────────────────────────────────────────────────────────
function renderScores() {
  if (!user) return;
  const list = $('scoresList');
  if (!user.scores.length) { list.innerHTML = '<div class="no-data">No scores yet. Enter your first score above!</div>'; return; }
  list.innerHTML = user.scores.map((s, i) => `
    <div class="score-item">
      <div class="score-badge">${s.score}</div>
      <div class="score-info">
        <div class="score-val">Stableford: ${s.score} pts</div>
        <div class="score-date">${s.date}</div>
      </div>
      <button class="btn-delete" data-idx="${i}" title="Remove">🗑</button>
    </div>
  `).join('');
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = async () => {
      const res = await api('DELETE', `/scores/${btn.dataset.idx}`);
      if (!res.error) { user = res; renderScores(); setText('scoresCount', `${user.scores.length} / 5`); }
    };
  });
}

// Set today's date as default
$('scoreDateInput').valueAsDate = new Date();

$('addScoreBtn').onclick = async () => {
  const score = parseInt($('scoreInput').value);
  const date = $('scoreDateInput').value;
  if (!score || score < 1 || score > 45) return alert('Score must be between 1 and 45.');
  if (!date) return alert('Please select a date.');
  const res = await api('POST', '/scores', { score, date });
  if (res.error) return alert(res.error);
  user = res;
  $('scoreInput').value = '';
  $('scoreDateInput').valueAsDate = new Date();
  renderScores();
  setText('scoresCount', `${user.scores.length} / 5`);
};

// ─── Draws ────────────────────────────────────────────────────────────────────
async function loadDraws() {
  const draws = await api('GET', '/draws');
  const el = $('drawsList');
  if (!draws.length) { el.innerHTML = '<div class="no-data">No draws have been run yet.</div>'; return; }
  el.innerHTML = draws.map(d => `
    <div class="draw-item">
      <div class="draw-header">
        <div class="draw-date">${new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div class="draw-mode">${d.mode}</div>
      </div>
      <div class="draw-numbers">${d.numbers.map(n => `<div class="draw-num">${n}</div>`).join('')}</div>
      <div class="draw-winners">
        5-Match: <span>${d.winners5.length}</span> winners ·
        4-Match: <span>${d.winners4.length}</span> winners ·
        3-Match: <span>${d.winners3.length}</span> winners
        ${d.jackpotRolled ? ' · <span style="color:var(--gold-light)">🏆 Jackpot rolled over!</span>' : ''}
      </div>
    </div>
  `).join('');
}

// ─── Charity Select ───────────────────────────────────────────────────────────
function renderCharitySelect() {
  const grid = $('charitySelect');
  grid.innerHTML = charities.map(c => `
    <div class="charity-select-item ${user.charityId === c.id ? 'selected' : ''}" data-id="${c.id}">
      <div class="emoji">${c.image}</div>
      <div class="name">${c.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.charity-select-item').forEach(el => {
    el.onclick = () => {
      grid.querySelectorAll('.charity-select-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
    };
  });
  $('charityPctInput').value = user.charityPct || 10;
}

$('saveCharityBtn').onclick = async () => {
  const selected = $('charitySelect').querySelector('.selected');
  const charityId = selected ? selected.dataset.id : user.charityId;
  const charityPct = parseInt($('charityPctInput').value) || 10;
  const res = await api('PUT', '/me', { charityId, charityPct });
  if (!res.error) { user = res; alert('✅ Charity preferences saved!'); }
};

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  $('settingsName').value = user.name;
  $('settingsPlan').value = user.plan;
}
$('saveSettingsBtn').onclick = async () => {
  const name = $('settingsName').value.trim();
  const plan = $('settingsPlan').value;
  const res = await api('PUT', '/me', { name, plan });
  if (!res.error) { user = res; setText('dashGreeting', `Welcome, ${user.name}! 👋`); alert('✅ Settings saved!'); }
};

// ─── Home Page ────────────────────────────────────────────────────────────────
async function loadHomePage() {
  const pool = await api('GET', '/pool');
  if (!pool.error) {
    animateCount('statPool', 0, pool.total, '£', 1200);
  }
  const draws = await api('GET', '/draws');
  if (!draws.error) {
    animateCount('statDraws', 0, draws.length, '', 1000);
  }
}

function animateCount(id, from, to, prefix = '', duration = 1000) {
  const el = $(id); if (!el) return;
  const steps = 40; const step = (to - from) / steps;
  let cur = from; let i = 0;
  const t = setInterval(() => {
    cur += step; i++;
    el.textContent = prefix + (Number.isInteger(to) ? Math.round(cur) : cur.toFixed(2));
    if (i >= steps) { clearInterval(t); el.textContent = prefix + to; }
  }, duration / steps);
}

// ─── Charities Public ────────────────────────────────────────────────────────
function renderPublicCharities() {
  const grid = $('charitiesGrid');
  if (!charities.length) { grid.innerHTML = '<div class="no-data">Loading...</div>'; return; }
  grid.innerHTML = charities.map(c => `
    <div class="charity-card">
      <div class="charity-emoji">${c.image}</div>
      <div class="charity-name">${c.name}</div>
      <div class="charity-desc">${c.description}</div>
    </div>
  `).join('');
}

// ─── Admin ────────────────────────────────────────────────────────────────────
async function loadAdminStats() {
  const stats = await api('GET', '/admin/stats');
  if (stats.error) return;
  setText('aActiveUsers', stats.activeUsers);
  setText('aTotalPool', `£${stats.totalPool.toFixed(2)}`);
  setText('aCharityTotal', `£${stats.charityTotal.toFixed(2)}`);
  setText('aTotalDraws', stats.totalDraws);
  setText('aJackpot', `£${(stats.jackpot || 0).toFixed(2)}`);
}

async function loadAdminUsers() {
  const users = await api('GET', '/admin/users');
  const el = $('adminUsersList');
  if (!users.length) { el.innerHTML = '<div class="no-data">No users found.</div>'; return; }
  el.innerHTML = users.map(u => `
    <div class="user-row">
      <div class="user-name">${u.name}</div>
      <div class="user-email">${u.email}</div>
      <span class="badge ${u.role === 'admin' ? 'badge-admin' : u.active ? 'badge-active' : 'badge-inactive'}">
        ${u.role === 'admin' ? 'Admin' : u.active ? 'Active' : 'Inactive'}
      </span>
      <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-muted)">${u.plan || '—'}</span>
      <span style="font-size:12px;color:var(--text-muted)">Scores: ${(u.scores || []).length}</span>
      ${u.role !== 'admin' ? `<button class="btn-sm" onclick="toggleUser('${u.id}', ${u.active})">${u.active ? 'Deactivate' : 'Activate'}</button>` : ''}
    </div>
  `).join('');
}

window.toggleUser = async (id, active) => {
  await api('PUT', `/admin/users/${id}`, { active: !active });
  loadAdminUsers();
};

$('runDrawBtn').onclick = async () => {
  const mode = $('drawMode').value;
  $('runDrawBtn').textContent = 'Running...';
  const res = await api('POST', '/admin/draw', { mode });
  $('runDrawBtn').textContent = 'Run Draw Now';
  if (res.error) { $('drawResult').innerHTML = `<p style="color:#e74c3c">${res.error}</p>`; return; }
  $('drawResult').innerHTML = `
    <h4>🎲 Draw Results — ${new Date(res.date).toLocaleDateString()}</h4>
    <div class="result-nums">${res.numbers.map(n => `<div class="result-num">${n}</div>`).join('')}</div>
    <div class="result-winners">
      Pool: <strong>£${res.pool.total.toFixed(2)}</strong> ·
      5-Match Winners: <strong>${res.winners5.length}</strong> (Jackpot: £${res.pool.match5.toFixed(2)}) ·
      4-Match Winners: <strong>${res.winners4.length}</strong> (£${res.pool.match4.toFixed(2)}) ·
      3-Match Winners: <strong>${res.winners3.length}</strong> (£${res.pool.match3.toFixed(2)})
      ${res.jackpotRolled ? '<br/><span style="color:var(--gold-light)">🏆 No 5-match winner — jackpot rolls over!</span>' : ''}
    </div>
  `;
};

async function loadAdminWinners() {
  const draws = await api('GET', '/draws');
  const el = $('adminWinnersList');
  const allWinners = [];
  draws.forEach(d => {
    [...(d.winners5 || []), ...(d.winners4 || []), ...(d.winners3 || [])].forEach(w => {
      allWinners.push({ ...w, drawDate: d.date, drawId: d.id });
    });
  });
  if (!allWinners.length) { el.innerHTML = '<div class="no-data">No winners yet.</div>'; return; }
  el.innerHTML = allWinners.map(w => `
    <div class="winner-row">
      <div class="winner-match">${w.matches}✓</div>
      <div style="flex:1">
        <div style="font-weight:600;color:var(--white)">${w.name}</div>
        <div style="font-size:12px;color:var(--text-muted)">${w.email} · ${new Date(w.drawDate).toLocaleDateString()}</div>
      </div>
      <span class="badge ${w.status === 'paid' ? 'badge-active' : 'badge-inactive'}">${w.status || 'pending'}</span>
    </div>
  `).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Load charities
  const res = await api('GET', '/charities');
  if (!res.error) {
    charities = res;
    renderPublicCharities();
    // Populate signup charity dropdown
    $('regCharity').innerHTML = charities.map(c => `<option value="${c.id}">${c.image} ${c.name}</option>`).join('');
  }

  // Restore session
  if (token) {
    await loadUser();
    if (user) {
      applyAuthState();
      animateCount('statUsers', 0, 1, '', 800);
    } else {
      applyAuthState();
    }
  } else {
    applyAuthState();
  }

  loadHomePage();
}

init();
