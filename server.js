const http = require('http');
const crypto = require('crypto');

// ─── In-Memory Database ───────────────────────────────────────────────────────
const db = {
  users: [],
  charities: [
    { id: 'c1', name: 'Cancer Research UK', description: 'Funding life-saving cancer research worldwide.', image: '🎗️' },
    { id: 'c2', name: 'Age UK Golf Days', description: 'Supporting elderly communities through sport events.', image: '⛳' },
    { id: 'c3', name: 'Help for Heroes', description: 'Supporting wounded armed forces personnel.', image: '🎖️' },
    { id: 'c4', name: 'Children in Need', description: 'Helping disadvantaged children across the UK.', image: '🌟' },
  ],
  draws: [],
  winners: [],
  sessions: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return crypto.randomBytes(8).toString('hex'); }
function hash(p) { return crypto.createHash('sha256').update(p).digest('hex'); }
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });
  res.end(JSON.stringify(data));
}
function auth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  return token ? db.sessions[token] : null;
}
function body(req) {
  return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
}

// Pre-seed admin
db.users.push({ id: 'admin', email: 'admin@golf.com', password: hash('admin123'), role: 'admin', name: 'Admin', scores: [], charityId: 'c1', charityPct: 10, plan: 'yearly', active: true, joined: Date.now(), totalWon: 0 });

// ─── Prize Pool Calc ──────────────────────────────────────────────────────────
let jackpotRollover = 0;
function calcPool() {
  const subs = db.users.filter(u => u.active && u.role !== 'admin');
  const monthly = subs.filter(u => u.plan === 'monthly').length * 10;
  const yearly = subs.filter(u => u.plan === 'yearly').length * 100 / 12;
  const total = monthly + yearly;
  return { total: +total.toFixed(2), match5: +(total * 0.4 + jackpotRollover).toFixed(2), match4: +(total * 0.35).toFixed(2), match3: +(total * 0.25).toFixed(2) };
}

