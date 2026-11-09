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
//   POST   /site-api/signups                          public (the /black-friday waitlist form)
//   GET    /site-api/signups[?campaign=black-friday-2026]   staff login
//   DELETE /site-api/signups/:id                      staff login
//   GET    /site-api/bf-email/info                    staff login: the sale trips + codes, is email set up
//   GET    /site-api/bf-email/preview/:signupId       staff login: { subject, html } of that family's email
//   POST   /site-api/bf-email/test   { to, signupId? } staff login: a [Test] copy to any address (nothing is marked)
//   POST   /site-api/bf-email/send/:signupId          staff login: the real email for the trips not emailed yet, then marked
//
// A sign-up (data/signups.json): { id, campaign, name, email, trips: [{ slug, title }], createdAt, updatedAt,
//   emailed?: [{ slug, code, at }] }  (emailed = the Black Friday code emails sent to them, one entry per trip)
// The Black Friday email itself: bf-email.js (design + which trips have a code). Sending: smtp.js.
//
// A testimonial: { id, name, fullText, shortVersion, category, featured, carousel, sortOrder, createdAt, updatedAt }
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { renderBlackFridayEmail, saleTripsFor, SALE_TRIPS } = require('./bf-email');
const { sendMail, mailConfig } = require('./smtp');

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
  const value = { name, fullText, shortVersion, category };
  // "Featured" = one of our best (admin star): shown first on the website. Left as it
  // was when a save doesn't mention it; new testimonials start not featured.
  // "carousel" = picked to show in the website carousels (admin "Carousel" switch). Same rules.
  for (const key of ['featured', 'carousel']) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') return { error: `${key} must be true or false.` };
    value[key] = body[key];
  }
  return { value };
}
const bySortOrder = (a, b) => a.sortOrder - b.sortOrder || String(a.createdAt).localeCompare(String(b.createdAt));

