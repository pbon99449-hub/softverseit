/* ──────────────────────────────────────────────────────────────
   Admin-panel link: works BOTH on the live server (http://localhost:5000)
   AND when the home page is opened straight from disk (file://).
   - On the server  -> /admin/login.html
   - On file://     -> ./admin-panel/public/login.html  (the real local file)
   ── Without this guard, opening index.html directly makes the
      /admin/login.html link resolve to file:///admin/login.html (error). ── */
(function () {
  if (typeof location === 'undefined' || typeof document === 'undefined') return;

  var LOCAL_LINK = './admin-panel/public/login.html';

  function applyLocalLink() {
    document.querySelectorAll('[data-admin-link]').forEach(function (a) {
      a.setAttribute('href', LOCAL_LINK);
    });
  }

  // Opened straight from disk (file://): no "/admin" route exists — fix the links.
  if (location.protocol === 'file:') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyLocalLink);
    } else {
      applyLocalLink();
    }
    return;
  }

  // Served over http(s): ask the server whether it actually serves /admin.
  //  * real admin server (serves "/admin")  -> keep /admin/login.html
  //  * any other static server (Live Server, python, etc.) -> rewrite to the
  //    real local file so it NEVER shows "Cannot GET /admin/login.html".
  fetch('/admin/').then(function (res) {
    if (!res.ok && res.status === 404) {
      applyLocalLink();
    }
  }).catch(function () {
    applyLocalLink();
  });
})();

// card auto
let courseData = [
  { id: 'basic',       name: 'বেসিক কম্পিউটার', status: 'open', date: '30 August, 2026', time: '৩টা-৫টা(রবি-মঙ্গল-বৃহ:স), ১টা-৩টা(রবি-মঙ্গল-বৃহ:স)' },
  { id: 'kid',         name: 'কিডস কম্পিউটার', status: 'open', date: '30 August, 2026', time: '৩টা-৫টা(শনি-সোম-বুধ)' },
  { id: 'graphic',     name: 'গ্রাফিক ডিজাইন', status: 'open', date: '30 August, 2026', time: '৩টা-৫টা(শনি-সোম-বুধ)' },
  { id: 'skill-boost', name: 'স্কিল বুস্ট', status: 'open', date: '30 August, 2026', time: '৫টা-৭টা(সপ্তাহে ৭ দিন)' },
  { id: 'ielts',       name: 'IELTS প্রেক্টিস', status: 'open', date: '30 july, 2026', time: '৫টা-৭টা(শনি-সোম-বুধ)' },
  { id: 'ict-practice',name: 'ICT প্রেক্টিস', status: 'open', date: '30 july, 2026', time: '৫টা-৭টা(রবি-মঙ্গল-বৃহ:স)' },
];

const statusLabel = {
  open: { text: '🟢 ভর্তি চলছে', cls: 'open' },
  full: { text: '⛔ আসন পূর্ণ',  cls: 'full' },
  soon: { text: '🔜 শীঘ্রই আসছে', cls: 'soon' },
};

