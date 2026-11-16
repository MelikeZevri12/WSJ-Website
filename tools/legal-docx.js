// Turns one of the legal Word documents (Privacy Policy, Cancellation & Refund Policy) into the
// article + table of contents of its website page, in the same layout as terms-and-conditions.html.
// Usage: node tools/legal-docx.js "<file.docx>" <page.html>
// Reads the .docx with the system's `tar` (Windows 10+ and Git Bash both have one), rewrites only the
// parts of the page between the markers it finds (hero meta line, "On this page" menu, article body).
// Expects the document's shape: title lines, an IMPORTANT ... notice, then bold "1. TITLE" sections
// with bold "1.1 Title" sub-sections, bullet / numbered lists and simple tables.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const [docx, pageFile] = process.argv.slice(2);
if (!docx || !pageFile) { console.error('Usage: node tools/legal-docx.js <file.docx> <page.html>'); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-docx-'));
// On Windows use its own tar.exe: Git Bash's GNU tar reads "C:\..." as a remote host.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
execFileSync(TAR, ['-xf', path.resolve(docx), '-C', tmp, 'word/document.xml', 'word/numbering.xml']);
const xml = fs.readFileSync(path.join(tmp, 'word/document.xml'), 'utf8');
const numbering = fs.readFileSync(path.join(tmp, 'word/numbering.xml'), 'utf8');
fs.rmSync(tmp, { recursive: true, force: true });

const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// numId -> list type per level ('ul' for bullets, 'ol' otherwise)
const abstractFmt = {};
for (const a of numbering.match(/<w:abstractNum [\s\S]*?<\/w:abstractNum>/g) || []) {
  const id = a.match(/w:abstractNumId="(\d+)"/)[1];
  abstractFmt[id] = {};
  for (const l of a.match(/<w:lvl [\s\S]*?<\/w:lvl>/g) || []) {
    abstractFmt[id][l.match(/w:ilvl="(\d+)"/)[1]] = (l.match(/<w:numFmt w:val="(\w+)"/) || [])[1] === 'bullet' ? 'ul' : 'ol';
  }
}
const numToAbstract = {};
for (const n of numbering.match(/<w:num w:numId="\d+"[\s\S]*?<\/w:num>/g) || []) {
  numToAbstract[n.match(/w:numId="(\d+)"/)[1]] = n.match(/<w:abstractNumId w:val="(\d+)"/)[1];
}
const listType = (numId, lvl) => (abstractFmt[numToAbstract[numId]] || {})[lvl] || 'ul';

function runs(p) {
  const out = [];
  for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) || []) {
    const bold = /<w:b\/>|<w:b w:val="(1|true|on)"\/>/.test(r);
    const t = (r.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || [])
      .map((x) => (x === '<w:tab/>' ? ' ' : x === '<w:br/>' ? '\n' : dec(x.replace(/<[^>]+>/g, '')))).join('');
    if (t) out.push({ text: t, bold });
  }
  return out;
}
function para(p) {
  const rs = runs(p);
  const text = rs.map((r) => r.text).join('');
  const solid = rs.filter((r) => r.text.trim());
  return {
    t: 'p', runs: rs, text: text.trim(),
    bold: solid.length > 0 && solid.every((r) => r.bold),
    numId: /<w:numPr>/.test(p) ? (p.match(/<w:numId w:val="(\d+)"/) || [])[1] : null,
    lvl: +((p.match(/<w:ilvl w:val="(\d+)"/) || [])[1] || 0),
  };
}
const blocks = [];
const body = xml.split('<w:body>')[1];
for (const m of body.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
  if (m.startsWith('<w:tbl>')) {
    blocks.push({ t: 'table', rows: (m.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map((tr) =>
      (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) =>
        (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map((p) => para(p).text).filter(Boolean).join(' '))) });
  } else {
    const p = para(m);
    if (p.numId === '0') p.numId = null; // numbering switched off
    if (p.text) blocks.push(p);
  }
}

// Inline text: emails and the website address become links, line breaks stay.
function linkify(s) {
  return esc(s)
    .replace(/https:\/\/worldschoolingjourneys\.com\/?/g, '<a href="/">https://worldschoolingjourneys.com</a>')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, (e) => `<a href="mailto:${e}">${e}</a>`)
    .replace(/\n/g, '<br>');
}
function inline(p) {
  if (p.bold) return `<strong>${linkify(p.text)}</strong>`;
  // merge neighbouring runs with the same weight, then wrap the bold ones
  const merged = [];
  for (const r of p.runs) {
    const last = merged[merged.length - 1];
    if (last && (last.bold === r.bold || !r.text.trim())) last.text += r.text; else merged.push({ ...r });
  }
  return merged.map((r, i) => {
    let t = i === 0 ? r.text.replace(/^\s+/, '') : r.text;
    if (i === merged.length - 1) t = t.replace(/\s+$/, '');
    if (!r.bold || !t.trim()) return linkify(t);
    const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0];
    return `${linkify(lead)}<strong>${linkify(t.trim())}</strong>${linkify(trail)}`;
  }).join('');
}

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'within', 'from', 'vs']);
function titleCase(s) {
  return s.toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && SMALL.has(w)) return w;
    if (/^u\.s\.?$/.test(w)) return 'U.S.';
    return w.split('-').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join('-');
  }).join(' ');
}

