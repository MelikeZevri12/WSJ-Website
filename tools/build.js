// Builds the site that gets uploaded: copies frontend/ into an output folder,
// fills in the shared navbar/footer (tools/includes.js) and leaves out
// everything that stays on this PC. Run by deploy.cmd:
//   node tools\build.js <outputFolder>
const fs = require('fs');
const path = require('path');
const { expand } = require('./includes');
const { ENABLED: CLEAN_URLS, landTripSlugs, checkLandTrips, cleanLinks, redirectPage } = require('./clean-urls');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tools/build.js <outputFolder>'); process.exit(1); }

// stays on this PC: local test server, design mockups, build tools, logs, the Caddy config copy (server/)
// (the admin dashboard IS uploaded: <site>/admin, behind the staff login)
const SKIP = new Set(['.git', '.github', 'server.js', 'server', 'templates', 'partials', 'tools', 'deploy.cmd',
  'desktop.ini', '.gitignore', '.gitattributes', '.htaccess', 'node_modules', 'README.md', 'CLAUDE.md']);

// Links to our own .css/.js files get ?v=<fingerprint of the file>, so a
// changed file always reaches visitors (browsers keep old copies otherwise).
const crypto = require('crypto');
const fingerprint = {};
const versioned = (html) => html.replace(/((?:href|src)=")(\/(?:css|js)\/[\w.-]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, attr, file) => {
  if (!(file in fingerprint)) { const p = path.join(ROOT, file); fingerprint[file] = fs.existsSync(p) ? crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 8) : null; }
  return fingerprint[file] ? `${attr}${file}?v=${fingerprint[file]}"` : m;
});

// Addresses without .html (tools/clean-urls.js): stop if a land trip would get a wrong one.
const slugs = landTripSlugs();
const problems = checkLandTrips(slugs);
if (problems.length) { console.error('Land trip addresses:\n  ' + problems.join('\n  ')); process.exit(1); }

fs.rmSync(OUT, { recursive: true, force: true });
let pages = 0, files = 0;
(function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.endsWith('.log') || e.name === 'desktop.ini') continue;
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (e.isDirectory()) copy(src, dst);
    else if (e.name.endsWith('.html')) {
      // a land trip is saved under its new name; its old name forwards there
      const tripId = CLEAN_URLS && path.basename(from) === 'land-trips' && from !== ROOT ? e.name.slice(0, -5) : null;
      const page = versioned(expand(fs.readFileSync(src, 'utf8'), src));
      const html = CLEAN_URLS ? cleanLinks(page, slugs) : page;
      if (tripId && slugs[tripId]) {
        fs.writeFileSync(path.join(to, slugs[tripId] + '.html'), html);
        fs.writeFileSync(dst, redirectPage(`/land-trips/${slugs[tripId]}`));
      } else fs.writeFileSync(dst, html);
      pages++;
    }
    else { fs.copyFileSync(src, dst); files++; }
  }
})(ROOT, OUT);

// a page still showing an include marker means a partial is missing
const leftover = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? leftover(path.join(dir, e.name))
  : e.name.endsWith('.html') && /<!--\s*include\s/.test(fs.readFileSync(path.join(dir, e.name), 'utf8')) ? [e.name] : []);
const bad = leftover(OUT);
if (bad.length) { console.error('Include not filled in: ' + bad.join(', ')); process.exit(1); }
console.log(`Built ${pages} pages + ${files} other files into ${OUT}`);

// sitemap.xml + robots.txt (tools/sitemap.js)
if (CLEAN_URLS) require('./sitemap').writeSitemap(OUT).then((info) => console.log(`Sitemap: ${info}`));
