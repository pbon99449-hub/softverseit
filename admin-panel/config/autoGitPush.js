/* ════════════════════════════════════════════════════════════════
   AUTO GIT PUSH — admin panel-এ সেভ করা কনটেন্ট স্বয়ংক্রিয়ভাবে GitHub-এ

   Admin panel-এ "সংরক্ষণ করুন" চাপলে কনটেন্ট SQLite DB + content-vault
   ফাইলে সেভ হয়। এই মডিউলটি সেই সেভের পরপরই local git দিয়ে
   commit + push করে দেয় — ফলে কনটেন্ট + নতুন গ্যালারির ছবি
   স্বয়ংক্রিয়ভাবে GitHub-এ backup হয় এবং Render-এ redeploy করলেও
   সব ফিরে আসে। কোনো ম্যানুয়াল কাজ (PUSH-CONTENT.bat) লাগে না।

   নোট:
   - শুধু লোকাল PC-তে চলে (প্রজেক্ট রুটে .git ফোল্ডার থাকলে)।
     Render-এর মতো deployed server-এ .git থাকে না → নীরবে skip হয়।
   - push ব্যর্থ হলেও সেভ ঠিকই কাজ করে — শুধু console-এ warning যায়।
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// প্রজেক্ট রুট (admin-panel-এর এক লেভেল উপরে) — সেখানেই .git আছে
const ROOT = path.join(__dirname, '..', '..');

let chain = Promise.resolve();   // একসাথে অনেক সেভ এলে পরপর চালানো হয়

function run(args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: ROOT, windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || '').trim(), err: err ? String(err.message || stderr || '') : '' });
    });
  });
}

// লোকাল পরিবেশে আছি কিনা (deployed server-এ .git থাকে না)
function enabled() {
  try { return fs.existsSync(path.join(ROOT, '.git')); }
  catch (_) { return false; }
}

// সেভের পরে call হয় — সব পরিবর্তন commit + push (ফায়ার-অ্যান্ড-ফরগেট)
function pushChanges(reason) {
  if (!enabled()) return;
  chain = chain.then(() => doPush(reason)).catch(() => {});
  return chain;
}

async function doPush(reason) {
  try {
    await run(['add', '-A']);
    // সত্যিই কিছু বদলেছে কিনা — না বদলে থাকলে commit/push-এর দরকার নেই
    const status = await run(['status', '--porcelain']);
    if (!status.ok || !status.out) return;

    const msg = 'content save (auto): ' + (reason || 'home page content update') + ' — ' + new Date().toISOString();
    const commit = await run(['commit', '-m', msg]);
    if (!commit.ok) {
      console.warn('⚠️  Auto-push: commit হয়নি — ' + commit.err.split('\n')[0]);
      return;
    }
    const push = await run(['push', 'origin', 'HEAD']);
    if (push.ok) {
      console.log('✅ Auto-push সফল — সেভ করা কনটেন্ট GitHub-এ backup হয়েছে');
    } else {
      console.warn('⚠️  Auto-push: GitHub-এ push হয়নি — ' + push.err.split('\n')[0] + ' (PUSH-CONTENT.bat দিয়ে ম্যানুয়ালি চেষ্টা করুন)');
    }
  } catch (err) {
    console.warn('⚠️  Auto-push ব্যর্থ: ' + (err && err.message));
  }
}

module.exports = { pushChanges, enabled };
