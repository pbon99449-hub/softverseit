// Test: save current content → should trigger auto git push
const BASE = 'http://localhost:5050';

async function main() {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'softverseit@gmail.com', password: '!!softverseit!!**' }),
  }).then(r => r.json());
  if (!login.success) throw new Error('login failed: ' + JSON.stringify(login));

  // বর্তমান কনটেন্ট নিয়ে আবার সেভ করি — ডাটা অপরিবর্তিত থাকবে,
  // কিন্তু সেভ হুক চলবে (vault + auto git push)
  const current = await fetch(BASE + '/api/site-content').then(r => r.json());
  const payload = {
    stats: current.data.stats,
    reviews: current.data.reviews,
    videos: current.data.videos,
    gallery: current.data.gallery,
    ticker: current.data.ticker,
    heroChip: current.data.heroChip,
  };
  const put = await fetch(BASE + '/api/site-content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
    body: JSON.stringify(payload),
  }).then(r => r.json());
  console.log('save success:', put.success);
}
main().catch(e => { console.error(e); process.exit(1); });
