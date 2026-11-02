// Testimonials, read live from the website's own database (the website server,
// /site-api/testimonials; edited in admin → Testimonials). Change one there and
// every page shows the change on its next load, no deploy needed.
//
//   WSJTestimonials.strip({ types: ['cruise'], more: '/testimonials#cruises' })
//     The "In Their Words" carousel (#testiTrack inside #stories / .proof-strip-wrap):
//     up to 10 testimonials of those types (featured ones first, each group in random order), each with "Read more" (opens the
//     whole review in a popup) when there's more to read, plus a "Read More
//     Testimonials" link above the carousel. Hidden if there are none or the
//     database can't be reached.
//   WSJTestimonials.page()
//     testimonials.html: fills each section's [data-t-types] grid: featured first, then the database order.
//
// Types: cruise, land_trip, port_excursion, austria_retreat. Styles: css/testimonials.css.
(function () {
  const API = '/site-api/testimonials';
  const STRIP_MAX = 10;
  const SHORT_CHARS = 220;   // carousel text when a testimonial has no Short Version
  const EXCERPT_CHARS = 300; // testimonials page: longer reviews start folded

  let request = null;
  function load() {
    if (!request) {
      request = fetch(API, { headers: { Accept: 'application/json' } })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((rows) => (Array.isArray(rows) ? rows : []));
    }
    return request;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paras = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const parasHTML = (text) => paras(text).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const same = (a, b) => String(a).replace(/\W+/g, '').toLowerCase() === String(b).replace(/\W+/g, '').toLowerCase();
  // Cut at the last whole word (sentence end if there's one near) before max characters
  function clip(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (sentence > max * 0.6) return cut.slice(0, sentence + 1);
    return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- the popup ----------
  let popup = null;
  function openPopup(t) {
    if (!popup) {
      popup = document.createElement('dialog');
      popup.className = 't-popup';
      popup.setAttribute('aria-labelledby', 't-popup-name');
      popup.innerHTML = '<button type="button" class="t-popup-close" aria-label="Close">&times;</button>' +
        '<blockquote class="t-popup-text"></blockquote><div class="t-popup-foot"><div class="t-popup-name" id="t-popup-name"></div>' +
        '<a class="t-popup-all" href="/testimonials">Read More Testimonials &rarr;</a></div>';
      document.body.appendChild(popup);
      popup.querySelector('.t-popup-close').addEventListener('click', () => popup.close());
      // a click on the dimmed background (outside the box) closes it too
      popup.addEventListener('click', (e) => {
        const r = popup.getBoundingClientRect();
        if (e.target === popup && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) popup.close();
      });
    }
    popup.querySelector('.t-popup-text').innerHTML = parasHTML(t.fullText || t.shortVersion);
    popup.querySelector('.t-popup-name').textContent = t.name;
    if (typeof popup.showModal === 'function') popup.showModal(); else popup.setAttribute('open', '');
    popup.querySelector('.t-popup-text').scrollTop = 0;
  }

  // ---------- the carousels ----------
  function strip({ types, more = '/testimonials', track = 'testiTrack' } = {}) {
    const el = document.getElementById(track);
    if (!el) return;
    const wrap = el.closest('.proof-strip-wrap') || el;
    wrap.hidden = true;
    load().then((rows) => {
      // Featured ones (admin star = our best) come first, each group in random order
      const fit = rows.filter((t) => (!types || types.includes(t.category)) && (t.shortVersion || t.fullText));
      const picked = [...shuffle(fit.filter((t) => t.featured)), ...shuffle(fit.filter((t) => !t.featured))].slice(0, STRIP_MAX);
      if (!picked.length) return;
      el.innerHTML = picked.map((t, i) => {
        const shown = t.shortVersion || clip(t.fullText, SHORT_CHARS);
        const hasMore = t.fullText && !same(shown, t.fullText);
        return `<div class="proof-chip" data-type="${esc(t.category)}"><div><p>“${esc(shown)}”</p><div class="proof-foot"><div class="who">${esc(t.name)}</div>` +
          (hasMore ? `<button type="button" class="proof-more" data-t="${i}" aria-haspopup="dialog">Read more</button>` : '') + '</div></div></div>';
      }).join('');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('.proof-more');
        if (b) openPopup(picked[Number(b.dataset.t)]);
      });
      // "Read More Testimonials" above the carousel, next to the arrows
      const arrows = wrap.querySelector('.proof-arrows');
      if (arrows && !wrap.querySelector('.proof-all')) {
        arrows.insertAdjacentHTML('afterbegin', `<a class="proof-all" href="${esc(more)}">Read More Testimonials <span aria-hidden="true">&rarr;</span></a>`);
      }
      wrap.hidden = false;
      wrap.style.display = '';
    }).catch(() => { /* database unreachable: the section stays hidden */ });
  }

  // ---------- the testimonials page ----------
  function page() {
    const grids = [...document.querySelectorAll('[data-t-types]')];
    if (!grids.length) return;
    load().then((rows) => {
      grids.forEach((grid) => {
        const types = grid.dataset.tTypes.split(',');
        // featured ones (admin star) first, then the database order
        const list = rows.filter((t) => types.includes(t.category)).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        grid.innerHTML = list.map((t) => {
          const full = t.fullText || t.shortVersion;
          const excerpt = clip(full, EXCERPT_CHARS);
          const folded = !same(excerpt, full);
          return `<figure class="t-card${folded ? ' has-more' : ''}"><blockquote>` +
            (folded ? `<div class="t-excerpt"><p>${esc(excerpt)}</p></div><div class="t-full">${parasHTML(full)}</div>` : parasHTML(full)) +
            '</blockquote><figcaption>' + (folded ? '<button type="button" class="t-more" aria-expanded="false">Read more</button>' : '') +
            `<div class="who">${esc(t.name)}</div></figcaption></figure>`;
        }).join('');
        const section = grid.closest('section');
        if (section) {
          section.hidden = !list.length;
          const count = document.querySelector(`.legal-toc a[href="#${section.id}"] b`);
          if (count) count.textContent = list.length;
          const tocLink = document.querySelector(`.legal-toc a[href="#${section.id}"]`);
          if (tocLink) tocLink.hidden = !list.length;
        }
      });
    }).catch(() => {
      grids.forEach((grid) => { grid.innerHTML = '<p class="t-error">Our testimonials couldn’t be loaded right now. Please try again in a moment.</p>'; });
    });
    // "Read more" swaps the excerpt for the whole review (and back)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.t-more');
      if (!btn) return;
      const open = btn.closest('.t-card').classList.toggle('open');
      btn.textContent = open ? 'Show less' : 'Read more';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  window.WSJTestimonials = { load, strip, page, clip };
})();
