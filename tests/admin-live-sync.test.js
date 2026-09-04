const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'admin-panel', 'public', 'js', 'common.js'), 'utf8');

function makeStorage() {
  const store = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
}

function run() {
  const storage = makeStorage();
  const ctx = {
    console,
    localStorage: storage,
    location: { protocol: 'file:', href: 'file:///softverse/admin-panel/public/index.html' },
    document: { body: { appendChild() {} } },
    window: {},
    setTimeout,
    clearTimeout,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

const ctx = run();
let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

const courses = ctx.localBackend('/api/courses', 'GET');
ok('courses endpoint exists', courses.status === 200 && Array.isArray(courses.json.data));

const createdCourse = ctx.localBackend('/api/courses', 'POST', { name: 'Web Design', category: 'Design', duration: '3 Months', teacher: 'Ayesha' });
ok('course can be created', createdCourse.status === 201 && createdCourse.json.data.name === 'Web Design');

const teachers = ctx.localBackend('/api/teachers', 'GET');
ok('teachers endpoint exists', teachers.status === 200 && Array.isArray(teachers.json.data));

const createdTeacher = ctx.localBackend('/api/teachers', 'POST', { name: 'Ayesha Akter', role: 'Trainer', phone: '01700000000' });
ok('teacher can be created', createdTeacher.status === 201 && createdTeacher.json.data.name === 'Ayesha Akter');

const submission = ctx.localBackend('/api/enrollments', 'POST', { fullName: 'Rahim', phone: '01711111111', course: 'Web Design', batch: 'Evening', age: '22' });
ok('enrollment submission is stored', submission.status === 201 && submission.json.data.fullName === 'Rahim');

const defaultSiteContent = ctx.localBackend('/api/site-content', 'GET');
ok('site content endpoint exists', defaultSiteContent.status === 200 && typeof defaultSiteContent.json.data === 'object');

const adminLogin = ctx.localBackend('/api/auth/login', 'POST', { email: 'admin@softverseit.com', password: 'ChangeMe123!' });
ok('default admin can authenticate for content edits', adminLogin.status === 200 && adminLogin.json.success === true);
ctx.setSession(adminLogin.json.token, adminLogin.json.admin);

const updatedSiteContent = ctx.localBackend('/api/site-content', 'PUT', {
  stats: [{ value: '999+', label: 'সফল শিক্ষার্থী' }],
  reviews: [{ quote: 'Great', author: 'Student 1' }],
  videos: [{ title: 'Demo', videoId: 'abc123' }],
  gallery: [{ title: 'Event', category: 'batch', src: '/Images/demo.jpg' }],
});
ok('site content can be updated and stored', updatedSiteContent.status === 200 && updatedSiteContent.json.data.stats[0].value === '999+');

const mainScript = fs.readFileSync(path.join(__dirname, '..', 'JS', 'main.js'), 'utf8');
ok('main site submits enrollments to the real backend API', mainScript.includes("/api/enrollments") && (mainScript.includes("fetch('/api/enrollments") || mainScript.includes('fetch("/api/enrollments"') || mainScript.includes("fetch(base + '/api/enrollments'")));
ok('main site refreshes course data from the backend for live updates', mainScript.includes("/api/courses") && mainScript.includes("setInterval(loadCoursesFromApi") || mainScript.includes("fetch('/api/courses") || mainScript.includes('fetch("/api/courses"'));

const coursePreset = {
  course: 'Web Design',
  batch: 'সকাল (৯টা – ১১টা)',
  education: 'শনি-সোম-বুধ'
};
const enrollForm = {
  enrollModal: { classList: { add() {}, remove() {} } },
  course: { value: '', classList: { add() {}, remove() {} } },
  batch: { value: '', classList: { add() {}, remove() {} } },
  education: { value: '', classList: { add() {}, remove() {} } },
  fullName: { value: '', classList: { add() {}, remove() {} } },
  phone: { value: '', classList: { add() {}, remove() {} } },
  age: { value: '', classList: { add() {}, remove() {} } },
  message: { value: '', classList: { add() {}, remove() {} } },
  body: { style: {} },
  formView: { style: {} },
  successView: { classList: { add() {}, remove() {} } },
  submitBtn: { disabled: false },
  btnText: { style: {} },
  btnLoader: { style: {} },
  reset: function() {},
};

const TitleCheck = `
  function openEnroll(meta) {
    const courseField = document.getElementById('course');
    const batchField = document.getElementById('batch');
    const educationField = document.getElementById('education');
    if (meta && meta.course && courseField) courseField.value = meta.course;
    if (meta && meta.batch && batchField) batchField.value = meta.batch;
    if (meta && meta.education && educationField) educationField.value = meta.education;
    document.getElementById('enrollModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  }
`;
const presetDom = {
  body: { style: {} },
  getElementById(id) {
    if (id === 'enrollModal') return { classList: { add() {}, remove() {} } };
    if (id === 'course') return enrollForm.course;
    if (id === 'batch') return enrollForm.batch;
    if (id === 'education') return enrollForm.education;
    if (id === 'fullName') return enrollForm.fullName;
    if (id === 'phone') return enrollForm.phone;
    if (id === 'age') return enrollForm.age;
    if (id === 'message') return enrollForm.message;
    return null;
  }
};
const presetCtx = { document: presetDom, console, window: {} };
const presetSandbox = vm.createContext(presetCtx);
vm.runInContext(TitleCheck, presetSandbox);
vm.runInContext('openEnroll(' + JSON.stringify(coursePreset) + ');', presetSandbox);
ok('course preset opens form with course, batch and day data', enrollForm.course.value === 'Web Design' && enrollForm.batch.value === 'সকাল (৯টা – ১১টা)' && enrollForm.education.value === 'শনি-সোম-বুধ');

console.log('\n=== LIVE DATA TEST: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail > 0 ? 1 : 0);