function readStoredCourses() {
  try {
    const raw = localStorage.getItem('sv_courses_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}

function normalizeCourseRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((course, index) => ({
    id: course._id || `live-${index}`,
    name: course.name || 'কোর্স',
    status: course.status || 'open',
    date: course.date || 'শীঘ্রই শুরু হবে',
    time: course.time || course.batch || 'সকাল / বিকেল / সন্ধ্যা',
    body: course.body || '',
    duration: course.duration || '',
    level: course.level || ''
  }));
}

async function loadCoursesFromApi() {
  const saved = readStoredCourses();
  if (saved.length) {
    courseData = normalizeCourseRows(saved);
    populateCourseCatalog();
  }

  try {
    const res = await fetch('/api/courses', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load courses');
    const json = await res.json();
    const rows = Array.isArray(json && json.data) ? json.data : [];
    if (rows.length) {
      localStorage.setItem('sv_courses_v1', JSON.stringify(rows));
      courseData = normalizeCourseRows(rows);
      populateCourseCatalog();
    }
  } catch (_) {
    if (!saved.length) {
      courseData = [...courseData];
    }
  }
}

function syncCourseOptions(selectedValue) {
  const courseSelect = document.getElementById('course');
  if (!courseSelect) return selectedValue || '';

  // IMPORTANT: never rebuild the form's course dropdown here. The static HTML
  // already ships the correct 6-course list (Basic, Kids, Graphic, Skill Boost,
  // IELTS, ICT). Rebuilding from courseData/localStorage overwrote that list
  // with an older/shorter set (often missing ICT), so the options disappeared.
  // We only preserve the currently selected value (used when prefilling from a
  // course card's enroll button or admin data).
  if (selectedValue && [...courseSelect.options].some(opt => opt.value === selectedValue)) {
    courseSelect.value = selectedValue;
  }

  return courseSelect.value || '';
}

function populateCourseCatalog() {
  const stored = readStoredCourses();
  if (stored.length) {
    courseData = normalizeCourseRows(stored);
  }

  syncCourseOptions();

  courseData.forEach(course => {
    const card = document.querySelector(`.c-card[data-id="${course.id}"]`);
    if (!card) return;
    const s = statusLabel[course.status] || statusLabel.open;
    const badge = card.querySelector('.c-status');
    if (badge) { badge.textContent = s.text; badge.className = `c-status ${s.cls}`; }
    const title = card.querySelector('.c-title');
    if (title) title.textContent = course.name;
    const body = card.querySelector('.c-body');
    if (body) body.textContent = course.body;
    const dateEl = card.querySelector('.c-date');
    const timeEl = card.querySelector('.c-time');
    if (dateEl) dateEl.textContent = 'শুরু: ' + course.date;
    if (timeEl) timeEl.textContent = 'সময়: ' + course.time;
    const durEl = card.querySelector('.c-dur');
    if (durEl) durEl.textContent = course.duration;
    const levelEl = card.querySelector('.c-level');
    if (levelEl) levelEl.textContent = course.level;
    // Keep card metadata + enroll buttons in sync when the admin renames a course,
    // so the enrollment form is prefilled with the NEW name (real-time, no reload).
    card.setAttribute('data-course', course.name);
    card.querySelectorAll('[data-course]').forEach(btn => btn.setAttribute('data-course', course.name));
  });
}

function populateTeacherRoster() {
  try {
    const roster = document.getElementById('teacherRoster');
    if (!roster) return;
    const raw = localStorage.getItem('sv_teachers_v1');
    const teachers = raw ? JSON.parse(raw) : [];
    if (!teachers.length) return;
    roster.innerHTML = teachers.map(t => `<div class="teacher-chip"><strong>${t.name}</strong><span>${t.subject || t.role || 'Trainer'}</span></div>`).join('');
  } catch (_) {}
}

window.addEventListener('storage', function (event) {
  if (event.key === 'sv_courses_v1' || event.key === 'sv_teachers_v1') {
    populateCourseCatalog();
    populateTeacherRoster();
  }
});

// ── REAL-TIME (same tab / iframe): admin saves dispatch this custom event ──
// (storage events only fire in OTHER tabs/windows; this closes the same-tab gap.)
window.addEventListener('sv-content-updated', function (e) {
  const key = e && e.detail;
  if (!key) return;
  try {
    if (key === 'sv_courses_v1')           populateCourseCatalog();
    else if (key === 'sv_teachers_v1')      populateTeacherRoster();
    else if (key === 'sv_site_content_v1') renderSiteContent(JSON.parse(localStorage.getItem('sv_site_content_v1') || 'null'));
    else if (key === 'sv_popup_v1')        renderWelcomePopup(JSON.parse(localStorage.getItem('sv_popup_v1') || 'null'));
  } catch (_) {}
});

// ── POLLING: cross-origin / cross-port real-time sync ──
// (storage events only fire same-origin; polling closes the gap when admin and
// homepage run on different ports, e.g. admin on :5000 and homepage on :5500)
let lastCoursesSignature = null;
setInterval(() => {
  try {
    const raw = localStorage.getItem('sv_courses_v1');
    if (raw !== lastCoursesSignature) {
      lastCoursesSignature = raw;
      populateCourseCatalog();
    }
  } catch (_) {}
}, 1500);

populateCourseCatalog();
populateTeacherRoster();
// Initialize the polling signature AFTER the initial load so we don't re-render immediately
try { lastCoursesSignature = localStorage.getItem('sv_courses_v1'); } catch (_) {}
setInterval(loadCoursesFromApi, 2000);
loadCoursesFromApi();

/* ══════════════════════════════════════
   TICKER DATA —
═══════════════════════════════════ */
const tickerItems = [
  ' ভর্তি চলছে — 30 August, 2026 থেকে নতুন ব্যাচ শুরু',
  ' বেসিক কম্পিউটার · গ্রাফিক ডিজাইন · কিডস কম্পিউটার',
  ' যোগাযোগ করুন: 01603-893912',
  ' মুন্সীগঞ্জ পুলিশ সুপার কার্যালয়ের বিপরীত পাশে',
  ' কোর্স শেষে সার্টিফিকেট প্রদান করা হয়',
];

const DEFAULT_SITE_CONTENT = {
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
    { title: 'সার্টিফিকেট অনুষ্ঠান', category: 'program', src: './Images/program pi/program2.webp' },
  ],
  ticker: [
    ' ভর্তি চলছে — 30 August, 2026 থেকে নতুন ব্যাচ শুরু',
    ' বেসিক কম্পিউটার · গ্রাফিক ডিজাইন · কিডস কম্পিউটার',
    ' যোগাযোগ করুন: 01603-893912',
    ' মুন্সীগঞ্জ পুলিশ সুপার কার্যালয়ের বিপরীত পাশে',
    ' কোর্স শেষে সার্টিফিকেট প্রদান করা হয়',
  ],
  heroChip: '30 july — নতুন ব্যাচ শুরু',
  // ফুটার — অ্যাডমিন প্যানেলের "ফুটার এডিট" পেজ থেকে বদলানো যায়
  footer: {
    about: 'বিশ্বস্ত কম্পিউটার ট্রেনিং সেন্টার। আমরা বিগত ২০২৩ সাল ২+ বছর ধরে শত শিক্ষার্থীকে কম্পিউটার প্রশিক্ষন দিয়ে।',
    link1Title: 'SV-Tech Zone',
    link1Url: 'https://www.facebook.com/share/18QPiHwUnt/?mibextid=wwXIfr',
    link2Title: 'SV-Advanture',
    link2Url: 'https://www.facebook.com/share/1CVe7s24fR/?mibextid=wwXIfr',
    link3Title: 'Gift Managment',
    link3Url: '#',
    address: 'মুগন্সীঞ্জ পুলিশ সুপার কার্যালয় বিপরীত পাশে',
    phone: '016038-93912',
    email: 'softversei@gmail.com',
    copyright: '© 2026 SoftVerse IT Computer Training Center।',
    facebookUrl: 'https://www.facebook.com/share/15eAhfq3ayS/?mibextid=wwXIfr',
    youtubeUrl: 'https://www.youtube.com/@SoftverseITInstitute',
  },
};

function normalizeYouTubeId(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';

  const direct = val.match(/[A-Za-z0-9_-]{11}/);
  if (direct) return direct[0];

  const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return match ? match[1] : '';
}

function normalizeSiteContent(data) {
  const source = data && typeof data === 'object' ? data : {};
  const stats = Array.isArray(source.stats) ? source.stats : DEFAULT_SITE_CONTENT.stats;
  const reviews = Array.isArray(source.reviews) ? source.reviews : DEFAULT_SITE_CONTENT.reviews;
  const videos = Array.isArray(source.videos) ? source.videos : DEFAULT_SITE_CONTENT.videos;
  const gallery = Array.isArray(source.gallery) ? source.gallery : DEFAULT_SITE_CONTENT.gallery;
  const ticker = Array.isArray(source.ticker) ? source.ticker : DEFAULT_SITE_CONTENT.ticker;
  const heroChip = typeof source.heroChip === 'string' ? source.heroChip.trim() : DEFAULT_SITE_CONTENT.heroChip;
  const footer = normalizeFooter(source.footer);

  return {
    stats: stats.length ? stats : DEFAULT_SITE_CONTENT.stats,
    reviews: reviews.length ? reviews : DEFAULT_SITE_CONTENT.reviews,
    videos: (videos.length ? videos : DEFAULT_SITE_CONTENT.videos).map(item => {
      const videoId = normalizeYouTubeId(item.videoId || item.url || item.link || item.youtube || '');
      return {
        title: item.title || 'Video',
        videoId,
        thumbnail: item.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : ''),
      };
    }),
    gallery: gallery.length ? gallery : DEFAULT_SITE_CONTENT.gallery,
    ticker: (ticker.length ? ticker : DEFAULT_SITE_CONTENT.ticker).map(item => String(item || '').trim()).filter(Boolean),
    heroChip,
    footer,
  };
}

// ফুটারের প্রতিটা ফিল্ড — অ্যাডমিনের দেওয়া লেখা না থাকলে ডিফল্ট লেখা
function normalizeFooter(input) {
  const defaults = DEFAULT_SITE_CONTENT.footer;
  const source = (input && typeof input === 'object') ? input : {};
  const out = {};
  Object.keys(defaults).forEach((key) => {
    out[key] = (typeof source[key] === 'string' && source[key].trim()) ? source[key].trim() : defaults[key];
  });
  return out;
}

// ── স্ট্যাটিস count-up অ্যানিমেশন ──
// বাংলা সংখ্যা ↔ ইংরেজি সংখ্যা রূপান্তর
const BN_TO_EN = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
const toEnDigits = (s) => String(s).replace(/[০-৯]/g, (d) => BN_TO_EN[d] || d);
const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

// "৮০০+" → { prefix:'', num:800, suffix:'+' }, "৯৮%" → { num:98, suffix:'%' }
// কমা থাকলে (যেমন ১,২০০) অ্যানিমেশনেও কমা ফরম্যাট রাখা হবে।
function parseStatTarget(raw) {
  const str = toEnDigits(String(raw || '')).trim();
  const m = str.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!m) return null;
  const num = parseInt(m[2].replace(/,/g, ''), 10);
  if (!isFinite(num) || num <= 0) return null;
  return { prefix: m[1], num, suffix: m[3], grouped: m[2].includes(',') };
}

