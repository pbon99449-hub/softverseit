/* ════════════════════════════════════════════════════════════════
   CONTENT VAULT — admin-এ সেভ করা সব ডাটার স্থায়ী (deploy-safe) কপি

   সমস্যা:
   Render-এর মতো PaaS হোস্টিং-এ admin-panel/data/softverse.sqlite আর
   runtime-এ লেখা সব ফাইল থাকে SERVER-এর ephemeral filesystem-এ —
   নতুন deploy/restart/spin-down-এর সাথে সাথে মুছে যায়। তাই admin
   প্যানেল থেকে সেভ করা হোম পেজ কনটেন্ট, কোর্স ও রেজাল্ট পরের
   restart-এ হারিয়ে যেত।

   সমাধান (৩টি স্তর):
   ১) প্রতিবার সফল সেভের পর ডাটা এই ফোল্ডারের JSON ফাইলে লেখা হয় —
      site-content.json / courses.json / results.json (এই ফোল্ডারটা git-এ ওঠে)।
   ২) সেভ হওয়া মাত্রই ডাটা GitHub-এ auto-push হয় — তবে DEBOUNCED
      (শেষ সেভের ১৫ সেকেন্ড পরে, সর্বোচ্চ ৬০ সেকেন্ড অপেক্ষা)। কারণ
      প্রতিটা push-এ Render নতুন করে deploy নেয় — প্রতি ক্লিকে push
      করলে deploy-thrash-এর ভিতরে করা সেভগুলো হারাতে পারে।
   ৩) প্রতি ৩ মিনিটে একটা self-heal sync চলে — কোনো কারণে push ব্যর্থ
      হলে (network / GitHub rate-limit) সেটা আবার চেষ্টা করা হয়,
      ফলে সেভ করা ডাটা কোনোভাবেই হারায় না।

   সার্ভার চালু হলে DB খালি পেলে GitHub (সর্বশেষ) → তারপর committed
   JSON ফাইল থেকে কনটেন্ট/কোর্স/রেজাল্ট restore করা হয়।
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const SiteContent = require('../models/SiteContent');
const Course = require('../models/Course');
const Result = require('../models/Result');
const { defaultSiteContent, sanitizeSiteContent } = require('../controllers/siteContentController');
const gitAutoPush = require('./gitAutoPush');

// এই ফাইলগুলো git-এ থাকবে (gitignore-এ নেই) — deploy-safe স্টোরেজ।
const VAULT_DIR = path.join(__dirname, '..', 'content-vault');
const VAULT_FILE = path.join(VAULT_DIR, 'site-content.json');
const COURSES_FILE = path.join(VAULT_DIR, 'courses.json');
const RESULTS_FILE = path.join(VAULT_DIR, 'results.json');

// Push debounce — শেষ সেভের পর কতক্ষণ অপেক্ষা করে একসাথে push হবে (env দিয়ে বদলানো যায়)
const PUSH_DEBOUNCE_MS = Math.max(2000, Number(process.env.GIT_PUSH_DEBOUNCE_MS || 15000));
// চলতি থাকলেও সর্বোচ্চ কতক্ষণ পরে push করতে বাধ্য হবে
const PUSH_MAX_WAIT_MS = Math.max(PUSH_DEBOUNCE_MS, Number(process.env.GIT_PUSH_MAX_WAIT_MS || 60000));
// Self-heal sync কতক্ষণ পর পর চলবে
const SYNC_INTERVAL_MS = Math.max(30000, Number(process.env.GIT_SYNC_INTERVAL_MS || 180000));

// কোন ডাটা কোন vault ফাইলে + GitHub-এর কোন path-এ যাবে
const KINDS = {
  content: { file: VAULT_FILE, repoPath: gitAutoPush.VAULT_PATH, model: SiteContent, single: true, sort: null },
  courses: { file: COURSES_FILE, repoPath: gitAutoPush.COURSES_PATH, model: Course, sort: { createdAt: 1 } },
  results: { file: RESULTS_FILE, repoPath: gitAutoPush.RESULTS_PATH, model: Result, sort: { createdAt: -1 } },
};

function ensureVaultDir() {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
}

function readJsonFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeJsonFile(file, data) {
  try {
    ensureVaultDir();
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.error('⚠️  Content vault write failed (' + path.basename(file) + '):', err.message);
    return false;
  }
}

// ── DB-র বর্তমান ডাটা থেকে vault payload তৈরি ──
async function collectPayload(kind) {
  const cfg = KINDS[kind];
  if (cfg.single) {
    const existing = await SiteContent.findOne().lean();
    return sanitizeSiteContent(existing || defaultSiteContent());
  }
  let q = cfg.model.find();
  if (cfg.sort) q = q.sort(cfg.sort);
  return q.lean();
}

// DB-র বর্তমান ডাটা vault ফাইলে লেখা (প্রতিটি সফল সেভের পরে call হয়)
async function writeVault(kind) {
  const payload = await collectPayload(kind);
  writeJsonFile(KINDS[kind].file, payload);
  return payload;
}

/* ── GitHub push (DEBOUNCED) ──
   প্রতিটা push-এ Render নতুন deploy নেয়, তাই প্রতি ক্লিকে push না করে
   শেষ সেভের ১৫ সেকেন্ড পরে একবারে (সর্বোচ্চ ৬০ সেকেন্ড অপেক্ষা করে)
   push করা হয় — ফলে deploy-thrash-এর ভিতরের সেভগুলো হারায় না। */
