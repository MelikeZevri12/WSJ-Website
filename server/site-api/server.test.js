// Run with: node --test server/site-api/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createServer, verifyToken } = require('./server');

const SECRET = 'test-secret-only-for-these-tests';
const b64url = (s) => Buffer.from(s).toString('base64url');
function token({ secret = SECRET, role = 'cruise-team', exp = Math.floor(Date.now() / 1000) + 3600, alg = 'HS256' } = {}) {
  const h = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const p = b64url(JSON.stringify({ role, iat: Math.floor(Date.now() / 1000), exp }));
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

async function start(seed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-api-'));
  const seedDir = path.join(dir, 'seed'); fs.mkdirSync(seedDir);
  if (seed) fs.writeFileSync(path.join(seedDir, 'testimonials.json'), JSON.stringify(seed));
  const server = createServer({ dataDir: path.join(dir, 'data'), seedDir, secret: SECRET });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/site-api`;
  const call = async (method, p, body, auth = token()) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { dir, call, close: () => new Promise((r) => server.close(r)) };
}

const kylie = { name: ' Kylie ', fullText: ' Last year our family went on a cruise. ', shortVersion: '', category: 'cruise' };

test('checks the staff login token', () => {
  assert.equal(verifyToken(token(), SECRET), true);
  assert.equal(verifyToken(token({ secret: 'other' }), SECRET), false);
  assert.equal(verifyToken(token({ exp: Math.floor(Date.now() / 1000) - 10 }), SECRET), false);
  assert.equal(verifyToken(token({ role: 'visitor' }), SECRET), false);
  assert.equal(verifyToken(token({ alg: 'none' }), SECRET), false);
  assert.equal(verifyToken('nonsense', SECRET), false);
  assert.equal(verifyToken(token(), ''), false);
});

test('starts from the seed file, sorted, and filters by type', async () => {
  const s = await start([
    { id: 'b', name: 'B', fullText: 'x', shortVersion: '', category: 'cruise', sortOrder: 20 },
    { id: 'a', name: 'A', fullText: 'y', shortVersion: '', category: 'austria_retreat', sortOrder: 10 },
  ]);
  try {
    const all = await s.call('GET', '/testimonials', null, null);
    assert.equal(all.status, 200);
    assert.deepEqual(all.body.map((t) => t.id), ['a', 'b']);
    assert.deepEqual((await s.call('GET', '/testimonials?category=cruise', null, null)).body.map((t) => t.id), ['b']);
    assert.equal((await s.call('GET', '/testimonials?category=nope', null, null)).status, 400);
  } finally { await s.close(); }
});

test('adds, edits and deletes (staff only), keeping a backup of every change', async () => {
  const s = await start([]);
  try {
    assert.equal((await s.call('POST', '/testimonials', kylie, null)).status, 401);
    assert.equal((await s.call('POST', '/testimonials', kylie, token({ secret: 'wrong' }))).status, 401);

    const added = await s.call('POST', '/testimonials', kylie);
    assert.equal(added.status, 201);
    assert.equal(added.body.name, 'Kylie');
    assert.equal(added.body.fullText, 'Last year our family went on a cruise.');
    assert.equal(added.body.sortOrder, 10);
    assert.equal((await s.call('POST', '/testimonials', { ...kylie, name: 'Mary' })).body.sortOrder, 20);

    const id = added.body.id;
    assert.equal((await s.call('PUT', `/testimonials/${id}`, { ...kylie, shortVersion: 'Lifelong friends.' }, null)).status, 401);
    const edited = await s.call('PUT', `/testimonials/${id}`, { ...kylie, shortVersion: 'Lifelong friends.', category: 'land_trip' });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.shortVersion, 'Lifelong friends.');
    assert.equal(edited.body.category, 'land_trip');

    assert.equal((await s.call('DELETE', `/testimonials/${id}`, null, null)).status, 401);
    assert.equal((await s.call('DELETE', `/testimonials/${id}`)).status, 200);
    assert.equal((await s.call('DELETE', `/testimonials/${id}`)).status, 404);
    assert.equal((await s.call('PUT', `/testimonials/${id}`, kylie)).status, 404);

    const left = (await s.call('GET', '/testimonials', null, null)).body;
    assert.deepEqual(left.map((t) => t.name), ['Mary']);
    const saved = JSON.parse(fs.readFileSync(path.join(s.dir, 'data', 'testimonials.json'), 'utf8'));
    assert.deepEqual(saved.map((t) => t.name), ['Mary']);
    assert.equal(fs.readdirSync(path.join(s.dir, 'data', 'backups')).length, 4);
  } finally { await s.close(); }
});

test('featured: off for new ones, set and cleared by a save, kept when a save leaves it out', async () => {
  const s = await start([]);
  try {
    const added = (await s.call('POST', '/testimonials', kylie)).body;
    assert.equal(added.featured, false);
    assert.equal((await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, featured: true })).body.featured, true);
    assert.equal((await s.call('PUT', `/testimonials/${added.id}`, kylie)).body.featured, true);
    assert.equal((await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, featured: false })).body.featured, false);
    assert.equal((await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, featured: 'yes' })).status, 400);
  } finally { await s.close(); }
});

test('carousel pick: off for new ones, set by a save, kept when a save leaves it out, separate from featured', async () => {
  const s = await start([]);
  try {
    const added = (await s.call('POST', '/testimonials', kylie)).body;
    assert.equal(added.carousel, false);
    const on = (await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, carousel: true })).body;
    assert.equal(on.carousel, true);
    assert.equal(on.featured, false);
    const starred = (await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, featured: true })).body;
    assert.equal(starred.carousel, true);
    assert.equal((await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, carousel: false })).body.carousel, false);
    assert.equal((await s.call('PUT', `/testimonials/${added.id}`, { ...kylie, carousel: 1 })).status, 400);
  } finally { await s.close(); }
});

test('rejects incomplete testimonials and unknown addresses', async () => {
  const s = await start([]);
  try {
    assert.equal((await s.call('POST', '/testimonials', { ...kylie, name: ' ' })).status, 400);
    assert.equal((await s.call('POST', '/testimonials', { ...kylie, fullText: '', shortVersion: '' })).status, 400);
    assert.equal((await s.call('POST', '/testimonials', { ...kylie, category: 'safari' })).status, 400);
    assert.equal((await s.call('POST', '/testimonials', { ...kylie, fullText: '', shortVersion: 'Short is enough.' })).status, 201);
    assert.equal((await s.call('GET', '/other', null, null)).status, 404);
    assert.equal((await s.call('GET', '/health', null, null)).status, 200);
  } finally { await s.close(); }
});

test('sign-ups: anyone can join, the same email is merged, only staff can list and delete', async () => {
  const s = await start([]);
  const join = (body, auth = null) => s.call('POST', '/signups', { campaign: 'black-friday-2026', name: 'Kylie', email: 'Kylie@Example.com', trips: [{ slug: 'morocco', title: 'Morocco Family Journey' }], ...body }, auth);
  try {
    assert.equal((await join({})).status, 201);
    assert.equal((await join({ name: 'Kylie B', trips: [{ slug: 'morocco', title: 'Morocco Family Journey' }, { slug: 'galapagos', title: 'Galápagos' }] })).status, 201);
    assert.equal((await join({ email: 'mary@example.com' })).status, 201);
    // bad input
    assert.equal((await join({ campaign: 'other' })).status, 400);
    assert.equal((await join({ name: ' ' })).status, 400);
    assert.equal((await join({ email: 'not-an-email' })).status, 400);
    assert.equal((await join({ trips: [] })).status, 400);
    assert.equal((await join({ trips: [{ slug: '<script>', title: 'x' }] })).status, 400);
    // a bot filling the hidden field: "ok", nothing saved
    assert.equal((await join({ email: 'bot@example.com', website: 'http://spam' })).status, 201);
    // staff only
    assert.equal((await s.call('GET', '/signups', null, null)).status, 401);
    const list = (await s.call('GET', '/signups?campaign=black-friday-2026')).body;
    assert.deepEqual(list.map((r) => r.email).sort(), ['kylie@example.com', 'mary@example.com']);
    const kylie = list.find((r) => r.email === 'kylie@example.com');
    assert.equal(kylie.name, 'Kylie B');
    assert.deepEqual(kylie.trips.map((t) => t.slug), ['morocco', 'galapagos']);
    assert.equal((await s.call('DELETE', `/signups/${kylie.id}`, null, null)).status, 401);
    assert.equal((await s.call('DELETE', `/signups/${kylie.id}`)).status, 200);
    assert.equal((await s.call('GET', '/signups')).body.length, 1);
    // too many from one connection
    let last;
    for (let i = 0; i < 25; i++) last = await join({ email: `p${i}@example.com` });
    assert.equal(last.status, 429);
  } finally { await s.close(); }
});

test('the real seed file is valid', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'testimonials.json'), 'utf8'));
  assert.ok(seed.length > 50);
  const ids = new Set();
  for (const t of seed) {
    assert.ok(t.id && !ids.has(t.id)); ids.add(t.id);
    assert.ok(t.name && (t.fullText || t.shortVersion));
    assert.ok(['cruise', 'land_trip', 'port_excursion', 'austria_retreat'].includes(t.category));
    assert.ok(!/—/.test(t.fullText + t.shortVersion), `em dash in ${t.name}`);
  }
});
