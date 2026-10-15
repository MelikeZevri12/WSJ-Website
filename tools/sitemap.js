// sitemap.xml + robots.txt for search engines, written into the built site by tools/build.js.
// Lists the content pages, every land trip and every cruise / journey the API has right now
// (so it's as fresh as the last deploy). If the API can't be reached, cruises are left out.
const fs = require('fs');
const path = require('path');
const { landTripSlugs } = require('./clean-urls');

const SITE = 'https://worldschoolingjourneys.com';
const API = 'https://api.worldschoolingjourneys.com';
const ROOT = path.join(__dirname, '..');
// templates and private pages: never listed
const NOT_LISTED = new Set(['home', 'admin', '404', 'booking-form', 'cruise-detail', 'journey']);

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function writeSitemap(outDir) {
  const paths = ['/'];
  for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()) {
    const name = f.slice(0, -5);
    if (!NOT_LISTED.has(name)) paths.push('/' + name);
  }
  for (const slug of Object.values(landTripSlugs()).sort()) paths.push('/land-trips/' + slug);
  let note = '';
  try {
    const cruises = await getJson(`${API}/cruises`);
    for (const c of cruises) if (c.slug && !c.isAddOn && !c.isIndividual && c.title) paths.push('/cruises/' + c.slug);
    const journeys = await getJson(`${API}/back-to-backs/journeys`);
    for (const j of journeys) if (j.slug) paths.push('/journeys/' + encodeURIComponent(j.slug));
  } catch (e) {
    note = ' (cruises left out: API not reachable)';
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + paths.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n') + '\n</urlset>\n';
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nDisallow: /admin\nSitemap: ${SITE}/sitemap.xml\n`);
  return `${paths.length} addresses${note}`;
}

module.exports = { SITE, writeSitemap };
