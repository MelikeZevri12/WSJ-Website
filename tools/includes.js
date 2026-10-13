// Shared page pieces. A page writes
//   <!-- include nav active="trips" -->   or   <!-- include footer -->
// and gets the contents of partials/nav.html or partials/footer.html in its place.
// In a partial, [[name]] becomes " active" when the page asked for active="name",
// and disappears otherwise (that's how the menu highlights the current page).
// Used by server.js (local testing) and tools/build.js (deploy), so both match.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INCLUDE = /<!--\s*include\s+([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*-->/g;

function expand(html, fromFile) {
  return html.replace(INCLUDE, (marker, name, attrText) => {
    const attrs = {};
    for (const [, k, v] of attrText.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[k] = v;
    const file = path.join(ROOT, 'partials', name + '.html');
    if (!fs.existsSync(file)) throw new Error(`${fromFile || 'page'}: no partials/${name}.html for ${marker}`);
    return fs.readFileSync(file, 'utf8')
      .replace(/^<!--[\s\S]*?-->\r?\n/, '') // the partial's own explanation comment stays in the partial
      .replace(/\[\[([\w-]+)\]\]/g, (m, key) => (key === attrs.active ? ' active' : ''))
      .replace(/\n$/, '');
  });
}

module.exports = { expand };
