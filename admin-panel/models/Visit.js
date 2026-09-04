const { defineModel } = require('../config/sqlite');

// One row per day: { date: 'YYYY-MM-DD', count: <total visits that day> }
const Visit = defineModel({
  name: 'Visit',
  tableName: 'visits',
  defaults: {
    date: '',
    count: 0,
  },
  // one document per calendar day → duplicate throws code 11000
  uniqueChecks: [{ fields: ['date'] }],
});

module.exports = Visit;