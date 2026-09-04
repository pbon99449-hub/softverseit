const { defineModel } = require('../config/sqlite');

const Result = defineModel({
  name: 'Result',
  tableName: 'results',
  defaults: {
    name: '',
    father: '—',
    mother: '—',
    course: '',
    batch: '',
    roll: '',
    registration: '',
    courseStart: '',
    courseFinish: '',
    typing: 0,
    msWord: 0,
    msExcel: 0,
    msPowerPoint: 0,
    viva: 0,
    total: 0,
    grade: '—',
    result: 'Pass',
  },
  // unique composite index: roll + registration → duplicate throws code 11000
  uniqueChecks: [{ fields: ['roll', 'registration'] }],
});

module.exports = Result;
