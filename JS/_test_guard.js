// Tests the admin-link guard IIFE (top of JS/main.js) — the "Cannot GET" fix.
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(__dirname + '/main.js', 'utf8');
const startIdx = src.indexOf('(function () {');
const endIdx = src.indexOf('})();', startIdx);
const guard = src.slice(startIdx, endIdx + '})();'.length);

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

async function runGuard(protocol, fetchMode) {
  const links = [{ href: '/admin/login.html' }];
  const rewritten = [];
  links.forEach(a => {
    a.setAttribute = (k, v) => { if (k === 'href') rewritten.push(v); };
  });
  const document = {
    readyState: 'complete',
    querySelectorAll: (sel) => (sel === '[data-admin-link]' ? links : []),
  };
  const ctx = {
    window: undefined,
    location: { protocol: protocol, href: 'http://localhost/index.html', assign() {}, replace() {} },
    document,
  };
  if (fetchMode === 'n/a') {
    ctx.fetch = () => { throw new Error('fetch should NOT be called in file:// mode'); };
  } else if (fetchMode === 'ok200') {
    ctx.fetch = () => Promise.resolve({ ok: true, status: 200 });
  } else if (fetchMode === '404') {
    ctx.fetch = () => Promise.resolve({ ok: false, status: 404 });
  } else {
    ctx.fetch = () => Promise.reject(new Error('network'));
  }
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(guard, ctx);
  await new Promise(r => setTimeout(r, 30));
  return rewritten;
}

(async () => {
  ok('file:// rewrites to local admin file', (await runGuard('file:', 'n/a'))[0] === './admin-panel/public/login.html');
  ok('http + /admin served -> keeps /admin/login.html', (await runGuard('http:', 'ok200')).length === 0);
  ok('http + 404 -> rewrites to local file', (await runGuard('http:', '404'))[0] === './admin-panel/public/login.html');
  ok('http + fetch rejects -> rewrites to local file', (await runGuard('http:', 'reject'))[0] === './admin-panel/public/login.html');
  console.log('');
  console.log('=== GUARD RESULT: ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail > 0 ? 1 : 0);
})();