// ০ থেকে শুরু করে ease-out স্পিডে টার্গেট সংখ্যা পর্যন্ত গোনা হবে (~২ সেকেন্ড)
function animateStatCount(el) {
  const raw = el.dataset.target || '';
  const t = parseStatTarget(raw);
  if (!t) { el.textContent = raw; return; }   // সংখ্যা না হলে সরাসরি দেখাও
  const DURATION = 2000;
  const fmt = (n) => toBnDigits(t.prefix + (t.grouped ? n.toLocaleString('en-US') : String(n)) + t.suffix);
  el.textContent = toBnDigits(t.prefix + '0' + t.suffix);
  let start = null;
  const step = (now) => {
    if (start === null) start = now;
    const p = Math.min((now - start) / DURATION, 1);
    const eased = 1 - Math.pow(1 - p, 3);   // ease-out cubic — শেষে ধীরে থামবে
    el.textContent = fmt(Math.round(t.num * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderSiteContent(content) {
  const siteContent = normalizeSiteContent(content || DEFAULT_SITE_CONTENT);

  renderTicker(siteContent.ticker);

  renderFooter(siteContent.footer);

  // ব্যানারের নিচের live-chip — অ্যাডমিন প্যানেলের "হোম পেজ কনটেন্ট" পেজ থেকে
  // এডিট + স্থায়ীভাবে সেভ করা যায় (site content-এর "heroChip" ফিল্ড)।
  // ফাঁকা রাখলে চিপটি লুকানো থাকবে।
  const heroChipEl = document.querySelector('.hero .live-chip');
  if (heroChipEl) {
    if (siteContent.heroChip) {
      heroChipEl.style.display = '';
      heroChipEl.innerHTML = '<span class="live-dot"></span> ' + escapeHtml(siteContent.heroChip);
    } else {
      heroChipEl.style.display = 'none';
    }
  }

  const statsWrap = document.querySelector('.stats');
  // স্ট্যাট সেকশন — ০ থেকে অ্যানিমেট (count-up) হয়ে অ্যাডমিনের সেট করা সংখ্যায় পৌঁছাবে।
  // একই ডাটা বারবার এলে রি-অ্যানিমেট হবে না (প্রতি ১০ সেকেন্ডে কনটেন্ট লোড হয়)।
  const statsSig = JSON.stringify(siteContent.stats);
  if (statsWrap && statsSig !== statsWrap.dataset.sig) {
    statsWrap.dataset.sig = statsSig;
    statsWrap.innerHTML = siteContent.stats.map((item, index) => `
      <div class="stat-box reveal visible ${index > 0 ? 'reveal-d' + Math.min(index, 3) : ''}">
        <div class="stat-n" data-target="${escapeHtml(item.value || '')}">০</div>
        <div class="stat-l">${item.label || ''}</div>
      </div>
    `).join('');
    statsWrap.querySelectorAll('.stat-n').forEach(el => {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { io.disconnect(); animateStatCount(el); }
        });
      }, { threshold: 0.35 });
      io.observe(el);
    });
  }

  const reviewTrack = document.getElementById('reviewTrack');
  if (reviewTrack) {
    const cards = siteContent.reviews.map(item => `
      <div class="t-card">
        <div class="t-quote">"</div>
        <div class="t-stars">${'★'.repeat(Math.max(1, Number(item.stars) || 5))}</div>
        <p class="t-text">${(item.quote || '').replace(/\n/g, '<br>')}</p>
        <div class="t-author">
          <div>
            <div class="t-name">${item.author || 'Student'}</div>
          </div>
        </div>
      </div>
    `).join('');
    reviewTrack.innerHTML = cards + cards;
  }

  const videoGrid = document.querySelector('.video-grid');
  if (videoGrid) {
    videoGrid.innerHTML = siteContent.videos.map(item => {
      const vid = normalizeYouTubeId(item.videoId || '');
      const thumb = item.thumbnail || (vid ? `https://img.youtube.com/vi/${vid}/maxresdefault.jpg` : '');
      return `
        <div class="video-card">
          <div class="video-wrap">
            <div class="yt-lazy" data-vid="${vid}">
              <img src="${thumb || 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'}" alt="${item.title || 'Video'}" loading="lazy" />
              <div class="yt-play-btn">▶</div>
            </div>
          </div>
          <div class="video-info">
            <div class="video-title">${item.title || 'Video'}</div>
          </div>
        </div>
      `;
    }).join('');

    videoGrid.querySelectorAll('.yt-lazy').forEach(el => {
      el.addEventListener('click', () => {
        const vid = normalizeYouTubeId(el.dataset.vid || '');
        if (!vid) return;
        el.innerHTML = `
          <iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%; height:100%; border:0;"></iframe>
        `;
      });
    });
  }

  const galleryGrid = document.getElementById('galleryGrid');
  if (galleryGrid) {
    galleryGrid.innerHTML = siteContent.gallery.map((item, index) => `
      <div class="g-item ${index >= 5 ? 'g-hidden' : ''}" data-cat="${item.category || 'batch'}" data-src="${item.src || ''}" data-label="${item.title || ''}" data-icon="📸">
        <div class="g-placeholder">
          <div class="ph-icon"><img src="${item.src || ''}" alt="${item.title || 'Gallery'}" loading="lazy"></div>
          <div class="ph-text">${item.title || 'গ্যালারি'}</div>
        </div>
        <div class="g-overlay"><span class="g-label">${item.title || 'গ্যালারি'}</span></div>
        <div class="g-zoom-icon">🔍</div>
      </div>
    `).join('');
    if (typeof updateLoadMore === 'function') updateLoadMore();
    if (typeof buildLbList === 'function') buildLbList();
  }
}

