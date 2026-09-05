/* ════════════════════════════════════════════════════════════════
   BACKUP / RESTORE — পুরো ডাটাবেজ একটা JSON ফাইলে নামানো ও ফেরানো।
   Render-এর মতো হোস্টিং-এ নতুন deploy হলে ডাটাবেজ মুছে যায় — তখন
   ব্যাকআপ ফাইল থেকে সব ডাটা এক ক্লিকে ফেরত আনা যায়।
   ════════════════════════════════════════════════════════════════ */
const Admin = require('../models/Admin');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const SiteContent = require('../models/SiteContent');
const Visit = require('../models/Visit');

// GET /api/backup — সব ডাটা JSON আকারে (শুধু লগইন করা অ্যাডমিন)
async function getBackup(req, res) {
  try {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      courses: await Course.find({}).lean(),
      enrollments: await Enrollment.find({}).lean(),
      results: await Result.find({}).lean(),
      siteContent: await SiteContent.findOne().lean(),
      visits: await Visit.find({}).lean(),
      // অ্যাডমিন অ্যাকাউন্টও রাখা হয় (পাসওয়ার্ড bcrypt-এ এনক্রিপ্টেড) —
      // রিস্টোরের পরে একই অ্যাকাউন্ট দিয়ে লগইন করা যায়।
      admins: await Admin.find({}).lean(),
    };
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// POST /api/backup/restore — ব্যাকআপ JSON থেকে সব ডাটা ফেরানো
async function restoreBackup(req, res) {
  try {
    const data = req.body || {};

    async function restoreCollection(Model, items, label) {
      if (!Array.isArray(items)) return 0;
      await Model.deleteMany({});
      const cleaned = items
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const { __v, ...rest } = item;
          return rest;
        });
      if (cleaned.length) await Model.insertMany(cleaned);
      return cleaned.length;
    }

    const counts = {};
    counts.courses = await restoreCollection(Course, data.courses);
    counts.enrollments = await restoreCollection(Enrollment, data.enrollments);
    counts.results = await restoreCollection(Result, data.results);
    counts.visits = await restoreCollection(Visit, data.visits);
    counts.admins = await restoreCollection(Admin, data.admins);

    if (data.siteContent && typeof data.siteContent === 'object') {
      await SiteContent.deleteMany({});
      const { _id, createdAt, updatedAt, __v, ...siteContent } = data.siteContent;
      await SiteContent.create(siteContent);
      counts.siteContent = 1;
    }

    res.json({ success: true, message: 'Backup restored successfully', data: counts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { getBackup, restoreBackup };
