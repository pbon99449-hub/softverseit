// Data is stored in the built-in SQLite database (admin-panel/data/softverse.sqlite,
// managed by config/sqlite.js) — no external database server is needed.
// connectDB() is kept as a no-op so server.js and seed.js keep working unchanged.
async function connectDB() {
  console.log('✅ Using built-in SQLite database (data/softverse.sqlite)');
}

module.exports = connectDB;
