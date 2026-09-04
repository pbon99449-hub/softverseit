const express = require('express');
const { record } = require('../controllers/visitController');

const router = express.Router();

// POST /api/visits — public (main website counts a visit)
router.post('/', record);

module.exports = router;