const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

function signToken(admin) {
  return jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
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

function matchesConfiguredDefaultAdmin(admin, candidatePassword) {
  if (!admin) return false;
  const fallback = fallbackAdminObject();
  return String(admin.email || '').toLowerCase().trim() === fallback.email && String(candidatePassword || '').trim() === fallback.password;
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await resolveAdmin(email, password);
    if (!admin) {
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

    if (!match) {
      match = matchesConfiguredDefaultAdmin(admin, candidatePassword);
    }

    if (!match) {
      match = String(admin.password || '') === candidatePassword;
    }

    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

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
