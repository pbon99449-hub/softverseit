// SQLite-backed mini ORM that mimics the small subset of the Mongoose API
// used by this project, so the controllers/frontend don't need to change.
// Storage: a single JSON "data" column per row + createdAt/updatedAt columns.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'softverse.sqlite'));
db.pragma('journal_mode = WAL');

function uid(prefix = '') {
  return prefix + crypto.randomBytes(12).toString('hex');
}

function nowISO() { return new Date().toISOString(); }

// ── Filter matching (supports: equality, $regex+$options, $gte, $or) ──
function matchValue(docValue, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if ('$regex' in cond) {
      const flags = cond.$options && cond.$options.includes('i') ? 'i' : '';
      return cond.$regex !== undefined &&
        new RegExp(String(cond.$regex), flags).test(String(docValue == null ? '' : docValue));
    }
    if ('$gte' in cond) {
      const a = docValue instanceof Date ? docValue.getTime() : Number(new Date(docValue).getTime() || 0);
      const b = cond.$gte instanceof Date ? cond.$gte.getTime() : Number(new Date(cond.$gte).getTime() || 0);
      return a >= b;
    }
    return false;
  }
  return String(docValue == null ? '' : docValue) === String(cond == null ? '' : cond);
}

function matchDoc(doc, filter) {
  filter = filter || {};
  for (const key of Object.keys(filter)) {
    if (key === '$or') {
      if (!filter.$or.some(sub => matchDoc(doc, sub))) return false;
      continue;
    }
    if (!matchValue(doc[key], filter[key])) return false;
  }
  return true;
}

// ── Duplicate-key error, mimicking Mongo's code 11000 ──
function dupError(msg) {
  const err = new Error(msg || 'Duplicate key');
  err.code = 11000;
  return err;
}

