// Search + sharing tags for every public page (since 2026-11-11).
// For each page below: the Google description, and the picture shown when the page is shared
// (Facebook, WhatsApp, iMessage, LinkedIn, X...). Run from the frontend folder:
//     node tools/seo-pages.js
// It (1) makes the sharing pictures, 1200x630 JPGs in images/share/, from the photo named here
// (using the Playwright browser in ../backend/node_modules), and (2) writes the tags between
// <!-- seo --> and <!-- /seo --> in each page's <head> (replacing what's there, so it's safe to re-run).
// Change a description or a photo: edit it below and run it again, then deploy.
// Cruise and back-to-back pages also update their tags with each cruise's own title, text and photo once
// it loads (cruise-detail.html / journey.html, setShareTags); the tags here are their fallback.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://worldschoolingjourneys.com';
const DEFAULT_PHOTO = 'images/site/hero-group-photo-656b03e1fc.jpg';

// file -> { url: the page's address, desc: Google description (<= 160 characters, no em dashes),
//           photo: source photo for the sharing picture, share: name of the JPG in images/share/,
//           band: optional red text band on the picture (Black Friday), ogTitle: sharing title when the page's <title> isn't a good one }
// desc: null keeps the description the page already has.
const PAGES = {
  'home.html': { url: '/', share: 'worldschooling-journeys', ogTitle: 'Worldschooling Journeys | Community-Led Cruises & Guided Land Trips',
    desc: 'Community-led worldschooling cruises and guided land trips for homeschool families. Travel the world, learn together and make lifelong friends.' },
  'about.html': { url: '/about', photo: 'images/land-trips/austria/group-on-the-peak.webp', share: 'about',
    desc: 'Meet the team behind Worldschooling Journeys: community-led cruises and guided land trips for homeschool families who want connection and real-world learning.' },
  'about-our-trips.html': { url: '/about-our-trips', share: 'worldschooling-journeys',
    desc: 'How our community-led worldschooling cruises and guided land trips work, what each one is really like, and which one fits your homeschool family.' },
  'contact.html': { url: '/contact', share: 'worldschooling-journeys',
    desc: 'Questions about a worldschooling cruise or land trip? Send the Worldschooling Journeys team a message, or reach us on WhatsApp or our chatbot.' },
  'faq.html': { url: '/faq', share: 'worldschooling-journeys',
    desc: 'Answers to common questions about Worldschooling Journeys: how booking works, payments, and what to expect on our community-led cruises and guided land trips.' },
  'stay-updated.html': { url: '/stay-updated', share: 'worldschooling-journeys',
    desc: 'Be the first to hear about new worldschooling cruises and land trips: join our newsletter, our Facebook group and our WhatsApp community.' },
  'testimonials.html': { url: '/testimonials', share: 'worldschooling-journeys', desc: null },
  'worldschooling-trips.html': { url: '/worldschooling-trips', share: 'worldschooling-journeys', ogTitle: 'Worldschooling Trips | Worldschooling Journeys',
    desc: 'Browse upcoming worldschooling trips for homeschool families: community-led cruises, back-to-back cruise journeys and guided land trips around the world.' },
  'roadmap.html': { url: '/roadmap', share: 'worldschooling-journeys', desc: null },
  'terms-and-conditions.html': { url: '/terms-and-conditions', share: 'worldschooling-journeys',
    desc: 'Terms and conditions for booking a Worldschooling Journeys trip with Every Avenue Travel, LLC, a Florida Seller of Travel (Reg. No. ST45213).' },
  'cancellation-policy.html': { url: '/cancellation-policy', share: 'worldschooling-journeys',
    desc: 'Cancellation and refund policy for Worldschooling Journeys cruises and land trips: deposits, payment deadlines, refunds and travel insurance.' },
  'privacy-policy.html': { url: '/privacy-policy', share: 'worldschooling-journeys',
    desc: 'How Worldschooling Journeys (Every Avenue Travel, LLC) collects, uses and protects your personal information when you visit our website or book a trip.' },
  'black-friday.html': { url: '/black-friday', share: 'black-friday', band: 'Black Friday Deals', desc: null },
  'cruise-detail.html': { url: '/worldschooling-trips', share: 'worldschooling-journeys', noUrl: true,
    desc: 'A community-led worldschooling cruise for homeschool families: see the itinerary, cabin prices, port excursions and which families are already coming.' },
  'journey.html': { url: '/worldschooling-trips', share: 'worldschooling-journeys', noUrl: true,
    desc: 'A back-to-back worldschooling journey: several community-led cruises in a row for homeschool families. See the route, cabin prices and who is coming.' },
  // land trips: the header photo of each trip; the address comes from js/trips.js (see landPath)
  'land-trips/austria-summer.html': { land: true, photo: 'images/land-trips/austria-summer.webp', share: 'austria-summer',
    desc: 'Two weeks in the Austrian Alps with other homeschool families: forests, waterfalls, thermal spas and mountain villages in Salzburgerland. All ages welcome.' },
  'land-trips/austria-fall.html': { land: true, photo: 'images/land-trips/austria-fall.webp', share: 'austria-fall',
    desc: 'A two-week worldschooling retreat among Salzburgerland’s golden peaks: alpine traditions, thermal spas, hikes and lifelong friendships. All ages welcome.' },
  'land-trips/austria-winter.html': { land: true, photo: 'images/land-trips/austria-winter.webp', share: 'austria-winter',
    desc: 'Ski, snowboard and explore Austrian Christmas markets with other homeschool families on our two-week winter retreat in Salzburgerland. All ages welcome.' },
  'land-trips/austria-wellness.html': { land: true, photo: 'images/land-trips/austria/wellness-header.webp', share: 'austria-wellness',
    desc: 'A three-week family wellness retreat in the Austrian Alps: thermal spas, mountain air, optional Healing Gallery therapy and a Kids Club while you rest.' },
  'land-trips/dude-ranch.html': { land: true, photo: 'images/land-trips/dude-ranch.webp', share: 'dude-ranch',
    desc: 'A week at a Wyoming guest ranch with other homeschool families: your own horse, cattle drives, private river fishing, archery and trap shooting.' },
  'land-trips/egypt-jordan.html': { land: true, photo: 'images/land-trips/egypt-jordan.webp', share: 'egypt-jordan',
    desc: 'See the Pyramids of Giza, cruise the Nile, walk into Petra and explore the Wadi Rum desert on a 15-day guided worldschooling adventure for families.' },
  'land-trips/galapagos.html': { land: true, photo: 'images/land-trips/galapagos.webp', share: 'galapagos',
    desc: 'Island-hop the Galápagos with other homeschool families: snorkel with sea lions and sea turtles, meet giant tortoises and explore three islands. Ages 3+.' },
  'land-trips/morocco.html': { land: true, photo: 'images/land-trips/morocco.webp', share: 'morocco',
    desc: 'A 12-day guided family journey through Morocco: ancient medinas, mountain villages, a camel trek and a desert camp. For worldschooling families, ages 4+.' },
  'land-trips/new-zealand.html': { land: true, photo: 'images/land-trips/new-zealand.webp', share: 'new-zealand',
    desc: 'A 21-day guided road trip across New Zealand’s North and South Islands with homeschool families: glaciers, national parks, Māori culture and Hobbiton.' },
  'land-trips/xcaret.html': { land: true, photo: 'images/land-trips/xcaret.webp', share: 'xcaret',
    desc: 'A family adventure in Mexico’s Riviera Maya with other worldschooling families, exploring the Xcaret parks: Xcaret Plus, Xel-Há, Xplor and Xenses.' },
};