// Resolve the API base: same-origin when the home page is served by the Node
// server, otherwise fall back to the Node server on port 5000. This makes the
// admin-saved content (টিকার, stats, reviews, gallery...) load PERMANENTLY even
// when index.html is opened via Live Server / another port / straight from disk.
let siteApiBasePromise = null;
function siteApiBase() {
  if (typeof location === 'undefined' || location.protocol === 'file:') {
    return Promise.resolve('http://localhost:5000');
  }
  if (siteApiBasePromise) return siteApiBasePromise;
  siteApiBasePromise = (async () => {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.success) return '';
    } catch (_) { /* same origin has no API */ }
    return 'http://localhost:5000';
  })();
  return siteApiBasePromise;
}

async function loadSiteContent() {
  const saved = localStorage.getItem('sv_site_content_v1');
  if (saved) {
    try { renderSiteContent(JSON.parse(saved)); } catch (_) {}
  }

  try {
    const base = await siteApiBase();
    const res = await fetch(base + '/api/site-content', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load site content');
    const json = await res.json();
    const data = normalizeSiteContent(json && json.data ? json.data : json);
    try { localStorage.setItem('sv_site_content_v1', JSON.stringify(data)); } catch (_) {}
    renderSiteContent(data);
  } catch (err) {
    if (!saved) renderSiteContent(DEFAULT_SITE_CONTENT);
  }
}

window.addEventListener('storage', function (event) {
  if (event.key === 'sv_site_content_v1' && event.newValue) {
    try { renderSiteContent(JSON.parse(event.newValue)); } catch (_) {}
  }
});

setInterval(loadSiteContent, 10000);
loadSiteContent();

// Ticker — navbar-এর নিচের smooth auto-scroll। অ্যাডমিন প্যানেলের "হোম পেজ কনটেন্ট"
// পেজ থেকে এডিট + সেভ করা যায় (site content-এর "ticker" ফিল্ড), রিয়েল-টাইমে আপডেট হয়।
const tickerTrack = document.querySelector('.ticker-track');
function renderTicker(items) {
  if (!tickerTrack) return;
  const list = (Array.isArray(items) && items.length) ? items : tickerItems;
  tickerTrack.innerHTML = [...list, ...list]
    .map(item => `<span>${escapeHtml(item)}</span>`)
    .join('');
}
renderTicker(tickerItems);

/* ── FOOTER — অ্যাডমিন প্যানেলের "ফুটার এডিট" পেজ থেকে রিয়েল-টাইমে আপডেট হয় ── */
function renderFooter(footer) {
  const f = footer || {};
  const setEl = (id, apply) => {
    const el = document.getElementById(id);
    if (el) apply(el);
  };
  const setText = (id, text) => { if (text) setEl(id, (el) => { el.textContent = text; }); };

  setText('footerAbout', f.about);
  setText('footerCopyright', f.copyright);
  setText('footerAddressText', f.address);

  // লিংক কলাম ("আমাদের আরো কিছু পেইজ")
  [[1, 'footerLink1'], [2, 'footerLink2'], [3, 'footerLink3']].forEach(([n, id]) => {
    const title = f['link' + n + 'Title'];
    const url = f['link' + n + 'Url'];
    setEl(id, (el) => {
      if (title) el.textContent = title;
      el.setAttribute('href', url || '#');
    });
  });

  // ফোন — লেখা + tel: লিংক (ক্লিক করলে কল যাবে)
  if (f.phone) {
    setText('footerPhoneText', f.phone);
    setEl('footerPhone', (el) => el.setAttribute('href', 'tel:' + String(f.phone).replace(/[^0-9+]/g, '')));
  }

  // ইমেইল — লেখা + mailto: লিংক (ক্লিক করলে মেইল যাবে)
  if (f.email) {
    setText('footerEmailText', f.email);
    setEl('footerEmail', (el) => el.setAttribute('href', 'mailto:' + f.email));
  }

  // সোশ্যাল বাটন
  if (f.facebookUrl) setEl('footerFacebook', (el) => el.setAttribute('href', f.facebookUrl));
  if (f.youtubeUrl) setEl('footerYoutube', (el) => el.setAttribute('href', f.youtubeUrl));
}

/* ── 1. NAVBAR SCROLL ── */
const nav = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', scrollY > 40);
}, { passive: true });

/* ── 2. HAMBURGER ── */
const hbg = document.getElementById('hamburger');
const mob = document.getElementById('mobileMenu');

/* মেনু খোলা/বন্ধ — আর পেছনের পেজ স্ক্রল আটকানো (মোডাল খোলা থাকলে তার লক ভাঙে না)।
   Modal/welcome/lightbox-এর নিজস্ব body-লক আছে — clash যাতে না হয় সেটা ম্যানেজ করা হয়। */
function anyOverlayActive() {
  return !!document.querySelector('.modal-overlay.active, .welcome-overlay.active, .lightbox-overlay.active');
}
function bodyLocked() { return document.body.style.overflow === 'hidden'; }
function setMenu(open) {
  hbg.classList.toggle('open', open);
  mob.classList.toggle('open', open);
  if (open) {
    if (!bodyLocked()) document.body.style.overflow = 'hidden';
  } else {
    if (!anyOverlayActive() && bodyLocked()) document.body.style.overflow = '';
  }
}

hbg.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenu(!hbg.classList.contains('open'));
});

/* মেনুর লিংক/ভর্তি বাটনে ক্লিক করলেই মেনু বন্ধ হয়ে যাবে। */
mob.querySelectorAll('a, .mob-enroll').forEach(el => {
  el.addEventListener('click', () => setMenu(false));
});

/* মেনুর বাইরে ক্লিক করলে বন্ধ। */
document.addEventListener('click', e => {
  if (!nav.contains(e.target) && !mob.contains(e.target)) setMenu(false);
});

/* Escape চাপলেও বন্ধ। */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') setMenu(false);
});

