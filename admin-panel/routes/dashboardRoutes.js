const express = require('express');
const { stats, visits } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', protect, stats);
router.get('/visits', protect, visits);

module.exports = router;
