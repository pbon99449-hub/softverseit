const express = require('express');
const {
  list, getByRollAndReg, create, update, remove,
} = require('../controllers/resultController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public: main website result.html looks results up here
router.get('/public', getByRollAndReg);

// Protected: admin panel only
router.get('/', protect, list);
router.post('/', protect, create);
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;