/* ── 3. SCROLL REVEAL ── */
const revealObserver = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  }),
  { threshold: 0.08 }
);
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── 4. ENROLL MODAL ── */
const enrollOverlay = document.getElementById('enrollModal');
const modalClose    = document.getElementById('modalClose');

function openEnroll(meta) {
  const courseField = document.getElementById('course');
  const batchField = document.getElementById('batch');
  const educationField = document.getElementById('education');

  const presetCourse = meta && meta.course ? meta.course : (courseField ? courseField.value : '');
  syncCourseOptions(presetCourse);

  if (meta && meta.course && courseField) courseField.value = meta.course;
  if (meta && (meta.start || meta.batch) && batchField) batchField.value = meta.start || meta.batch;
  if (meta && meta.education && educationField) educationField.value = meta.education;

  enrollOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeEnroll() {
  enrollOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// event delegation
document.body.addEventListener('click', e => {
  const courseBtn = e.target.closest('.course-enroll-btn');
  if (courseBtn) {
    e.preventDefault();
    openEnroll({
      course: courseBtn.dataset.course || '',
      start: courseBtn.dataset.start || courseBtn.dataset.batch || '',
      batch: courseBtn.dataset.batch || '',
      education: courseBtn.dataset.day || ''
    });
    return;
  }
  if (e.target.closest('.open-modal')) openEnroll();
});

modalClose.addEventListener('click', closeEnroll);
enrollOverlay.addEventListener('click', e => {
  if (e.target === enrollOverlay) closeEnroll();
});

/* ── 5. WELCOME MODAL ── */
const welcomeOverlay = document.getElementById('welcomeOverlay');

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const welcomePopupDefaults = {
  enabled: true,
  badge: 'ভর্তি চলছে এখনেই',
  headline: '40, 41 নাম্বার ব্যাচ',
  headlineHighlight: 'এ ভর্তি চলছে',
  sub: 'SoftVerse IT Training Center — ২০২৬',
  batchTitle: 'ব্যাচ বিস্তারিত',
  startDate: 'শুরুর তারিখ: 30 August , 2026',
  time: 'সময়: সকাল / বিকেল / সন্ধ্যা ব্যাচ',
  place: 'স্থান: মুন্সীগঞ্জ পুলিশ সুপার কার্যালয় বিপরীত পাশে',
  courses: 'কোর্স: কম্পিউটার বেসিক, গ্রাফিক্স ডিজাইন, কিডস কম্পিউটার',
  enrollBtn: 'এখনই আসন নিশ্চিত করুন →',
  skipBtn: 'পরে দেখবো',
};
let welcomePopupState = Object.assign({}, welcomePopupDefaults);

function renderWelcomePopup(data) {
  const p = Object.assign({}, welcomePopupDefaults, data || {});
  welcomePopupState = p;
  const byId = function (id) { return document.getElementById(id); };
  const set = function (id, value) { const el = byId(id); if (el) el.textContent = value || ''; };
  set('wmBadgeTxt', p.badge);
  const hl = byId('wmHeadline');
  if (hl) hl.innerHTML = escapeHtml(p.headline) + '<br/><span>' + escapeHtml(p.headlineHighlight) + '</span>';
  set('wmSub', p.sub);
  set('wmBatchTitle', p.batchTitle);
  set('wmDate', p.startDate);
  set('wmTime', p.time);
  set('wmPlace', p.place);
  set('wmCourses', p.courses);
  set('wmEnrollTxt', p.enrollBtn);
  set('wmSkipTxt', p.skipBtn);
}

// Resolve the API base: same-origin when served by the Node server,
// otherwise fall back to the Node server on port 5000 (works for
// Live Server / other ports / file:// so the popup ALWAYS gets updates).
// Reuses the shared siteApiBase() resolver above (same detection logic),
// so the popup and the home-page content always hit the same backend.
function popupApiBase() {
  return siteApiBase();
}

async function loadWelcomePopup() {
  try {
    const cached = localStorage.getItem('sv_popup_v1');
    if (cached) {
      try { renderWelcomePopup(JSON.parse(cached)); } catch (_) {}
    }
    const base = await popupApiBase();
    const res = await fetch(base + '/api/site-content/popup', { cache: 'no-store' });
    if (!res.ok) throw new Error('failed');
    const json = await res.json();
    const data = (json && json.data) ? json.data : {};
    try { localStorage.setItem('sv_popup_v1', JSON.stringify(data)); } catch (_) {}
    renderWelcomePopup(data);
    // If the admin disabled the popup while it was open on screen, close it instantly.
    if (data.enabled === false && welcomeOverlay.classList.contains('active')) {
      closeWelcome();
    }
  } catch (_) {
    /* offline: keep cached/static content */
  }
}

function openWelcome() {
  if (welcomePopupState.enabled === false) return;
  welcomeOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeWelcome() {
  welcomeOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// page load
window.addEventListener('load', () => setTimeout(openWelcome, 800));
loadWelcomePopup();

// ── REAL-TIME popup update ──
// 1) If admin saves in another tab, the localStorage "storage" event fires
//    here instantly → update the popup without reloading.
window.addEventListener('storage', function (event) {
  if (event.key === 'sv_popup_v1' && event.newValue) {
    try { renderWelcomePopup(JSON.parse(event.newValue)); } catch (_) {}
  }
});
// 2) Poll the backend periodically so the popup also reflects server-side
//    changes while this page stays open (live server / admin via API).
setInterval(loadWelcomePopup, 5000);
// 3) Admin panel dispatches this custom event right after a successful save —
//    pull the fresh data immediately (no waiting for the next poll).
window.addEventListener('sv-content-updated', function () { loadWelcomePopup(); });

document.getElementById('wmClose').addEventListener('click', closeWelcome);
document.getElementById('wmSkip').addEventListener('click', closeWelcome);
welcomeOverlay.addEventListener('click', e => {
  if (e.target === welcomeOverlay) closeWelcome();
});

document.getElementById('wmEnroll').addEventListener('click', () => {
  closeWelcome();
  setTimeout(openEnroll, 350);
});

// Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEnroll();
    closeWelcome();
    closeLightbox();
  }
});

/* ── 6. FORM + GOOGLE SHEET ── */
const SHEET_URL   = 'https://script.google.com/macros/s/AKfycbxHlczHv1otw9rYXhJxAfLyAoGBCnlcRzzJQwx_zPZK_FzWjDZgvMeJKkoNS8WLaxvwIg/exec';
const form        = document.getElementById('enrollForm');
const formView    = document.getElementById('formView');
const successView = document.getElementById('successView');
const submitBtn   = document.getElementById('submitBtn');
const btnText     = document.getElementById('btnText');
const btnLoader   = document.getElementById('btnLoader');

function showError(fId, eId, show) {
  const f = document.getElementById(fId);
  const e = document.getElementById(eId);
  if (f) f.classList.toggle('error', show);
  if (e) e.classList.toggle('show', show);
}

function validate() {
  let ok = true;

  const name = document.getElementById('fullName').value.trim();
  if (!name) { showError('fullName','err-fullName',true); ok=false; }
  else         showError('fullName','err-fullName',false);

  const phone = document.getElementById('phone').value.trim().replace(/ |-/g,'');
  if (phone.length !== 11 || !phone.startsWith('01')) {
    showError('phone','err-phone',true); ok=false;
  } else showError('phone','err-phone',false);

  if (!document.getElementById('course').value) {
    showError('course','err-course',true); ok=false;
  } else showError('course','err-course',false);

  if (!document.getElementById('batch').value) {
    showError('batch','err-batch',true); ok=false;
  } else showError('batch','err-batch',false);

  return ok;
}

function resetForm() {
  formView.style.display = 'block';
  successView.classList.remove('show');
  form.reset();
  submitBtn.disabled = false;
  btnText.style.display = 'inline';
  btnLoader.style.display = 'none';
}

function showSuccess() {
  formView.style.display = 'none';
  successView.classList.add('show');
  setTimeout(() => {
    closeEnroll();
    setTimeout(resetForm, 400);
  }, 3000);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validate()) return;

  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  const payload = {
    fullName:  document.getElementById('fullName').value.trim(),
    phone:     document.getElementById('phone').value.trim(),
    age:       document.getElementById('age').value || '—',
    course:    document.getElementById('course').value,
    batch:     document.getElementById('batch').value,
    education: document.getElementById('education').value || '—',
    message:   document.getElementById('message').value || '—',
  };

  function fallbackLocalSave() {
    try {
      const existing = JSON.parse(localStorage.getItem('sv_enrollments_v1') || '[]');
      const item = { _id: 'local_' + Date.now(), ...payload, status: 'pending', createdAt: new Date().toISOString() };
      existing.push(item);
      localStorage.setItem('sv_enrollments_v1', JSON.stringify(existing));
      window.dispatchEvent(new StorageEvent('storage', { key: 'sv_enrollments_v1', newValue: JSON.stringify(existing) }));
    } catch (_) {}
  }

  // API base: Node সার্ভার থেকে সাইট চললে same-origin, নাহলে (Live Server /
  // file://) localhost:5000 — যেকোনো ভাবে খোলা হলেও আবেদন সার্ভারেই জমা হবে,
  // ফলে অ্যাডমিন ড্যাশবোর্ডে সাথে সাথে দেখা যাবে।
  const submitToServer = async () => {
    let base = '';
    try { base = await popupApiBase(); } catch (_) { base = ''; }
    const res = await fetch(base + '/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((json && json.message) || 'Enrollment failed');
  };

  submitToServer()
    .then(() => showSuccess())
    .catch(() => {
      // সার্ভারে পৌঁছায়নি — অফলাইন ব্যাকআপ হিসেবে localStorage-এ রাখা হলো
      fallbackLocalSave();
      showSuccess();
    });
});

