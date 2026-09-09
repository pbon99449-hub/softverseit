const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// অ্যাডমিন প্যানেল থেকে আপলোড করা গ্যালারি ছবি ডিস্কে ফাইল হিসেবে সেভ হয় —
// তাই ছবি ডাটাবেজের JSON-এ base64 হয়ে ভরে যায় না এবং চিরকত্তর স্থায়ী থাকে।
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
// ছবিগুলো এছাড়াও repo-root-এর Images/gallery-এ সেভ হয় — এই ফোল্ডারটার
// git-এ থাকে, তাই Render-এ redeploy করলেও গ্যালারির ছবি মুছে যায় না।
const GALLERY_DIR = path.join(__dirname, '..', '..', 'Images', 'gallery');
const MAX_BASE64_CHARS = 12 * 1024 * 1024;   // ≈ 9MB ফাইল

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });
}
ensureUploadDir();

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/avif': '.avif',
};

// POST /api/uploads/image  (protect)  body: { dataUrl: 'data:image/...;base64,...' }
// রেসপন্স: { success: true, url: '/admin/uploads/img_xxx.jpg' }
async function uploadImage(req, res) {
  try {
    const dataUrl = String((req.body && req.body.dataUrl) || '');
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) {
      return res.status(400).json({ success: false, message: 'সঠিক ছবির ডাটা পাওয়া যায়নি (image data URL দিন)' });
    }
    const mime = m[1].toLowerCase();
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      return res.status(400).json({ success: false, message: 'এই ছবির ফরম্যাট সাপোর্ট করা হয় না (' + mime + ')' });
    }
    if (dataUrl.length > MAX_BASE64_CHARS) {
      return res.status(413).json({ success: false, message: 'ছবিটা খুব বড় — ছোট ছবি দিন' });
    }

    ensureUploadDir();
    const name = 'img_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext;
    const bytes = Buffer.from(m[2], 'base64');
    fs.writeFileSync(path.join(UPLOAD_DIR, name), bytes);
    fs.writeFileSync(path.join(GALLERY_DIR, name), bytes);

    // মূল ছবি Images/gallery-এ git-tracked ফোল্ডারে থাকে (deploy-safe),
    // public/uploads-এ কপি থাকে পুরনো রেফারেন্সগুলোর জন্য।
    // URL root-relative — admin, মেইন সাইট ও লোকাল/লাইভ সার্ভার সব জায়গায় কাজ করে।
    const url = '/Images/gallery/' + name;
    res.status(201).json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { uploadImage, UPLOAD_DIR };