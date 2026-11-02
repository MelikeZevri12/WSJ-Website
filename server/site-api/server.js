// The website's own small server ("site API"), separate from the cruise API.
// It keeps the website's internal data: for now the testimonials (admin →
// Testimonials tab). Plain Node, no packages to install.
//
// Runs on the VPS as the systemd service "site-api" (~/apps/site-api), on
// 127.0.0.1:3100. Caddy sends https://worldschoolingjourneys.com/site-api/*
// here (server/Caddyfile.site), so the admin page talks to it on its own
// address: no extra domain, no CORS.
//
// Data: ~/apps/site-api/data/testimonials.json. Every change first copies the
// previous file into data/backups/ (the last 100 are kept). On the very first
// start the file is created from seed/testimonials.json (the testimonials the
// website had on 2026-11-02).
//
// Login: the admin page's staff login (the cruise API's ADMIN_PASSWORD) gives a
// signed token. This server only checks that signature, with the same
// JWT_SECRET (read from ~/apps/site-api/.env, copied from the cruise API's .env
// on the server). It never sees or stores the password.
//
//   GET    /site-api/health
//   GET    /site-api/testimonials[?category=cruise]   public
//   POST   /site-api/testimonials                     staff login
//   PUT    /site-api/testimonials/:id                 staff login
//   DELETE /site-api/testimonials/:id                 staff login
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const CATEGORIES = ['cruise', 'land_trip', 'port_excursion', 'austria_retreat'];
const MAX_BODY = 200 * 1024;
const KEEP_BACKUPS = 100;

