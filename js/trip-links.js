// Trip cards on phones and tablets (loaded by the footer, so it runs on every page).
// Desktop: trip cards keep opening in a new tab (target="_blank"), the listing stays open in its own tab.
// Touch devices: a card opens the trip in the SAME tab, and the trip page gets clear "Back to ..." buttons
// (a bar under the navbar + a button at the start of the sticky section menu) that return to the page the
// visitor came from, scrolled to the card they tapped. Without a known previous page they lead to the listing.
(function () {
  var KEY = 'wsjTripNav', RETURN_KEY = 'wsjTripReturn';
  var isTouch = function () {
    return (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) || window.innerWidth <= 760;
  };
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  var clean = function (p) { return (p || '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/'; };
  var tripKind = function (p) {
    p = clean(p);
    if (/^\/cruises\/[^/]+/.test(p) || /^\/journeys\/[^/]+/.test(p)) return 'cruise';
    if (/^\/land-trips\/[^/]+/.test(p)) return 'land';
    return '';
  };

  // 1. Touch devices: trip cards open in the same tab
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a.trip-card[target="_blank"]');
    if (!a || !isTouch() || a.origin !== location.origin) return;
    e.preventDefault();
    store.set(KEY, { from: location.href, card: a.getAttribute('href'), to: clean(a.pathname), t: Date.now() });
    location.href = a.href;
  });

  // 2. Back on the listing: scroll to the card that was tapped (the cards are often drawn after the page loads)
  var ret = store.get(RETURN_KEY);
  if (ret && ret.url === location.href && ret.card) {
    store.del(RETURN_KEY);
    var tries = 0, timer = setInterval(function () {
      var card = [].slice.call(document.querySelectorAll('a.trip-card')).filter(function (c) { return c.getAttribute('href') === ret.card; })[0];
      if (card || ++tries > 50) {
        clearInterval(timer);
        if (card) card.scrollIntoView({ block: 'center', inline: 'center' });
      }
    }, 100);
  }

  // 3. Trip pages on touch devices: "Back to ..." buttons
  var kind = tripKind(location.pathname);
  if (!kind || !isTouch()) return;

  var nav = store.get(KEY), from = '', card = '';
  if (nav && Date.now() - nav.t < 3 * 3600 * 1000 && (nav.to === clean(location.pathname) || document.referrer === nav.from)) {
    from = nav.from; card = nav.card;
  } else if (document.referrer) {
    try {
      var r = new URL(document.referrer);
      if (r.origin === location.origin && clean(r.pathname) !== clean(location.pathname)) from = document.referrer;
    } catch (e) {}
  }

  var label, href;
  if (from) {
    var fu = new URL(from), fp = clean(fu.pathname);
    var names = { '/': 'Home', '/home': 'Home', '/cruises': 'Group Cruises', '/land-trips': 'Land Trips', '/about': 'About Us',
      '/contact': 'Contact', '/stay-updated': 'Stay Updated', '/testimonials': 'Testimonials', '/faq': 'FAQ',
      // one page, two views: the # says which
      '/worldschooling-trips': fu.hash === '#landtrips' ? 'Land Trips' : fu.hash === '#cruises' ? 'Group Cruises' : 'Worldschooling Trips' };
    label = 'Back to ' + (names[fp] || (tripKind(fp) ? 'Previous Trip' : 'Previous Page'));
    href = from;
  } else {
    label = kind === 'land' ? 'See All Land Trips' : 'See All Group Cruises';
    href = kind === 'land' ? '/worldschooling-trips#landtrips' : '/worldschooling-trips#cruises';
  }

  // history.back() keeps the previous page exactly as it was, but only if this page added no history entries (#section links do)
  var hashMoved = false;
  window.addEventListener('hashchange', function () { hashMoved = true; });
  var goBack = function (e) {
    e.preventDefault();
    if (from && !hashMoved && document.referrer === from && history.length > 1) { history.back(); return; }
    if (from && card) store.set(RETURN_KEY, { url: from, card: card });
    location.href = href;
  };

  var style = document.createElement('style');
  style.textContent =
    '.trip-back-bar{background:var(--sky-tint,#eef4f6);border-bottom:1px solid var(--line,#e3e0d6);}' +
    '.trip-back-bar a{display:flex;align-items:center;gap:8px;min-height:48px;font-weight:700;font-size:16px;color:var(--green-dark,#4f6b38);text-decoration:none;}' +
    '.trip-back-bar a .arr{font-size:20px;line-height:1;}' +
    '.subnav a.subnav-back,.subnav a.subnav-back:hover{flex:0 0 auto;align-self:center;position:sticky;left:0;z-index:2;white-space:nowrap;' +
    'padding:7px 12px;margin-right:4px;border:none;border-radius:4px;background:var(--green-dark,#708F53);color:#fff;font-weight:700;' +
    'box-shadow:6px 0 8px -4px rgba(253,250,242,.95);}';
  document.head.appendChild(style);

  var bar = document.createElement('div');
  bar.className = 'trip-back-bar';
  bar.innerHTML = '<div class="wrap"><a href=""><span class="arr" aria-hidden="true">←</span><span></span></a></div>';
  var barLink = bar.querySelector('a');
  barLink.href = href; barLink.lastChild.textContent = label;
  barLink.addEventListener('click', goBack);
  var top = document.querySelector('.global-nav');
  if (top) top.parentNode.insertBefore(bar, top.nextSibling); else document.body.insertBefore(bar, document.body.firstChild);

  var sub = document.querySelector('.subnav .subnav-inner');
  if (sub) {
    var b = document.createElement('a');
    b.className = 'subnav-back'; b.href = href; b.textContent = from ? '← Back' : '← All Trips'; b.setAttribute('aria-label', label);
    b.addEventListener('click', goBack);
    sub.insertBefore(b, sub.firstChild);
  }
})();
