// "Send A Message" form (Home, About, Contact, Stay Updated) → POST /contact on the API,
// which emails it to the inbox for the chosen reason (the reason → inbox list lives in
// the API: backend/src/modules/contact/contact.controller.ts). The visitor's email is the
// Reply-To. js/newsletter.js also adds the email to the newsletter once the form is complete.
(function () {
  var API = 'https://api.worldschoolingjourneys.com';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function wire(form) {
    var btn = form.querySelector('button[type="submit"]');
    var msg = form.querySelector('.cf-msg');
    var chips = form.querySelectorAll('.reason-chip input');

    // .active mirrors the checked radio (styling for browsers without :has)
    chips.forEach(function (input) {
      input.addEventListener('change', function () {
        chips.forEach(function (i) { i.closest('.reason-chip').classList.toggle('active', i.checked); });
        if (msg.classList.contains('nl-err')) say('', '');
      });
    });

    function say(text, kind) {
      msg.textContent = text;
      msg.classList.remove('nl-ok', 'nl-err');
      if (kind) msg.classList.add(kind);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var fullName = f.fullName.value.trim(), email = f.email.value.trim(), message = f.message.value.trim();
      var reason = (form.querySelector('.reason-chip input:checked') || {}).value;
      if (!fullName) { say('Please enter your name.', 'nl-err'); f.fullName.focus(); return; }
      if (!EMAIL_RE.test(email)) { say('Please enter a valid email address.', 'nl-err'); f.email.focus(); return; }
      if (!reason) { say('Please choose a reason for contacting us.', 'nl-err'); chips[0].focus(); return; }
      if (!message) { say('Please write a message.', 'nl-err'); f.message.focus(); return; }

      btn.disabled = true; var label = btn.textContent; btn.textContent = 'Sending…'; say('', '');
      fetch(API + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason, fullName: fullName, email: email, message: message, page: location.pathname, website: f.website.value }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
      }).then(function (res) {
        if (res.ok) {
          var from = res.body.replyFrom;
          say('Message sent! ' + (from ? 'Please add ' + from + ' to your approved senders and check your spam folder. ' : '')
            + 'If you don’t hear back within 48 hours, reach out over WhatsApp or Facebook Messenger.', 'nl-ok');
          form.reset();
          chips.forEach(function (i) { i.closest('.reason-chip').classList.remove('active'); });
        } else if (res.status === 400 && res.body && res.body.message) {
          say(String(res.body.message), 'nl-err');
        } else if (res.status === 429) {
          say('You’ve sent several messages in a short time. Please try again a bit later, or reach out over WhatsApp.', 'nl-err');
        } else {
          throw new Error('send failed');
        }
      }).catch(function () {
        say('Sorry, your message didn’t go through. Please try again, or reach out over WhatsApp or Facebook Messenger.', 'nl-err');
      }).then(function () {
        btn.disabled = false; btn.textContent = label;
      });
    });
  }

  function init() { document.querySelectorAll('form.contact-form').forEach(wire); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