// a land trip's address: the title from js/trips.js minus "N-day Worldschooling" (same rule as js/trips.js / tools/clean-urls.js)
function landPath(slug) {
  const src = fs.readFileSync(path.join(ROOT, 'js/trips.js'), 'utf8');
  const m = src.match(new RegExp(`"slug":"${slug}"[^}]*?"title":"([^"]+)"`));
  if (!m) throw new Error(`no title for ${slug} in js/trips.js`);
  return '/land-trips/' + m[1].replace(/^\s*\d+[\s-]*days?\s+/i, '').replace(/\bworldschooling\b/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const esc = (s) => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function makeImages() {
  const { chromium } = require(path.join(ROOT, '..', 'backend', 'node_modules', 'playwright'));
  const outDir = path.join(ROOT, 'images', 'share');
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = new Map();
  for (const p of Object.values(PAGES)) jobs.set(p.share, { photo: p.photo || DEFAULT_PHOTO, band: p.band });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [name, j] of jobs) {
    const img = fs.readFileSync(path.join(ROOT, j.photo));
    const mime = j.photo.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const band = j.band ? `<div style="position:absolute;left:0;right:0;top:0;background:#c8102e;color:#fff;font:800 54px/1 'Segoe UI',Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:30px 0;">${j.band}</div>` : '';
    await page.setContent(`<body style="margin:0"><div style="position:relative;width:1200px;height:630px;background:url(data:${mime};base64,${img.toString('base64')}) center 35%/cover">${band}</div></body>`);
    await page.waitForTimeout(150);
    const file = path.join(outDir, `${name}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    console.log(`picture: images/share/${name}.jpg (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
  await b.close();
}

function writeTags() {
  const problems = [];
  for (const [file, p] of Object.entries(PAGES)) {
    const f = path.join(ROOT, file);
    let html = fs.readFileSync(f, 'utf8');
    html = html.replace(/\n?<!-- seo -->[\s\S]*?<!-- \/seo -->/, '');
    const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Worldschooling Journeys');
    const existing = html.match(/<meta name="description" content="([^"]*)">/);
    const desc = p.desc || (existing && decode(existing[1]));
    if (!desc) problems.push(`${file}: no description`);
    else if (desc.length > 160) problems.push(`${file}: description is ${desc.length} characters (Google shows about 155-160)`);
    if (/—/.test(desc || '')) problems.push(`${file}: em dash in the description`);
    if (/gastein|mondi/i.test(desc || '')) problems.push(`${file}: mentions a place the Austria pages must not name`);
    if (p.desc && existing) html = html.replace(/\n?<meta name="description" content="[^"]*">/, '');
    const url = SITE + (p.land ? landPath(path.basename(file, '.html')) : p.url);
    const image = `${SITE}/images/share/${p.share}.jpg`;
    const tags = [
      '<!-- seo -->',
      ...(p.desc || !existing ? [`<meta name="description" content="${esc(desc)}">`] : []),
      ...(p.noUrl ? [] : [`<link rel="canonical" href="${url}">`, `<meta property="og:url" content="${url}">`]),
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Worldschooling Journeys">',
      `<meta property="og:title" content="${esc(p.ogTitle || title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:image" content="${image}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:image" content="${image}">`,
      '<!-- /seo -->',
    ].join('\n');
    if (!/<\/title>/.test(html)) { problems.push(`${file}: no <title>`); continue; }
    html = html.replace(/(<title>[^<]*<\/title>)/, `$1\n${tags}`);
    fs.writeFileSync(f, html);
    console.log(`tags: ${file}  ->  ${p.noUrl ? '(address set by the page)' : url}`);
  }
  if (problems.length) { console.log('\nPROBLEMS:\n  ' + problems.join('\n  ')); process.exitCode = 1; }
}

(async () => {
  if (!process.argv.includes('--tags-only')) await makeImages();
  writeTags();
})();
