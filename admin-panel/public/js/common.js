/* SoftVerse Admin — shared helpers: API, auth guard, layout, toast */

const API = (() => {
  function token() { return localStorage.getItem('sv_admin_token') || ''; }
  // API requests always go to THE Node server (port 5000). Relative paths
  // work when this page is served by Node itself; otherwise (Live Server,
  // other port) we hit the Node server directly — this is what kills the 405.
  let basePromise = null;
  function apiBase() {
    if (typeof location === 'undefined' || location.protocol === 'file:') return Promise.resolve('');
    if (basePromise) return basePromise;
    basePromise = (async () => {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (r.ok && j && j.success) return '';
      } catch (_) { /* same origin has no API */ }
      return 'http://localhost:5000';
    })();
    return basePromise;
  }

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      return localReply(path, method, body, auth);
    }

    const base = await apiBase();
    let res;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (auth && token()) headers.Authorization = 'Bearer ' + token();
      res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (netErr) {
      // Server unreachable. Login/register can still work from the built-in
      // offline backend (localStorage) so the admin is never locked out.
      const PUBLIC = ['/api/auth/login', '/api/auth/register'];
      if (PUBLIC.includes(path)) {
        return localReply(path, method, body, auth);
      }
      // Other WRITE requests must reach the real server - otherwise data is
      // never permanently saved while the UI still shows "saved". Fail loudly.
      if (method !== 'GET') {
        throw new Error('\u09b8\u09be\u09b0\u09cd\u09ad\u09be\u09b0 \u099a\u09be\u09b2\u09c1 \u09a8\u09c7\u0987 \u2014 \u09b2\u0997\u0987\u09a8 \u0995\u09b0\u09be \u09af\u09be\u09ac\u09c7, \u0995\u09bf\u09a8\u09cd\u09a4\u09c1 \u09a4\u09a5\u09cd\u09af \u09b8\u09c7\u09ad \u09b9\u09ac\u09c7 \u09a8\u09be\u0964 \u09b8\u09ac \u09ab\u09bf\u099a\u09be\u09b0\u09c7\u09b0 \u099c\u09a8\u09cd\u09af START-SERVER.bat \u099a\u09be\u09b2\u09c1 \u0995\u09b0\u09c1\u09a8\u0964');
      }
      return localReply(path, method, body, auth);
    }

    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }

    if (res.status === 401 && auth) { clearSession(); location.href = 'login.html'; throw new Error('Session expired'); }
    if (res.status === 405) {
      // Wrong origin (e.g. Live Server) handed the request — retry once
      // directly against the real Node server so writes stop failing with 405.
      if (base === '') return request(path, { method, body, auth, _forcePort: true });
    }
    if (!res.ok) { throw new Error((json && json.message) || ('Error ' + res.status)); }
    return json;
  }
return {
    get: (p) => request(p),
    post: (p, b) => request(p, { method: 'POST', body: b }),
    put: (p, b) => request(p, { method: 'PUT', body: b }),
    patch: (p, b) => request(p, { method: 'PATCH', body: b }),
    del: (p) => request(p, { method: 'DELETE' }),
    apiBase: () => apiBase(),
  };
})();

function setSession(token, admin) {
  localStorage.setItem('sv_admin_token', token);
  localStorage.setItem('sv_admin_user', JSON.stringify(admin));
  // লগইনের সময় stamp — পুরনো লগইন দিয়ে /admin পেজ সরাসরি খোলা যাবে না (requireAuth() দেখুন।
  localStorage.setItem(LS.tokenAt, String(Date.now()));
}
function currentAdmin() {
  try { return JSON.parse(localStorage.getItem('sv_admin_user') || 'null'); }
  catch (_) { return null; }
}
function clearSession() {
  localStorage.removeItem('sv_admin_token');
  localStorage.removeItem('sv_admin_user');
  localStorage.removeItem(LS.tokenAt);
}

/* ── Toast ── */
function toast(message, type = 'success') {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
  el.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
  host.appendChild(el);
  setTimeout(() => { el.remove(); }, 3200);
}

