// Adds testimonials from a file into the website server's data, on the VPS.
// Never overwrites anything edited in admin: it only
//   - adds the ones in "add" that aren't there yet (same name + same full text = already there), and
//   - fills in "fillFullText" for testimonials whose full text is still empty.
//
//   node import-testimonials.js imports/<file>.json            shows what it would do (changes nothing)
//   node import-testimonials.js imports/<file>.json --apply    does it (stop site-api first)
//
// The running server keeps the list in memory, so it must be stopped while this
// writes (it checks, and refuses otherwise). The current data file is backed up
// first to data/backups/testimonials-<date>-before-import.json.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const CATEGORIES = ['cruise', 'land_trip', 'port_excursion', 'austria_retreat'];
const norm = (s) => String(s || '').toLowerCase().replace(/\W+/g, '');

function serverIsRunning(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/site-api/health', timeout: 2000 }, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function plan(rows, changes, now = new Date().toISOString()) {
  const next = JSON.parse(JSON.stringify(rows));
  const log = [];
  let order = next.reduce((m, r) => Math.max(m, r.sortOrder || 0), 0);
  for (const t of changes.add || []) {
    if (!t.name || !(t.fullText || t.shortVersion) || !CATEGORIES.includes(t.category)) throw new Error(`Bad entry in "add": ${JSON.stringify(t).slice(0, 120)}`);
    if (next.some((r) => norm(r.name) === norm(t.name) && norm(r.fullText) === norm(t.fullText))) { log.push(`already there: ${t.name}`); continue; }
    order += 10;
    next.push({ id: crypto.randomUUID(), name: t.name, fullText: t.fullText || '', shortVersion: t.shortVersion || '', category: t.category, featured: false, sortOrder: order, createdAt: now, updatedAt: now });
    log.push(`ADD ${t.name} (${t.category})`);
  }
  for (const f of changes.fillFullText || []) {
    const r = next.find((x) => x.id === f.id);
    if (!r) { log.push(`not found, skipped: ${f.name} (${f.id})`); continue; }
    if (r.fullText) { log.push(`already has a full text, left alone: ${r.name}`); continue; }
    r.fullText = f.fullText; r.updatedAt = now;
    log.push(`FILL full text of ${r.name}`);
  }
  return { next, log };
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) { console.log('Usage: node import-testimonials.js imports/<file>.json [--apply]'); process.exit(1); }
  const dataDir = process.env.SITE_API_DATA || path.join(__dirname, 'data');
  const dataFile = path.join(dataDir, 'testimonials.json');
  if (!fs.existsSync(dataFile)) { console.log(`No data file at ${dataFile} (has the server run once?)`); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const { next, log } = plan(rows, JSON.parse(fs.readFileSync(file, 'utf8')));
  log.forEach((l) => console.log(l));
  console.log(`${rows.length} testimonials now, ${next.length} after.`);
  if (flag !== '--apply') { console.log('Nothing changed (add --apply to do it).'); return; }
  if (await serverIsRunning(Number(process.env.SITE_API_PORT || 3100))) {
    console.log('site-api is running: stop it first (sudo systemctl stop site-api), then run this again.'); process.exit(1);
  }
  const backups = path.join(dataDir, 'backups'); fs.mkdirSync(backups, { recursive: true });
  const backup = path.join(backups, `testimonials-${new Date().toISOString().replace(/[:.]/g, '-')}-before-import.json`);
  fs.copyFileSync(dataFile, backup);
  fs.writeFileSync(`${dataFile}.tmp`, JSON.stringify(next, null, 1));
  fs.renameSync(`${dataFile}.tmp`, dataFile);
  console.log(`Done. Backup of the previous data: ${backup}`);
}

module.exports = { plan };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
