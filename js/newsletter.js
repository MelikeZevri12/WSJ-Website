// Newsletter (Moosend, through the team's Google Apps Script - the Moosend API key
// stays inside the script, never on the website). Loaded by the footer on every page.
//  1. The "Email Newsletter" boxes (.newsletter-form): Sign Up subscribes and says so.
//  2. Every other form (bookings, quotes, waitlists...): when it's submitted complete,
//     the person's email + name are also added to the newsletter, quietly in the background.
//     That never blocks or changes what the form itself does.
(function () {
  var NEWSLETTER_URL = 'https://script.google.com/macros/s/AKfycbyDstzzBQKUW-xucy5NlFpA_55v0QriquFdCnLGvUVkE74bDTLjStm-RR2QMzl_urc/exec';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Resolves true when Moosend accepted the email. text/plain keeps it a "simple"
  // request (no CORS preflight, which Apps Script can't answer); the script reads the JSON body as text.
  function subscribe(email, name) {
    return fetch(NEWSLETTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ Email: email, Name: name || '' }),
      keepalive: true,
    }).then(function (r) { return r.text(); }).then(function (t) {
      try { var j = JSON.parse(t); return j && (j.Code === 0 || j.Code === '0'); } catch (e) { return false; }
    }).catch(function () { return false; });
  }
  window.wsjSubscribe = subscribe;

  // ---------- 1. the newsletter boxes ----------
  function wireBox(box) {
    if (box.dataset.wired) return; box.dataset.wired = '1';
    var input = box.querySelector('input[type="email"]'), btn = box.querySelector('button');
    if (!input || !btn) return;
    input.setAttribute('aria-label', 'Email address'); input.autocomplete = 'email';
    // The message sits on top of the email box + button (position:absolute in
    // content-page.css), so the card never changes size. Errors go away after a
    // few seconds or on a click, so they can try again; "subscribed" stays.
    var msg = document.createElement('p'); msg.className = 'nl-msg'; msg.setAttribute('role', 'status');
    box.appendChild(msg);
    var hideTimer;
    function clearMsg() { clearTimeout(hideTimer); msg.textContent = ''; msg.classList.remove('nl-ok', 'nl-err'); }
    function showError(text) { msg.textContent = text; msg.classList.add('nl-err'); hideTimer = setTimeout(function () { clearMsg(); input.focus(); }, 3500); }
    msg.addEventListener('click', function () { if (msg.classList.contains('nl-err')) { clearMsg(); input.focus(); } });
    function send() {
      var email = input.value.trim();
      clearMsg();
      if (!EMAIL_RE.test(email)) { showError('Please enter a valid email address.'); return; }
      btn.disabled = true; var label = btn.textContent; btn.textContent = 'Signing up…'; msg.textContent = '';
      subscribe(email, '').then(function (ok) {
        btn.disabled = false; btn.textContent = label;
        if (ok) { msg.textContent = 'You’re subscribed! Watch your inbox for trip news.'; msg.classList.add('nl-ok'); input.value = ''; }
        else showError('Sorry, that didn’t go through. Please try again in a moment.');
      });
    }
    btn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  // ---------- 2. every other form ----------
  function nameFrom(form) {
    var get = function (sel) { var el = form.querySelector(sel); return el ? el.value.trim() : ''; };
    var first = get('[id*="FirstName" i], [name*="firstName" i]'), last = get('[id*="LastName" i], [name*="lastName" i]');
    if (first || last) return (first + ' ' + last).trim();
    var named = [].filter.call(form.querySelectorAll('input[type="text"]'), function (i) { return /name/i.test(i.name + ' ' + i.id) && !/website/i.test(i.name + i.id); });
    return named.length ? named[0].value.trim() : '';
  }
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement) || form.closest('.newsletter-form')) return;
    var hp = form.querySelector('[name="website"]'); if (hp && hp.value) return;       // bot honeypot
    var input = form.querySelector('input[type="email"]'); if (!input) return;
    var email = input.value.trim();
    // only once the form is really complete (its own checks may still stop it otherwise)
    if (!EMAIL_RE.test(email) || !form.checkValidity()) return;
    subscribe(email, nameFrom(form));
  }, true);

  function init() { document.querySelectorAll('.newsletter-form').forEach(wireBox); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
