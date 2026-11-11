// Link previews for cruise and back-to-back pages (since 2026-11-11).
// Facebook, WhatsApp, iMessage, LinkedIn, X... read a page's tags without running its scripts, and the cruise
// and journey pages only fill in their cruise after loading it. So for THOSE robots only, Caddy sends
// /cruises/<slug> and /journeys/<slug> here (server/Caddyfile.site, @previewBot), and this answers with a
// tiny page carrying that cruise's own title, description and picture. Visitors never see it.
// Picture: images/share/cruises/<slug>.jpg (or journeys/) made at deploy time by tools/share-cruise-images.js;
// until the next deploy a new cruise uses its header photo as it is.
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://worldschoolingjourneys.com';
const API = process.env.CRUISE_API || 'https://api.worldschoolingjourneys.com';
const WEBSITE_DIR = process.env.WEBSITE_DIR || path.join(__dirname, '..', 'website');   // ~/apps/website on the VPS
const DEFAULT_IMAGE = `${SITE}/images/share/worldschooling-journeys.jpg`;
const CACHE_MS = 10 * 60 * 1000;
const BUSINESS_ID = /^[A-Z]{2}-\d{2}[A-Z]{3}\d{4}-[A-Z0-9]+-[A-Z0-9]+$/;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pictureUrl = (p) => (!p ? null : p.startsWith('/uploads/') ? API + p : p.startsWith('/') ? SITE + p : p);
// at most 160 characters, cut at a word
function clip(text, max = 160) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 3).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '...';
}
const sentence = (s) => { const t = String(s || '').trim(); return !t ? '' : /[.!?]$/.test(t) ? t : t + '.'; };

function describeCruise(c) {
  const when = [c.sailDates, c.ship && c.ship.name ? `on ${c.ship.name}` : ''].filter(Boolean).join(' ');
  const facts = when ? sentence(when) + ' ' : '';
  // the cruise's own one-line text from Admin (subtitle), then dates + ship, then what we are
  const full = `${sentence(c.subtitle)} ${facts}A community-led worldschooling cruise for homeschool families.`.trim();
  return full.length <= 160 ? full : clip(`${sentence(c.subtitle)} ${facts}`.trim()) || clip(full);
}
function describeJourney(j) {
  const n = (j.cruises || []).length;
  const lead = sentence(j.headline) || sentence(j.shortDescription);
  const full = `${lead} ${n ? `${n} back-to-back community-led cruises for homeschool families.` : ''}`.trim();
  return full.length <= 160 ? full : clip(lead || j.shortDescription || full);
}

// same file name as tools/share-cruise-images.js
function sharePicture(kind, slug, fallback) {
  const name = slug.replace(/[^A-Za-z0-9._-]/g, '_') + '.jpg';
  try { if (fs.existsSync(path.join(WEBSITE_DIR, 'images', 'share', kind, name))) return `${SITE}/images/share/${kind}/${name}`; } catch {}
  return pictureUrl(fallback) || DEFAULT_IMAGE;
}

function page({ title, desc, url, image }) {
  const t = esc(title), d = esc(desc);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Worldschooling Journeys">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${esc(image)}">${image.endsWith('.jpg') && image.startsWith(SITE + '/images/share/') ? '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(image)}">
</head><body><h1>${t}</h1><p>${d}</p><p><img src="${esc(image)}" alt="" width="600"></p><p><a href="${esc(url)}">${esc(url)}</a></p></body></html>`;
}

function createPreview({ fetchJson = defaultFetch } = {}) {
  const cache = new Map();   // "kind/slug" -> { at, html }
  async function build(kind, slug) {
    try {
      if (kind === 'cruises') {
        const c = await fetchJson(`${API}/cruises/${BUSINESS_ID.test(slug) ? 'by-business-id' : 'by-slug'}/${encodeURIComponent(slug)}`);
        if (c && c.title) {
          const s = c.slug || slug;
          return page({ title: `${c.title} | Worldschooling Journeys`, desc: describeCruise(c), url: `${SITE}/cruises/${encodeURIComponent(s)}`, image: sharePicture('cruises', s, c.heroImageUrl) });
        }
      } else {
        const j = await fetchJson(`${API}/back-to-backs/by-slug/${encodeURIComponent(slug)}`);
        if (j && (j.title || (j.cruises || []).length)) {
          const s = j.slug || slug;
          return page({ title: `${j.title || 'Back-to-Back Journey'} | Worldschooling Journeys`, desc: describeJourney(j), url: `${SITE}/journeys/${encodeURIComponent(s)}`, image: sharePicture('journeys', s, j.heroImageUrl) });
        }
      }
    } catch { /* the cruise system didn't answer: general preview below */ }
    return page({ title: 'Worldschooling Journeys | Community-Led Cruises & Guided Land Trips', url: `${SITE}/${kind}/${encodeURIComponent(slug)}`, image: DEFAULT_IMAGE,
      desc: 'Community-led worldschooling cruises and guided land trips for homeschool families. Travel the world, learn together and make lifelong friends.' });
  }
  // kind: "cruises" | "journeys"
  return async function preview(kind, slug) {
    const key = `${kind}/${slug}`, hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.html;
    const html = await build(kind, slug);
    cache.set(key, { at: Date.now(), html });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return html;
  };
}
async function defaultFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json();
}

module.exports = { createPreview, describeCruise, describeJourney };