const H2 = /^(\d+)\.\s+(.+)$/;
const H3 = /^\d+\.\d+(\.\d+)*\s+\S/;
const firstSection = blocks.findIndex((b) => b.t === 'p' && b.bold && H2.test(b.text));
const noticeStart = blocks.findIndex((b) => b.t === 'p' && b.bold && /^IMPORTANT\b/.test(b.text));
if (firstSection < 0 || noticeStart < 0 || noticeStart > firstSection) throw new Error('Unexpected document layout');

// Header lines (before the notice): version + effective date for the hero.
const header = blocks.slice(0, noticeStart).map((b) => b.text).join('\n');
const effective = (header.match(/Effective Date:\s*([\d/]+)/) || [])[1];
const version = (header.match(/Version:\s*([\d.]+)/) || [])[1];
const sellerNo = (header.match(/Registration Number:\s*(\S+)/) || [])[1];
if (!effective || !version) throw new Error('Effective date / version not found in the document header');

// Render a run of blocks (lists grouped, tables, headings).
function render(list, inNotice) {
  let html = '';
  const stack = []; // open lists: {tag, lvl}
  const closeTo = (lvl) => { while (stack.length && stack[stack.length - 1].lvl >= lvl) html += `</li></${stack.pop().tag}>\n`; };
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.t === 'p' && b.numId) {
      const tag = listType(b.numId, b.lvl);
      const top = stack[stack.length - 1];
      if (top && top.lvl === b.lvl && top.numId === b.numId) html += '</li>\n';
      else if (top && top.lvl === b.lvl) { closeTo(b.lvl); }
      else if (top && top.lvl > b.lvl) { closeTo(b.lvl + 1); html += '</li>\n'; if (stack[stack.length - 1]?.numId !== b.numId) closeTo(b.lvl); }
      if (!stack.length || stack[stack.length - 1].lvl < b.lvl) { html += `<${tag}>\n`; stack.push({ tag, lvl: b.lvl, numId: b.numId }); }
      html += `<li>${inline(b)}`;
      continue;
    }
    closeTo(0);
    if (b.t === 'table') {
      const [head, ...rows] = b.rows;
      html += `<table><thead><tr>${head.map((c) => `<th>${linkify(c)}</th>`).join('')}</tr></thead><tbody>\n`
        + rows.map((r) => `<tr>${r.map((c) => `<td>${linkify(c)}</td>`).join('')}</tr>`).join('\n') + '\n</tbody></table>\n';
    } else if (b.bold && H3.test(b.text)) {
      html += `<h3>${linkify(b.text)}</h3>\n`;
    } else if (inNotice && b.bold && /^IMPORTANT\b/.test(b.text) && b.text.length < 70) {
      html += `<h2>${linkify(b.text)}</h2>\n`;
    } else {
      html += `<p>${inline(b)}</p>\n`;
    }
  }
  closeTo(0);
  return html;
}

const notice = blocks.slice(noticeStart, firstSection);
const sectionsHtml = [];
const toc = [];
let i = firstSection;
while (i < blocks.length) {
  const m = blocks[i].text.match(H2);
  const n = m[1], title = titleCase(m[2]);
  let j = i + 1;
  while (j < blocks.length && !(blocks[j].t === 'p' && blocks[j].bold && H2.test(blocks[j].text))) j++;
  const content = blocks.slice(i + 1, j).filter((b) => !(b.bold && /^END OF\b/.test(b.text)));
  toc.push(`<a href="#s${n}"><span>${n}.</span>${esc(title)}</a>`);
  sectionsHtml.push(`<section class="ls" id="s${n}"><h2><span class="sn">${n}.</span>${esc(title)}</h2>${render(content, false)}</section>`);
  i = j;
}

const article = `<div class="legal-notice">${render(notice, true)}</div>${sectionsHtml.join('\n')}\n`;

let page = fs.readFileSync(pageFile, 'utf8');
const swap = (re, fn, what) => { if (!re.test(page)) throw new Error(`${what} not found in ${pageFile}`); page = page.replace(re, fn); };
swap(/<p class="lh-meta">[\s\S]*?<\/p>/, () =>
  `<p class="lh-meta">Every Avenue Travel LLC, doing business as Worldschooling Journeys · Effective Date: <strong>${effective}</strong> · Version ${version}</p>`, 'hero meta line');
swap(/(<summary class="toc-label">On this page<\/summary><nav>)[\s\S]*?(<\/nav>)/, (_, a, b) => a + toc.join('') + b, 'On this page menu');
swap(/(<article class="legal-doc">\s*)[\s\S]*?(\s*<a href="#top" class="to-top">)/, (_, a, b) => a + article + b, 'article');
fs.writeFileSync(pageFile, page);
console.log(`${pageFile}: ${toc.length} sections, effective ${effective}, version ${version}${sellerNo ? `, seller of travel ${sellerNo}` : ''}`);
