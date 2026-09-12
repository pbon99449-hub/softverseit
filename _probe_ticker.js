// Full authenticated E2E against the RUNNING server (or spawn one if none):
// login → PUT ticker (exactly like the admin panel) → GET (exactly like the home page).
const { spawn } = require('child_process');
const fs = require('fs');
const BASE = 'http://localhost:5000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  let child = null;
  let up = false;
  try { const h = await fetch(BASE + '/api/health'); up = h.ok; } catch (_) {}
  if (!up) {
    child = spawn('node', ['admin-panel/server.js'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    for (let i = 0; i < 60; i++) {
      try { const h = await fetch(BASE + '/api/health'); if (h.ok) { up = true; break; } } catch (_) {}
      await wait(250);
    }
  }
  console.log('server reachable:', up, '(spawned fresh:', !!child, ')');

  try {
    // ── login exactly like admin login page ──
    const login = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'softverseit@gmail.com', password: '!!softverseit!!**' }),
    });
    const loginJson = await login.json().catch(() => null);
    console.log('login status:', login.status, 'keys:', loginJson ? Object.keys(loginJson) : null);
    const token = loginJson && (loginJson.token || (loginJson.data && loginJson.data.token));
    console.log('token received:', !!token);
    if (!token) throw new Error('no token — cannot test admin save');

    // ── PUT exactly like site-content.html saveToServer() ──
    const newTicker = ['E2E টিকার লাইন ১', 'E2E টিকার লাইন ২', 'E2E টিকার লাইন ৩'];
    const put = await fetch(BASE + '/api/site-content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        stats: [{ value: '৮০০+', label: 'সফল শিক্ষার্থী' }],
        reviews: [{ quote: 'E2E review', author: 'E2E', stars: 5 }],
        videos: [{ title: 'E2E video', videoId: '0VEmSzp7ZQQ' }],
        gallery: [{ title: 'E2E gallery', category: 'batch', src: './Images/program pi/program4.webp' }],
        ticker: newTicker,
        heroChip: 'E2E hero chip',
      }),
    });
    const putJson = await put.json().catch(() => null);
    console.log('PUT:', put.status, 'ticker:', JSON.stringify(putJson && putJson.data && putJson.data.ticker));

    // ── GET exactly like home page loadSiteContent() ──
    const get = await fetch(BASE + '/api/site-content', { cache: 'no-store' });
    const getJson = await get.json();
    const served = getJson && getJson.data && getJson.data.ticker;
    console.log('GET:', get.status, 'ticker:', JSON.stringify(served));

    // ── vault file (deploy-safe copy) ──
    const vault = JSON.parse(fs.readFileSync('admin-panel/content-vault/site-content.json', 'utf8'));
    console.log('VAULT ticker:', JSON.stringify(vault.ticker));

    const pass = JSON.stringify(served) === JSON.stringify(newTicker);
    console.log(pass ? '>>> E2E PASS: saved ticker is served to the home page' : '>>> E2E FAIL: saved ticker NOT served');
  } catch (e) {
    console.log('ERR', e.message);
  }
  if (child) child.kill();
  process.exit(0);
})();


