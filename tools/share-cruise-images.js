// Sharing pictures for every cruise and back-to-back page, made at deploy time by tools/build.js (since 2026-11-11).
// Each one is the cruise's header photo cropped to 1200x630 and saved as JPG (most header photos are WebP, which
// WhatsApp and LinkedIn previews often don't show) into the built site at images/share/cruises/<slug>.jpg and
// images/share/journeys/<slug>.jpg. The website server's link previews (server/site-api/preview.js) use them.
// Pictures are kept in ../share-cache (outside git) and only made again when a cruise's header photo changes,
// so deploys stay quick. Needs the Playwright browser in ../backend/node_modules; if anything fails the deploy
// still goes on (previews then use the header photo as it is).
'use strict';
const fs = require('fs');
const path = require('path');

const API = 'https://api.worldschoolingjourneys.com';
const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, '..', 'share-cache');
const abs = (p) => (p.startsWith('/uploads/') ? API + p : p.startsWith('/') ? 'https://worldschoolingjourneys.com' + p : p);
const fileName = (slug) => slug.replace(/[^A-Za-z0-9._-]/g, '_') + '.jpg';

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function buildShareImages(outDir) {
  const today = new Date().toISOString().slice(0, 10);
  const cruises = await getJson(`${API}/cruises`);
  const journeys = await getJson(`${API}/back-to-backs/journeys`);
  const items = [
    ...cruises.filter((c) => c.slug && c.title && c.heroImageUrl && !c.isAddOn && !c.isIndividual && c.departureDate.slice(0, 10) >= today)
      .map((c) => ({ kind: 'cruises', slug: c.slug, photo: abs(c.heroImageUrl) })),
    ...journeys.filter((j) => j.slug && j.heroImageUrl && j.cruises && j.cruises.length && j.cruises[0].departureDate.slice(0, 10) >= today)
      .map((j) => ({ kind: 'journeys', slug: j.slug, photo: abs(j.heroImageUrl) })),
  ];
  const manifestFile = path.join(CACHE, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch {}
  const todo = items.filter((it) => manifest[`${it.kind}/${it.slug}`] !== it.photo || !fs.existsSync(path.join(CACHE, it.kind, fileName(it.slug))));

  let made = 0, failed = 0;
  if (todo.length) {
    const { chromium } = require(path.join(ROOT, '..', 'backend', 'node_modules', 'playwright'));
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
      for (const it of todo) {
        try {
          fs.mkdirSync(path.join(CACHE, it.kind), { recursive: true });
          await page.setContent(`<body style="margin:0"><img id="p" src="${it.photo.replace(/"/g, '%22')}" style="display:block;width:1200px;height:630px;object-fit:cover;object-position:center 40%"></body>`);
          const ok = await page.waitForFunction(() => { const i = document.getElementById('p'); return i.complete && (i.naturalWidth > 0 || 'broken'); }, null, { timeout: 20000 }).then((h) => h.jsonValue());
          if (ok === 'broken') throw new Error('picture did not load');
          await page.screenshot({ path: path.join(CACHE, it.kind, fileName(it.slug)), type: 'jpeg', quality: 82 });
          manifest[`${it.kind}/${it.slug}`] = it.photo; made++;
        } catch (e) { failed++; console.log(`  sharing picture not made for ${it.kind}/${it.slug}: ${e.message}`); }
      }
    } finally { await browser.close(); }
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
  }
  // copy this deploy's pictures into the built site
  let copied = 0;
  for (const it of items) {
    const from = path.join(CACHE, it.kind, fileName(it.slug));
    if (!fs.existsSync(from)) continue;
    const to = path.join(outDir, 'images', 'share', it.kind, fileName(it.slug));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to); copied++;
  }
  return `${copied} cruise/journey pictures (${made} new${failed ? `, ${failed} failed` : ''})`;
}

module.exports = { buildShareImages, fileName };

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { console.error('usage: node tools/share-cruise-images.js <outputFolder>'); process.exit(1); }
  buildShareImages(out).then(console.log, (e) => { console.error(e.message); process.exit(1); });
}
