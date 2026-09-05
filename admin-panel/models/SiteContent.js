const { defineModel } = require('../config/sqlite');

// stats/reviews/videos/gallery/popup are stored as JSON inside the doc row
const SiteContent = defineModel({
  name: 'SiteContent',
  tableName: 'site_content',
  defaults: {
    stats: [],
    reviews: [],
    videos: [],
    gallery: [],
    ticker: [],
    heroChip: '',
    footer: {},
    popup: {},
  },
});

module.exports = SiteContent;
