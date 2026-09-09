# Content Vault (deploy-safe home page content)

Render / Vercel / Netlify-র মতো হোস্টিং-এ server-এর ডিস্কে লেখা যেকোনো
ফাইল (SQLite DB, upload করা ছবি) **নতুন deploy বা restart-এ মুছে যায়**।

এই ফোল্ডারে থাকা `site-content.json`-এ **প্রতিবার সেভের পর** হোম পেজের
পুরো কনটেন্ট (stats, reviews, videos, gallery, ticker, heroChip,
footer, popup) এর **frame-copy** লেখা হয়। এই ফোল্ডারটা git-এ থাকে,
তাই GitHub-এ push করলে পরের deploy-এ সার্ভার চালু হওয়ার সময়
**DB খালি পেলে এই ফাইল থেকেই সব কনটেন্ট ফেরত আনা হয়** — কখনো হারায় না।

## ব্যবহার নিয়ম (সহজ ৩ ধাপ)

1. Admin panel-এ হোম পেজ কনটেন্ট / ফুটার / পপআপ সেভ করুন।
2. Project folder-এ **`PUSH-CONTENT.bat`** ডাবল-ক্লিক করুন
   (এটা content-vault + Images/gallery GitHub-এ push করবে)।
3. Render-এ redeploy করুন।

> গ্যালারিতে নতুন ছবি যোগ করলে ছবিগুলোও `Images/gallery/`-এ save হয় এবং
> push হলে deploy-এর পরেও ঠিকঠাক দেখা যায়।