/* ── Auth guard for protected pages ── */
function requireAuth() {
  if (!localStorage.getItem('sv_admin_token')) {
    location.href = 'login.html';
    return false;
  }
  // file:// (ডিস্ক/ফোল্ডার থেকে সরাসরি খোলা) — অফলাইন মোড: আগের মতোই কাজ করবে।
  if (typeof location !== 'undefined' && location.protocol === 'file:') return true;

  // http(s) মোড:
  // ১) পুরনো লগইন দিয়ে প্যানেল খোলা বন্ধ — লগইনের ১০ মিনিট (সার্ভারের
  //    ADMIN_SESSION_MINUTES-এর ডিফল্ট) পরে থাকলে ফের login পেজ দেখাবে।
  //    (লগইন পেজ থেকে email+password সাবমিট করলেই আবার ভিতরে ঢোকা যাবে।)
  var at = parseInt(localStorage.getItem(LS.tokenAt) || '0', 10);
  if (!at || Date.now() - at > 10 * 60 * 1000) {
    clearSession();
    location.href = 'login.html';
    return false;
  }

  // ২) সার্ভার চালু থাকলে টোকেনটি আসলেই বৈধ কিনা যাচাই হয় — পুরনো/জাল
  //    localStorage টোকেন দিয়ে প্যানেল খোলা যাবে না (401 হলে login এ পাঠাবে)।
  //    সার্ভার পাওয়া না গেলে (static/Live Server) অফলাইন মোডের মতো কাজ করবে।
  if (typeof fetch === 'function') {
    try {
      API.apiBase().then(function (base) {
        return fetch((base || '') + '/api/auth/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('sv_admin_token') } });
      }).then(function (r) {
        if (r.status === 401) { clearSession(); location.href = 'login.html'; }
      }).catch(function () { /* সার্ভার পাওয়া যায়নি → অফলাইন মোড */ });
    } catch (_) { /* ignore */ }
  }
  return true;
}

/* ── Escape HTML to prevent XSS when injecting user data ── */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Layout (sidebar + topbar) ── */
const NAV_ITEMS = [
  { href: 'index.html', icon: 'fa-solid fa-gauge-high', label: 'ড্যাশবোর্ড' },
  { href: 'site-content.html', icon: 'fa-solid fa-house-chimney', label: 'হোম পেজ কনটেন্ট' },
  { href: 'courses.html', icon: 'fa-solid fa-book-open', label: 'কোর্স ম্যানেজ' },
  { href: 'enrollments.html', icon: 'fa-solid fa-users', label: 'ভর্তির আবেদন' },
  { href: 'results.html', icon: 'fa-solid fa-file-lines', label: 'রেজাল্ট ম্যানেজ' },
  { href: 'popup-sms.html', icon: 'fa-solid fa-comment-sms', label: 'পপআপ SMS' },
];

function renderLayout(currentPage = '') {
  const admin = currentAdmin() || {};
  const shell = document.getElementById('shell');
  if (!shell) return;

  const navHtml = NAV_ITEMS.map(n => {
    const active = (currentPage === n.href) ? 'active' : '';
    return `<a href="${n.href}" class="${active}"><i class="${n.icon}"></i>${n.label}</a>`;
  }).join('');

  const initial = (admin.name || 'A').trim().charAt(0).toUpperCase();

  shell.innerHTML = `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="b-title">SOFTVERSE <span>ADMIN</span></div>
        <div class="b-sub">কম্পিউটার ট্রেনিং সেন্টার</div>
      </div>
      <div class="sidebar-nav">
        <div class="nav-label">মেনু</div>
        ${navHtml}
      </div>
      <div class="sidebar-foot">
        <button class="logout-btn" id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i> লগ আউট</button>
      </div>
    </div>

    <div class="sidebar-scrim" id="sidebarScrim"></div>

    <div class="main-area">
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:.8rem">
          <button class="hamburger-btn" id="hamburgerBtn" aria-label="মেনু"><i class="fa-solid fa-bars"></i></button>
          <h1 id="pageTitle"></h1>
        </div>
        <div class="top-right">
          <a href="/" title="ওয়েবসাইটে যান" class="icon-btn" style="width:auto;padding:0 .7rem"><i class="fa-solid fa-house"></i> ওয়েবসাইট</a>
          <div class="admin-chip">
            <div class="av">${esc(initial)}</div>
            <div><div class="nm">${esc(admin.name || 'Admin')}</div><div class="rl">${esc(admin.role || 'admin')}</div></div>
          </div>
        </div>
      </div>
      <div class="page-content" id="pageContent"></div>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    // Server-side session cookie-ও মুছে দিতে হবে — নাহলে লগআউটের পরও
    // ব্রাউজার /admin পেজগুলো সরাসরি খুলতে পারবে। ব্যর্থ হলেও লগআউট এগিয়ে যাবে।
    let gone = false;
    const go = () => { if (!gone) { gone = true; location.href = 'login.html'; } };
    try { API.post('/api/auth/logout', {}).then(go, go); setTimeout(go, 1500); }
    catch (_) { go(); }
  });
  const hbg = document.getElementById('hamburgerBtn');
  const side = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebarScrim');
  if (hbg) hbg.addEventListener('click', () => {
    const open = side.classList.toggle('open');
    if (scrim) scrim.classList.toggle('show', open);
  });
  // Sidebar er baire (scrim e) tap korle mobile menu bondho hoy
  if (scrim) scrim.addEventListener('click', () => {
    side.classList.remove('open');
    scrim.classList.remove('show');
  });
}

/* ── Format date (DD-MM-YYYY, same as main site) ── */
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/* ── Pagination helper ── */
function renderPagination(pag, onPage) {
  const wrap = document.getElementById('pagination');
  if (!wrap) return;
  if (!pag || pag.pages <= 1) { wrap.innerHTML = ''; return; }
  let h = `<span>পাতা ${pag.page} / ${pag.pages} (মোট ${pag.total}টি)</span>`;
  if (pag.page > 1) h += `<button class="btn btn-ghost btn-sm" data-p="${pag.page - 1}">◀ আগে</button>`;
  if (pag.page < pag.pages) h += `<button class="btn btn-ghost btn-sm" data-p="${pag.page + 1}">পরের ▶</button>`;
  wrap.innerHTML = h;
  wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => onPage(parseInt(btn.dataset.p, 10))));
}

/* ════════════════════════════════════════════════════════════
   OFFLINE DATA LAYER (localStorage backend)
   ─────────────────────────────────────────────────────────────
   Makes the admin panel work with NO Node server and NO MongoDB —
   e.g. when index.html / admin pages are opened straight from disk
   (file://). All admin data is saved in the browser. If a real
   backend IS reachable, request() above uses it instead.
   ════════════════════════════════════════════════════════════ */

const LS = {
  admins: 'sv_admins_v1',
  enrollments: 'sv_enrollments_v1',
  results: 'sv_results_v1',
  courses: 'sv_courses_v1',
  teachers: 'sv_teachers_v1',
  siteContent: 'sv_site_content_v1',
  popup: 'sv_popup_v1',
  visits: 'sv_visits_v1',
  token: 'sv_admin_token',
  user: 'sv_admin_user',
  tokenAt: 'sv_admin_token_at',
};

/* Default first admin — auto-created on first run (matches .env). */
const DEFAULT_ADMIN = {
  email: 'admin@softverseit.com',
  password: 'ChangeMe123!',
  name: 'Super Admin',
  role: 'superadmin',
};

function lsRead(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (_) { return fallback; }
}
function lsWrite(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* Seed a default admin + empty stores the first time the panel is used. */
function ensureSeeds() {
  let admins = lsRead(LS.admins, []);
  if (!admins.length) {
    admins = [{ _id: 'admin_' + Date.now().toString(36), name: DEFAULT_ADMIN.name, email: DEFAULT_ADMIN.email, password: DEFAULT_ADMIN.password, role: DEFAULT_ADMIN.role }];
    lsWrite(LS.admins, admins);
  }
  if (lsRead(LS.enrollments, null) == null) lsWrite(LS.enrollments, []);
  if (lsRead(LS.results, null) == null) lsWrite(LS.results, []);
  if (lsRead(LS.visits, null) == null) lsWrite(LS.visits, []);
  if (lsRead(LS.teachers, null) == null) {
    lsWrite(LS.teachers, [
      { _id: uid(), name: 'Abid Hasan', role: 'Lead Trainer', phone: '01700000000', subject: 'Basic Computer' },
      { _id: uid(), name: 'Niloy Haldar', role: 'Graphics Design Trainer', phone: '01800000000', subject: 'Graphic Design' }
    ]);
  }
  if (lsRead(LS.courses, null) == null) {
    lsWrite(LS.courses, [
      { _id: 'basic', name: 'বেসিক কম্পিউটার', category: 'Computer Skills', duration: '৩ মাস', teacher: 'Abid Hasan', batch: 'সকাল / বিকেল / সন্ধ্যা', status: 'open', price: '৳ 3000', body: 'MS Office, ইন্টারনেট, ফাইল ম্যানেজমেন্ট এবং ডিজিটাল লিটারেসির সম্পূর্ণ কোর্স।', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '২৯ মার্চ, ২০২৬', time: 'সকাল / বিকেল / সন্ধ্যা' },
      { _id: 'kid', name: 'কিডস কম্পিউটার', category: 'For Kids', duration: '২ মাস', teacher: 'Abid Hasan', batch: 'বিকেল (১টা – ৩টা)', status: 'open', price: '৳ 2500', body: 'কম্পিউটার পরিচিতি, হার্ডওয়ার পরিচিতি, Ms Paint etc.', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '০১ এপ্রিল, ২০২৬', time: 'বিকেল / সন্ধ্যা' },
      { _id: 'graphic', name: 'গ্রাফিক ডিজাইন', category: 'Design', duration: '৩ মাস', teacher: 'Niloy Haldar', batch: 'সন্ধ্যা (৩টা – ৫টা)', status: 'open', price: '৳ 4500', body: 'Photoshop, Illustrator, AI ও ব্র্যান্ড আইডেন্টিটি ডিজাইনের সম্পূর্ণ গাইড।', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '২৯ মার্চ, ২০২৬', time: 'সকাল / বিকেল' },
      { _id: 'skill-boost', name: 'স্কিল বুস্ট', category: 'Skill Boost', duration: '১ মাস', teacher: 'Abid Hasan', batch: 'সন্ধ্যা (৫টা – ৭টা)', status: 'open', price: '৳ 2200', body: 'MS Office, টাইপিং etc.', level: 'সপ্তাহে ৭ দিন ক্লাস', date: '০৫ এপ্রিল, ২০২৬', time: 'সন্ধ্যা' },
      { _id: 'ielts', name: 'IELTS প্রেক্টিস', category: 'Language', duration: '১ মাস', teacher: 'Niloy Haldar', batch: 'বিকেল (১টা – ৩টা)', status: 'open', price: '৳ 2600', body: 'টাইপিং, Software Practice', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '০১ এপ্রিল, ২০২৬', time: 'বিকেল / সন্ধ্যা' },
      { _id: 'ict-practice', name: 'ICT প্রেক্টিস', category: 'Practice', duration: '২ মাস', teacher: 'Abid Hasan', batch: 'দুপুর (১১টা – ১টা)', status: 'open', price: '৳ 3200', body: 'HTML Advance, CSS, C Language, Projects', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '০৫ এপ্রিল, ২০২৬', time: 'সকাল / বিকেল' }
    ]);
  }
}

/* Current logged-in admin (read from the localStorage session), or null. */
function liveAdmin() {
  try {
    if (!localStorage.getItem(LS.token)) return null;
    return JSON.parse(localStorage.getItem(LS.user) || 'null');
  } catch (_) { return null; }
}

/* Turn localBackend's {status,json} into the value request() expects. */
function localReply(path, method, body, auth) {
  const PUBLIC = ['/api/auth/login', '/api/auth/register'];
  if (auth !== false && !PUBLIC.includes(path) && !liveAdmin()) {
    clearSession();
    location.href = 'login.html';
    throw new Error('Session expired');
  }
  const out = localBackend(path, method, body);
  // Auth endpoints return their json (even 401) so the login/register form can show the message.
  if (PUBLIC.includes(path)) return out.json;
  if (out.status === 401) { clearSession(); location.href = 'login.html'; throw new Error('Session expired'); }
  if (out.status >= 400) throw new Error((out.json && out.json.message) || 'Request failed');
  return out.json;
}

/* Local router — mirrors every endpoint the pages call. Returns {status, json}. */
function localBackend(path, method, body) {
  ensureSeeds();
  const qm = path.indexOf('?');
  let qs = {};
  if (qm !== -1) {
    new URLSearchParams(path.slice(qm + 1)).forEach((v, k) => { qs[k] = v; });
    path = path.slice(0, qm);
  }
  const pg = {
    page: parseInt(qs.page || '1', 10) || 1,
    limit: parseInt(qs.limit || '15', 10) || 15,
    search: qs.search || '',
    status: qs.status || '',
    course: qs.course || '',
    result: qs.result || '',
  };

  // ── Auth endpoints ──
  if (path === '/api/auth/login' && method === 'POST') {
    const admins = lsRead(LS.admins, []);
    const email = String((body && body.email) || '').toLowerCase().trim();
    const pw = String((body && body.password) || '').trim();
    const a = admins.find(x => String(x.email || '').toLowerCase().trim() === email && String(x.password || '').trim() === pw);
    if (!a) return { status: 401, json: { success: false, message: 'Invalid email or password' } };
    return { status: 200, json: { success: true, token: 'local_' + a._id, admin: { id: a._id, name: a.name, email: a.email, role: a.role } } };
  }
  if (path === '/api/auth/register' && method === 'POST') {
    const admins = lsRead(LS.admins, []);
    const name = String((body && body.name) || '').trim();
    const email = String((body && body.email) || '').toLowerCase().trim();
    const password = String((body && body.password) || '');
    if (!name || !email || !password) return { status: 400, json: { success: false, message: 'Name, email and password are required' } };
    if (password.length < 6) return { status: 400, json: { success: false, message: 'Password must be at least 6 characters' } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, json: { success: false, message: 'Please enter a valid email address' } };
    if (admins.find(x => x.email === email)) return { status: 409, json: { success: false, message: 'An account with this email already exists' } };
    const a = { _id: uid(), name, email, password, role: 'admin' };
    admins.push(a);
    lsWrite(LS.admins, admins);
    return { status: 201, json: { success: true, token: 'local_' + a._id, admin: { id: a._id, name: a.name, email: a.email, role: a.role } } };
  }
  if (path === '/api/auth/me' && method === 'GET') {
    const me = liveAdmin();
    if (!me) return { status: 401, json: { success: false, message: 'Not authorized' } };
    return { status: 200, json: { success: true, admin: me } };
  }

    // ── Dashboard stats ──
  if (path === '/api/dashboard/stats' && method === 'GET') {
    if (!liveAdmin()) return { status: 401, json: { success: false, message: 'Not authorized' } };
    const enrollments = lsRead(LS.enrollments, []);
    const results = lsRead(LS.results, []);
    const courses = lsRead(LS.courses, []);
    const teachers = lsRead(LS.teachers, []);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalEnrollments = enrollments.length;
    const pendingEnrollments = enrollments.filter(e => e.status === 'pending').length;
    const enrolledCount = enrollments.filter(e => e.status === 'enrolled').length;
    const monthEnrollments = enrollments.filter(e => new Date(e.createdAt || 0) >= monthStart).length;
    const totalResults = results.length;
    const passCount = results.filter(r => r.result === 'Pass').length;
    const failCount = totalResults - passCount;
    const courseBreakdown = courses.map(course => {
      const total = enrollments.filter(e => (e.course || '').toLowerCase() === (course.name || '').toLowerCase()).length;
      return {
        name: course.name,
        total,
        applicationCount: total,
        status: course.status || 'open',
        date: course.date || '',
        time: course.time || ''
      };
    });
    const recentEnrollments = [...enrollments].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    const recentResults = [...results].slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    return { status: 200, json: { success: true, data: { totalEnrollments, pendingEnrollments, enrolledCount, monthEnrollments, totalResults, passCount, failCount, coursesCount: courses.length, teachersCount: teachers.length, courseBreakdown, recentEnrollments, recentResults } } };
  }

  if (path === '/api/site-content' && method === 'GET') {
    const item = localStorage.getItem('sv_site_content_v1');
    const defaultContent = {
      stats: [
        { value: '৮০০+', label: 'সফল শিক্ষার্থী' },
        { value: '৪+', label: 'প্রফেশনাল কোর্স' },
        { value: '২+', label: 'বছরের অভিজ্ঞতা' },
        { value: '৯৮%', label: 'শিক্ষার্থী সন্তুষ্টি' },
      ],
      reviews: [
        { quote: 'Softverse IT তে ক্লাস করে আমার কম্পিউটার নিয়ে বেসিক ধারণা এসেছে।', author: '(ব্যাচ ২৫)', stars: 5 },
        { quote: 'আমাদের স্যাররা খুবই বন্ধুপ্রতিম এবং অনুপ্রেরণাদায়ক।', author: '(ব্যাচ ২৬)', stars: 5 },
        { quote: 'বাস্তব অভিজ্ঞতার ওপর ক্লাস হওয়ায় খুব উপকার হয়েছে।', author: '(ব্যাচ ২৭)', stars: 5 },
      ],
      videos: [
        { title: 'Softverse It Rap Song', videoId: '0VEmSzp7ZQQ' },
        { title: 'বেসিক কোর্স ব্যাচ', videoId: 'PfhSGo4URak' },
        { title: 'ক্যাম্পেইন রিভিউ', videoId: '0EVtuVKj_kw' },
      ],
      gallery: [
        { title: 'ক্লাস রুম 2', category: 'batch', src: './Images/program pi/program4.webp' },
        { title: 'কলেজ ক্যাম্পেইন', category: 'program', src: './Images/program pi/campain.webp' },
        { title: 'ক্লাস রুম 1', category: 'batch', src: './Images/program pi/program3.webp' },
        { title: 'সার্টিফিকেট অনুষ্ঠান', category: 'graduation', src: './Images/program pi/program.webp' },
      ],
      heroChip: '30 july — নতুন ব্যাচ শুরু',
    };
    let data = defaultContent;
    if (item) {
      try { data = { ...defaultContent, ...JSON.parse(item) }; } catch (_) {}
    }
    return { status: 200, json: { success: true, data } };
  }
  if (path === '/api/site-content' && method === 'PUT') {
    if (!liveAdmin()) return { status: 401, json: { success: false, message: 'Not authorized' } };
    const payload = body || {};
    // heroChip রিকোয়েস্টে না এলে আগের সেভ করা মান (বা ডিফল্ট) অপরিবর্তিত থাকে
    let prevHeroChip = '30 july — নতুন ব্যাচ শুরু';
    try {
      const prev = JSON.parse(localStorage.getItem('sv_site_content_v1') || 'null');
      if (prev && typeof prev.heroChip === 'string') prevHeroChip = prev.heroChip;
    } catch (_) {}
    const normalized = {
      stats: Array.isArray(payload.stats) ? payload.stats : [],
      reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
      videos: Array.isArray(payload.videos) ? payload.videos : [],
      gallery: Array.isArray(payload.gallery) ? payload.gallery : [],
      heroChip: typeof payload.heroChip === 'string' ? payload.heroChip.trim() : prevHeroChip,
    };
    localStorage.setItem('sv_site_content_v1', JSON.stringify(normalized));
    return { status: 200, json: { success: true, data: normalized } };
  }

  // ── Popup SMS (welcome modal) ──
  const defaultPopup = {
    enabled: true,
    badge: 'ভর্তি চলছে এখনেই',
    headline: '40, 41 নাম্বার ব্যাচ',
    headlineHighlight: 'এ ভর্তি চলছে',
    sub: 'SoftVerse IT Training Center — ২০২৬',
    batchTitle: 'ব্যাচ বিস্তারিত',
    startDate: 'শুরুর তারিখ: 30 August, 2026',
    time: 'সময়: সকাল / বিকেল / সন্ধ্যা ব্যাচ',
    place: 'স্থান: মুন্সীগঞ্জ পুলিশ সুপার কার্যালয় বিপরীত পাশে',
    courses: 'কোর্স: কম্পিউটার বেসিক, গ্রাফিক্স ডিজাইন, কিডস কম্পিউটার',
    enrollBtn: 'এখনই আসন নিশ্চিত করুন →',
    skipBtn: 'পরে দেখবো',
  };
  if (path === '/api/site-content/popup' && method === 'GET') {
    let data = Object.assign({}, defaultPopup);
    const item = localStorage.getItem(LS.popup);
    if (item) { try { data = Object.assign(defaultPopup, JSON.parse(item)); } catch (_) {} }
    return { status: 200, json: { success: true, data } };
  }
  if (path === '/api/site-content/popup' && method === 'PUT') {
    if (!liveAdmin()) return { status: 401, json: { success: false, message: 'Not authorized' } };
    const data = Object.assign({}, defaultPopup, body || {});
    data.enabled = body && Object.prototype.hasOwnProperty.call(body, 'enabled') ? (body.enabled === true || body.enabled === 'true' || body.enabled === 'on') : data.enabled;
    localStorage.setItem(LS.popup, JSON.stringify(data));
    return { status: 200, json: { success: true, data } };
  }

  let m;

  // ── Courses ──
  if (path === '/api/courses' && method === 'GET') {
    const list = lsRead(LS.courses, []);
    return { status: 200, json: { success: true, data: list } };
  }
  if (path === '/api/courses' && method === 'POST') {
    const list = lsRead(LS.courses, []);
    const item = Object.assign({ _id: uid(), createdAt: new Date().toISOString(), status: 'open' }, body || {});
    list.push(item);
    lsWrite(LS.courses, list);
    return { status: 201, json: { success: true, data: item } };
  }
  m = path.match(/^\/api\/courses\/([^/]+)$/);
  if (m && method === 'PUT') {
    const list = lsRead(LS.courses, []);
    const i = list.findIndex(x => x._id === m[1]);
    if (i === -1) return { status: 404, json: { success: false, message: 'Course not found' } };
    list[i] = Object.assign({}, list[i], body || {});
    lsWrite(LS.courses, list);
    return { status: 200, json: { success: true, data: list[i] } };
  }
  if (m && method === 'DELETE') {
    lsWrite(LS.courses, lsRead(LS.courses, []).filter(x => x._id !== m[1]));
    return { status: 200, json: { success: true, message: 'Deleted' } };
  }

  // ── Teachers ──
  if (path === '/api/teachers' && method === 'GET') {
    const list = lsRead(LS.teachers, []);
    return { status: 200, json: { success: true, data: list } };
  }
  if (path === '/api/teachers' && method === 'POST') {
    const list = lsRead(LS.teachers, []);
    const item = Object.assign({ _id: uid(), createdAt: new Date().toISOString() }, body || {});
    list.push(item);
    lsWrite(LS.teachers, list);
    return { status: 201, json: { success: true, data: item } };
  }
  m = path.match(/^\/api\/teachers\/([^/]+)$/);
  if (m && method === 'PUT') {
    const list = lsRead(LS.teachers, []);
    const i = list.findIndex(x => x._id === m[1]);
    if (i === -1) return { status: 404, json: { success: false, message: 'Teacher not found' } };
    list[i] = Object.assign({}, list[i], body || {});
    lsWrite(LS.teachers, list);
    return { status: 200, json: { success: true, data: list[i] } };
  }
  if (m && method === 'DELETE') {
    lsWrite(LS.teachers, lsRead(LS.teachers, []).filter(x => x._id !== m[1]));
    return { status: 200, json: { success: true, message: 'Deleted' } };
  }

  // ── Enrollments ──
  if (path === '/api/enrollments' && method === 'GET') {
    if (!liveAdmin()) return { status: 401, json: { success: false, message: 'Not authorized' } };
    let list = lsRead(LS.enrollments, []);
    if (pg.search) { const s = pg.search.toLowerCase(); list = list.filter(e => ((e.fullName || '') + ' ' + (e.phone || '')).toLowerCase().includes(s)); }
    if (pg.status) list = list.filter(e => e.status === pg.status);
    if (pg.course) list = list.filter(e => e.course === pg.course);
    list = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const pages = Math.max(1, Math.ceil(list.length / pg.limit));
    const data = list.slice((pg.page - 1) * pg.limit, pg.page * pg.limit);
    return { status: 200, json: { success: true, data, pagination: { page: Math.min(pg.page, pages), pages, total: list.length, limit: pg.limit } } };
  }
  if (path === '/api/enrollments' && method === 'POST') {
    const list = lsRead(LS.enrollments, []);
    const item = Object.assign({ _id: uid(), status: 'pending', createdAt: new Date().toISOString() }, body || {});
    list.push(item);
    lsWrite(LS.enrollments, list);
    return { status: 201, json: { success: true, data: item } };
  }
  m = path.match(/^\/api\/enrollments\/([^/]+)\/status$/);
  if (m && method === 'PATCH') {
    const list = lsRead(LS.enrollments, []);
    const e = list.find(x => x._id === m[1]);
    if (!e) return { status: 404, json: { success: false, message: 'Not found' } };
    e.status = (body && body.status) || e.status;
    lsWrite(LS.enrollments, list);
    return { status: 200, json: { success: true, data: e } };
  }
  m = path.match(/^\/api\/enrollments\/([^/]+)$/);
  if (m && method === 'PUT') {
    const list = lsRead(LS.enrollments, []);
    const i = list.findIndex(x => x._id === m[1]);
    if (i === -1) return { status: 404, json: { success: false, message: 'Not found' } };
    list[i] = Object.assign({}, list[i], body || {});
    lsWrite(LS.enrollments, list);
    return { status: 200, json: { success: true, data: list[i] } };
  }
  if (m && method === 'DELETE') {
    lsWrite(LS.enrollments, lsRead(LS.enrollments, []).filter(x => x._id !== m[1]));
    return { status: 200, json: { success: true, message: 'Deleted' } };
  }

  // ── Visit tracking (dashboard line chart) — Bangladesh (Asia/Dhaka) dates ──
  const dhakaFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dhakaDateStr = (d = new Date()) => dhakaFmt.format(d); // 'YYYY-MM-DD'
  if (path === '/api/visits' && method === 'POST') {
    const list = lsRead(LS.visits, []);
    const key = dhakaDateStr();
    const row = list.find(v => v.date === key);
    if (row) row.count = (Number(row.count) || 0) + 1;
    else list.push({ date: key, count: 1 });
    lsWrite(LS.visits, list);
    return { status: 200, json: { success: true } };
  }
  if (path === '/api/dashboard/visits' && method === 'GET') {
    if (!liveAdmin()) return { status: 401, json: { success: false, message: 'Not authorized' } };
    const list = lsRead(LS.visits, []);
    const days = Math.min(Math.max(parseInt(qs.days || '14', 10) || 14, 1), 60);
    // চার্ট প্রথম রেকর্ড হওয়া তারিখ থেকে শুরু হয় — আগের ফাঁকা দিন দেখায় না।
    const todayStr = dhakaDateStr();
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const today = new Date(Date.UTC(ty, tm - 1, td));
    let startDate = today;
    const sorted = list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (sorted.length && sorted[0].date) {
      const [fy, fm, fd] = String(sorted[0].date).split('-').map(Number);
      startDate = new Date(Date.UTC(fy, fm - 1, fd));
    }
    const minStart = new Date(today);
    minStart.setUTCDate(minStart.getUTCDate() - (days - 1));
    if (startDate < minStart) startDate = minStart;
    const dates = [];
    for (const cursor = new Date(startDate); cursor <= today; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cursor.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    const map = {};
    list.forEach(v => { map[v.date] = Number(v.count) || 0; });
    const series = dates.map(date => ({ date, count: map[date] || 0 }));
    const total = series.reduce((acc, s) => acc + s.count, 0);
    return {
      status: 200,
      json: {
        success: true,
        data: {
          series,
          todayCount: map[todayStr] || 0,
          total,
          last7: series.slice(-7).reduce((acc, s) => acc + s.count, 0),
        },
      },
    };
  }

  // ── Results ──
  if (path === '/api/results' && method === 'GET') {
    if (!liveAdmin()) return { status: 401, json: { success: false, message: 'Not authorized' } };
    let list = lsRead(LS.results, []);
    if (pg.search) { const s = pg.search.toLowerCase(); list = list.filter(r => ((r.name || '') + ' ' + (r.roll || '') + ' ' + (r.registration || '')).toLowerCase().includes(s)); }
        if (pg.course) list = list.filter(r => r.course === pg.course);
    if (pg.result) list = list.filter(r => r.result === pg.result);
    const pages = Math.max(1, Math.ceil(list.length / pg.limit));
    const data = list.slice((pg.page - 1) * pg.limit, pg.page * pg.limit);
    return { status: 200, json: { success: true, data, pagination: { page: pg.page, pages, total: list.length, limit: pg.limit } } };
  }
  if (path === '/api/results' && method === 'POST') {
    const list = lsRead(LS.results, []);
    const item = Object.assign({ _id: uid(), createdAt: new Date().toISOString() }, body || {});
    list.push(item);
    lsWrite(LS.results, list);
    return { status: 201, json: { success: true, data: item } };
  }
  m = path.match(/^\/api\/results\/([^/]+)$/);
  if (m && method === 'PUT') {
    const list = lsRead(LS.results, []);
    const i = list.findIndex(x => x._id === m[1]);
    if (i === -1) return { status: 404, json: { success: false, message: 'Not found' } };
    list[i] = Object.assign({}, list[i], body || {});
    lsWrite(LS.results, list);
    return { status: 200, json: { success: true, data: list[i] } };
  }
  if (m && method === 'DELETE') {
    lsWrite(LS.results, lsRead(LS.results, []).filter(x => x._id !== m[1]));
    return { status: 200, json: { success: true, message: 'Deleted' } };
  }

  return { status: 404, json: { success: false, message: 'API route not found' } };
}

/* Seed default admin + empty stores on first load (so file:// works immediately). */
ensureSeeds();

