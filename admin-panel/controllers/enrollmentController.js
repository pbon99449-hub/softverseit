const Enrollment = require('../models/Enrollment');

// GET /api/enrollments  (supports ?search=&status=&course=&page=&limit=)
async function list(req, res) {
  try {
    const { search = '', status = '', course = '', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (course) filter.course = course;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);

    const [items, total] = await Promise.all([
      Enrollment.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Enrollment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// POST /api/enrollments  — public, called from the main website's enroll form
async function create(req, res) {
  try {
    const { fullName, phone, age, course, batch, education, message } = req.body;
    if (!fullName || !phone || !course || !batch) {
      return res.status(400).json({ success: false, message: 'fullName, phone, course and batch are required' });
    }
    const enrollment = await Enrollment.create({
      fullName, phone, age, course, batch, day: education, message,
    });
    res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// PATCH /api/enrollments/:id/status
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'contacted', 'enrolled', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
    }
    const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.json({ success: true, data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// PUT /api/enrollments/:id
async function update(req, res) {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.json({ success: true, data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// DELETE /api/enrollments/:id
async function remove(req, res) {
  try {
    const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.json({ success: true, message: 'Enrollment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { list, create, updateStatus, update, remove };