const pending = new Map();        // kind -> { timer, firstAt }
const busyKinds = new Set();      // এখন push চলছে
const reschedule = new Set();     // busy থাকায় শেষে আবার push করতে হবে
const dirtySinceBoot = new Set(); // boot-এর পরে সত্যিই কিছু সেভ হয়েছে কিনা
const lastPushedJson = new Map(); // repoPath -> সর্বশেষ সফল push-এর JSON

function schedulePush(kind, reason) {
  const cfg = KINDS[kind];
  if (!cfg) return;
  dirtySinceBoot.add(kind);
  // vault ফাইল কপি সাথে সাথেই লেখা হয় — PUSH-CONTENT.bat সর্বশেষ ডাটা পায়
  writeVault(kind).catch(() => {});
  // GitHub sync বন্ধ থাকলে (token নেই) শুধু ফাইল কপিই যথেষ্ট
  if (!gitAutoPush.enabled()) return;
  const now = Date.now();
  let st = pending.get(kind);
  if (!st) st = { firstAt: now, timer: null };
  if (st.timer) clearTimeout(st.timer);
  const wait = Math.max(0, Math.min(PUSH_DEBOUNCE_MS, st.firstAt + PUSH_MAX_WAIT_MS - now));
  st.timer = setTimeout(() => { pending.delete(kind); flushPush(kind).catch(() => {}); }, wait);
  pending.set(kind, st);
}

async function flushPush(kind) {
  const cfg = KINDS[kind];
  if (!cfg || !gitAutoPush.enabled()) return;
  if (busyKinds.has(kind)) { reschedule.add(kind); return; }
  busyKinds.add(kind);
  try {
    const payload = await collectPayload(kind);
    writeJsonFile(cfg.file, payload);
    const json = JSON.stringify(payload);
    // আগের push-এর পর কিছু বদলায়নি → অপ্রয়োজনীয় commit/deploy হয় না
    if (lastPushedJson.get(cfg.repoPath) === json) return;
    const r = await gitAutoPush.pushFile(cfg.repoPath, Buffer.from(json, 'utf8'),
      kind + ' vault: auto-save (' + new Date().toISOString() + ')');
    if (r.ok) {
      lastPushedJson.set(cfg.repoPath, json);
      console.log('✅ GitHub auto-push (' + kind + ') সফল — ' + cfg.repoPath + ' repo-তে স্থায়ী হয়েছে');
    } else {
      console.warn('⚠️  GitHub auto-push (' + kind + ') হয়নি: ' + r.reason + ' — self-heal sync আবার চেষ্টা করবে');
    }
  } catch (err) {
    console.error('⚠️  Vault push failed (' + kind + '):', err.message);
  } finally {
    busyKinds.delete(kind);
    if (reschedule.delete(kind)) flushPush(kind).catch(() => {});
  }
}

/* ── SELF-HEAL SYNC — প্রতি ৩ মিনিটে ──
   সেভের সময় push ব্যর্থ হলে (network down / GitHub rate-limit / restart-এর
   ঠিক আগে) ডাটা শুধু ephemeral DB-তে থেকে যেত — restart-এ হারিয়ে যেত।
   এই sync সেগুলো ধরে আবার push করে। Boot-এর পরে যেসব ডাটা বদলায়নি সেগুলো
   কখনো push হয় না (অপ্রয়োজনীয় deploy-loop ঠেকাতে)। */
let syncTimer = null;
function startPeriodicSync() {
  if (syncTimer) return;
  syncTimer = setInterval(async () => {
    for (const kind of Object.keys(KINDS)) {
      if (!dirtySinceBoot.has(kind)) continue;
      try { await flushPush(kind); } catch (_) {}
    }
  }, SYNC_INTERVAL_MS);
  if (syncTimer.unref) syncTimer.unref();
}