/* ── অফলাইনে জমা হওয়া আবেদন recovery-sync ──
   আগে সার্ভার বন্ধ থাকায় localStorage-এ আটকে থাকা আবেদনগুলো সাইট খুললেই
   সার্ভারে পাঠানো হয় — তাহলে অ্যাডমিন ড্যাশবোর্ডে কোনো আবেদন হারায় না। */
async function syncLocalEnrollments() {
  let list;
  try { list = JSON.parse(localStorage.getItem('sv_enrollments_v1') || '[]'); } catch (_) { return; }
  if (!Array.isArray(list) || !list.length) return;
  const pending = list.filter(x => x && String(x._id || '').startsWith('local_'));
  if (!pending.length) return;
  let base = '';
  try { base = await popupApiBase(); } catch (_) { return; }
  const remaining = [];
  for (const item of pending) {
    try {
      const res = await fetch(base + '/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: item.fullName, phone: item.phone, age: item.age,
          course: item.course, batch: item.batch, education: item.education,
          message: item.message,
        }),
      });
      if (!res.ok) { remaining.push(item); continue; }
      list = list.filter(x => x !== item);   // সার্ভারে গেছে — লোকাল কপি মুছে দাও
    } catch (_) { remaining.push(item); }
  }
  try { localStorage.setItem('sv_enrollments_v1', JSON.stringify(list)); } catch (_) {}
  if (remaining.length < pending.length) {
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'sv_enrollments_v1', newValue: JSON.stringify(list) })); } catch (_) {}
  }
}
setTimeout(() => { syncLocalEnrollments().catch(() => {}); }, 2500);
setInterval(() => { syncLocalEnrollments().catch(() => {}); }, 60000);

['fullName','phone','course','batch'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => {
    el.classList.remove('error');
    const err = document.getElementById('err-' + id);
    if (err) err.classList.remove('show');
  });
});

/* ── 7. GALLERY FILTER ── */
document.querySelectorAll('.g-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.g-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const filter = tab.dataset.filter;
    document.querySelectorAll('.g-item').forEach(item => {
      if (item.classList.contains('g-hidden')) return;
      item.style.display = (filter === 'all' || item.dataset.cat === filter) ? 'block' : 'none';
    });
  });
});

/* ── 8. LAZY LOAD ── */
const imgObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const item = entry.target;
    const src  = item.dataset.src;
    if (src && src.trim() !== '') {
      const img = document.createElement('img');
      img.src = src;
      img.alt = item.dataset.label || '';
      img.loading = 'lazy';
      const ph = item.querySelector('.g-placeholder');
      if (ph) ph.style.display = 'none';
      item.prepend(img);
    }
    obs.unobserve(item);
  });
}, { rootMargin: '200px' });

document.querySelectorAll('.g-item[data-src]').forEach(el => imgObserver.observe(el));

/* ── 9. LOAD MORE ── */
const loadMoreBtn   = document.getElementById('loadMoreBtn');
const loadMoreCount = document.getElementById('loadMoreCount');
const loadMoreText  = document.getElementById('loadMoreText');
const loadMoreIcon  = document.getElementById('loadMoreIcon');
const SHOW_PER_CLICK = 3;

