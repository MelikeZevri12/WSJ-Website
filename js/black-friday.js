// Black Friday sale (since 2026-11-09): which land trips have a discount code, and for which years.
// Read by:
//   - the home page's first carousel (js/trip-strips.js): while the sale is on it shows ONLY these trips,
//     each card with a red "Black Friday Sale" ribbon and its code, instead of "Trips Filling Up Now"
//   - the land trip pages: a red "use code ... at checkout" box next to the Book Your Spot buttons,
//     shown only when a sale year is picked
// To add a trip: add its page name (the land-trips file name), the years and the code below.
// To end the sale: set ON to false (the home carousel goes back to "Trips Filling Up Now", the code boxes disappear).
// Styles: css/black-friday.css
(function () {
  const ON = true;
  const TRIPS = {
    'austria-wellness': { years: [2027], code: 'BFAUSTRIA' },
    'austria-summer':   { years: [2027], code: 'BFAUSTRIA' },
    'austria-fall':     { years: [2027], code: 'BFAUSTRIA' },
    'austria-winter':   { years: [2027], code: 'BFAUSTRIA' },
    'new-zealand':      { years: [2027], code: 'BFNEWZEALAND' },
  };
  const LABEL = 'Black Friday Sale';

  function codeFor(slug, year) {
    const t = ON && TRIPS[slug];
    return t && t.years.includes(Number(year)) ? t.code : null;
  }
  window.WSJPromo = { on: ON, label: LABEL, trips: ON ? TRIPS : {}, codeFor };

  // ---------- land trip pages: the code box next to the booking buttons ----------
  const slug = document.body && document.body.dataset.trip;
  if (!ON || !slug || !TRIPS[slug]) return;

  // the year the visitor has picked (each trip page keeps it in `sel` or `dep()`, same as js/booking.js)
  function selectedYear() {
    try { if (typeof sel !== 'undefined' && sel && sel.year) return sel.year; } catch (e) {}
    try { if (typeof dep === 'function' && dep()) return dep().start.slice(0, 4); } catch (e) {}
    return null;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function boxFor(btn) {
    // hero: under the year/session pickers; price box: under the total; "Ready to join": under the button
    // ("Ready to join" lays its text and button side by side, so the button and the box share one column there)
    if (btn.parentElement.classList.contains('join-content')) {
      const stack = document.createElement('div');
      stack.className = 'bf-stack';
      btn.insertAdjacentElement('beforebegin', stack);
      stack.appendChild(btn);
    }
    const anchor = btn.closest('.hero-cta') || btn.closest('.price-summary') || btn;
    let box = anchor.nextElementSibling;
    if (!box || !box.classList.contains('bf-code')) {
      box = document.createElement('div');
      box.className = 'bf-code';
      box.hidden = true;
      if (anchor.closest('.hero')) box.classList.add('bf-code-hero');
      anchor.insertAdjacentElement('afterend', box);
    }
    return box;
  }
  function sync() {
    const code = codeFor(slug, selectedYear());
    document.querySelectorAll('.book-btn').forEach((btn) => {
      const box = boxFor(btn);
      const show = !!code && /^\s*book\b/i.test(btn.textContent);   // not on "Join the Waitlist" / "See 2027 Dates"
      if (show && box.dataset.code !== code) {
        box.dataset.code = code;
        box.innerHTML = `<span class="bf-tag">${esc(LABEL)}</span>` +
          `<span class="bf-text">Use code <strong class="bf-the-code">${esc(code)}</strong> at checkout</span>` +
          `<button type="button" class="bf-copy" aria-label="Copy the code ${esc(code)}">Copy code</button>`;
      }
      if (box.hidden === show) box.hidden = !show;
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.bf-copy');
    if (!b) return;
    const code = b.closest('.bf-code').dataset.code;
    const done = () => { b.textContent = 'Copied!'; setTimeout(() => { b.textContent = 'Copy code'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => {});
  });
  // the pages redraw their buttons whenever the year/departure changes
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
