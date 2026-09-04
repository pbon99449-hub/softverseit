// Run once with: npm run seed
// Creates the first admin account from the values in .env (ADMIN_NAME/EMAIL/PASSWORD)
require('dotenv').config();
const connectDB = require('./config/db');
const Admin = require('./models/Admin');

async function seed() {
  await connectDB();

  const name = process.env.ADMIN_NAME || 'Super Admin';
  const email = (process.env.ADMIN_EMAIL || 'admin@softverseit.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

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
