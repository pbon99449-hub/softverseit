const express = require('express');
const { getSiteContent, updateSiteContent, getPopupContent, updatePopupContent } = require('../controllers/siteContentController');
const { protect } = require('../middleware/auth');
const gitAutoPush = require('../config/gitAutoPush');

const router = express.Router();

// GitHub auto-sync চালু আছে কিনা — admin panel-এ স্ট্যাটাস ব্যাজ দেখায়
router.get('/vault-status', (req, res) => {
  res.json({ success: true, data: { autoPush: gitAutoPush.enabled() } });
});

router.get('/', getSiteContent);
router.put('/', protect, updateSiteContent);
router.get('/popup', getPopupContent);
router.put('/popup', protect, updatePopupContent);

module.exports = router;
