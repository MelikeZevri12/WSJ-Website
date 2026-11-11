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

async function start(seed, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-api-'));
  const seedDir = path.join(dir, 'seed'); fs.mkdirSync(seedDir);
  if (seed) fs.writeFileSync(path.join(seedDir, 'testimonials.json'), JSON.stringify(seed));
  const server = createServer({ dataDir: path.join(dir, 'data'), seedDir, secret: SECRET, ...extra });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/site-api`;
  const call = async (method, p, body, auth = token()) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { dir, call, base, close: () => new Promise((r) => server.close(r)) };
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

// ---------- Black Friday code emails ----------
const { renderBlackFridayEmail } = require('./bf-email');
const { sendMail, buildMessage } = require('./smtp');
const net = require('net');

test('the email lists only trips with a code, per person savings, no em dashes', () => {
  const m = renderBlackFridayEmail({ name: 'Ana Silva', trips: [{ slug: 'austria-fall' }, { slug: 'morocco' }, { slug: 'new-zealand' }] });
  assert.match(m.subject, /codes are live for 2 of your trips/);
  assert.match(m.html, /Hi Ana,/);
  assert.match(m.html, /BFAUSTRIA/); assert.match(m.html, /BFNEWZEALAND/);
  assert.match(m.html, /Save €50 per person/); assert.match(m.html, /A family of 4 saves \$200/);
  assert.ok(!/Morocco/.test(m.html));
  assert.ok(!/—/.test(m.html + m.text + m.subject));
  assert.ok(!/gastein|mondi/i.test(m.html + m.text));
  assert.equal(renderBlackFridayEmail({ name: 'X', trips: [{ slug: 'morocco' }] }), null);
  const one = renderBlackFridayEmail({ name: '', trips: ['new-zealand'] });
  assert.match(one.subject, /save \$50 per person on the New Zealand Roadtrip/);
  assert.match(one.html, /Hi there,/);
});

test('sends each family their code email once, tracks it per trip, staff only', async () => {
  const sent = [];
  const mailer = async (cfg, msg) => { sent.push(msg); return { accepted: msg.to }; };
  const s = await start(null, { mail: { host: 'x', from: 'no-reply@example.com' }, mailer });
  try {
    const join = (email, trips) => s.call('POST', '/signups', { campaign: 'black-friday-2026', name: 'Fam ' + email, email, trips: trips.map((slug) => ({ slug, title: slug })) }, null);
    await join('a@example.com', ['austria-fall', 'morocco']);
    await join('b@example.com', ['morocco']);
    await join('c@example.com', ['new-zealand', 'austria-winter']);
    const list = (await s.call('GET', '/signups?campaign=black-friday-2026')).body;
    const by = (e) => list.find((r) => r.email === e);
    assert.deepEqual(by('a@example.com').bfDue, ['austria-fall']);
    assert.deepEqual(by('b@example.com').bfDue, []);
    assert.deepEqual(by('c@example.com').bfDue, ['new-zealand', 'austria-winter']);

    // staff only
    assert.equal((await s.call('POST', `/bf-email/send/${by('a@example.com').id}`, null, null)).status, 401);
    assert.equal((await s.call('GET', '/bf-email/info', null, null)).status, 401);
    assert.equal((await s.call('GET', '/bf-email/info')).body.mailReady, true);

    // preview: nothing sent
    const pv = await s.call('GET', `/bf-email/preview/${by('c@example.com').id}`);
    assert.equal(pv.status, 200); assert.match(pv.body.html, /BFNEWZEALAND/);
    assert.equal(sent.length, 0);

    // test: goes to the given address, marks nothing
    const t = await s.call('POST', '/bf-email/test', { to: 'me@example.com', signupId: by('a@example.com').id });
    assert.equal(t.status, 200);
    assert.equal(sent.length, 1); assert.equal(sent[0].to, 'me@example.com'); assert.match(sent[0].subject, /^\[Test\]/);
    assert.deepEqual((await s.call('GET', '/signups')).body.find((r) => r.email === 'a@example.com').bfDue, ['austria-fall']);

    // real send: marked, and a second send is refused
    const r1 = await s.call('POST', `/bf-email/send/${by('a@example.com').id}`);
    assert.equal(r1.status, 200);
    assert.equal(sent[1].to, 'a@example.com'); assert.ok(!/^\[Test\]/.test(sent[1].subject));
    assert.deepEqual(r1.body.emailed.map((e) => [e.slug, e.code]), [['austria-fall', 'BFAUSTRIA']]);
    assert.deepEqual(r1.body.bfDue, []);
    assert.equal((await s.call('POST', `/bf-email/send/${by('a@example.com').id}`)).status, 409);
    assert.equal((await s.call('POST', `/bf-email/send/${by('b@example.com').id}`)).status, 409);   // no code yet
    assert.equal(sent.length, 2);

    // two clicks at once: only one email
    const c = by('c@example.com').id;
    const both = await Promise.all([s.call('POST', `/bf-email/send/${c}`), s.call('POST', `/bf-email/send/${c}`)]);
    assert.deepEqual(both.map((x) => x.status).sort(), [200, 409]);
    assert.equal(sent.length, 3);

    // signing up again later for another sale trip: only the new trip is due
    await join('a@example.com', ['austria-summer']);
    assert.deepEqual((await s.call('GET', '/signups')).body.find((r) => r.email === 'a@example.com').bfDue, ['austria-summer']);
  } finally { await s.close(); }
});

test('unsubscribe: the link needs its signature, GET only asks, POST unsubscribes, then never emailed again', async () => {
  const sent = [];
  const s = await start(null, { mail: { host: 'x' }, mailer: async (cfg, msg) => { sent.push(msg); } });
  try {
    await s.call('POST', '/signups', { campaign: 'black-friday-2026', name: 'A', email: 'a@example.com', trips: [{ slug: 'austria-fall', title: 'x' }] }, null);
    const id = (await s.call('GET', '/signups')).body[0].id;
    const { unsubUrl } = require('./server');
    const link = unsubUrl(SECRET, id).replace('https://worldschoolingjourneys.com/site-api', '');
    const raw = (m, p) => fetch(s.base + p, { method: m }).then(async (r) => ({ status: r.status, text: await r.text() }));
    // the email carries the link + one-click headers
    const pv = await s.call('GET', `/bf-email/preview/${id}`);
    assert.ok(pv.body.html.includes(unsubUrl(SECRET, id).replace(/&/g, '&amp;')));
    assert.equal((await raw('GET', `/unsubscribe?id=${id}&t=wrongwrongwrongwrongwron`)).status, 400);
    const ask = await raw('GET', link);
    assert.equal(ask.status, 200); assert.match(ask.text, /Yes, unsubscribe me/);
    assert.deepEqual((await s.call('GET', '/signups')).body[0].bfDue, ['austria-fall']);   // just opening the link changes nothing
    const done = await raw('POST', link);
    assert.equal(done.status, 200); assert.match(done.text, /unsubscribed/);
    const row = (await s.call('GET', '/signups')).body[0];
    assert.ok(row.unsubscribedAt); assert.deepEqual(row.bfDue, []);
    assert.equal((await s.call('POST', `/bf-email/send/${id}`)).status, 409);
    assert.equal(sent.length, 0);
    assert.match((await raw('GET', '/unsubscribe?test=1')).text, /test email/);
  } finally { await s.close(); }
});

test('a failed send is not marked, and missing mail settings give a clear message', async () => {
  const mailer = async () => { throw new Error('Mail server said: 550 no'); };
  const s = await start(null, { mail: { host: 'x' }, mailer });
  const s2 = await start(null, { mail: null });
  try {
    await s.call('POST', '/signups', { campaign: 'black-friday-2026', name: 'A', email: 'a@example.com', trips: [{ slug: 'austria-fall', title: 'x' }] }, null);
    const id = (await s.call('GET', '/signups')).body[0].id;
    assert.equal((await s.call('POST', `/bf-email/send/${id}`)).status, 502);
    assert.deepEqual((await s.call('GET', '/signups')).body[0].bfDue, ['austria-fall']);
    const t = await s2.call('POST', '/bf-email/test', { to: 'me@example.com' });
    assert.equal(t.status, 503); assert.match(t.body.message, /isn.t set up/);
  } finally { await s.close(); await s2.close(); }
});

test('smtp.js talks to a mail server and sends a proper message', async () => {
  const seen = [];
  const fake = net.createServer((sock) => {
    let data = false, body = '';
    sock.write('220 fake ready\r\n');
    sock.on('data', (d) => {
      for (const line of d.toString().split('\r\n').filter((l, i, a) => i < a.length - 1 || l)) {
        if (data) { if (line === '.') { data = false; seen.push(['BODY', body]); sock.write('250 queued\r\n'); } else body += line + '\r\n'; continue; }
        seen.push(line);
        if (/^EHLO/.test(line)) sock.write('250-fake\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH/.test(line)) sock.write('235 ok\r\n');
        else if (/^DATA/.test(line)) { data = true; sock.write('354 go\r\n'); }
        else if (/^QUIT/.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 ok\r\n');
      }
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  try {
    const cfg = { host: '127.0.0.1', port: fake.address().port, user: 'u', pass: 'p', from: 'no-reply@example.com', replyTo: 'booking@example.com' };
    await sendMail(cfg, { to: 'fam@example.com', subject: 'Save €50 per person', text: 'hi', html: '<p>hi</p>' }, { insecure: true });
    assert.ok(seen.includes('MAIL FROM:<no-reply@example.com>'));
    assert.ok(seen.includes('RCPT TO:<fam@example.com>'));
    const body = seen.find((x) => Array.isArray(x))[1];
    assert.match(body, /Reply-To: <booking@example.com>/);
    assert.match(body, /Subject: =\?UTF-8\?B\?/);
    assert.match(body, /multipart\/alternative/);
    await sendMail(cfg, { to: 'fam@example.com', subject: 's', text: 't', html: 'h', unsubscribe: 'https://x.test/u?id=1' }, { insecure: true });
    const body2 = seen.filter((x) => Array.isArray(x))[1][1];
    assert.match(body2, /List-Unsubscribe: <https:\/\/x.test\/u\?id=1>/);
    assert.match(body2, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    await assert.rejects(sendMail(cfg, { to: 'not an email', subject: 's', text: 't', html: 'h' }, { insecure: true }), /doesn.t look right/);
    await assert.rejects(sendMail(null, { to: 'a@b.co' }), /isn.t set up/);
  } finally { fake.close(); }
  assert.match(buildMessage({ from: 'a@b.co', fromName: 'W', to: 'c@d.co', subject: 's', text: 't', html: 'h' }), /^From: W <a@b.co>/);
});

// ---------- link previews for cruise / journey pages ----------
const { createPreview, describeCruise } = require('./preview');

test('link previews: each cruise and journey gets its own title, description and picture', async () => {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    if (url.endsWith('/cruises/by-slug/med-cruise-sep-2027')) return { title: '8-day Worldschooling Mediterranean Cruise', slug: 'med-cruise-sep-2027', subtitle: 'Ten ports, five countries, one floating classroom', sailDates: 'Sep 5 – 13, 2027', ship: { name: 'Sun Princess' }, heroImageUrl: '/uploads/med.webp' };
    if (url.endsWith('/cruises/by-business-id/RC-19SEP2026-MIA-MIA')) return { title: 'Icon Cruise', slug: 'icon-cruise-sep-2026', subtitle: 'Big ship fun', sailDates: 'Sep 19 – 26, 2026', ship: { name: 'Icon of the Seas' }, heroImageUrl: 'https://example.com/icon.jpg' };
    if (url.endsWith('/back-to-backs/by-slug/BB-X')) return { title: 'Asia Journey', slug: 'BB-X', headline: 'Fifty-seven nights from Tokyo to Auckland on one ship', cruises: [{}, {}, {}, {}], heroImageUrl: '/uploads/nz.webp' };
    if (url.includes('/by-slug/broken')) throw new Error('API down');
    return null;
  };
  const preview = createPreview({ fetchJson });
  const s = await start(null, { preview });
  try {
    const get = async (p, ua) => { const r = await fetch(s.base + p); return { status: r.status, text: await r.text() }; };
    const med = await get('/preview/cruises/med-cruise-sep-2027');
    assert.equal(med.status, 200);
    assert.match(med.text, /<meta property="og:title" content="8-day Worldschooling Mediterranean Cruise \| Worldschooling Journeys">/);
    assert.match(med.text, /<meta name="description" content="Ten ports, five countries, one floating classroom\. Sep 5 – 13, 2027 on Sun Princess\. A community-led worldschooling cruise for homeschool families\.">/);
    assert.match(med.text, /og:image" content="https:\/\/api\.worldschoolingjourneys\.com\/uploads\/med\.webp"/);   // no deploy-made JPG here: the header photo
    assert.match(med.text, /og:url" content="https:\/\/worldschoolingjourneys\.com\/cruises\/med-cruise-sep-2027"/);
    // an old booking-code link: looked up by code, canonical address = the cruise's slug
    const old = await get('/preview/cruises/RC-19SEP2026-MIA-MIA');
    assert.match(old.text, /og:url" content="https:\/\/worldschoolingjourneys\.com\/cruises\/icon-cruise-sep-2026"/);
    assert.match(old.text, /og:image" content="https:\/\/example\.com\/icon\.jpg"/);
    const j = await get('/preview/journeys/BB-X');
    assert.match(j.text, /Fifty-seven nights from Tokyo to Auckland on one ship\. 4 back-to-back community-led cruises for homeschool families\./);
    // unknown cruise or the cruise system down: still a valid general preview, never an error
    for (const p of ['/preview/cruises/nope', '/preview/cruises/broken']) {
      const g = await get(p);
      assert.equal(g.status, 200); assert.match(g.text, /images\/share\/worldschooling-journeys\.jpg/);
    }
    // cached: asking again doesn't call the cruise system again
    const before = calls.length; await get('/preview/cruises/med-cruise-sep-2027'); assert.equal(calls.length, before);
    // titles/descriptions are escaped
    assert.ok(!/<script/i.test((await get('/preview/cruises/%3Cscript%3E')).text.replace(/<\/?(html|head|body|meta|title|link|h1|p|img|a)\b[^>]*>/g, '')));
  } finally { await s.close(); }
});

test('cruise descriptions stay within 160 characters', () => {
  const d = describeCruise({ subtitle: 'x'.repeat(50) + ' ' + 'word '.repeat(40), sailDates: 'Oct 30 – Nov 21, 2027', ship: { name: 'Majestic Princess' } });
  assert.ok(d.length <= 160, d.length);
  assert.ok(!/—/.test(d));
});

// ---------- contact form messages ----------
test('contact messages: the form saves partner/jobs/press/general, staff list, mark handled and delete', async () => {
  const s = await start(null);
  try {
    const post = (b) => s.call('POST', '/messages', { fullName: 'Ana Silva', email: 'Ana@Example.com', message: 'Hello!', page: '/contact', ...b }, null);
    assert.equal((await post({ reason: 'jobs' })).status, 201);
    assert.equal((await post({ reason: 'partner', message: 'Collab idea' })).status, 201);
    assert.equal((await post({ reason: 'press' })).status, 201);
    assert.equal((await post({ reason: 'general' })).status, 201);
    assert.equal((await post({ reason: 'cruise' })).status, 400);          // cruise / land trip questions aren't saved
    assert.equal((await post({ reason: 'jobs', email: 'nope' })).status, 400);
    assert.equal((await post({ reason: 'jobs', message: '' })).status, 400);
    assert.equal((await post({ reason: 'jobs', website: 'http://spam' })).status, 201);   // bot: "ok", not saved
    assert.equal((await s.call('GET', '/messages', null, null)).status, 401);
    const all = (await s.call('GET', '/messages')).body;
    assert.equal(all.length, 4);
    assert.equal(all[0].email, 'ana@example.com'); assert.equal(all[0].handled, false);
    const jobs = (await s.call('GET', '/messages?reason=jobs')).body;
    assert.equal(jobs.length, 1);
    assert.equal((await s.call('PATCH', `/messages/${jobs[0].id}`, { handled: true }, null)).status, 401);
    assert.equal((await s.call('PATCH', `/messages/${jobs[0].id}`, { handled: 'yes' })).status, 400);
    assert.equal((await s.call('PATCH', `/messages/${jobs[0].id}`, { handled: true })).body.handled, true);
    assert.equal((await s.call('DELETE', `/messages/${jobs[0].id}`)).status, 200);
    assert.equal((await s.call('GET', '/messages')).body.length, 3);
    assert.equal((await s.call('DELETE', `/messages/${jobs[0].id}`)).status, 404);
  } finally { await s.close(); }
});
