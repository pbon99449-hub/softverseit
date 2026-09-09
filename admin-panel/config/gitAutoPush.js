/* ════════════════════════════════════════════════════════════════
   GITHUB AUTO-PUSH — সেভ করা হোম পেজ কনটেন্ট সরাসরি repository-তে commit

   Render-এর disk সম্পূর্ণ ephemeral: নতুন instance বুট করলে SQLite আর
   runtime-এ লেখা কোনো vault ফাইলও মুছে যায়। তাই "সেভ → পুশ করিনি" মানে
   পরের deploy-এ কনটেন্ট default হয়ে যাওয়া বাধ্যতামূলক।

   এই মডিউল GitHub REST API (Contents API) দিয়ে
   admin-panel/content-vault/site-content.json ফাইলটাকে সরাসরি repo-তে
   commit+push করে। ফলে সেভ করার সাথেসাথেই কনটেন্ট GitHub-এ চলে যায় —
   পরের যেকোনো deploy/spin-up-এ সেটাই ফিরে আসে। কোনো git client দরকার নেই,
   শুধু একটা fine-grained Personal Access Token, Render-এর env-এ বসানো।

   Render env-এ দিতে হবে:
     GIT_REPO_OWNER  = account/repo-র owner (যেমন: pbon99449-hub)
     GIT_REPO_NAME   = repo নাম (যেমন: softverseit)
     GIT_BRANCH      = master (বা যে branch-এ deploy হয়)
     GIT_PUSH_TOKEN  = fine-grained PAT (repo: Contents Read & Write)
   ════════════════════════════════════════════════════════════════ */

const REPO_OWNER = (process.env.GIT_REPO_OWNER || '').trim();
const REPO_NAME = (process.env.GIT_REPO_NAME || '').trim();
const GIT_TOKEN = (process.env.GIT_PUSH_TOKEN || '').trim();
const BRANCH = (process.env.GIT_BRANCH || 'master').trim();
const VAULT_PATH = 'admin-panel/content-vault/site-content.json';
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

function vaultUrl(ref) {
  return `${API_BASE}/repos/${encodeURIComponent(REPO_OWNER)}/${encodeURIComponent(REPO_NAME)}/contents/${VAULT_PATH}?ref=${encodeURIComponent(ref)}`;
}

// GitHub-এ থাকা latest content (fresh boot-এ restore-এর জন্য)
async function getLatestContent() {
  if (!enabled()) return null;
  try {
    const res = await doFetch(vaultUrl(BRANCH), { headers: authHeaders() });
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

async function getCurrentSha() {
  try {
    const res = await doFetch(vaultUrl(BRANCH), { headers: authHeaders() });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json && json.sha ? json.sha : null;
  } catch (_) {
    return null;
  }
}

// site-content object-টা GitHub-এ commit+push
// সফল: { ok: true }  ব্যর্থ: { ok: false, reason }
async function pushContent(siteContentObj) {
  if (!enabled()) {
    return { ok: false, reason: 'GitHub sync বন্ধ — GIT_PUSH_TOKEN set করা হয়নি' };
  }
  if (!siteContentObj || typeof siteContentObj !== 'object') {
    return { ok: false, reason: 'No content to push' };
  }
  try {
    const fileContent = JSON.stringify(siteContentObj, null, 2);
    const body = {
      message: `content-vault: auto-save (${new Date().toISOString()})`,
      content: Buffer.from(fileContent, 'utf8').toString('base64'),
      branch: BRANCH,
    };
    const sha = await getCurrentSha();
    if (sha) body.sha = sha;

    const url = `${API_BASE}/repos/${encodeURIComponent(REPO_OWNER)}/${encodeURIComponent(REPO_NAME)}/contents/${VAULT_PATH}`;
    const res = await doFetch(url, {
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
    console.error('⚠️  GitHub push failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

module.exports = { enabled, getLatestContent, pushContent, VAULT_PATH, BRANCH };