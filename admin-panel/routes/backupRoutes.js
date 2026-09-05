const express = require('express');
const { getBackup, restoreBackup } = require('../controllers/backupController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ব্যাকআপ নেওয়া/ফেরানো শুধু লগইন করা অ্যাডমিন পারবে
router.get('/', protect, getBackup);
router.post('/restore', protect, restoreBackup);

module.exports = router;
