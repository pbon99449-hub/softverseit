const express = require('express');
const { uploadImage } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/uploads/image — admin gallery image upload (saved as a file on disk)
router.post('/image', protect, uploadImage);

module.exports = router;