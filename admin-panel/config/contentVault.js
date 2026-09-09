/* ════════════════════════════════════════════════════════════════
   CONTENT VAULT — হোম পেজ কনটেন্টের স্থায়ী (deploy-safe) কপি

   সমস্যা:
   Render-এর মতো PaaS হোস্টিং-এ admin-panel/data/softverse.sqlite আর
   admin-panel/public/uploads/ থাকে SERVER-এর ephemeral filesystem-এ —
   নতুন deploy/restart-এর সাথে সাথে মুছে যায়। তাই admin প্যানেল থেকে
   সেভ করা হোম পেজ কনটেন্ট পরের deploy-এ হারিয়ে যেত।

   সমাধান:
   প্রতিবার সফল সেভের পর পুরো site-content একটা JSON ফাইলে লেখা হয় —
   admin-panel/content-vault/site-content.json (এই ফোল্ডারটা git-এ ওঠে)।
   সার্ভার চালু হলে DB খালি পেলে এই ফাইল থেকেই কনটেন্ট ফেরত আনা হয়।
   তাই কনটেন্ট সেভের পর শুধু PUSH-CONTENT.bat চালিয়ে push করলে
   পরের deploy-এ সেই কনটেন্ট সবাই দেখবে। আর কখনো লুকানো/হারানো যায় না।
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const SiteContent = require('../models/SiteContent');
const { defaultSiteContent, sanitizeSiteContent } = require('../controllers/siteContentController');

// এই ফাইলটা git-এ থাকবে (gitignore-এ নেই) — deploy-safe স্টোরেজ।
const VAULT_FILE = path.join(__dirname, '..', 'content-vault', 'site-content.json');

function ensureVaultDir() {
  fs.mkdirSync(path.dirname(VAULT_FILE), { recursive: true });
}

function readVaultFile() {
  try {
    if (!fs.existsSync(VAULT_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeVaultFile(content) {
  try {
    ensureVaultDir();
    const tmp = VAULT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(content, null, 2), 'utf8');
    fs.renameSync(tmp, VAULT_FILE);
    return true;
  } catch (err) {
    console.error('⚠️  Content vault write failed:', err.message);
    return false;
  }
}

// DB-র বর্তমান কনটেন্ট vault ফাইলে লিখে দেয় (প্রতিটি সফল সেভের পরে call হয়)
async function snapshotSiteContent() {
  try {
    const existing = await SiteContent.findOne().lean();
    const payload = sanitizeSiteContent(existing || defaultSiteContent());
    writeVaultFile(payload);
    return payload;
  } catch (err) {
    console.error('⚠️  Content vault snapshot failed:', err.message);
    return null;
  }
}

// vault ফাইল থেকে কনটেন্ট restore (fresh deploy-এ DB খালি থাকলে)
async function restoreSiteContentFromVault() {
  const snapshot = readVaultFile();
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

// boot-এ: DB আছে → vault ফাইল refresh ; DB খালি → vault থেকে restore
async function ensureContentVault() {
  const existing = await SiteContent.findOne().lean();
  if (existing) {
    await snapshotSiteContent();
    return;
  }
  const restored = await restoreSiteContentFromVault();
  if (!restored) {
    const payload = defaultSiteContent();
    await SiteContent.create(payload);
    writeVaultFile(sanitizeSiteContent(payload));
  }
}

module.exports = { snapshotSiteContent, restoreSiteContentFromVault, ensureContentVault, VAULT_FILE };