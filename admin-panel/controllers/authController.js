const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const JWT_SECRET = require('../config/secret');

function signToken(admin) {
  return jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

/* ── লগইন brute-force guard (in-memory, কোনো extra dependency লাগে না) ──
   একই IP থেকে ১৫ মিনিটে ৮ বারের বেশি ভুল পাসওয়ার্ড দিলে সাময়িক ব্লক।
   ফলে পাসওয়ার্ড গেস করে (brute-force) ঢোকার চেষ্টা বন্ধ হয়। */
const loginAttempts = new Map();   // ip -> { count, firstAt }
const LOGIN_WINDOW_MS = 15 * 60 * 1000;   // ১৫ মিনিট
const LOGIN_MAX_FAILS = 8;

function loginKey(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String((req.socket && req.socket.remoteAddress) || 'unknown');
}

function tooManyLoginFails(req) {
  const rec = loginAttempts.get(loginKey(req));
  if (!rec) return false;
  if (Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(loginKey(req));
    return false;
  }
  return rec.count >= LOGIN_MAX_FAILS;
}

function recordLoginFailure(req) {
  const key = loginKey(req);
  const rec = loginAttempts.get(key);
  if (!rec || Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

function clearLoginFailures(req) {
  loginAttempts.delete(loginKey(req));
}

/* ── Session cookie (httpOnly) ──
   Admin HTML pages (/admin/index.html etc.) are guarded SERVER-SIDE with this
   cookie: without a valid login the server redirects to the login page —
   the panel can never be opened without the correct email + password. */
const SESSION_COOKIE = 'sv_admin_session';

function sessionCookieValue(token, maxAgeSeconds) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  parts.push('Max-Age=' + Math.max(0, Math.floor(maxAgeSeconds || 0)));
  return parts.join('; ');
}

// "exp" claim থেকে cookie-র Max-Age বের করা হয় (JWT_EXPIRES_IN এর সাথে মিলবে)।
// তবে সর্বোচ্চ ADMIN_SESSION_MINUTES (ডিফল্ট ১০ মিনিট) — এরপর /admin আবার
// লগইন চাইবে। (ব্রাউজার খোলা থাকলেও মেয়াদ শেষ হলে আবার লগইন লাগবেই।)
function maxAgeFromToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const fromJwt = decoded.exp - Math.floor(Date.now() / 1000);
      const minutes = parseInt(process.env.ADMIN_SESSION_MINUTES || '10', 10) || 10;
      return Math.min(fromJwt, minutes * 60);
    }
  } catch (_) { /* ignore */ }
  const minutes = parseInt(process.env.ADMIN_SESSION_MINUTES || '10', 10) || 10;
  return minutes * 60;
}

function fallbackAdminObject() {
  const email = (process.env.ADMIN_EMAIL || 'admin@softverseit.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.ADMIN_NAME || 'Super Admin';
  return {
    _id: 'fallback-admin',
    name,
    email,
    password,
    role: 'superadmin',
    toSafeJSON() { return { id: this._id, name: this.name, email: this.email, role: this.role }; },
  };
}

function isFallbackLoginRequired() {
  // Legacy MongoDB check removed — the panel now runs on the built-in SQLite
  // store, which is always available, so the fallback login path is never used.
  return false;
}

async function ensureDefaultAdminRecord() {
  const email = (process.env.ADMIN_EMAIL || 'admin@softverseit.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.ADMIN_NAME || 'Super Admin';

  if (isFallbackLoginRequired()) return null;

  const existing = await Admin.findOne({ email });
  if (existing) return existing;

  return Admin.create({ name, email, password, role: 'superadmin' });
}

async function resolveAdmin(email, password) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedPassword = String(password || '').trim();
  const fallback = fallbackAdminObject();

  if (normalizedEmail === fallback.email && normalizedPassword === fallback.password) {
    if (isFallbackLoginRequired()) {
      return fallback;
    }

    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing) return existing;

    return ensureDefaultAdminRecord();
  }

  if (isFallbackLoginRequired()) {
    return null;
  }

  return Admin.findOne({ email: normalizedEmail });
}

function matchesConfiguredDefaultAdmin() {
  // ব্যাকডোর বন্ধ — ডিফল্ট পাসওয়ার্ড দিয়ে আর কখনো সরাসরি লগইন হবে না।
  // (প্রথমবার লগইনের সময় ensureDefaultAdminRecord() ডিফল্ট পাসওয়ার্ডসহ
  // অ্যাকাউন্ট তৈরি করে, তখন comparePassword দিয়েই যাচাই হয়।)
  return false;
}

// POST /api/auth/login
async function login(req, res) {
  try {
    // brute-force ব্লক — অনেকবার ভুল চেষ্টা করলে সাময়িকভাবে লগইন বন্ধ
    if (tooManyLoginFails(req)) {
      return res.status(429).json({
        success: false,
        message: 'অনেকবার ভুল চেষ্টা হয়েছে — নিরাপত্তার জন্য ১৫ মিনিট পর আবার চেষ্টা করুন',
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await resolveAdmin(email, password);
    if (!admin) {
      recordLoginFailure(req);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const candidatePassword = String(password || '').trim();
    let match = false;

    if (typeof admin.comparePassword === 'function') {
      try {
        match = await admin.comparePassword(candidatePassword);
      } catch (_) {
        match = false;
      }
    }

    // ⚠️ নিরাপত্তা: এখানে আর কোনো "ডিফল্ট পাসওয়ার্ড" বা plaintext ফলব্যাক
    // মেলানো হয় না। আগে ডিফল্ট 'ChangeMe123!' পাসওয়ার্ড পাসওয়ার্ড বদলানোর
    // পরেও কাজ করত (ব্যাকডোর) — সেটি বন্ধ করা হয়েছে। comparePassword নিজেই
    // bcrypt hash এবং legacy plaintext — দুটোই ঠিকমতো যাচাই করে।

    if (!match) {
      recordLoginFailure(req);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    clearLoginFailures(req);

    const token = signToken(admin);
    // লগইন সফল → httpOnly session cookie সেট হয়, যা দিয়ে সার্ভার
    // /admin পেজগুলোতে ঢোকার আগে লগইন যাচাই করে।
    res.setHeader('Set-Cookie', sessionCookieValue(token, maxAgeFromToken(token)));
    res.json({ success: true, token, admin: admin.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ success: true, admin: req.admin.toSafeJSON() });
}

// PUT /api/auth/change-password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const admin = req.admin;
    const match = await admin.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    admin.password = newPassword;
    await admin.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// POST /api/auth/register — create a new admin account (real, stored in MongoDB)
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const existing = await Admin.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    // Default role for self-registered accounts is 'admin'.
    const admin = await Admin.create({ name: name.trim(), email: cleanEmail, password, role: 'admin' });

    // Auto-login after registration: return a JWT so the user is signed in right away.
    const token = signToken(admin);
    res.setHeader('Set-Cookie', sessionCookieValue(token, maxAgeFromToken(token)));
    res.status(201).json({ success: true, token, admin: admin.toSafeJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// POST /api/auth/logout — server-side session cookie মুছে দেয়,
// ফলে লগআউটের পর /admin পেজগুলো আবার লগইন ছাড়া খুলবে না।
function logout(req, res) {
  res.setHeader('Set-Cookie', sessionCookieValue('', 0));
  res.json({ success: true, message: 'Logged out' });
}

module.exports = { register, login, me, changePassword, logout };
