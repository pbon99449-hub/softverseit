const express = require('express');
const { list, create, update, remove } = require('../controllers/courseController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public: main website + admin panel course manage page read courses here
router.get('/', list);

// Protected: admin panel only
router.post('/', protect, create);
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;
