// "Book Your Spot" on the land trip pages, the same way the old WordPress
// [wetravel_button] shortcode worked:
//   - a WeTravel UUID  -> the button opens WeTravel's checkout in a NEW TAB, so the trip page stays open
//     (WeTravel's own embed_checkout.js popup covered the whole page on phones with no way back)
//   - a full https:// link -> the button opens that page in a new tab
//   - nothing listed   -> the button becomes "Join the Waitlist" (js/waitlist.js popup)
// To open bookings for a trip/year, add its UUID (or link) below. Nothing else needs changing.
(function () {
  const BOOKING = {
    //  page name        year (or "all" = every departure, or a departure's start date "2027-08-22" when a year has two trips)
    'morocco':        { all: '84408854' },
    'austria-summer': { 2027: '74908621' },
    'austria-fall':   { 2027: '50555278' },
    'austria-winter': { 2026: '66397481', 2027: '64756176' },
    'dude-ranch':     { 2027: 'https://secure.thinkreservations.com/veebar/reservations/availability?startDate=2027-09-05&endDate=2027-09-11&numberOfAdults=2&numberOfChildren=0&customerGroup=group_block_code&groupBlockCode=WORLDSCHOOL2027' },
    'new-zealand':    { 2027: '5999768167' },
    'galapagos':      { 2027: '8101960041', '2027-08-22': '8522452872' },   // Aug 22: Galápagos Island Hopping for Teens
    'egypt-jordan':   { 2027: '44398947' },
    'austria-wellness': { 2027: '21359722' },
    // Xcaret: no UUID yet, so waitlist only
  };
  const WETRAVEL_ENV = 'https://everyavenuetravel.wetravel.com';

  // the trip's ID (its file name, e.g. austria-fall); the address itself is the trip title
  const slug = document.body.dataset.trip || (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  const isUrl = (v) => /^https?:\/\//i.test(v || '');
  const isBookLabel = (t) => /^\s*book\b/i.test(t);          // "Book Your Spot", "Book with the Ranch"

  // The year the visitor has picked (each trip page keeps it in `sel` or `dep()`)
  function selectedYear() {
    try { if (typeof sel !== 'undefined' && sel && sel.year) return String(sel.year); } catch (e) {}
    try { if (typeof dep === 'function' && dep()) return dep().start.slice(0, 4); } catch (e) {}
    return null;
  }
  // The picked departure's start date (fixed-price trips: dep().start), for a departure with its own booking
  function selectedDate() {
    try { if (typeof dep === 'function' && dep()) return dep().start; } catch (e) {}
    return null;
  }
  // the page the booking button opens: an external link as is, a WeTravel UUID -> WeTravel's checkout page
  function currentBooking() {
    const trip = BOOKING[slug];
    const booking = trip && (trip[selectedDate()] || trip.all || trip[selectedYear()]);
    if (!booking) return null;
    return isUrl(booking) ? booking : `${WETRAVEL_ENV}/checkout_embed?uuid=${encodeURIComponent(booking)}&source=widget_book_now`;
  }

  // Keep every booking button's label/link in step with what's bookable for the
  // selected year (the page re-renders its buttons whenever the year changes).
  function syncButtons() {
    const booking = currentBooking();
    document.querySelectorAll('.book-btn').forEach((b) => {
      if (!booking) {
        if (isBookLabel(b.textContent)) b.textContent = 'Join the Waitlist';
      } else if (isBookLabel(b.textContent)) {
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
    window.open(booking, '_blank', 'noopener');
  }, true);
})();
