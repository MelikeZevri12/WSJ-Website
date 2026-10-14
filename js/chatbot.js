// Zipchat: loads the chat bubble on every page, and makes every "Connect via ChatBot" link open it.
// Without the widget (blocked, still loading, failed), the link opens the chat in a new tab instead.
(function () {
  var ZIPCHAT_ID = 'lbcwQPr6HjDbhwzA3XOo';
  var CHAT_URL = 'https://app.zipchat.ai/iframe/?widget_token=' + ZIPCHAT_ID;

  var s = document.createElement('script');
  s.src = 'https://app.zipchat.ai/widget/zipchat.js?id=' + ZIPCHAT_ID;
  s.defer = true;
  document.head.appendChild(s);

  function isChatLink(a) { return /connect via chatbot/i.test(a.textContent); }

  // real link as the fallback (also what crawlers and middle-click see)
  function wire() {
    document.querySelectorAll('a').forEach(function (a) {
      if (!isChatLink(a)) return;
      a.href = CHAT_URL; a.target = '_blank'; a.rel = 'noopener';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  // On phones the trip and cruise pages have a sticky price bar at the bottom (.sticky-bar);
  // lift the bubble above it so it doesn't cover the bar's button.
  var baseBottom = null;
  function liftBubble() {
    var host = document.getElementById('zipchat-shadow-host');
    var box = host && host.shadowRoot && host.shadowRoot.getElementById('widget-chat-container');
    if (!box) return;
    if (baseBottom === null) baseBottom = box.style.bottom || '20px';
    var bar = document.querySelector('.sticky-bar');
    var h = bar && getComputedStyle(bar).display !== 'none' && bar.getBoundingClientRect().top < innerHeight ? bar.offsetHeight : 0;
    var want = h ? 'calc(' + baseBottom + ' + ' + h + 'px)' : baseBottom;
    if (box.style.bottom !== want) box.style.bottom = want;
  }
  if (window.matchMedia) setInterval(liftBubble, 700);

  // capture phase, so it runs before anything else on the page can swallow the click
  window.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || !isChatLink(a) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (window.Zipchat && typeof window.Zipchat.open === 'function') {
      e.preventDefault();
      e.stopPropagation();
      window.Zipchat.open({ open: true });
    }
  }, true);
})();
