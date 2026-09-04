const express = require('express');
const { getSiteContent, updateSiteContent, getPopupContent, updatePopupContent } = require('../controllers/siteContentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', getSiteContent);
router.put('/', protect, updateSiteContent);
router.get('/popup', getPopupContent);
router.put('/popup', protect, updatePopupContent);

module.exports = router;
