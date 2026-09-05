const crypto = require('crypto');

/* ── Central JWT secret ──
   JWT_SECRET সবসময় .env-এ রাখবেন (.env কখনো GitHub-এ push হয় না)।
   .env হারিয়ে গেলে বা না থাকলে এই রানের জন্য random secret তৈরি হবে —
   যা কেউ অনুমান/জাল করতে পারবে না। তবে সার্ভার রিস্টার্টে সব সেশন
   বাতিল হয়ে যাবে (সবাইকে আবার লগইন করতে হবে)। */
let secret = process.env.JWT_SECRET;
if (!secret) {
  console.warn('⚠️  JWT_SECRET .env-এ নেই — এই রানের জন্য temporary random secret ব্যবহার হচ্ছে।');
  console.warn('   স্থায়ী সমাধান: admin-panel/.env ফাইলে JWT_SECRET=<লম্বা র‍্যান্ডম স্ট্রিং> যোগ করুন।');
  secret = crypto.randomBytes(48).toString('hex');
}

module.exports = secret;
