const SiteContent = require('../models/SiteContent');

function defaultPopup() {
  return {
    enabled: true,
    badge: 'ভর্তি চলছে এখনেই',
    headline: '40, 41 নাম্বার ব্যাচ',
    headlineHighlight: 'এ ভর্তি চলছে',
    sub: 'SoftVerse IT Training Center — ২০২৬',
    batchTitle: 'ব্যাচ বিস্তারিত',
    startDate: 'শুরুর তারিখ: 30 August, 2026',
    time: 'সময়: সকাল / বিকেল / সন্ধ্যা ব্যাচ',
    place: 'স্থান: মুন্সীগঞ্জ পুলিশ সুপার কার্যালয় বিপরীত পাশে',
    courses: 'কোর্স: কম্পিউটার বেসিক, গ্রাফিক্স ডিজাইন, কিডস কম্পিউটার',
    enrollBtn: 'এখনই আসন নিশ্চিত করুন →',
    skipBtn: 'পরে দেখবো',
  };
}

function defaultSiteContent() {
  return {
    stats: [
      { value: '৮০০+', label: 'সফল শিক্ষার্থী' },
      { value: '৪+', label: 'প্রফেশনাল কোর্স' },
      { value: '২+', label: 'বছরের অভিজ্ঞতা' },
      { value: '৯৮%', label: 'শিক্ষার্থী সন্তুষ্টি' },
    ],
    reviews: [
      { quote: 'Softverse IT তে ক্লাস করে আমার কম্পিউটার নিয়ে বেসিক ধারণা এসেছে।', author: '(ব্যাচ ২৫)', stars: 5 },
      { quote: 'আমাদের স্যাররা খুবই বন্ধুপ্রতিম এবং অনুপ্রেরণাদায়ক।', author: '(ব্যাচ ২৬)', stars: 5 },
      { quote: 'বাস্তব অভিজ্ঞতার ওপর ক্লাস হওয়ায় খুব উপকার হয়েছে।', author: '(ব্যাচ ২৭)', stars: 5 },
    ],
    videos: [
      { title: 'Softverse It Rap Song', videoId: '0VEmSzp7ZQQ' },
      { title: 'বেসিক কোর্স ব্যাচ', videoId: 'PfhSGo4URak' },
      { title: 'ক্যাম্পেইন রিভিউ', videoId: '0EVtuVKj_kw' },
    ],
    gallery: [
      { title: 'ক্লাস রুম 2', category: 'batch', src: './Images/program pi/program4.webp' },
      { title: 'কলেজ ক্যাম্পেইন', category: 'program', src: './Images/program pi/campain.webp' },
      { title: 'ক্লাস রুম 1', category: 'batch', src: './Images/program pi/program3.webp' },
      { title: 'সার্টিফিকেট অনুষ্ঠান', category: 'graduation', src: './Images/program pi/program.webp' },
      { title: 'সার্টিফিকেট অনুষ্ঠান', category: 'program', src: './Images/program pi/program2.webp' },
    ],
    ticker: [
      ' ভর্তি চলছে — 30 August, 2026 থেকে নতুন ব্যাচ শুরু',
      ' বেসিক কম্পিউটার · গ্রাফিক ডিজাইন · কিডস কম্পিউটার',
      ' যোগাযোগ করুন: 01603-893912',
      ' মুন্সীগঞ্জ পুলিশ সুপার কার্যালয়ের বিপরীত পাশে',
      ' কোর্স শেষে সার্টিফিকেট প্রদান করা হয়',
    ],
    heroChip: '30 july — নতুন ব্যাচ শুরু',
    footer: {
      about: 'বিশ্বস্ত কম্পিউটার ট্রেনিং সেন্টার। আমরা বিগত ২০২৩ সাল ২+ বছর ধরে শত শিক্ষার্থীকে কম্পিউটার প্রশিক্ষন দিয়ে।',
      link1Title: 'SV-Tech Zone',
      link1Url: 'https://www.facebook.com/share/18QPiHwUnt/?mibextid=wwXIfr',
      link2Title: 'SV-Advanture',
      link2Url: 'https://www.facebook.com/share/1CVe7s24fR/?mibextid=wwXIfr',
      link3Title: 'Gift Managment',
      link3Url: '#',
      address: 'মুগন্সীঞ্জ পুলিশ সুপার কার্যালয় বিপরীত পাশে',
      phone: '016038-93912',
      email: 'softversei@gmail.com',
      copyright: '© 2026 SoftVerse IT Computer Training Center।',
      facebookUrl: 'https://www.facebook.com/share/15eAhfq3ayS/?mibextid=wwXIfr',
      youtubeUrl: 'https://www.youtube.com/@SoftverseITInstitute',
    },
    popup: defaultPopup(),
  };
}

function normalizeVideoId(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  const direct = value.match(/[A-Za-z0-9_-]{11}/);
  if (direct) return direct[0];

  const urlMatch = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return urlMatch ? urlMatch[1] : '';
}

