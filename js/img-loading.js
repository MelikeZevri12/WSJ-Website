// Pictures while they load (loaded by the footer on every page; styles at the end of css/nav.css).
// A picture that hasn't arrived yet shows a soft shimmer instead of its alt text, then fades in.
// One that fails keeps a plain empty box. Works for pictures added later too (cruise pages, carousels).
(function () {
  function done(img, ok) {
    const wasLoading = img.classList.contains('wsj-img-loading');
    img.classList.remove('wsj-img-loading');
    img.classList.toggle('wsj-img-failed', !ok);
    if (ok && wasLoading) {
      img.classList.add('wsj-img-in');
      // drop the fade class afterwards so the picture's own animations (if any) aren't overridden
      img.addEventListener('animationend', () => img.classList.remove('wsj-img-in'), { once: true });
      setTimeout(() => img.classList.remove('wsj-img-in'), 600);
    }
  }
  function watch(img) {
    if (!img.getAttribute('src') && !img.getAttribute('srcset')) return;
    if (img.complete) { if (!img.naturalWidth) done(img, false); else img.classList.remove('wsj-img-failed'); return; }
    img.classList.add('wsj-img-loading');
    img.classList.remove('wsj-img-failed');
    img.addEventListener('load', () => done(img, true), { once: true });
    img.addEventListener('error', () => done(img, false), { once: true });
  }
  document.querySelectorAll('img').forEach(watch);
  new MutationObserver((list) => list.forEach((m) => {
    if (m.type === 'attributes') { if (m.target.tagName === 'IMG') watch(m.target); return; }
    m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'IMG') watch(n); else n.querySelectorAll('img').forEach(watch);
    });
  })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
})();
