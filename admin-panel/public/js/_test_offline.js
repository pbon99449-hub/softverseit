// node admin-panel/public/js/_test_offline.js
// Validates the offline (localStorage) backend inside common.js WITHOUT a browser.
const fs = require('fs');
const vm = require('vm');
const url = require('url');

const code = fs.readFileSync(__dirname + '/common.js', 'utf8');

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};

const ctx = {
  console, Math, Date, JSON, parseInt, String, Object, Array, Number, Boolean, RegExp,
  setTimeout, clearTimeout,
  URLSearchParams: url.URLSearchParams,
  localStorage,
  location: { protocol: 'file:', href: 'file:///x/login.html', assign: () => {}, replace: () => {} },
  document: { getElementById: () => null, createElement: () => ({ appendChild() {} }), addEventListener() {} },
};
ctx.window = ctx;
vm.createContext(ctx);

let loaded = false;
try { vm.runInContext(code, ctx); loaded = true; } catch (e) { console.log('LOAD ERROR:', e.message); }

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + ' ' + (extra || '')); }
}

const admins0 = JSON.parse(store['sv_admins_v1'] || '[]');
ok('default admin seeded', admins0.length === 1 && admins0[0].email === 'admin@softverseit.com');
ok('empty enrollments store', JSON.parse(store['sv_enrollments_v1']).length === 0);
ok('empty results store', JSON.parse(store['sv_results_v1']).length === 0);

let r = ctx.localReply('/api/auth/login', 'POST', { email: 'admin@softverseit.com', password: 'wrong' }, true);
ok('login bad password -> 401 json', r.success === false && r.message === 'Invalid email or password');

r = ctx.localReply('/api/auth/login', 'POST', { email: 'admin@softverseit.com', password: 'ChangeMe123!' }, true);
ok('login good -> success', r.success === true && !!r.token && r.admin.email === 'admin@softverseit.com');

r = ctx.localReply('/api/auth/register', 'POST', { name: 'Test Admin', email: 'test@softverseit.com', password: 'secret123' }, false);
ok('register -> 201', r.success === true && r.admin.name === 'Test Admin');

r = ctx.localReply('/api/auth/register', 'POST', { name: 'x', email: 'test@softverseit.com', password: 'secret123' }, false);
ok('register duplicate -> 409', r.success === false && r.message === 'An account with this email already exists');

r = ctx.localReply('/api/auth/register', 'POST', { name: 'x', email: 'not-an-email', password: 'secret123' }, false);
ok('register bad email -> 400', r.success === false && r.message === 'Please enter a valid email address');

r = ctx.localReply('/api/auth/register', 'POST', { name: 'x', email: 'a@b.com', password: '123' }, false);
ok('register short pw -> 400', r.success === false && r.message === 'Password must be at least 6 characters');

store['sv_admin_token'] = 'local_' + admins0[0]._id;
store['sv_admin_user'] = JSON.stringify({ id: admins0[0]._id, name: admins0[0].name, email: admins0[0].email, role: admins0[0].role });

r = ctx.localReply('/api/dashboard/stats', 'GET', undefined, true);
ok('dashboard stats -> 200', r.success === true && typeof r.data.totalEnrollments === 'number');

r = ctx.localReply('/api/enrollments', 'POST', { fullName: 'Rahim Uddin', phone: '01711111111', course: 'Basic', batch: '40th', age: '22' }, true);
ok('enrollments POST -> 201', r.success === true && r.data._id && r.data.status === 'pending');

r = ctx.localReply('/api/enrollments?page=1&limit=15', 'GET', undefined, true);
ok('enrollments GET -> 200 with pagination', r.success === true && r.data.length === 1 && r.pagination.total === 1);

r = ctx.localReply('/api/enrollments?search=rahim&page=1&limit=15', 'GET', undefined, true);
ok('enrollments search works', r.success === true && r.data.length === 1);
r = ctx.localReply('/api/enrollments?search=nonexistent&page=1&limit=15', 'GET', undefined, true);
ok('enrollments search no match', r.success === true && r.data.length === 0);

const eid = JSON.parse(store['sv_enrollments_v1'])[0]._id;
r = ctx.localReply('/api/enrollments/' + eid + '/status', 'PATCH', { status: 'enrolled' }, true);
ok('enrollments PATCH status -> 200', r.success === true && r.data.status === 'enrolled');

r = ctx.localReply('/api/results', 'POST', { name: 'Karim', roll: '101', registration: 'REG-101', course: 'IELTS', batch: '39th', total: '88', result: 'Pass', grade: 'A' }, true);
ok('results POST -> 201', r.success === true && r.data._id);
r = ctx.localReply('/api/results?page=1&limit=15', 'GET', undefined, true);
ok('results GET -> 200', r.success === true && r.data.length === 1 && r.pagination.total === 1);
r = ctx.localReply('/api/dashboard/stats', 'GET', undefined, true);
ok('dashboard counts 1 enrollment + 1 result', r.data.totalEnrollments === 1 && r.data.totalResults === 1 && r.data.passCount === 1);

r = ctx.localReply('/api/enrollments/' + eid, 'DELETE', undefined, true);
ok('enrollments DELETE -> 200', r.success === true);
r = ctx.localReply('/api/enrollments?page=1&limit=15', 'GET', undefined, true);
ok('enrollments deleted -> 0', r.data.length === 0);

let threw = false, msg = '';
try { ctx.localReply('/api/unknown-route', 'GET', undefined, true); } catch (e) { threw = true; msg = e.message; }
ok('unknown route -> throws 404', threw && msg === 'API route not found');

store['sv_admin_token'] = null;
store['sv_admin_user'] = null;
let redirected = false;
ctx.location.assign = () => { redirected = true; };
ctx.location.replace = () => { redirected = true; };
try { ctx.localReply('/api/enrollments?page=1&limit=15', 'GET', undefined, true); } catch (e) { redirected = true; }
ok('protected route without session redirects', redirected);

console.log('');
console.log('=== RESULT: ' + pass + ' passed, ' + fail + ' failed ===');
if (!loaded) console.log('NOTE: common.js failed to load (syntax/runtime error at top level)');
process.exit(fail > 0 ? 1 : 0);
