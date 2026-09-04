// লগইন → cookie → protected page ফ্লো লাইভ টেস্ট (Node 22 fetch দিয়ে)
const BASE = 'http://localhost:5000';

(async () => {
  // 0) "/admin" লিখলে শেষ পর্যন্ত কোথায় পৌঁছায় (redirect chain follow করে)
  const chain = await fetch(BASE + '/admin', { redirect: 'follow' });
  console.log('"/admin" final destination :', chain.url.replace(BASE, ''));
  console.log('  -> login page dekhay?     :', chain.url.endsWith('/admin/login.html') ? 'YES ✅ (age login ashbe)' : 'NO ❌');

  // 1) সঠিক ইমেইল-পাসওয়ার্ডে লগইন
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@softverseit.com', password: 'ChangeMe123!' }),
  });
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  console.log('login status        :', loginRes.status);
  console.log('set-cookie received :', setCookie ? setCookie.split(';')[0].slice(0, 40) + '...' : '(NONE)');

  // 2) cookie নিয়ে protected পেজগুলো
  for (const page of ['/admin/index.html', '/admin/courses.html', '/admin/enrollments.html', '/admin/dashboard.html', '/admin/results.html']) {
    const r = await fetch(BASE + page, { headers: { Cookie: cookie }, redirect: 'manual' });
    console.log(('WITH login  ' + page).padEnd(38), '->', r.status, r.status === 200 ? 'PANEL OPEN ✅' : 'LOCKED ❌');
  }

  // 3) ভুল পাসওয়ার্ড
  const wrong = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@softverseit.com', password: 'WRONG-PASS' }),
  });
  console.log('login WRONG password ->', wrong.status, wrong.status === 401 ? 'REJECTED ✅' : '❌');

  // 4) ভুয়া/জাল cookie দিয়ে ঢোকার চেষ্টা
  const fake = await fetch(BASE + '/admin/index.html', { headers: { Cookie: 'sv_admin_session=FAKE.TOKEN.HERE' }, redirect: 'manual' });
  console.log('FAKE cookie attempt  ->', fake.status, fake.status === 302 ? 'BLOCKED ✅' : '❌');

  // 5) লগআউট → cookie মুছে যায় → আবার লক
  // 6) "/admin" দিলে পুরনো সেশন বাতিল হয় — তারপর প্যানেল আর খোলে না
  const r2 = await fetch(BASE + '/admin', { redirect: 'manual' });
  const cleared = (r2.headers.get('set-cookie') || '').includes('Max-Age=0');
  console.log('"/admin" dile session CANCEL:', cleared ? 'YES ✅' : 'NO ❌', '| redirect:', r2.status === 302 ? 'login-e ✅' : '❌');
  // ব্রাউজার এখন cookie মুছে ফেলেছে — প্যানেলে ঢোকার চেষ্টা করলে:
  const blocked = await fetch(BASE + '/admin/index.html', { redirect: 'manual' });
  console.log('erpor panel khulte cha       :', blocked.status === 302 ? 'BLOCKED — login chara hoy na ✅' : '❌ khule geche!');
})();