// ── Table management ─────────────────────────────────────────────────
// Schema: one JSON "data" column per row + createdAt/updatedAt columns.
function ensureTable(tableName) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`
  );
}

function rowToDoc(row) {
  let data = {};
  try { data = JSON.parse(row.data) || {}; } catch (_) { data = {}; }
  return Object.assign({}, data, { _id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt });
}

function allRows(tableName) { return db.prepare(`SELECT * FROM ${tableName}`).all(); }
function getRow(tableName, id) { return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id); }
function insertRow(tableName, id, data, createdAt, updatedAt) {
  db.prepare(`INSERT INTO ${tableName} (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)`)
    .run(id, JSON.stringify(data), createdAt, updatedAt);
}
function updateRow(tableName, id, data, updatedAt) {
  db.prepare(`UPDATE ${tableName} SET data = ?, updatedAt = ? WHERE id = ?`)
    .run(JSON.stringify(data), updatedAt, id);
}
function deleteRow(tableName, id) {
  db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
}

// Instance helper keys — stripped when a "lean" plain object is requested.
const INSTANCE_KEYS = ['save', 'toSafeJSON', 'comparePassword'];

function stripDoc(doc) {
  const clone = Object.assign({}, doc);
  INSTANCE_KEYS.forEach(k => { delete clone[k]; });
  return clone;
}

function applyUpdate(doc, update) {
  const out = Object.assign({}, doc);
  if (!update || typeof update !== 'object') return out;
  if (update.$set) Object.assign(out, update.$set);
  for (const key of Object.keys(update)) {
    if (key.startsWith('$')) continue;
    out[key] = update[key];
  }
  return out;
}

function cmpValues(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function sortDocs(docs, spec) {
  const keys = Object.keys(spec || {});
  if (!keys.length) return docs;
  return docs.slice().sort((x, y) => {
    for (const k of keys) {
      const dir = spec[k] < 0 ? -1 : 1;
      const r = cmpValues(x[k], y[k]) * dir;
      if (r !== 0) return r;
    }
    return 0;
  });
}

// Chainable, awaitable query — mimics the Mongoose Query API used here:
//   Model.find(filter).sort({...}).skip(n).limit(n)  /  Model.findOne().lean()
class Query {
  constructor(table, wrapFn, filter, single) {
    this.table = table;
    this._wrap = wrapFn;
    this.filter = filter || {};
    this.single = !!single;
    this._sort = null;
    this._skip = 0;
    this._limit = null;
    this._lean = false;
  }
  sort(spec) { this._sort = spec; return this; }
  skip(n) { this._skip = Number(n) || 0; return this; }
  limit(n) { this._limit = n == null ? null : Number(n); return this; }
  lean() { this._lean = true; return this; }
  _exec() {
    let docs = allRows(this.table).map(rowToDoc).filter(d => matchDoc(d, this.filter));
    docs = sortDocs(docs, this._sort);
    if (this._skip) docs = docs.slice(this._skip);
    if (this._limit != null) docs = docs.slice(0, this._limit);
    if (this.single) {
      const one = docs[0] ? this._wrap(docs[0]) : null;
      return this._lean ? (one ? stripDoc(one) : null) : one;
    }
    const list = docs.map(d => this._wrap(d));
    return this._lean ? list.map(stripDoc) : list;
  }
  then(onFulfilled, onRejected) {
    try { return Promise.resolve(this._exec()).then(onFulfilled, onRejected); }
    catch (err) { return Promise.reject(err).then(onFulfilled, onRejected); }
  }
  catch(onRejected) {
    return Promise.resolve().then(() => this._exec()).catch(onRejected);
  }
}

// Awaitable single-result wrapper with .lean() support
// (e.g. Model.findOneAndUpdate(...).lean()).
class SingleQuery {
  constructor(execFn) { this._execFn = execFn; this._lean = false; }
  lean() { this._lean = true; return this; }
  _run() {
    return Promise.resolve(this._execFn()).then(doc => {
      if (!doc) return doc;
      return this._lean ? stripDoc(doc) : doc;
    });
  }
  then(onFulfilled, onRejected) { return this._run().then(onFulfilled, onRejected); }
  catch(onRejected) { return this._run().catch(onRejected); }
}


// ── defineModel — the mini-ORM entry point (Mongoose-like API) ───────
function defineModel({ name, tableName, defaults = {}, uniqueChecks = [], hooks = {} }) {
  ensureTable(tableName);

  function applyDefaults(input) {
    const doc = {};
    for (const key of Object.keys(defaults)) {
      const val = defaults[key];
      doc[key] = typeof val === 'function' ? val() : val;
    }
    const src = input || {};
    for (const key of Object.keys(src)) {
      if (src[key] !== undefined) doc[key] = src[key];
    }
    return doc;
  }

  async function runUniqueChecks(data, excludeId) {
    for (const check of uniqueChecks || []) {
      const fields = (check && check.fields) || [];
      if (!fields.length) continue;
      const filter = {};
      let complete = true;
      for (const f of fields) {
        if (data[f] === undefined) { complete = false; break; }
        filter[f] = data[f];
      }
      if (!complete) continue;
      const dup = allRows(tableName).map(rowToDoc)
        .find(d => d._id !== excludeId && matchDoc(d, filter));
      if (dup) throw dupError(`${name} already exists (${fields.join(' + ')})`);
    }
  }

  async function runBeforeSave(doc) {
    if (hooks && typeof hooks.beforeSave === 'function') await hooks.beforeSave(doc);
  }

  // Attach instance helpers (save / toSafeJSON / comparePassword) to a doc.
  function wrap(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const wrapped = Object.assign({}, doc);

    wrapped.save = async function () {
      wrapped.updatedAt = nowISO();
      await runBeforeSave(wrapped);
      await runUniqueChecks(wrapped, wrapped._id);
      updateRow(tableName, wrapped._id, stripDoc(wrapped), wrapped.updatedAt);
      return wrapped;
    };

    wrapped.toSafeJSON = function () {
      const clone = stripDoc(wrapped);
      delete clone.password;
      clone.id = clone._id;
      return clone;
    };

    // Works for both bcrypt hashes and legacy plaintext passwords.
    wrapped.comparePassword = async function (candidate) {
      const pw = wrapped.password;
      const c = String(candidate == null ? '' : candidate).trim();
      if (typeof pw === 'string' && pw.startsWith('$2')) {
        return bcrypt.compare(c, pw);
      }
      return String(pw == null ? '' : pw) === c;
    };

    return wrapped;
  }

  const model = {
    name,
    tableName,

    find(filter) { return new Query(tableName, wrap, filter, false); },
    findOne(filter) { return new Query(tableName, wrap, filter, true); },
    findById(id) { return new Query(tableName, wrap, { _id: id }, true); },

    async countDocuments(filter) {
      return allRows(tableName).map(rowToDoc).filter(d => matchDoc(d, filter || {})).length;
    },

    async create(input) {
      const doc = applyDefaults(input);
      if (!doc._id) doc._id = uid();
      if (!doc.createdAt) doc.createdAt = nowISO();
      doc.updatedAt = nowISO();
      await runBeforeSave(doc);
      await runUniqueChecks(doc, null);
      const { _id, ...rest } = doc;
      insertRow(tableName, _id, rest, doc.createdAt, doc.updatedAt);
      return wrap(doc);
    },

    async insertMany(items) {
      const out = [];
      for (const item of (items || [])) out.push(await model.create(item));
      return out;
    },

    findOneAndUpdate(filter, update, opts = {}) {
      return new SingleQuery(async () => {
        const found = allRows(tableName).map(rowToDoc).find(d => matchDoc(d, filter || {}));
        if (!found) {
          if (opts.upsert) return model.create(update || {});
          return null;
        }
        const prev = wrap(Object.assign({}, found));
        const updated = applyUpdate(found, update);
        updated._id = found._id;
        updated.createdAt = found.createdAt;
        updated.updatedAt = nowISO();
        await runBeforeSave(updated);
        await runUniqueChecks(updated, found._id);
        const { _id, ...rest } = updated;
        updateRow(tableName, _id, rest, updated.updatedAt);
        return opts.new === false ? prev : wrap(updated);
      });
    },

    findByIdAndUpdate(id, update, opts) {
      return model.findOneAndUpdate({ _id: id }, update, opts);
    },

    async findByIdAndDelete(id) {
      const row = getRow(tableName, id);
      if (!row) return null;
      deleteRow(tableName, id);
      return wrap(rowToDoc(row));
    },

    async deleteMany(filter) {
      const rows = allRows(tableName).map(rowToDoc);
      let deletedCount = 0;
      for (const doc of rows) {
        if (matchDoc(doc, filter || {})) { deleteRow(tableName, doc._id); deletedCount++; }
      }
      return { deletedCount };
    },
  };

  return model;
}

module.exports = { defineModel, uid, nowISO, matchDoc };