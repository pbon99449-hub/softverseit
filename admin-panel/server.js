require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const courseRoutes = require('./routes/courseRoutes');
const resultRoutes = require('./routes/resultRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const siteContentRoutes = require('./routes/siteContentRoutes');
const visitRoutes = require('./routes/visitRoutes');

const app = express();

/* ── 24h uptime guard ──
   Kono unexpected error ashleo server bondho hoye jabe na —
   error log hobe, kintu process cholte thakbe.
   (Ei chara ekta unhandled error-e puro server crash kore OFF hoye jeto.) */
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (server cholche):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (server cholche):', reason);
});

// ── DB ──
connectDB();

// ── Middleware ──
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin.split(',') }));
// গ্যালারি ছবি base64 হয়ে সেভ হয় — ডিফল্ট 100kb limit-এ "Request Entity Too Large"
// (413) আসত। 25mb রাখা হলো যাতে বড় ছবিও নিরাপদে সেভ হয়।
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Don't let browsers serve a stale HTML page ──
app.use((req, res, next) => {
  if (req.accepts('html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
});

// ── Security headers ──
// ব্রাউজার-সাইড সাধারণ আক্রমণ (MIME sniffing, clickjacking) ঠেকাতে।
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/visits', visitRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running' }));

// ── Serve the MAIN website (homepage first) ──
// (HTML is served with Cache-Control: no-store so browsers never use a stale copy)
// Project root = parent of admin-panel folder
const MAIN_ROOTS = {
  root:   path.join(__dirname, '..'),          // index.html, result.html
  css:    path.join(__dirname, '..', 'Css'),  // Css/
  images: path.join(__dirname, '..', 'Images'),// Images/
  js:     path.join(__dirname, '..', 'JS'),   // JS/
};

// Static assets of the main website. Mounted at their original folder names so
// the site's relative paths (./Css/style.css, ./Images/..., ./JS/main.js) keep working.
app.use('/Css', express.static(MAIN_ROOTS.css));
app.use('/Images', express.static(MAIN_ROOTS.images));
app.use('/JS', express.static(MAIN_ROOTS.js));

