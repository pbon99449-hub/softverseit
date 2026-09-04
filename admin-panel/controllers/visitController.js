const Visit = require('../models/Visit');

// Bangladesh (Asia/Dhaka) calendar date — visit days follow BD time, not UTC.
const DHAKA_TZ = 'Asia/Dhaka';
const dhakaDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: DHAKA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

// Returns 'YYYY-MM-DD' in Asia/Dhaka time (en-CA locale formats as YYYY-MM-DD).
function localDateStr(d = new Date()) {
  return dhakaDateFmt.format(d instanceof Date ? d : new Date(d));
}

// POST /api/visits — PUBLIC. Called by the main website once per visitor
// session; increments today's counter for the dashboard's daily visits chart.
async function record(req, res) {
  try {
    const date = localDateStr();
    const existing = await Visit.findOne({ date });
    if (existing) {
      existing.count = (Number(existing.count) || 0) + 1;
      await existing.save();
    } else {
      await Visit.create({ date, count: 1 });
    }
    res.json({ success: true });
  } catch (_) {
    // Visit tracking must NEVER break the visitor's page — always answer OK.
    res.json({ success: true });
  }
}

module.exports = { record, localDateStr };