// Page addresses without ".html" (used by tools/build.js and server.js).
//  - /about.html → /about, /home.html → /  (links in every page are rewritten)
//  - land trips get their address from the trip title in js/trips.js, which is the
//    page header: "14-day Worldschooling Austrian Fall Mountain Retreat"
//    → /land-trips/austrian-fall-mountain-retreat. The file name (austria-fall) stays the
//    trip's ID for booking codes and waitlist signups (<body data-trip="...">).
// Source files keep their names and their ".html" links; only the built site changes.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Needs the Caddy routes on the VPS (/about → about.html, .html → redirect; set up 2026-10-14).
// Switching off goes together with CLEAN_LAND_TRIP_URLS in js/trips.js.
const ENABLED = true;

// Same rule as landTripPath() in js/trips.js and the cruise slugs in the API.
function slugify(title) {
  return title
    .replace(/^\s*\d+[\s-]*days?\s+/i, '').replace(/\bworldschooling\b/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// { 'austria-fall': 'austrian-fall-mountain-retreat', ... } from js/trips.js
function landTripSlugs() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'trips.js'), 'utf8');
  const map = {};
  for (const m of src.matchAll(/\{"slug":"([a-z0-9-]+)"[^\n]*?"title":"([^"]+)"/g)) map[m[1]] = slugify(m[2]);
  return map;
}

// Problems that would give a trip a wrong or clashing address (the build stops on these).
function checkLandTrips(map = landTripSlugs()) {
  const problems = [];
  const files = fs.readdirSync(path.join(ROOT, 'land-trips')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
  const src = fs.readFileSync(path.join(ROOT, 'js', 'trips.js'), 'utf8');
  for (const id of files) {
    if (!map[id]) { problems.push(`land-trips/${id}.html has no entry in js/trips.js`); continue; }
    const title = src.match(new RegExp(`"slug":"${id}"[^\\n]*?"title":"([^"]+)"`))[1];
    const page = fs.readFileSync(path.join(ROOT, 'land-trips', id + '.html'), 'utf8');
    if (!page.includes(`title: '${title.replace(/'/g, "\\'")}'`)) problems.push(`land-trips/${id}.html: header title differs from js/trips.js ("${title}")`);
    if (!new RegExp(`<body[^>]*data-trip="${id}"`).test(page)) problems.push(`land-trips/${id}.html: <body> needs data-trip="${id}"`);
    if (map[id] === id) problems.push(`land-trips/${id}.html: address would equal the file name`);
  }
  const seen = {};
  for (const [id, slug] of Object.entries(map)) {
    if (seen[slug]) problems.push(`${id} and ${seen[slug]} would share /land-trips/${slug}`);
    seen[slug] = id;
  }
  return problems;
}

const rootPages = () => new Set(fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)));

// Rewrites our own links in a page (href="/x.html", '/x.html' in scripts...).
function cleanLinks(html, map = landTripSlugs(), pages = rootPages()) {
  return html
    .replace(/\/land-trips\/([a-z0-9-]+)\.html(?=[?#"'`)\s])/g, (m, id) => (map[id] ? `/land-trips/${map[id]}` : m))
    .replace(/(["'`(=\s])\/([a-z0-9-]+)\.html(?=[?#"'`)\s])/g, (m, pre, name) =>
      name === 'home' ? `${pre}/` : pages.has(name) ? `${pre}/${name}` : m);
}

// Address → source file, for the local preview server (Caddy does the same with the built files).
function resolvePath(urlPath, map = landTripSlugs()) {
  const m = urlPath.match(/^\/land-trips\/([a-z0-9-]+)$/);
  if (m) { const id = Object.keys(map).find((k) => map[k] === m[1]); if (id) return `/land-trips/${id}.html`; }
  if (/^\/[a-z0-9-]+$/.test(urlPath) && fs.existsSync(path.join(ROOT, urlPath + '.html'))) return urlPath + '.html';
  return null;
}

// Tiny page left at an old address (/land-trips/austria-fall.html) that forwards
// visitors, query and #section included, to the trip's new address.
function redirectPage(to) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Moved</title>
<meta name="robots" content="noindex"><link rel="canonical" href="https://trips.worldschoolingjourneys.com${to}">
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p>This trip has moved to <a href="${to}">${to}</a>.</p></body></html>
`;
}

module.exports = { ENABLED, slugify, landTripSlugs, checkLandTrips, cleanLinks, resolvePath, redirectPage };