// ─── Draw Engine ─────────────────────────────────────────────────────────────
function runDraw(mode = 'random') {
  const eligible = db.users.filter(u => u.active && u.role !== 'admin' && u.scores.length >= 3);
  if (!eligible.length) return { error: 'No eligible users' };

  let drawNums;
  if (mode === 'random') {
    drawNums = Array.from({ length: 5 }, () => Math.floor(Math.random() * 45) + 1);
  } else {
    // Algorithmic: weighted by least frequent scores
    const freq = {};
    eligible.forEach(u => u.scores.forEach(s => { freq[s.score] = (freq[s.score] || 0) + 1; }));
    const all = Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => (freq[a] || 0) - (freq[b] || 0));
    drawNums = all.slice(0, 5);
  }

  const pool = calcPool();
  const results = { id: uid(), date: Date.now(), numbers: drawNums, mode, pool, winners5: [], winners4: [], winners3: [], status: 'published' };

  eligible.forEach(u => {
    const scores = u.scores.map(s => s.score);
    const matches = drawNums.filter(n => scores.includes(n)).length;
    if (matches >= 3) {
      const entry = { userId: u.id, name: u.name, email: u.email, matches, status: 'pending' };
      if (matches === 5) results.winners5.push(entry);
      else if (matches === 4) results.winners4.push(entry);
      else results.winners3.push(entry);
    }
  });

  // Jackpot rollover
  if (!results.winners5.length) { jackpotRollover += pool.match5; results.jackpotRolled = true; }
  else jackpotRollover = 0;

  db.draws.unshift(results);
  return results;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const routes = {
  'POST /api/auth/signup': async (req, res) => {
    const { email, password, name, plan, charityId, charityPct } = await body(req);
    if (db.users.find(u => u.email === email)) return json(res, 400, { error: 'Email exists' });
    const user = { id: uid(), email, password: hash(password), role: 'user', name, scores: [], charityId: charityId || 'c1', charityPct: charityPct || 10, plan: plan || 'monthly', active: true, joined: Date.now(), totalWon: 0 };
    db.users.push(user);
    const token = uid();
    db.sessions[token] = user.id;
    const { password: _, ...safe } = user;
    return json(res, 201, { token, user: safe });
  },
  'POST /api/auth/login': async (req, res) => {
    const { email, password } = await body(req);
    const user = db.users.find(u => u.email === email && u.password === hash(password));
    if (!user) return json(res, 401, { error: 'Invalid credentials' });
    const token = uid();
    db.sessions[token] = user.id;
    const { password: _, ...safe } = user;
    return json(res, 200, { token, user: safe });
  },
  'POST /api/auth/logout': async (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    delete db.sessions[token];
    return json(res, 200, { ok: true });
  },
  'GET /api/me': async (req, res) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    const { password: _, ...safe } = user;
    return json(res, 200, safe);
  },
  'GET /api/charities': async (req, res) => json(res, 200, db.charities),
  'POST /api/scores': async (req, res) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    const { score, date } = await body(req);
    if (!score || score < 1 || score > 45) return json(res, 400, { error: 'Score must be 1-45' });
    user.scores.unshift({ score: +score, date: date || new Date().toISOString().split('T')[0] });
    if (user.scores.length > 5) user.scores = user.scores.slice(0, 5);
    const { password: _, ...safe } = user;
    return json(res, 200, safe);
  },
  'DELETE /api/scores/:idx': async (req, res, params) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    user.scores.splice(+params.idx, 1);
    const { password: _, ...safe } = user;
    return json(res, 200, safe);
  },
  'PUT /api/me': async (req, res) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    const data = await body(req);
    if (data.charityId) user.charityId = data.charityId;
    if (data.charityPct) user.charityPct = Math.max(10, +data.charityPct);
    if (data.name) user.name = data.name;
    const { password: _, ...safe } = user;
    return json(res, 200, safe);
  },
  'GET /api/draws': async (req, res) => json(res, 200, db.draws.slice(0, 10)),
  'GET /api/pool': async (req, res) => json(res, 200, { ...calcPool(), jackpot: jackpotRollover }),
  // Admin
  'GET /api/admin/users': async (req, res) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user || user.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
    return json(res, 200, db.users.map(({ password: _, ...u }) => u));
  },
  'POST /api/admin/draw': async (req, res) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user || user.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
    const { mode } = await body(req);
    return json(res, 200, runDraw(mode || 'random'));
  },
  'PUT /api/admin/winners/:drawId/:userId': async (req, res) => {
    const uid2 = auth(req);
    const admin = db.users.find(u => u.id === uid2);
    if (!admin || admin.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
    const { status } = await body(req);
    const draw = db.draws.find(d => d.id === res._params.drawId);
    if (!draw) return json(res, 404, { error: 'Draw not found' });
    [...draw.winners5, ...draw.winners4, ...draw.winners3].forEach(w => {
      if (w.userId === res._params.userId) w.status = status;
    });
    return json(res, 200, { ok: true });
  },
  'GET /api/admin/stats': async (req, res) => {
    const uid2 = auth(req);
    const user = db.users.find(u => u.id === uid2);
    if (!user || user.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
    const activeUsers = db.users.filter(u => u.active && u.role !== 'admin').length;
    const pool = calcPool();
    const charityTotal = db.users.filter(u => u.role !== 'admin').reduce((sum, u) => {
      const fee = u.plan === 'monthly' ? 10 : 100 / 12;
      return sum + fee * (u.charityPct / 100);
    }, 0);
    return json(res, 200, { activeUsers, totalPool: pool.total, charityTotal: +charityTotal.toFixed(2), totalDraws: db.draws.length, jackpot: jackpotRollover });
  },
  'PUT /api/admin/users/:id': async (req, res, params) => {
    const uid2 = auth(req);
    const admin = db.users.find(u => u.id === uid2);
    if (!admin || admin.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
    const target = db.users.find(u => u.id === params.id);
    if (!target) return json(res, 404, { error: 'User not found' });
    const data = await body(req);
    if (typeof data.active !== 'undefined') target.active = data.active;
    if (data.plan) target.plan = data.plan;
    const { password: _, ...safe } = target;
    return json(res, 200, safe);
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────
function matchRoute(method, url) {
  for (const key of Object.keys(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const paramNames = [];
    const regex = new RegExp('^' + pattern.replace(/:([^/]+)/g, (_, n) => { paramNames.push(n); return '([^/]+)'; }) + '$');
    const match = url.match(regex);
    if (match) {
      const params = {};
      paramNames.forEach((n, i) => params[n] = match[i + 1]);
      return { handler: routes[key], params };
    }
  }
  return null;
}

// ─── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { json(res, 200, {}); return; }
  const url = req.url.split('?')[0];
  const match = matchRoute(req.method, url);
  if (!match) { json(res, 404, { error: 'Not found' }); return; }
  res._params = match.params;
  try { await match.handler(req, res, match.params); }
  catch (e) { json(res, 500, { error: e.message }); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🏌️ Golf Platform API running on http://localhost:${PORT}`));
