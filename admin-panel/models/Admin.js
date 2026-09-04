const bcrypt = require('bcryptjs');
const { defineModel } = require('../config/sqlite');

// Password hashing (was a Mongoose pre-save hook)
async function hashPassword(data) {
  if (typeof data.password === 'string' && data.password.length >= 6 && !data.password.startsWith('$2')) {
    data.password = await bcrypt.hash(data.password, 10);
  }
}

const Admin = defineModel({
  name: 'Admin',
  tableName: 'admins',
  defaults: {
    name: '',
    email: '',
    password: '',
    role: 'admin',
  },
  uniqueChecks: [{ fields: ['email'] }],
  hooks: { beforeSave: hashPassword },
});

module.exports = Admin;
