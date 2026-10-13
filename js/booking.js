// "Book Your Spot" on the land trip pages, the same way the old WordPress
// [wetravel_button] shortcode worked:
//   - a WeTravel UUID  -> the button opens WeTravel's checkout (embed_checkout.js popup)
//   - a full https:// link -> the button opens that page in a new tab
//   - nothing listed   -> the button becomes "Join the Waitlist" (js/waitlist.js popup)
// To open bookings for a trip/year, add its UUID (or link) below. Nothing else needs changing.
(function () {
  const BOOKING = {
    //  page name        year (or "all" = every departure)
    'morocco':        { all: '84408854' },
    'austria-summer': { 2027: '74908621' },
    'austria-fall':   { 2027: '50555278' },
    'austria-winter': { 2027: '64756176' },   // 2026: no UUID yet, so waitlist only
    'dude-ranch':     { 2027: 'https://secure.thinkreservations.com/veebar/reservations/availability?startDate=2027-09-05&endDate=2027-09-11&numberOfAdults=2&numberOfChildren=0&customerGroup=group_block_code&groupBlockCode=WORLDSCHOOL2027' },
    // Egypt & Jordan, Galápagos, New Zealand, Xcaret, Austria Wellness: no UUIDs yet, so waitlist only
  };
  const WETRAVEL_ENV = 'https://everyavenuetravel.wetravel.com', WETRAVEL_UID = '1084781';

  const slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  const isUrl = (v) => /^https?:\/\//i.test(v || '');
  const isBookLabel = (t) => /^\s*book\b/i.test(t);          // "Book Your Spot", "Book with the Ranch"

  // The year the visitor has picked (each trip page keeps it in `sel` or `dep()`)
  function selectedYear() {
    try { if (typeof sel !== 'undefined' && sel && sel.year) return String(sel.year); } catch (e) {}
    try { if (typeof dep === 'function' && dep()) return dep().start.slice(0, 4); } catch (e) {}
    return null;
  }
  function currentBooking() {
    const trip = BOOKING[slug];
    if (!trip) return null;
    return trip.all || trip[selectedYear()] || null;
  }

  // WeTravel's own script (loaded on the page after this one) opens its checkout
  // when a ".wtrvl-checkout_button" is clicked; this hidden one is pointed at the
  // right trip and clicked whenever a "Book Your Spot" button is used.
  const checkoutBtn = document.createElement('button');
  checkoutBtn.type = 'button';
  checkoutBtn.className = 'wtrvl-checkout_button';
  checkoutBtn.hidden = true;
  checkoutBtn.dataset.env = WETRAVEL_ENV;
  checkoutBtn.dataset.version = 'v0.4';
  checkoutBtn.dataset.uid = WETRAVEL_UID;
  document.body.appendChild(checkoutBtn);

  // Keep every booking button's label/link in step with what's bookable for the
  // selected year (the page re-renders its buttons whenever the year changes).
  function syncButtons() {
    const booking = currentBooking();
    document.querySelectorAll('.book-btn').forEach((b) => {
      if (!booking) {
        if (isBookLabel(b.textContent)) b.textContent = 'Join the Waitlist';
      } else if (isUrl(booking) && isBookLabel(b.textContent)) {
        if (b.getAttribute('href') !== booking) { b.setAttribute('href', booking); b.target = '_blank'; b.rel = 'noopener'; }
      }
    });
  }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; syncButtons(); });
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  syncButtons();

  // Capture phase, so the page's own "#" handlers don't swallow the click
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.book-btn');
    if (!b || !isBookLabel(b.textContent)) return;   // waitlist / "See dates" buttons are handled elsewhere
    const booking = currentBooking();
    if (!booking) return;
    e.preventDefault(); e.stopPropagation();
    if (isUrl(booking)) { window.open(booking, '_blank', 'noopener'); return; }
    checkoutBtn.dataset.uuid = booking;
    checkoutBtn.setAttribute('href', `${WETRAVEL_ENV}/checkout_embed?uuid=${encodeURIComponent(booking)}`);
    checkoutBtn.click();
  }, true);
})();
