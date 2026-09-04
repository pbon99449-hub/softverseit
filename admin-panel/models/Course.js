const crypto = require('crypto');
const { defineModel } = require('../config/sqlite');

// String _id so seeded ids like 'basic', 'kid' work with the admin panel's PUT /api/courses/:id
const genId = () => crypto.randomBytes(12).toString('hex');

const Course = defineModel({
  name: 'Course',
  tableName: 'courses',
  defaults: {
    _id: genId,
    name: '',
    category: '',
    duration: '',
    teacher: '',
    batch: '',
    status: 'open',
    price: '',
    body: '',
    level: '',
    date: '',
    time: '',
  },
});

module.exports = Course;