// boot-এ GitHub-এ যা আছে সেটাকেই "pushed" ধরা হয় — যাতে একই কনটেন্ট আবার
// push না করে অপ্রয়োজনীয় deploy তৈরি না হয়
async function initLastPushedFromRemote() {
  if (!gitAutoPush.enabled()) return;
  for (const kind of Object.keys(KINDS)) {
    try {
      const remote = await gitAutoPush.getRemoteJson(KINDS[kind].repoPath);
      if (remote !== null && remote !== undefined) {
        lastPushedJson.set(KINDS[kind].repoPath, JSON.stringify(remote));
      }
    } catch (_) {}
  }
}

// ── হোম পেজ কনটেন্টের snapshot (server.js-এর সেভ-হুক থেকে call হয়) ──
async function snapshotSiteContent() {
  try {
    const payload = await writeVault('content');
    schedulePush('content', 'home page content save');
    return payload;
  } catch (err) {
    console.error('⚠️  Content vault snapshot failed:', err.message);
    return null;
  }
}

// vault থেকে content restore (fresh deploy-এ DB খালি থাকলে)
async function restoreSiteContentFromVault() {
  // ১) GitHub-এর latest কনটেন্টই সবচেয়ে সঠিক — token থাকলে সেটা আগে চেষ্টা করি
  if (gitAutoPush.enabled()) {
    const remote = await gitAutoPush.getRemoteJson(gitAutoPush.VAULT_PATH);
    if (remote) {
      try {
        const payload = sanitizeSiteContent(remote);
        await SiteContent.findOneAndUpdate({}, payload, {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        });
        writeJsonFile(VAULT_FILE, payload);
        lastPushedJson.set(gitAutoPush.VAULT_PATH, JSON.stringify(payload));
        console.log('✅ Content restored from GitHub (latest committed content)');
        return true;
      } catch (err) {
        console.error('⚠️  GitHub vault restore failed:', err.message);
      }
    }
  }
  // ২) নাহলে committed vault ফাইল থেকে
  const snapshot = readJsonFile(VAULT_FILE);
  if (!snapshot) return false;
  try {
    const payload = sanitizeSiteContent(snapshot);
    await SiteContent.findOneAndUpdate({}, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    return true;
  } catch (err) {
    console.error('⚠️  Content vault restore failed:', err.message);
    return false;
  }
}

// কোর্স / রেজাল্ট — DB খালি হলে GitHub → committed ফাইল থেকে restore
async function restoreArrayFromVault(kind) {
  const cfg = KINDS[kind];
  try {
    const count = await cfg.model.countDocuments();
    if (count > 0) return 'db';
  } catch (err) {
    console.error('⚠️  Vault restore check failed (' + kind + '):', err.message);
    return 'db';
  }
  if (gitAutoPush.enabled()) {
    const remote = await gitAutoPush.getRemoteJson(cfg.repoPath);
    if (Array.isArray(remote) && remote.length) {
      await cfg.model.insertMany(remote);
      lastPushedJson.set(cfg.repoPath, JSON.stringify(remote));
      console.log('✅ ' + kind + ' restored from GitHub (' + remote.length + ' items)');
      return 'github';
    }
  }
  const local = readJsonFile(cfg.file);
  if (Array.isArray(local) && local.length) {
    await cfg.model.insertMany(local);
    lastPushedJson.set(cfg.repoPath, JSON.stringify(local));
    console.log('✅ ' + kind + ' restored from committed vault file (' + local.length + ' items)');
    return 'file';
  }
  return 'empty';
}

// boot-এ: content/courses/results — DB আছে → vault ফাইল refresh ; DB খালি → vault থেকে restore
async function ensureContentVault() {
  const existing = await SiteContent.findOne().lean();
  if (existing) {
    await writeVault('content');
  } else {
    const restored = await restoreSiteContentFromVault();
    if (!restored) {
      const payload = defaultSiteContent();
      await SiteContent.create(payload);
      writeJsonFile(VAULT_FILE, sanitizeSiteContent(payload));
    }
  }
  // কোর্স ও রেজাল্টও এখন vault-এ থাকে — restart-এ হারায় না
  await restoreArrayFromVault('courses');
  await restoreArrayFromVault('results');
  // সব vault ফাইল বর্তমান DB দিয়ে রিফ্রেশ (PUSH-CONTENT.bat-এর জন্য সর্বদা fresh)
  for (const kind of Object.keys(KINDS)) {
    try { await writeVault(kind); } catch (_) {}
  }
  await initLastPushedFromRemote();
}

module.exports = {
  snapshotSiteContent,
  restoreSiteContentFromVault,
  ensureContentVault,
  startPeriodicSync,
  schedulePush,
  VAULT_FILE,
  COURSES_FILE,
  RESULTS_FILE,
};