function updateLoadMore() {
  const remaining = document.querySelectorAll('.g-item.g-hidden').length;
  if (remaining === 0) {
    loadMoreText.textContent = 'সব ছবি দেখা হয়ে গেছে';
    loadMoreIcon.textContent = '✓';
    loadMoreBtn.classList.add('all-shown');
    loadMoreCount.textContent = 'মোট ' + document.querySelectorAll('.g-item').length + 'টি ছবি';
  } else {
    loadMoreCount.textContent = 'আরও ' + remaining + 'টি ছবি আছে';
  }
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    const hidden = [...document.querySelectorAll('.g-item.g-hidden')];
    hidden.slice(0, SHOW_PER_CLICK).forEach((item, i) => {
      item.classList.remove('g-hidden');
      item.classList.add('g-visible');
      item.style.animationDelay = (i * 0.12) + 's';
      imgObserver.observe(item);
    });
    updateLoadMore();
  });
  updateLoadMore();
}

/* ── 10. LIGHTBOX ── */
const lightbox  = document.getElementById('lightbox');
const lbImg     = document.getElementById('lbImg');
const lbPh      = document.getElementById('lbPlaceholder');
const lbIcon    = document.getElementById('lbIcon');
const lbCaption = document.getElementById('lbCaption');
const lbCounter = document.getElementById('lbCounter');

let lbItems = [], lbIndex = 0;

function buildLbList() {
  lbItems = [...document.querySelectorAll('.g-item:not(.g-hidden):not([style*="none"])')];
}

function showLbSlide() {
  const item  = lbItems[lbIndex];
  const src   = item.dataset.src;
  const label = item.dataset.label || '';
  const icon  = item.dataset.icon  || '📸';
  lbCaption.textContent = label;
  lbCounter.textContent = (lbIndex + 1) + ' / ' + lbItems.length;
  if (src && src.trim() !== '') {
    lbImg.src = src; lbImg.style.display = 'block'; lbPh.style.display = 'none';
  } else {
    lbImg.style.display = 'none'; lbPh.style.display = 'flex'; lbIcon.textContent = icon;
  }
}

function openLightbox(index) {
  buildLbList(); lbIndex = index; showLbSlide();
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

document.getElementById('galleryGrid').addEventListener('click', e => {
  const item = e.target.closest('.g-item');
  if (!item) return;
  buildLbList();
  const idx = lbItems.indexOf(item);
  if (idx !== -1) openLightbox(idx);
});

document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => {
  lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length; showLbSlide();
});
document.getElementById('lbNext').addEventListener('click', () => {
  lbIndex = (lbIndex + 1) % lbItems.length; showLbSlide();
});
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'ArrowLeft')  { lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length; showLbSlide(); }
  if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % lbItems.length; showLbSlide(); }
});

/* ── 11. REVIEW AUTO SCROLL — card clone + drag to scroll ── */
const reviewTrack = document.getElementById('reviewTrack');
if (reviewTrack) {
  /* কার্ডগুলো clone করে double করি
     যাতে scroll শেষ হলে seamless loop হয় */
  const cards = reviewTrack.innerHTML;
  reviewTrack.innerHTML = cards + cards;

  /* ── Drag to scroll (mouse + touch) ──
     CSS-এর animation duration-এর সাথে মিলিয়ে রাখতে হবে
     (style.css → .review-track animation) */
  const SCROLL_DURATION = 20000; /* ms — CSS-এর 20s এর সাথে sync */
  const wrap = reviewTrack.closest('.review-track-wrap') || reviewTrack.parentElement;
  let isDragging = false;
  let startX = 0;
  let startOffsetMs = 0;
  let currentOffsetMs = 0;

  /* এখন track ঠিক কতটা সরে গেছে (px) সেটা transform থেকে বের করি */
  const getTranslateX = () => {
    const t = window.getComputedStyle(reviewTrack).transform;
    if (!t || t === 'none') return 0;
    return new DOMMatrixReadOnly(t).m41;
  };

  /* animation-delay দিয়ে track-এর position সেট করি */
  const applyOffset = () => {
    const d = ((currentOffsetMs % SCROLL_DURATION) + SCROLL_DURATION) % SCROLL_DURATION;
    reviewTrack.style.animationDelay = `${-d}ms`;
  };

  if (wrap) {
    wrap.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      wrap.classList.add('dragging');
      reviewTrack.style.animationPlayState = 'paused';
      const half = reviewTrack.scrollWidth / 2;
      currentOffsetMs = half > 0 ? (-getTranslateX() / half) * SCROLL_DURATION : 0;
      startOffsetMs = currentOffsetMs;
      if (wrap.setPointerCapture) {
        try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const half = reviewTrack.scrollWidth / 2;
      if (!half) return;
      const deltaPx = e.clientX - startX;
      /* বাঁ দিকে টানলে track সামনে এগোয় (auto-scroll এর দিকেই) */
      currentOffsetMs = startOffsetMs - (deltaPx / half) * SCROLL_DURATION;
      applyOffset();
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      wrap.classList.remove('dragging');
      /* delay রেখে animation আবার চালু — hover pause CSS নিজেই সামলাবে */
      reviewTrack.style.animationPlayState = '';
    };

    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);
    /* টেনে টেক্সট/ছবি সিলেক্ট বা ড্র্যাগ হওয়া আটকাই */
    wrap.addEventListener('dragstart', (e) => e.preventDefault());
  }
}

/* ── YouTube Lazy Load ── */
document.querySelectorAll('.yt-lazy').forEach(el => {
  el.addEventListener('click', () => {
    const vid = el.dataset.vid;
    el.innerHTML = `
      <iframe 
        src="https://www.youtube.com/embed/${vid}?autoplay=1" 
        allow="autoplay; encrypted-media" 
        allowfullscreen
        style="width:100%; height:100%; border:0;">
      </iframe>
    `;
  });
});

