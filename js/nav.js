// The phone menu on every page (loaded at the end of each page).
// MOBILE NAVBAR: the phone menu button opens/closes the side drawer; tapping
// the dimmed page, a link, or Escape closes it. The page can't scroll behind it.
(function(){
  const nav = document.querySelector('.global-nav');
  const btn = document.getElementById('gnToggle');
  const links = document.getElementById('gnLinks');
  if(!nav || !btn || !links) return;
  const logo = nav.querySelector('.gn-logo');
  if(logo){ const copy = logo.cloneNode(true); copy.classList.add('gn-drawer-logo'); links.prepend(copy); }
  const backdrop = document.createElement('div');
  backdrop.className = 'gn-backdrop';
  nav.appendChild(backdrop);
  function setOpen(open){
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  links.addEventListener('click', (e) => { if(e.target.closest('a[href]:not([href="#"])')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if(innerWidth > 760) setOpen(false); });
})();
