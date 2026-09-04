const Course = require('../models/Course');

// Seed data — inserted automatically when the collection is empty,
// so the admin panel always starts with the same 6 courses as the homepage.
const seedCourses = [
  { _id: 'basic', name: 'বেসিক কম্পিউটার', category: 'Computer Skills', duration: '৩ মাস', teacher: 'Abid Hasan', batch: 'সকাল / বিকেল / সন্ধ্যা', status: 'open', price: '৳ 3000', body: 'MS Office, ইন্টারনেট, ফাইল ম্যানেজমেন্ট এবং ডিজিটাল লিটারেসির সম্পূর্ণ কোর্স।', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '২৯ মার্চ, ২০২৬', time: 'সকাল / বিকেল / সন্ধ্যা' },
  { _id: 'kid', name: 'কিডস কম্পিউটার', category: 'For Kids', duration: '২ মাস', teacher: 'Abid Hasan', batch: 'বিকেল (১টা – ৩টা)', status: 'open', price: '৳ 2500', body: 'কম্পিউটার পরিচিতি, হার্ডওয়্যার পরিচিতি, Ms Paint etc.', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '০১ এপ্রিল, ২০২৬', time: 'বিকেল / সন্ধ্যা' },
  { _id: 'graphic', name: 'গ্রাফিক ডিজাইন', category: 'Design', duration: '৩ মাস', teacher: 'Niloy Haldar', batch: 'সন্ধ্যা (৩টা – ৫টা)', status: 'open', price: '৳ 4500', body: 'Photoshop, Illustrator, AI ও ব্র্যান্ড আইডেন্টিটি ডিজাইনের সম্পূর্ণ গাইড।', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '২৯ মার্চ, ২০২৬', time: 'সকাল / বিকেল' },
  { _id: 'skill-boost', name: 'স্কিল বুস্ট', category: 'Skill Boost', duration: '১ মাস', teacher: 'Abid Hasan', batch: 'সন্ধ্যা (৫টা – ৭টা)', status: 'open', price: '৳ 2200', body: 'MS Office, টাইপিং etc.', level: 'সপ্তাহে ৭ দিন ক্লাস', date: '০৫ এপ্রিল, ২০২৬', time: 'সন্ধ্যা' },
  { _id: 'ielts', name: 'IELTS প্রেক্টিস', category: 'Language', duration: '১ মাস', teacher: 'Niloy Haldar', batch: 'বিকেল (১টা – ৩টা)', status: 'open', price: '৳ 2600', body: 'টাইপিং, Software Practice', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '০১ এপ্রিল, ২০২৬', time: 'বিকেল / সন্ধ্যা' },
  { _id: 'ict-practice', name: 'ICT প্রেক্টিস', category: 'Practice', duration: '২ মাস', teacher: 'Abid Hasan', batch: 'দুপুর (১১টা – ১টা)', status: 'open', price: '৳ 3200', body: 'HTML Advance, CSS, C Language, Projects', level: 'সপ্তাহে ৩ দিন ক্লাস', date: '০৫ এপ্রিল, ২০২৬', time: 'সকাল / বিকেল' },
];

async function seedIfEmpty() {
  try {
    const count = await Course.countDocuments();
    if (count === 0) {
      await Course.insertMany(seedCourses);
      console.log('Seeded default courses (6)');
    }
  } catch (err) {
    console.error('Course seeding failed:', err.message);
  }
}
seedIfEmpty();

// GET /api/courses — public (main website reads these to render its cards)
async function list(req, res) {
  try {
    const items = await Course.find().sort({ createdAt: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// POST /api/courses — protected (admin panel)
async function create(req, res) {
  try {
    const course = await Course.create(req.body || {});
    res.status(201).json({ success: true, data: course });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// PUT /api/courses/:id — protected (admin panel "সেভ করুন" button)
async function update(req, res) {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body || {}, {
      new: true,
      runValidators: true,
    });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, data: course });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// DELETE /api/courses/:id — protected (admin panel)
async function remove(req, res) {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { list, create, update, remove };
