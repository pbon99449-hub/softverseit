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

// ── কোন branch-এ content যাবে ──
// GIT_BRANCH env → origin/HEAD যে branch দেখায় → 'master'
async function deployBranch() {
  const envBranch = String(process.env.GIT_BRANCH || '').trim();
  if (envBranch) return envBranch;
  const r = await run(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (r.ok && r.out) return String(r.out).replace(/^origin\//, '').trim() || 'master';
  return 'master';
}

// ── আগের কোনো `git pull --rebase` মাঝপথে আটকে গেছে কিনা ──
// এই অবস্থায় HEAD detached থাকে → `git push origin HEAD` ব্যর্থ হয় →
// সেভ করা কনটেন্ট GitHub-এ যেত না → deployed হোম পেজ আপডেট দেখত না।
function rebaseStuck() {
  const dotGit = path.join(ROOT, '.git');
  try {
    return fs.existsSync(path.join(dotGit, 'rebase-merge')) || fs.existsSync(path.join(dotGit, 'rebase-apply'));
  } catch (_) { return false; }
}

// আটকে থাকা rebase-এর সব commit কি শুধু auto-save (content) commit?
// হলে abort করা নিরাপদ — আসল কনটেন্ট SQLite DB-তে থাকে এবং পরের
// snapshot থেকে vault ফাইল আবার নতুন করে লেখা হয়।
function stuckRebaseOnlyAutoSaves() {
  try {
    const dir = path.join(ROOT, '.git', 'rebase-merge');
    const todo = fs.readFileSync(path.join(dir, 'git-rebase-todo'), 'utf8');
    const done = fs.readFileSync(path.join(dir, 'done'), 'utf8');
    const picks = (todo + '\n' + done).split(/\r?\n/).filter((l) => /^pick\s/i.test(l));
    return picks.length > 0 && picks.every((l) => /content save \(auto\)/i.test(l));
  } catch (_) { return false; }
}

// আটকে থাকা rebase থেকে বের হওয়া — সফল: true, ব্যর্থ: false
async function recoverStuckRebase() {
  if (!enabled() || !rebaseStuck()) return true;
  if (stuckRebaseOnlyAutoSaves()) {
    const ab = await run(['rebase', '--abort']);
    if (ab.ok) {
      console.warn('⚠️  Auto-push: আটকে থাকা git rebase বাতিল করা হলো (সব সেভ করা কনটেন্ট DB-তে নিরাপদ — vault আবার লেখা হবে)');
      return true;
    }
    console.warn('⚠️  Auto-push: আটকে থাকা rebase বাতিল ব্যর্থ — ' + ab.err.split('\n')[0]);
    return false;
  }
  console.warn('⚠️  Auto-push: git rebase আটকে আছে (non-auto commit-সহ) — `git status` দেখে manually শেষ করুন। কনটেন্ট DB-তে সেভ আছে, GitHub sync এখন হবে না।');
  return false;
}

// সেভের পরে call হয় — সব পরিবর্তন commit + push (ফায়ার-অ্যান্ড-ফরগেট)
function pushChanges(reason) {
  if (!enabled()) return;
  chain = chain.then(() => doPush(reason)).catch(() => {});
  return chain;
}

async function doPush(reason) {
  try {
    // আটকে থাকা rebase আগে সামলাই — নাহলে commit/push দুটোই ভুল জায়গায় যায়
    if (!(await recoverStuckRebase())) return;
    const branch = await deployBranch();

    await run(['add', '-A']);
    // সত্যিই কিছু বদলেছে কিনা — না বদলে থাকলে commit/push-এর দরকার নেই
    const status = await run(['status', '--porcelain']);
    if (!status.ok) { console.warn('⚠️  Auto-push: git status ব্যর্থ — ' + status.err.split('\n')[0]); return; }
    if (!status.out) return;

    const msg = 'content save (auto): ' + (reason || 'home page content update') + ' — ' + new Date().toISOString();
    const commit = await run(['commit', '-m', msg]);
    if (!commit.ok) {
      console.warn('⚠️  Auto-push: commit হয়নি — ' + commit.err.split('\n')[0]);
      return;
    }
    // refspec সহ push — detached HEAD-এও (রিবেজ চলাকালীন) কাজ করে
    const push = await run(['push', 'origin', 'HEAD:refs/heads/' + branch]);
    if (push.ok) {
      console.log('✅ Auto-push সফল — সেভ করা কনটেন্ট GitHub-এ backup হয়েছে (' + branch + ')');
    } else if (/non-fast-forward|rejected|fetch first|behind/i.test(push.err)) {
      console.warn('⚠️  Auto-push: GitHub-এর master এগিয়ে আছে — PUSH-CONTENT.bat চালান বা manually `git pull --rebase origin ' + branch + '` করে আবার সেভ করুন। কনটেন্ট DB-তে নিরাপদ আছে।');
    } else {
      console.warn('⚠️  Auto-push: GitHub-এ push হয়নি — ' + push.err.split('\n')[0] + ' (PUSH-CONTENT.bat দিয়ে ম্যানুয়ালি চেষ্টা করুন)');
    }
  } catch (err) {
    console.warn('⚠️  Auto-push ব্যর্থ: ' + (err && err.message));
  }
}

module.exports = { pushChanges, enabled, recoverStuckRebase, rebaseStuck, deployBranch };
