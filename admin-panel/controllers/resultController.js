const Result = require('../models/Result');

// GET /api/results (supports ?search=&course=&result=&page=&limit=)
async function list(req, res) {
  try {
    const { search = '', course = '', result = '', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (course) filter.course = course;
    if (result) filter.result = result;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { roll: { $regex: search, $options: 'i' } },
        { registration: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);

    const [items, total] = await Promise.all([
      Result.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Result.countDocuments(filter),
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

// GET /api/results/public?roll=&reg=  — public, used by result.html on main site
async function getByRollAndReg(req, res) {
  try {
    const { roll, reg } = req.query;
    if (!roll || !reg) {
      return res.status(400).json({ success: false, message: 'roll and reg are required' });
    }
    const result = await Result.findOne({ roll: roll.trim(), registration: reg.trim() });
    if (!result) {
      return res.json({ success: false, message: 'Result not found. Please check your Roll and Registration Number.' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// POST /api/results
async function create(req, res) {
  try {
    const result = await Result.create(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A result with this Roll & Registration already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// PUT /api/results/:id
async function update(req, res) {
  try {
    const result = await Result.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A result with this Roll & Registration already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// DELETE /api/results/:id
async function remove(req, res) {
  try {
    const result = await Result.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
    res.json({ success: true, message: 'Result deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { list, getByRollAndReg, create, update, remove };
