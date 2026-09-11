# Content Vault (deploy-safe home page content)

Render / Vercel / Netlify-র মতো হোস্টিং-এ server-এর ডিস্কে লেখা যেকোনো
ফাইল (SQLite DB, upload করা ছবি) **নতুন deploy বা restart-এ মুছে যায়**।

এই ফোল্ডারে থাকা `site-content.json`-এ **প্রতিবার সেভের পর** হোম পেজের
পুরো কনটেন্ট (stats, reviews, videos, gallery, ticker, heroChip,
footer, popup) এর **কপি** লেখা হয়। এই ফোল্ডারটা git-এ থাকে,
তাই কনটেন্ট হারায় না:

- সার্ভার চালু হওয়ার সময় DB খালি পেলে এই ফাইল থেকে কনটেন্ট **স্বয়ংক্রিয়ভাবে restore** হয়।
- কনটেন্ট GitHub-এ পাঠাতে চাইলে প্রজেক্টের রুটে থাকা **PUSH-CONTENT.bat** চালান —
  এটা এই ফাইলসহ সবকিছু commit + push করে দেয়।

কনটেন্ট ম্যানেজ করা হয় admin panel-এর **"হোম পেজ কনটেন্ট"** ও
**"ফুটার এডিট"** পেজ থেকে — সেভ হওয়া মাত্রই হোমপেজে রিয়েল-টাইমে দেখা যায়।

তাই GitHub-এ push করলে পরের deploy-এ সার্ভার চালু হওয়ার সময়
**DB খালি পেলে এই ফাইল থেকেই সব কনটেন্ট ফেরত আনা হয়** — কখনো হারায় না।

## ⭐ সুপার-সহজ পদ্ধতি (সবচেয়ে ভালো): GitHub AUTO-SYNC

সার্ভার নিজেই সেভ করা কনটেন্ট **সাথে সাথেই GitHub-এ commit+push** করে দেয়।
তখন শুধু admin-panel-এ Save চাপলেই কাজ শেষ — আর কিছুই করতে হয় না।
কনটেন্ট GitHub-এ থাকা পর্যন্ত Render যতবার restart/redeploy হোক, কনটেন্ট ফিরবেই।

### একবার সেটআপ করুন (৫ মিনিট)

1. **GitHub token বানান:**
   GitHub → আপনার profile → **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token** → Repository-তে
   **softverseit** select করুন → Permissions-এ **Contents: Read and write**
   দিন → Generate। (টোকেনটা কপি করে রাখুন — আর দেখানো হবে না!)
2. **Render-এ env ভেরিয়েবল বসান:**
   Render Dashboard → আপনার **Service → Environment** → **Add Environment Variable**:
   - `GIT_REPO_OWNER` = `pbon99449-hub`
   - `GIT_REPO_NAME`  = `softverseit`
   - `GIT_BRANCH`     = `master`
   - `GIT_PUSH_TOKEN` = ধাপ ১-এর টোকেন
3. **Redeploy** করে admin panel-এ প্রবেশ করুন — "হোম পেজ কনটেন্ট" পেজে
   **🟢 GitHub auto-sync চালু** ব্যাজ দেখালেই বুঝবেন সব ঠিকঠাক।
4. এখন থেকে **যতবার কনটেন্ট বদলাবেন, শুধু Save চাপুন** — GitHub-এ backup
   হয়ে যাবে। Render-এ redeploy-ত্তরও কনটেন্ট ঠিকই থাকবে।

> টোকেন ছাড়া চললে (রিলিজ/লোকাল): Save-এর পরে project folder-এ
> **`PUSH-CONTENT.bat`** চালান, তারপর redeploy করুন। এতে GitHub-এ
> গেলেই কনটেন্ট permanent। ব্যাজে 🟠 দেখালে এই ম্যানুয়াল পদ্ধতিটা ব্যবহার করুন।

## গ্যালারির ছবি

Admin-এ আপলোড করা নতুন ছবি `Images/gallery/`-এ (repo-root, git-tracked)
সেভ হয় — তাই redeploy-এর পরেও ছবি টিকে থাকে এবং হোমপেজে ছবি ভাঙে না।

## কোর্স ও রেজাল্টও এখন vault-এ থাকে

Admin-এ সেভ করা **কোর্স** (`courses.json`) ও **রেজাল্ট** (`results.json`) ও
একই ভাবে vault + GitHub-এ যায়। Render-এ restart/redeploy-তে ephemeral disk
মুছে গেলে boot-এর সময় DB খালি পেলে এই ফাইলগুলো থেকে সব ফিরে আসে —
তাই কোর্স/রেজাল্ট আর কখনো default seed-এ ফিরে যায় না।

## Smart sync (deploy-thrash ও ব্যর্থ push থেকে সুরক্ষা)

- **Debounced push:** প্রতি সেভে সাথে সাথে push না করে শেষ সেভের ১৫ সেকেন্ড
  পরে একসাথে push হয় (সর্বোচ্চ ৬০ সেকেন্ড অপেক্ষা)। কারণ প্রতিটা push-এ
  Render নতুন deploy নেয় — প্রতি ক্লিকে push করলে deploy-এর ভিতরে করা
  পরের সেভগুলো হারাতে পারে।
- **Self-heal sync:** প্রতি ৩ মিনিটে চেক করা হয় — কোনো সেভের push ব্যর্থ
  হয়ে থাকলে (network / GitHub rate-limit) আবার push করা হয়।
- **অপ্রয়োজনীয় deploy নেই:** boot-এ GitHub-এ যা থাকে সেটাই baseline —
  একই কনটেন্ট আবার push করে deploy-loop তৈরি হয় না।
- সময়গুলো Render env-এ `GIT_PUSH_DEBOUNCE_MS`, `GIT_PUSH_MAX_WAIT_MS`,
  `GIT_SYNC_INTERVAL_MS` দিয়ে বদলানো যায়।