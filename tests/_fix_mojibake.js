// PowerShell 5.1-এর ভুল encoding-এর ফলে তৈরি mojibake উল্টে দেয়।
// ঘটনা: UTF-8 ফাইল cp1252 হিসেবে পড়া হয়েছিল → আবার UTF-8 লেখা হয়েছিল।
// সমাধান: এখনকার টেক্সটকে cp1252-এ ফেরত এনকোড করে যে bytes পাওয়া যায়,
// সেগুলোই আসলে মূল UTF-8 bytes — সেই হিসেবে পড়লেই বাংলা টেক্সট ফিরে আসে।
const fs = require('fs');
const path = require('path');

// cp1252-এর 0x80-0x9F বিশেষ ম্যাপিং (বাকিটা latin1-এর মতোই)
const CP1252 = {
  '\u20AC': 0x80, '\u0081': 0x81, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84,
  '\u2026': 0x85, '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89,
  '\u0160': 0x8A, '\u2039': 0x8B, '\u0152': 0x8C, '\u008D': 0x8D, '\u017D': 0x8E,
  '\u008F': 0x8F, '\u0090': 0x90, '\u2018': 0x91, '\u2019': 0x92, '\u201C': 0x93,
  '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97, '\u02DC': 0x98,
  '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C, '\u009D': 0x9D,
  '\u017E': 0x9E, '\u0178': 0x9F,
};

// টেক্সট → cp1252 bytes (undo the wrong read)
function toCp1252Bytes(str) {
  const bytes = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code < 0x100) bytes.push(code);                    // latin1 + control অংশ
    else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]); // € … ’ ইত্যাদি
    else throw new Error('Unmappable char U+' + code.toString(16));
  }
  return Buffer.from(bytes);
}

const files = process.argv.slice(2);
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  try {
    const originalBytes = toCp1252Bytes(raw.replace(/^\uFEFF/, '')); // BOM বাদ
    const restored = originalBytes.toString('utf8');
    if (restored.includes('\uFFFD')) {
      console.log(name.padEnd(22), '❌ কিছু অংশ ফেরানো যায়নি (U+FFFD) — ম্যানুয়াল চেক দরকার');
      continue;
    }
    if (restored === raw.replace(/^\uFEFF/, '')) {
      console.log(name.padEnd(22), '— কোনো পরিবর্তন দরকার নেই (সঠিক আছে)');
      continue;
    }
    fs.writeFileSync(file, restored, 'utf8'); // BOM ছাড়া, খাঁটি UTF-8
    console.log(name.padEnd(22), '✅ ঠিক করা হয়েছে — নমুনা:', (restored.match(/[\u0980-\u09FF]+/g) || ['(বাংলা নেই)']).slice(0, 2).join(' / '));
  } catch (err) {
    console.log(name.padEnd(22), '❌', err.message);
  }
}