function sanitizeFooter(value) {
  const fallback = defaultSiteContent().footer;
  const input = value && typeof value === 'object' ? value : {};
  const out = {};
  Object.keys(fallback).forEach((key) => {
    out[key] = typeof input[key] === 'string' && input[key].trim() ? input[key].trim() : fallback[key];
  });
  return out;
}

function sanitizeSiteContent(value) {
  const fallback = defaultSiteContent();
  const input = value && typeof value === 'object' ? value : {};

  return {
    stats: Array.isArray(input.stats) ? input.stats.filter(item => item && (item.value || item.label)).map(item => ({ value: String(item.value || ''), label: String(item.label || '') })) : fallback.stats,
    reviews: Array.isArray(input.reviews) ? input.reviews.filter(item => item && (item.quote || item.author)).map(item => ({ quote: String(item.quote || ''), author: String(item.author || 'Student'), stars: Number(item.stars) || 5 })) : fallback.reviews,
    videos: Array.isArray(input.videos) ? input.videos.filter(item => item && (item.title || item.videoId)).map(item => {
      const videoId = normalizeVideoId(item.videoId || item.url || item.link || item.youtube || '');
      const thumb = String(item.thumbnail || '').trim();
      return {
        title: String(item.title || ''),
        videoId,
        thumbnail: videoId ? (thumb || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`) : '',
      };
    }) : fallback.videos,
    gallery: Array.isArray(input.gallery) ? input.gallery.filter(item => item && (item.title || item.src)).map(item => ({ title: String(item.title || ''), category: String(item.category || 'batch'), src: String(item.src || '') })) : fallback.gallery,
    ticker: Array.isArray(input.ticker) ? input.ticker.map(item => String(item || '').trim()).filter(Boolean) : fallback.ticker,
    // ব্যানারের নিচের live-chip লেখা — ফাঁকা স্ট্রিং দিলে চিপটি হোমপেজে লুকানো থাকবে
    heroChip: typeof input.heroChip === 'string' ? input.heroChip.trim() : fallback.heroChip,
    // ফুটার (হোমপেজের নিচের অংশ) — অ্যাডমিন প্যানেলের "ফুটার এডিট" পেজ থেকে বদলানো যায়
    footer: sanitizeFooter(input.footer),
    popup: sanitizePopup(input.popup),
  };
}

function sanitizePopup(value) {
  const fallback = defaultPopup();
  const input = value && typeof value === 'object' ? value : {};
  const out = {};
  const fields = ['badge', 'headline', 'headlineHighlight', 'sub', 'batchTitle', 'startDate', 'time', 'place', 'courses', 'enrollBtn', 'skipBtn'];
  fields.forEach(f => {
    out[f] = typeof input[f] === 'string' ? input[f] : (fallback[f] || '');
  });
  out.enabled = typeof input.enabled === 'boolean' ? input.enabled : (input.enabled === 'false' ? false : fallback.enabled);
  return out;
}

async function getPopupContent(req, res) {
  try {
    const content = await SiteContent.findOne().lean();
    const payload = content ? sanitizePopup(content.popup) : defaultPopup();
    res.json({ success: true, data: payload });
  } catch (err) {
    res.json({ success: true, data: defaultPopup() });
  }
}

async function updatePopupContent(req, res) {
  try {
    const popup = sanitizePopup(req.body || {});
    const content = await SiteContent.findOneAndUpdate({}, { popup }, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    res.json({ success: true, data: sanitizePopup(content ? content.popup : popup) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

async function getSiteContent(req, res) {
  try {
    const content = await SiteContent.findOne().lean();
    const payload = content ? sanitizeSiteContent(content) : defaultSiteContent();
    if (!content) {
      await SiteContent.create(payload);
    }
    res.json({ success: true, data: payload });
  } catch (err) {
    res.json({ success: true, data: defaultSiteContent() });
  }
}

async function updateSiteContent(req, res) {
  try {
    const body = req.body || {};
    // Merge over the stored doc: sections NOT present in the request body keep
    // their saved values — e.g. saving from the content page must not reset the
    // popup or ticker that other pages/admin sections manage.
    const existing = await SiteContent.findOne().lean();
    const base = existing || defaultSiteContent();
    const merged = {};
    ['stats', 'reviews', 'videos', 'gallery', 'ticker', 'heroChip', 'footer', 'popup'].forEach((key) => {
      merged[key] = body[key] !== undefined ? body[key] : base[key];
    });
    const payload = sanitizeSiteContent(merged);
    const content = await SiteContent.findOneAndUpdate({}, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }).lean();
    res.json({ success: true, data: sanitizeSiteContent(content || payload) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

module.exports = { defaultSiteContent, sanitizeSiteContent, getSiteContent, updateSiteContent, getPopupContent, updatePopupContent };
