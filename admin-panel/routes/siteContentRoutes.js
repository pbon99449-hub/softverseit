const express = require('express');
const { getSiteContent, updateSiteContent, getPopupContent, updatePopupContent } = require('../controllers/siteContentController');
const { protect } = require('../middleware/auth');
const gitAutoPush = require('../config/gitAutoPush');

const router = express.Router();

// স্বয়ংক্রিয় GitHub sync চালু আছে কিনা — admin panel-এ 🟢 ব্যাজ দেখায়
router.get('/sync-status', (req, res) => {
  res.json({ success: true, data: { autoPush: gitAutoPush.enabled() } });
});

router.get('/', getSiteContent);
router.put('/', protect, updateSiteContent);
router.get('/popup', getPopupContent);
router.put('/popup', protect, updatePopupContent);

module.exports = router;
