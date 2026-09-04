const express = require('express');
const {
  list, create, updateStatus, update, remove,
} = require('../controllers/enrollmentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public: main website enroll form posts here
router.post('/', create);

// Protected: admin panel only
router.get('/', protect, list);
router.patch('/:id/status', protect, updateStatus);
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;