/* ══════════════════════════════════════
   ANIMATED COURSE BANNER (stick-figure hero)
   — works with any number of .sv-slide elements,
     each can carry its own background image via
     style="background-image:url('...')"
═══════════════════════════════════ */
(function(){
  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  function setupTrackAndDots(root){
    const track = root.querySelector('[data-sv-track]');
    const dotsWrap = root.querySelector('[data-sv-dots]');
    if(!track) return null;

    const realSlides = Array.from(track.children);
    const n = realSlides.length;
    if(n === 0) return null;

    // clone the first slide onto the end for a seamless loop
    const clone = realSlides[0].cloneNode(true);
    track.appendChild(clone);
    const totalSlides = n + 1;
    const stepPct = 100 / totalSlides;

    track.style.width = (totalSlides * 100) + '%';
    Array.from(track.children).forEach(s => { s.style.width = stepPct + '%'; });

    // build dots to match the real slide count
    if(dotsWrap){
      dotsWrap.innerHTML = '';
      for(let i = 0; i < n; i++){
        const d = document.createElement('span');
        d.className = 'sv-dot' + (i === 0 ? ' sv-active' : '');
        dotsWrap.appendChild(d);
      }
    }

    return { n, stepPct };
  }

  async function runSvBanner(root){
    const track     = root.querySelector('[data-sv-track]');
    const figure    = root.querySelector('[data-sv-figure]');
    const hook      = root.querySelector('[data-sv-hook]');
    const ropeLine  = root.querySelector('[data-sv-ropeline]');
    const throwPath = root.querySelector('[data-sv-throwpath]');
    const ropeKnot  = root.querySelector('[data-sv-ropeknot]');
    if(!track || !figure || !throwPath) return;

    const setup = setupTrackAndDots(root);
    if(!setup) return;
    const total = setup.n;
    const stepPct = setup.stepPct;

    const pathLen = throwPath.getTotalLength();
    throwPath.style.strokeDasharray = pathLen;
    throwPath.style.strokeDashoffset = pathLen;

    function animateThrow(duration){
      return new Promise(resolve => {
        throwPath.style.opacity = 1;
        ropeKnot.style.opacity = 1;
        const start = throwPath.getPointAtLength(0);
        ropeKnot.setAttribute('cx', start.x);
        ropeKnot.setAttribute('cy', start.y);
        throwPath.style.transition = 'none';
        throwPath.style.strokeDashoffset = pathLen;
        void throwPath.getBoundingClientRect();
        throwPath.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(.2,.6,.3,1)`;
        throwPath.style.strokeDashoffset = 0;

        const t0 = performance.now();
        function step(now){
          const t = Math.min(1, (now - t0) / duration);
          const pt = throwPath.getPointAtLength(t * pathLen);
          ropeKnot.setAttribute('cx', pt.x);
          ropeKnot.setAttribute('cy', pt.y);
          if(t < 1){ requestAnimationFrame(step); }
          else { resolve(); }
        }
        requestAnimationFrame(step);
      });
    }

    let progress = 0;
    const tugShift = stepPct * 0.2, pushHalf = stepPct * 0.4; // sums to one stepPct per slide

    figure.style.left = '78%';
    figure.classList.add('sv-flip');

    while(true){
      const dots = root.querySelectorAll('[data-sv-dots] .sv-dot');
      const base = -(progress * stepPct);

      // wind up — two backward steps, legs walking, arm cocks behind
      figure.classList.add('sv-winding');
      figure.style.transition = 'left 800ms steps(2, end)';
      figure.style.left = '85%';
      await wait(800);
      figure.classList.remove('sv-winding');

      // throw — steps forward to plant as the rope releases
      figure.classList.add('sv-throwing');
      figure.style.transition = 'left 380ms ease-out';
      figure.style.left = '78%';
      await animateThrow(600);
      figure.classList.remove('sv-throwing');
      throwPath.style.opacity = 0;
      ropeKnot.style.opacity = 0;

      // catches on the banner
      hook.classList.add('sv-show');
      ropeLine.classList.add('sv-show');
      await wait(200);

      // sling over the shoulder
      figure.classList.add('sv-shoulder');
      await wait(300);

      // tug — banner nudges forward a little
      figure.classList.add('sv-tugging');
      track.style.transition = 'transform 800ms ease-out';
      track.style.transform = `translateX(${base - tugShift}%)`;
      await wait(800);
      figure.classList.remove('sv-tugging');

      // let go — rope vanishes
      figure.classList.remove('sv-shoulder');
      ropeLine.classList.remove('sv-show');
      hook.classList.remove('sv-show');
      await wait(250);

      // push — first half
      figure.classList.add('sv-pushing');
      figure.style.transition = 'left 2200ms linear';
      track.style.transition = 'transform 2200ms linear';
      requestAnimationFrame(() => {
        figure.style.left = '46%';
        track.style.transform = `translateX(${base - tugShift - pushHalf}%)`;
      });
      await wait(2200);

      // tired — sit and rest
      figure.classList.remove('sv-pushing');
      figure.classList.add('sv-resting');
      await wait(1400);

      // push — second half, finishing the slide
      figure.classList.remove('sv-resting');
      figure.classList.add('sv-pushing');
      figure.style.transition = 'left 2200ms linear';
      track.style.transition = 'transform 2200ms linear';
      requestAnimationFrame(() => {
        figure.style.left = '6%';
        track.style.transform = `translateX(${base - stepPct}%)`;
      });
      await wait(2200);
      figure.classList.remove('sv-pushing');

      progress++;
      dots.forEach((d,i) => d.classList.toggle('sv-active', i === progress % total));

      if(progress === total){
        await wait(250);
        track.style.transition = 'none';
        progress = 0;
        track.style.transform = 'translateX(0%)';
        void track.offsetWidth;
      }

      // run back to the right for the next banner
      await wait(200);
      figure.classList.remove('sv-flip');
      figure.classList.add('sv-running');
      figure.style.transition = 'left 1200ms ease-in-out';
      requestAnimationFrame(() => { figure.style.left = '78%'; });
      await wait(1200);
      figure.classList.remove('sv-running');
      figure.classList.add('sv-flip');

      // force legs to settle to neutral during the pause
      const legs = figure.querySelectorAll('.sv-thigh, .sv-shin');
      legs.forEach(l => { l.style.animation = 'none'; l.style.transform = 'none'; });
      await wait(600);
      legs.forEach(l => { l.style.animation = ''; l.style.transform = ''; });
    }
  }

  // lazily load the rest of the banner photos after the page has loaded,
  // staggered so they don't all compete with initial page-load bandwidth
  function lazyLoadBannerImages(root){
    const deferred = root.querySelectorAll('.sv-slide[data-bg]');
    deferred.forEach((slide, i) => {
      setTimeout(() => {
        const url = slide.getAttribute('data-bg');
        if (url) {
          slide.style.backgroundImage = `url('${url}')`;
          slide.removeAttribute('data-bg');
        }
      }, 400 * (i + 1)); // ~400ms apart
    });
  }

  window.addEventListener('load', () => {
    document.querySelectorAll('[data-sv-banner]').forEach(lazyLoadBannerImages);
  });

  document.querySelectorAll('[data-sv-banner]').forEach(runSvBanner);
})();
