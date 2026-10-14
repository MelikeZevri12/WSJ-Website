const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { expand } = require('./tools/includes');
const { ENABLED: CLEAN_URLS, cleanLinks, resolvePath } = require('./tools/clean-urls');

const PORT = 5173;
const ROOT = __dirname;

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  // /cruises/[slug] is a single reusable template (cruise-detail.html), not a
  // real file per cruise - the slug is read client-side from location.pathname.
  const isCruiseDetailRoute = urlPath.startsWith('/cruises/');
  // /journeys/[slug] - same idea, one template (journey.html) for every
  // 3+ cruise back-to-back journey.
  const isJourneyRoute = urlPath.startsWith('/journeys/');
  const filePath = urlPath === '/' ? '/home.html'
    : isCruiseDetailRoute ? '/cruise-detail.html'
    : isJourneyRoute ? '/journey.html'
    // addresses without .html: /about → about.html, /land-trips/<trip title> → land-trips/<id>.html
    : resolvePath(urlPath) || urlPath;
  const resolved = path.join(ROOT, filePath);

  fs.readFile(resolved, (err, data) => {
    if (err) {
      // No literal file at this path (and it's not the /cruises/ route) -
      // treat it as a shareable cruise booking-form link, e.g.
      // /RC-19SEP2026-MIA-MIA (the businessId, read client-side from
      // location.pathname by booking-form.html itself). Only for
      // extension-less paths, so a genuinely missing asset (a typo'd .png,
      // a missing .css) still 404s normally instead of silently rendering
      // the booking form.
      if (!isCruiseDetailRoute && !path.extname(urlPath)) {
        fs.readFile(path.join(ROOT, 'booking-form.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    // pages: fill in the shared navbar/footer, same as the deploy build does
    if (ext === '.html') {
      try { data = expand(data.toString('utf8'), resolved); if (CLEAN_URLS) data = cleanLinks(data); }
      catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end(e.message); return; }
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Frontend serving on http://localhost:${PORT}`));
