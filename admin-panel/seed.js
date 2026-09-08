// Run once with: npm run seed
// Creates the first admin account from the values in .env (ADMIN_NAME/EMAIL/PASSWORD)
require('dotenv').config();
const connectDB = require('./config/db');
const Admin = require('./models/Admin');

async function seed() {
  await connectDB();

  // নিরাপত্তা: ডিফল্ট ক্রেডেনশিয়াল নেই — .env-এ ADMIN_EMAIL/ADMIN_PASSWORD
  // না থাকলে seed হবে না (যাতে পরিচিত/অনুমানযোগ্য অ্যাকাউন্ট তৈরি না হয়)।
  const name = process.env.ADMIN_NAME || 'Super Admin';
  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.error('\u274c admin-panel/.env file-e ADMIN_EMAIL ar ADMIN_PASSWORD set korun - seed bondho.');
    process.exit(1);
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`ℹ️ Admin with email "${email}" already exists. Skipping.`);
    process.exit(0);
  }

  const admin = await Admin.create({ name, email, password, role: 'superadmin' });
  console.log('✅ Admin account created:');
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Password: ${password}`);
  console.log('   ⚠️  Please log in and change this password immediately.');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
