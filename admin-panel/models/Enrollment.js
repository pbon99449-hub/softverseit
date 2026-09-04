const { defineModel } = require('../config/sqlite');

const Enrollment = defineModel({
  name: 'Enrollment',
  tableName: 'enrollments',
  defaults: {
    fullName: '',
    phone: '',
    age: '—',
    course: '',
    batch: '',
    day: '—',
    message: '—',
    status: 'pending',
    source: 'website',
  },
});

module.exports = Enrollment;