// Home page (/) and result page (/result.html) of the main website
app.get('/', (req, res) => res.sendFile(path.join(MAIN_ROOTS.root, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(MAIN_ROOTS.root, 'index.html')));
app.get('/result.html', (req, res) => res.sendFile(path.join(MAIN_ROOTS.root, 'result.html')));

// ── Serve the ADMIN PANEL under /admin ──
// `/admin` → প্রতিবার LOGIN পেজ। ঢোকামাত্র আগের session cookie বাতিল করে
// দেওয়া হয় — ফলে সঠিক ইমেইল+পাসওয়ার্ড সাবমিট না করলে প্যানেল খুলবেই না,
// আগে কখনো লগইন করা থাকলেও। (cookie-র নাম authController.js-এর
// SESSION_COOKIE-এর সাথে মিলছে — পরিবর্তন করলে দুই জায়গায়ই করতে হবে।)
const ADMIN_PUBLIC = path.join(__dirname, 'public');
const CLEAR_SESSION_COOKIE = 'sv_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
app.get('/admin', (req, res) => { res.setHeader('Set-Cookie', CLEAR_SESSION_COOKIE); res.redirect('/admin/login.html'); });
app.get('/admin/', (req, res) => { res.setHeader('Set-Cookie', CLEAR_SESSION_COOKIE); res.redirect('/admin/login.html'); });

// ── SERVER-SIDE LOGIN GUARD for admin HTML pages ──
// সঠিক ইমেইল+পাসওয়ার্ড দিয়ে লগইন না করলে (কোনো session cookie ছাড়া)
// protected admin পেজগুলো সার্ভার পরিবেশনই করবে না — /admin/login.html-এ
// redirect করে দেবে। এটি static middleware-এর আগে বসানো হয়েছে যাতে
// express.static দিয়ে এই পেজগুলো কোনোভাবেই সরাসরি ফাঁকি দেওয়া না যায়।
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./config/secret');
const PROTECTED_ADMIN_PAGES = new Set([
  'index.html', 'dashboard.html', 'courses.html', 'enrollments.html',
  'results.html', 'site-content.html', 'popup-sms.html', 'register.html',
]);

function adminSessionToken(req) {
  const raw = req.headers.cookie || '';
  const pair = raw.split(';').map(s => s.trim()).find(s => s.startsWith('sv_admin_session='));
  return pair ? decodeURIComponent(pair.slice('sv_admin_session='.length)) : null;
}

function adminSessionValid(req) {
  const token = adminSessionToken(req);
  if (!token) return false;
  try { jwt.verify(token, JWT_SECRET); return true; }
  catch (_) { return false; }
}

app.use('/admin', (req, res, next) => {
  // শুধু HTML পেজগুলো guard করা হয় (css/js/ছবি public থাকবে)।
  // basename নেওয়া হচ্ছে double-decode করে — যাতে "/admin/./index.html"
  // বা "/admin/%69ndex.html" টাইপ path trick দিয়ে guard ফাঁকি দেওয়া না যায়।
  let p = req.path;
  for (let i = 0; i < 3; i++) {
    try { const d = decodeURIComponent(p); if (d === p) break; p = d; } catch (_) { break; }
  }
  const base = path.posix.basename(p).toLowerCase();
  if (PROTECTED_ADMIN_PAGES.has(base) && !adminSessionValid(req)) {
    return res.redirect('/admin/login.html');
  }
  next();
});

// Explicit admin page routes — these can NEVER "Cannot GET"
// login.html-ও এখানে cookie clear করে দেখানো হয় — যাতে লগইন পেজে থাকা
// অবস্থায় পুরনো সেশন কাজে না লাগে; সাবমিট করলেই নতুন সেশন তৈরি হবে।
const ADMIN_PAGES = ['register.html', 'index.html', 'dashboard.html', 'courses.html', 'enrollments.html', 'results.html', 'site-content.html', 'popup-sms.html'];
app.get('/admin/login.html', (req, res) => {
  res.setHeader('Set-Cookie', CLEAR_SESSION_COOKIE);
  res.sendFile(path.join(ADMIN_PUBLIC, 'login.html'));
});
ADMIN_PAGES.forEach(page => {
  app.get('/admin/' + page, (req, res) => res.sendFile(path.join(ADMIN_PUBLIC, page)));
});

// Admin static assets (css/admin.css, js/common.js, Images/...)
app.use('/admin', express.static(ADMIN_PUBLIC));

// Legacy URLs (old admin-at-root layout) → redirect to the new /admin/ locations
app.get('/login.html', (req, res) => res.redirect(301, '/admin/login.html'));
app.get('/register.html', (req, res) => res.redirect(301, '/admin/register.html'));
app.get('/css/admin.css', (req, res) => res.redirect(301, '/admin/css/admin.css'));
app.get('/js/common.js', (req, res) => res.redirect(301, '/admin/js/common.js'));

// ── 404 for unknown API routes ──
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// ── Friendly 404 page (never show the raw "Cannot GET ..." ) ──
app.use((req, res) => {
  res.status(404).sendFile(path.join(MAIN_ROOTS.root, '404.html'));
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  // Full details in the server console so errors can always be traced.
  console.error('─── API ERROR ───────────────────────────');
  console.error(req.method, req.originalUrl);
  console.error(err && err.stack ? err.stack : err);
  console.error('─────────────────────────────────────────');
  if (req.path.startsWith('/api')) {
    // Send the REAL error message to the admin panel — a generic
    // "Unexpected server error" hides what actually went wrong.
    return res.status(500).json({
      success: false,
      message: (err && err.message) || 'Unexpected server error',
    });
  }
  res.status(500).sendFile(path.join(MAIN_ROOTS.root, '500.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Admin panel server running on http://localhost:${PORT}`);
});