// ---------- sign-ups from public forms (the Black Friday waitlist page) ----------
// One list per campaign. The same email signing up again for the same campaign updates
// their entry (new name, trips added) instead of making a second one.
const CAMPAIGNS = ['black-friday-2026'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SIGNUPS_PER_HOUR = 20;   // per visitor (IP address): enough for a family, not for a bot
function validateSignup(body) {
  const campaign = clip(body.campaign, 60);
  if (!CAMPAIGNS.includes(campaign)) return { error: 'Unknown sign-up list.' };
  const name = clip(body.name, 120);
  const email = clip(body.email, 200).toLowerCase();
  if (!name) return { error: 'Please add your name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Please add a valid email address.' };
  if (!Array.isArray(body.trips) || !body.trips.length) return { error: 'Please pick at least one trip.' };
  const trips = [];
  for (const t of body.trips.slice(0, 30)) {
    const slug = clip(t && t.slug, 60), title = clip(t && t.title, 150);
    if (!/^[a-z0-9-]+$/.test(slug) || !title) return { error: 'Please pick the trips from the list.' };
    if (!trips.some((x) => x.slug === slug)) trips.push({ slug, title });
  }
  return { value: { campaign, name, email, trips } };
}

// ---------- HTTP ----------
// Black Friday code emails: the sale trips a sign-up picked that haven't been emailed yet
const BF_CAMPAIGN = 'black-friday-2026';
const SEND_GAP_MS = 2000;   // at least this long between two real emails, so the mail server isn't flooded
function bfDue(row) {
  if (row.campaign !== BF_CAMPAIGN) return [];
  const done = new Set((row.emailed || []).map((e) => e.slug));
  return saleTripsFor(row.trips).filter((slug) => !done.has(slug));
}

function createServer({ dataDir, seedDir, secret, mail = mailConfig(), mailer = sendMail }) {
  const testimonials = createStore(dataDir, 'testimonials', seedDir && path.join(seedDir, 'testimonials.json'));
  const signups = createStore(dataDir, 'signups', null);
  // sign-ups per visitor in the last hour (kept in memory only)
  const recent = new Map();
  function tooMany(req) {
    // Caddy passes the visitor's address in X-Forwarded-For (the last entry is the one Caddy saw)
    const ip = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '?';
    const hourAgo = Date.now() - 3600e3;
    const times = (recent.get(ip) || []).filter((t) => t > hourAgo);
    times.push(Date.now()); recent.set(ip, times);
    if (recent.size > 5000) for (const [k, v] of recent) if (v[v.length - 1] < hourAgo) recent.delete(k);
    return times.length > SIGNUPS_PER_HOUR;
  }

  // emails go out one at a time, at least SEND_GAP_MS apart; a family being emailed can't be emailed twice at once
  const sending = new Set();
  let mailQueue = Promise.resolve(), lastSent = 0;
  function paced(job) {
    const run = mailQueue.then(async () => {
      const wait = lastSent + SEND_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      // a mail server refusal goes back to the admin page word for word (502), not as a generic error
      try { return await job(); } catch (err) {
        console.error(new Date().toISOString(), 'email not sent:', err.message);   // shows in: sudo journalctl -u site-api
        throw Object.assign(err, { status: err.status || 502 });
      } finally { lastSent = Date.now(); }
    });
    mailQueue = run.catch(() => {});
    return run;
  }

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

    // public sign-up form
    if (p === '/site-api/signups' && req.method === 'POST') {
      const body = await readBody(req);
      if (body.website) return send(res, 201, { ok: true });   // honeypot filled in = a bot: pretend it worked, save nothing
      if (tooMany(req)) return send(res, 429, { message: 'Too many sign-ups from this connection. Please try again in an hour.' });
      const { value, error } = validateSignup(body);
      if (error) return send(res, 400, { message: error });
      const now = new Date().toISOString();
      await signups.change((rows) => {
        const same = rows.find((r) => r.campaign === value.campaign && r.email === value.email);
        if (same) {
          same.name = value.name;
          value.trips.forEach((t) => { if (!same.trips.some((x) => x.slug === t.slug)) same.trips.push(t); });
          same.updatedAt = now; return same;
        }
        const row = { id: crypto.randomUUID(), ...value, createdAt: now, updatedAt: now };
        rows.push(row); return row;
      });
      return send(res, 201, { ok: true });
    }
    // the lists, for the admin page
    const signup = p.match(/^\/site-api\/signups\/([A-Za-z0-9-]{1,64})$/);
    if ((p === '/site-api/signups' && req.method === 'GET') || (signup && req.method === 'DELETE')) {
      if (!isStaff(req)) return send(res, 401, { message: 'Please log in again.' });
      if (req.method === 'GET') {
        const campaign = url.searchParams.get('campaign');
        const rows = (await signups.load()).filter((r) => !campaign || r.campaign === campaign)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .map((r) => ({ ...r, bfDue: bfDue(r) }));
        return send(res, 200, rows);
      }
      const gone = await signups.change((rows) => {
        const i = rows.findIndex((r) => r.id === signup[1]);
        if (i < 0) return false;
        rows.splice(i, 1); return true;
      });
      return gone ? send(res, 200, { ok: true }) : send(res, 404, { message: 'Sign-up not found.' });
    }

    // Black Friday code emails (admin → Black Friday → Email the Codes)
    if (p.startsWith('/site-api/bf-email/')) {
      if (!isStaff(req)) return send(res, 401, { message: 'Please log in again.' });
      if (p === '/site-api/bf-email/info' && req.method === 'GET') {
        return send(res, 200, { mailReady: !!mail, trips: Object.entries(SALE_TRIPS).map(([slug, t]) => ({ slug, title: t.title, dates: t.dates, code: t.code, saving: t.saving })) });
      }
      const preview = p.match(/^\/site-api\/bf-email\/preview\/([A-Za-z0-9-]{1,64})$/);
      if (preview && req.method === 'GET') {
        const row = (await signups.load()).find((r) => r.id === preview[1]);
        if (!row) return send(res, 404, { message: 'Sign-up not found.' });
        const due = bfDue(row);
        const msg = renderBlackFridayEmail({ name: row.name, trips: due.length ? due : row.trips });
        if (!msg) return send(res, 404, { message: 'None of their trips has a code yet.' });
        return send(res, 200, { subject: msg.subject, html: msg.html, due });
      }
      if (p === '/site-api/bf-email/test' && req.method === 'POST') {
        const body = await readBody(req);
        const row = body.signupId && (await signups.load()).find((r) => r.id === body.signupId);
        // a real family's email if one is picked, otherwise every sale trip
        const msg = renderBlackFridayEmail({ name: row ? row.name : 'Friend', trips: row ? row.trips : Object.keys(SALE_TRIPS) }, { test: true });
        if (!msg) return send(res, 400, { message: 'None of their trips has a code yet.' });
        await paced(() => mailer(mail, { to: clip(body.to, 200), subject: msg.subject, text: msg.text, html: msg.html }));
        return send(res, 200, { ok: true, subject: msg.subject });
      }
      const real = p.match(/^\/site-api\/bf-email\/send\/([A-Za-z0-9-]{1,64})$/);
      if (real && req.method === 'POST') {
        const id = real[1];
        if (sending.has(id)) return send(res, 409, { message: 'Already being sent.' });
        sending.add(id);
        try {
          const row = (await signups.load()).find((r) => r.id === id);
          if (!row) return send(res, 404, { message: 'Sign-up not found.' });
          const due = bfDue(row);
          if (!due.length) return send(res, 409, { message: 'Nothing to send: already emailed, or none of their trips has a code yet.' });
          const msg = renderBlackFridayEmail({ name: row.name, trips: due });
          await paced(() => mailer(mail, { to: row.email, subject: msg.subject, text: msg.text, html: msg.html }));
          const at = new Date().toISOString();
          const saved = await signups.change((rows) => {
            const r = rows.find((x) => x.id === id);
            if (!r) return null;
            r.emailed = (r.emailed || []).concat(due.map((slug) => ({ slug, code: SALE_TRIPS[slug].code, at })));
            return r;
          });
          return send(res, 200, saved ? { ...saved, bfDue: bfDue(saved) } : { ok: true });
        } finally { sending.delete(id); }
      }
      return send(res, 404, { message: 'Not found.' });
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
        const t = { id: crypto.randomUUID(), featured: false, carousel: false, ...value, sortOrder: rows.reduce((m, r) => Math.max(m, r.sortOrder || 0), 0) + 10, createdAt: now, updatedAt: now };
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

module.exports = { createServer, verifyToken, validateTestimonial, validateSignup, bfDue, CATEGORIES, CAMPAIGNS };

if (require.main === module) {
  const port = Number(process.env.SITE_API_PORT || 3100);
  const secret = process.env.JWT_SECRET;
  if (!secret) { console.error('JWT_SECRET is missing (see the setup steps in server/site-api/README.md).'); process.exit(1); }
  createServer({ dataDir: process.env.SITE_API_DATA || path.join(__dirname, 'data'), seedDir: path.join(__dirname, 'seed'), secret })
    .listen(port, '127.0.0.1', () => console.log(`site-api listening on 127.0.0.1:${port}`));
}
