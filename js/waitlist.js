// Waitlist popup. On the land trip pages every "Join the Waitlist" button
// (sold-out departures, trips not released yet, years still being planned)
// opens this instead of following its link. The Coming Soon cards
// (.cs-postmark-card[data-idea]) open it too, with "idea stage" wording.
// Signups are saved by the backend and show up on the admin dashboard's
// Waitlist tab (and js/newsletter.js adds the email to the newsletter).
(function () {
  const API = 'https://api.worldschoolingjourneys.com';
  const isWaitlistButton = (el) => el && /waitlist/i.test(el.textContent);

  const modal = document.createElement('div');
  modal.className = 'wl-overlay';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="wl-modal" role="dialog" aria-modal="true" aria-labelledby="wlTitle">
      <button type="button" class="wl-close" aria-label="Close">×</button>
      <form class="wl-form" novalidate>
        <div class="eyebrow wl-trip"></div>
        <h3 id="wlTitle"></h3>
        <p class="wl-text"></p>
        <p class="wl-urgent"></p>
        <label class="wl-field"><span>Name</span><input type="text" name="fullName" autocomplete="name" required maxlength="120"></label>
        <label class="wl-field"><span>Email</span><input type="email" name="email" autocomplete="email" required maxlength="200"></label>
        <label class="wl-hp" aria-hidden="true">Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        <div class="wl-error" role="alert"></div>
        <button type="submit" class="btn btn-primary wl-submit">Notify Me</button>
      </form>
      <div class="wl-done" hidden>
        <h3>You're on the list!</h3>
        <p class="wl-done-text"></p>
        <button type="button" class="btn btn-primary wl-close-btn">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const form = modal.querySelector('.wl-form'), done = modal.querySelector('.wl-done'), err = modal.querySelector('.wl-error');
  const submitBtn = modal.querySelector('.wl-submit');
  let trip = null, lastFocus = null;

  // Wording: trips being released (default) vs. ideas on the roadmap
  const COPY = {
    trip: {
      title: 'Be the first to be notified!',
      text: "We're still finalizing all the details. In the meantime, you can sign up now and we'll notify you as soon as the trip is released.",
      urgent: "Don't miss out! Spots are limited, so act fast!",
      done: "Thank you! We'll email you as soon as the trip is released.",
    },
    idea: {
      title: 'This trip is just an idea for now',
      text: "It's still in the idea stage. Leave your email so we know you're interested, and we'll let you know if it becomes a real trip.",
      urgent: '',
      done: "Thank you! Your interest helps us decide which trips to plan next. We'll email you if this one goes ahead.",
    },
  };

  // The trip and the departure / year the visitor was looking at
  function currentTrip() {
    const slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    const name = (document.querySelector('.hero h1')?.textContent || document.title.split('|')[0]).trim();
    // what the visible hero pickers show, minus prices and status words ("Oct 16 – Nov 3, 2026 · $4,717" -> "Oct 16 – Nov 3, 2026")
    const picked = [...document.querySelectorAll('.hero .hp-field')].filter((f) => f.offsetParent)
      .flatMap((f) => (f.querySelector('.cs-btn, select')?.textContent || '').replace(/\s+/g, ' ').split(' · '))
      .map((s) => s.trim()).filter((s) => s && !/[$€]|waitlist|details coming|sold out|few spots|spots left/i.test(s));
    return { tripSlug: slug, tripName: name, detail: picked.join(' · ').slice(0, 160) || null };
  }

  // given = {tripSlug, tripName} for a Coming Soon idea; otherwise the land trip page itself
  function open(given) {
    trip = given || currentTrip();
    const copy = given ? COPY.idea : COPY.trip;
    modal.querySelector('#wlTitle').textContent = copy.title;
    modal.querySelector('.wl-text').textContent = copy.text;
    modal.querySelector('.wl-urgent').textContent = copy.urgent;
    modal.querySelector('.wl-urgent').hidden = !copy.urgent;
    modal.querySelector('.wl-done-text').textContent = copy.done;
    lastFocus = document.activeElement;
    modal.querySelector('.wl-trip').textContent = given ? 'Coming Soon · ' + trip.tripName : trip.tripName + (trip.detail ? ' · ' + trip.detail : '');
    form.hidden = false; done.hidden = true; err.textContent = ''; submitBtn.disabled = false; submitBtn.textContent = 'Notify Me';
    modal.hidden = false; document.body.classList.add('wl-open');
    setTimeout(() => form.elements.fullName.focus(), 30);
  }
  function close() {
    modal.hidden = true; document.body.classList.remove('wl-open');
    if (lastFocus) lastFocus.focus();
  }

  // Coming Soon cards: click or Enter/Space
  const ideaOf = (card) => ({ tripSlug: card.dataset.idea, tripName: card.querySelector('.cs-postmark-title').textContent.trim(), detail: 'Coming Soon idea' });
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.cs-postmark-card[data-idea]');
    if (card) open(ideaOf(card));
  });
  document.addEventListener('keydown', (e) => {
    const card = e.target.closest && e.target.closest('.cs-postmark-card[data-idea]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(ideaOf(card)); }
  });

  // Capture phase, so the page's own button handlers never see the click
  document.addEventListener('click', (e) => {
    const b = e.target.closest('a.btn, button.btn, .book-btn');
    if (!b || b.closest('.wl-modal') || !isWaitlistButton(b)) return;
    e.preventDefault(); e.stopPropagation();
    open();
  }, true);

  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.wl-close, .wl-close-btn')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = form.elements.fullName.value.trim(), email = form.elements.email.value.trim();
    if (!fullName) { err.textContent = 'Please enter your name.'; form.elements.fullName.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Please enter a valid email address.'; form.elements.email.focus(); return; }
    err.textContent = ''; submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
    try {
      const res = await fetch(`${API}/trip-waitlist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trip, fullName, email, website: form.elements.website.value }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message || 'Something went wrong.'); }
      form.reset(); form.hidden = true; done.hidden = false;
      done.querySelector('.wl-close-btn').focus();
    } catch (ex) {
      err.textContent = (ex.message && !/fetch/i.test(ex.message) ? ex.message : 'We couldn’t send that just now.') + ' Please try again, or contact us below.';
      submitBtn.disabled = false; submitBtn.textContent = 'Notify Me';
    }
  });
})();
