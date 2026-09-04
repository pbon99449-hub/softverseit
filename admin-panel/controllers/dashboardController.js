const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const Visit = require('../models/Visit');
const { localDateStr } = require('./visitController');

// GET /api/dashboard/stats
async function stats(req, res) {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalEnrollments,
      pendingEnrollments,
      enrolledCount,
      monthEnrollments,
      totalResults,
      passCount,
      failCount,
      recentEnrollments,
      recentResults,
    ] = await Promise.all([
      Enrollment.countDocuments(),
      Enrollment.countDocuments({ status: 'pending' }),
      Enrollment.countDocuments({ status: 'enrolled' }),
      Enrollment.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Result.countDocuments(),
      Result.countDocuments({ result: 'Pass' }),
      Result.countDocuments({ result: 'Fail' }),
      Enrollment.find().sort({ createdAt: -1 }).limit(5),
      Result.find().sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      success: true,
      data: {
        totalEnrollments,
        pendingEnrollments,
        enrolledCount,
        monthEnrollments,
        totalResults,
        passCount,
        failCount,
        recentEnrollments,
        recentResults,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// GET /api/dashboard/visits?days=14 — daily website visit counts for the
// dashboard's realtime line chart. The series starts from the FIRST recorded
// visit day (e.g. tracking began on 02/09/2026 → chart starts there) and
// grows one day at a time. `days` only caps the window for very long histories.
async function visits(req, res) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);

    // Today in BANGLADESH (Asia/Dhaka) time.
    const todayStr = localDateStr();
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const today = new Date(Date.UTC(ty, tm - 1, td));

    // প্রথম রেকর্ড হওয়া ভিজিটের তারিখ — চার্ট সেদিন থেকেই শুরু হবে।
    const first = await Visit.findOne({}).sort({ date: 1 });
    let startDate = today;
    if (first && first.date) {
      const [fy, fm, fd] = String(first.date).split('-').map(Number);
      startDate = new Date(Date.UTC(fy, fm - 1, fd));
    }

    // `days`-এর বেশি পুরোনো হিস্ট্রি হলে শুধু সাম্প্রতিক `days` দিন দেখাই।
    const minStart = new Date(today);
    minStart.setUTCDate(minStart.getUTCDate() - (days - 1));
    if (startDate < minStart) startDate = minStart;

    // startDate → আজ পর্যন্ত তারিখের তালিকা (পুরোনো → নতুন)।
    const dates = [];
    for (const cursor = new Date(startDate); cursor <= today; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cursor.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }

    const rows = await Visit.find({ date: { $gte: dates[0] } });
    const map = {};
    rows.forEach(r => { map[r.date] = Number(r.count) || 0; });

    const series = dates.map(date => ({ date, count: map[date] || 0 }));
    const sum = list => list.reduce((acc, s) => acc + s.count, 0);
    const todayCount = map[todayStr] || 0;

    res.json({
      success: true,
      data: {
        series,
        todayCount,
        total: sum(series),
        last7: sum(series.slice(-7)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { stats, visits };