// ---------- storage: one JSON file per collection ----------
function createStore(dataDir, name, seedFile) {
  const file = path.join(dataDir, `${name}.json`);
  const backups = path.join(dataDir, 'backups');
  let rows = null;
  let queue = Promise.resolve();

  async function load() {
    if (rows) return rows;
    await fsp.mkdir(backups, { recursive: true });
    if (!fs.existsSync(file)) {
      const seed = seedFile && fs.existsSync(seedFile) ? await fsp.readFile(seedFile, 'utf8') : '[]';
      await fsp.writeFile(file, seed);
    }
    rows = JSON.parse(await fsp.readFile(file, 'utf8'));
    return rows;
  }
  // fn edits the rows and returns what to answer with; a falsy answer (not
  // found) means nothing changed. Changes run one at a time; the old file is backed up, the new one is
  // written to a temp file and renamed over it, so a crash can't leave half a file.
  function change(fn) {
    const run = queue.then(async () => {
      const current = await load();
      const next = JSON.parse(JSON.stringify(current));
      const result = fn(next);
      if (!result) return result;   // nothing found to change: no backup, no write
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fsp.copyFile(file, path.join(backups, `${name}-${stamp}.json`));
      const tmp = `${file}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(next, null, 1));
      await fsp.rename(tmp, file);
      rows = next;
      const old = (await fsp.readdir(backups)).filter((f) => f.startsWith(`${name}-`)).sort();
      await Promise.all(old.slice(0, Math.max(0, old.length - KEEP_BACKUPS)).map((f) => fsp.unlink(path.join(backups, f))));
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }
  return { load, change };
}

// ---------- staff login check (HS256 token from the cruise API's /auth/login) ----------
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function verifyToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (header.alg !== 'HS256') return false;
    const expected = Buffer.from(b64url(crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest()));
    const given = Buffer.from(parts[2]);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (typeof payload.exp === 'number' && payload.exp * 1000 < now) return false;
    return payload.role === 'cruise-team';
  } catch {
    return false;
  }
}

// ---------- testimonials ----------
const clip = (v, max) => (typeof v === 'string' ? v : '').trim().slice(0, max);
function validateTestimonial(body) {
  const name = clip(body.name, 120);
  const fullText = clip(body.fullText, 10000);
  const shortVersion = clip(body.shortVersion, 1000);
  const category = clip(body.category, 40);
  if (!name) return { error: 'Name is required.' };
  if (!fullText && !shortVersion) return { error: 'Add the full text, the short version, or both.' };
  if (!CATEGORIES.includes(category)) return { error: 'Pick a type: Cruise, Land Trip, Port Excursion or Austria Retreat.' };
  return { value: { name, fullText, shortVersion, category } };
}
const bySortOrder = (a, b) => a.sortOrder - b.sortOrder || String(a.createdAt).localeCompare(String(b.createdAt));

// ---------- HTTP ----------
function createServer({ dataDir, seedDir, secret }) {
  const testimonials = createStore(dataDir, 'testimonials', seedDir && path.join(seedDir, 'testimonials.json'));

  function send(res, status, body) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Too much data.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch { reject(Object.assign(new Error('That wasn\'t valid JSON.'), { status: 400 })); }
      });
      req.on('error', reject);
    });
  }
  const isStaff = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''), secret);

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname.replace(/\/+$/, '');
    if (p === '/site-api/health' && req.method === 'GET') return send(res, 200, { ok: true });

    if (p === '/site-api/testimonials' && req.method === 'GET') {
      const category = url.searchParams.get('category');
      if (category && !CATEGORIES.includes(category)) return send(res, 400, { message: 'Unknown category.' });
      const rows = (await testimonials.load()).filter((t) => !category || t.category === category).sort(bySortOrder);
      return send(res, 200, rows);
    }

    const one = p.match(/^\/site-api\/testimonials\/([A-Za-z0-9-]{1,64})$/);
    const isWrite = (p === '/site-api/testimonials' && req.method === 'POST') || (one && (req.method === 'PUT' || req.method === 'DELETE'));
    if (!isWrite) return send(res, 404, { message: 'Not found.' });
    if (!isStaff(req)) return send(res, 401, { message: 'Please log in again.' });

    if (req.method === 'DELETE') {
      const gone = await testimonials.change((rows) => {
        const i = rows.findIndex((t) => t.id === one[1]);
        if (i < 0) return false;
        rows.splice(i, 1); return true;
      });
      return gone ? send(res, 200, { ok: true }) : send(res, 404, { message: 'Testimonial not found.' });
    }

    const { value, error } = validateTestimonial(await readBody(req));
    if (error) return send(res, 400, { message: error });
    const now = new Date().toISOString();
    if (req.method === 'POST') {
      const row = await testimonials.change((rows) => {
        const t = { id: crypto.randomUUID(), ...value, sortOrder: rows.reduce((m, r) => Math.max(m, r.sortOrder || 0), 0) + 10, createdAt: now, updatedAt: now };
        rows.push(t); return t;
      });
      return send(res, 201, row);
    }
    const row = await testimonials.change((rows) => {
      const t = rows.find((r) => r.id === one[1]);
      if (!t) return null;
      Object.assign(t, value, { updatedAt: now }); return t;
    });
    return row ? send(res, 200, row) : send(res, 404, { message: 'Testimonial not found.' });
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!err.status) console.error(new Date().toISOString(), req.method, req.url, err);
      if (!res.headersSent) send(res, err.status || 500, { message: err.status ? err.message : 'Something went wrong on the website server.' });
    });
  });
}

module.exports = { createServer, verifyToken, validateTestimonial, CATEGORIES };

if (require.main === module) {
  const port = Number(process.env.SITE_API_PORT || 3100);
  const secret = process.env.JWT_SECRET;
  if (!secret) { console.error('JWT_SECRET is missing (see the setup steps in server/site-api/README.md).'); process.exit(1); }
  createServer({ dataDir: process.env.SITE_API_DATA || path.join(__dirname, 'data'), seedDir: path.join(__dirname, 'seed'), secret })
    .listen(port, '127.0.0.1', () => console.log(`site-api listening on 127.0.0.1:${port}`));
}
