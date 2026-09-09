/* ════════════════════════════════════════════════════════════════
   GITHUB AUTO-PUSH — Render-এর admin panel-এ সেভ করা সবকিছু
   (হোম পেজ কনটেন্ট + গ্যালারির ছবি) স্বয়ংক্রিয়ভাবে GitHub-এ জমা হয়।

   Render-এর disk সম্পূর্ণ ephemeral: নতুন deploy/restart-এ SQLite আর
   runtime-এ লেখা সব ফাইল মুছে যায়। তাই স্থায়ী স্টোরেজ হিসেবে GitHub
   repo-টাই ব্যবহার হয় — সেভ করলেই REST API দিয়ে commit হয়ে যায়, আর
   পরের deploy-এ boot-এর সময় GitHub থেকেই কনটেন্ট ফিরে আসে।

   Render env-এ দিতে হবে (একবারই):
     GIT_REPO_OWNER  = account/repo-র owner (যেমন: pbon99449-hub)
     GIT_REPO_NAME   = repo নাম (যেমন: softverseit)
     GIT_BRANCH      = master (বা যে branch-এ deploy হয়)
     GIT_PUSH_TOKEN  = fine-grained PAT (repo: Contents Read & Write)

   Token না বসানো থাকলে সব কাজ আগের মতোই চলে — শুধু GitHub sync বন্ধ থাকে।
   ════════════════════════════════════════════════════════════════ */

const REPO_OWNER = (process.env.GIT_REPO_OWNER || '').trim();
const REPO_NAME = (process.env.GIT_REPO_NAME || '').trim();
const GIT_TOKEN = (process.env.GIT_PUSH_TOKEN || '').trim();
const BRANCH = (process.env.GIT_BRANCH || 'master').trim();
const VAULT_PATH = 'admin-panel/content-vault/site-content.json';
const GALLERY_DIR_PREFIX = 'Images/gallery/';
const API_BASE = 'https://api.github.com';

const doFetch = (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function')
  ? globalThis.fetch.bind(globalThis)
  : null;

// token + repo তথ্য ঠিকঠাক থাকলে sync চালু
function enabled() {
  return Boolean(doFetch && GIT_TOKEN && REPO_OWNER && REPO_NAME);
}

function authHeaders(extra) {
  const h = {
    Authorization: 'token ' + GIT_TOKEN,
    'User-Agent': 'softverse-it-admin',
    Accept: 'application/vnd.github+json',
  };
  return Object.assign(h, extra || {});
}

function fileUrl(repoPath, ref) {
  return `${API_BASE}/repos/${encodeURIComponent(REPO_OWNER)}/${encodeURIComponent(REPO_NAME)}/contents/${repoPath.split('/').map(encodeURIComponent).join('/')}${ref ? '?ref=' + encodeURIComponent(ref) : ''}`;
}

// repoPath-এর ফাইলের বর্তমান sha (update করতে হলে লাগে); না থাকলে null
async function getFileSha(repoPath) {
  try {
    const res = await doFetch(fileUrl(repoPath, BRANCH), { headers: authHeaders() });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json && json.sha ? json.sha : null;
  } catch (_) {
    return null;
  }
}

// যেকোনো ফাইল repo-তে commit করে (create/update দুটোই)
// সফল: { ok: true }  ব্যর্থ: { ok: false, reason }
async function pushFile(repoPath, contentBuffer, message) {
  if (!enabled()) return { ok: false, reason: 'GitHub sync বন্ধ — Render env-এ GIT_PUSH_TOKEN বসানো হয়নি' };
  if (!contentBuffer) return { ok: false, reason: 'No content to push' };
  try {
    const body = {
      message: message || `auto-save: ${repoPath} (${new Date().toISOString()})`,
      content: Buffer.from(contentBuffer).toString('base64'),
      branch: BRANCH,
    };
    const sha = await getFileSha(repoPath);
    if (sha) body.sha = sha;

    const res = await doFetch(fileUrl(repoPath), {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`GitHub push HTTP ${res.status}: ${(json && json.message) || 'unknown error'}`);
    }
    return { ok: true };
  } catch (err) {
    console.error('⚠️  GitHub push failed (' + repoPath + '):', err.message);
    return { ok: false, reason: err.message };
  }
}

// হোম পেজ কনটেন্ট (vault JSON) GitHub-এ commit+push
async function pushContent(siteContentObj) {
  if (!siteContentObj || typeof siteContentObj !== 'object') {
    return { ok: false, reason: 'No content to push' };
  }
  const fileContent = JSON.stringify(siteContentObj, null, 2);
  return pushFile(VAULT_PATH, Buffer.from(fileContent, 'utf8'), `content-vault: auto-save (${new Date().toISOString()})`);
}

// গ্যালারির ছবি (buffer) GitHub-এর Images/gallery/ ফোল্ডারে commit
async function pushGalleryImage(fileName, contentBuffer) {
  const safe = String(fileName || '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!safe) return { ok: false, reason: 'Invalid image file name' };
  return pushFile(GALLERY_DIR_PREFIX + safe, contentBuffer, `gallery image: auto-save ${safe} (${new Date().toISOString()})`);
}

// GitHub-এ থাকা latest হোম পেজ কনটেন্ট (boot-এ restore-এর জন্য)
async function getLatestContent() {
  if (!enabled()) return null;
  try {
    const res = await doFetch(fileUrl(VAULT_PATH, BRANCH), { headers: authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error('⚠️  GitHub content GET failed (status ' + res.status + ')');
      return null;
    }
    const json = await res.json().catch(() => null);
    if (!json || !json.content) return null;
    const decoded = Buffer.from(String(json.content).replace(/\n/g, ''), 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    console.error('⚠️  GitHub content GET error:', err.message);
    return null;
  }
}

module.exports = { enabled, getLatestContent, pushContent, pushFile, pushGalleryImage, VAULT_PATH, BRANCH };
