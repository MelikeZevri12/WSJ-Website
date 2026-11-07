// Form checks for the cruise booking forms (cruise page, journey page, booking-form.html), added 2026-11-07
// after feedback asking for more validation, a country list for citizenship and phone number checks.
// Any <form data-validate> gets these checks (on top of the browser's own required/min/max):
//   type="email"             a real-looking address (name@example.com)
//   type="tel"               7 to 15 digits, only + ( ) - . and spaces besides; required when the form's
//                            "Best way to reach you?" (contactMethod) is Text, Call or WhatsApp
//   data-check="name"        a first or last name: letters (any language), spaces, ' - .
//   data-check="fullname"    the same, at least two words (first and last name)
//   data-check="dob"         a date of birth: not in the future, after 1900
//   data-check="dob-adult"   the same, and 18 or older (the lead traveler)
//   data-check="travelers"   a whole number from 1 to data-max (15 = MAX_TRAVELERS below; more = email us)
//   data-check="kids"        a whole number, at most travelers - 1 (data-travelers = id of the travelers box)
//   data-check="kidage"      a whole number from 0 to 17
// The number boxes show their message while typing (no need to leave the field first).
//   select[data-country]     filled with the country list below (common ones first)
// Messages show under the field once it's left, and in the browser's bubble on Next / Submit.
// Pages call WSJForm.checkAll(el) before checking validity (booking-steps.js does it per step; a
// capture listener does it on every submit of a form[data-validate]).
window.WSJForm = (function () {
  const COMMON = ['United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland', 'Germany', 'France',
    'Netherlands', 'Spain', 'Italy', 'Mexico', 'Brazil', 'South Africa'];
  const ALL = ['Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia',
    'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
    'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia',
    'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
    'Congo (Democratic Republic)', 'Congo (Republic)', 'Costa Rica', "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
    'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
    'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
    'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
    'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
    'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
    'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
    'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
    'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'São Tomé and Príncipe', 'Saudi Arabia', 'Senegal', 'Serbia',
    'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea',
    'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania',
    'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda',
    'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
    'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'];
  // What people typed before the list existed (and in older requests) -> the list's name
  const ALIASES = { 'us': 'United States', 'usa': 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States', 'america': 'United States',
    'united states of america': 'United States', 'american': 'United States', 'uk': 'United Kingdom', 'u.k.': 'United Kingdom',
    'great britain': 'United Kingdom', 'britain': 'United Kingdom', 'england': 'United Kingdom', 'scotland': 'United Kingdom',
    'wales': 'United Kingdom', 'british': 'United Kingdom', 'canadian': 'Canada', 'australian': 'Australia', 'holland': 'Netherlands',
    'the netherlands': 'Netherlands', 'uae': 'United Arab Emirates', 'czechia': 'Czech Republic', 'korea': 'South Korea',
    'ivory coast': "Côte d'Ivoire", 'turkiye': 'Turkey', 'türkiye': 'Turkey' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalize = (v) => {
    const s = String(v ?? '').trim(); if (!s) return '';
    const low = s.toLowerCase();
    return ALIASES[low] || ALL.find((c) => c.toLowerCase() === low) || s;
  };

  // <option>s for a citizenship <select>; a saved value that isn't in the list is kept as its own option
  function countryOptions(selected) {
    const v = normalize(selected);
    const opt = (c) => `<option${c === v ? ' selected' : ''}>${esc(c)}</option>`;
    return `<option value="">Select a country</option>` +
      (v && !ALL.includes(v) ? `<option selected>${esc(v)}</option>` : '') +
      `<optgroup label="Most common">${COMMON.map(opt).join('')}</optgroup>` +
      `<optgroup label="All countries">${ALL.map((c) => `<option>${esc(c)}</option>`).join('')}</optgroup>`;
  }
  function setCountry(select, value) { select.innerHTML = countryOptions(value); }

  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  const PHONE_NEEDED = ['Text', 'Call', 'WhatsApp'];
  const MAX_TRAVELERS = 15; // per booking request (user's choice, 2026-11-07)
  const whole = (s) => (/^\d+$/.test(String(s).trim()) ? +String(s).trim() : NaN);
  function ageOn(iso, today) {
    const [y, m, d] = iso.split('-').map(Number);
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
    return age;
  }

  // The message for one field ('' = fine). Empty fields are left to the browser's "required".
  function messageFor(el) {
    const v = (el.value || '').trim();
    const check = el.dataset.check || '';
    if (el.type === 'tel') {
      const how = el.form && el.form.elements.contactMethod;
      if (!v) return how && PHONE_NEEDED.includes(how.value) ? `Please add your phone number so we can reach you by ${how.value === 'Call' ? 'phone' : how.value}.` : '';
      const digits = v.replace(/\D/g, '');
      if (!/^\+?[\d\s().-]+$/.test(v) || digits.length < 7 || digits.length > 15)
        return 'Please enter a valid phone number, with the country code if you\'re outside the US or Canada (e.g. +1 555 555 5555).';
      return '';
    }
    if (!v) return '';
    if (check === 'travelers') {
      const n = whole(v), max = +(el.dataset.max || MAX_TRAVELERS);
      if (!(n >= 1)) return 'Please enter the number of people as a whole number (at least 1).';
      if (n > max) return `For more than ${max} travelers, please email us at booking@everyavenue.com and we'll quote your group.`;
      return '';
    }
    if (check === 'kids') {
      const k = whole(v), tBox = document.getElementById(el.dataset.travelers), t = tBox ? whole(tBox.value) : NaN;
      if (!(k >= 0)) return 'Please enter a whole number (0 if no kids are traveling).';
      const tMax = tBox ? +(tBox.dataset.max || MAX_TRAVELERS) : MAX_TRAVELERS;
      if (t >= 1 && t <= tMax && k > t - 1) return t === 1 ? 'With 1 traveler, kids should be 0: at least one adult needs to travel.'
        : `At least one adult needs to travel, so with ${t} travelers there can be at most ${t - 1} kid${t - 1 === 1 ? '' : 's'}.`;
      return '';
    }
    if (check === 'kidage') {
      const a = whole(v);
      return a >= 0 && a <= 17 ? '' : 'Kids\' ages are 0 to 17 (anyone 18 or older counts as an adult).';
    }
    if (el.type === 'email') return EMAIL_RE.test(v) ? '' : 'Please enter a valid email address, like name@example.com.';
    if (check === 'name' || check === 'fullname') {
      if (v.length < 2 || !NAME_RE.test(v)) return 'Please use letters only (spaces, hyphens and apostrophes are fine).';
      if (check === 'fullname' && v.split(/\s+/).filter(Boolean).length < 2) return 'Please enter the first and last name.';
      return '';
    }
    if (check === 'dob' || check === 'dob-adult') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Please enter a valid date of birth.';
      const today = new Date(), year = +v.slice(0, 4);
      if (year < 1900) return 'Please check the year of birth.';
      if (ageOn(v, today) < 0 || new Date(v + 'T00:00') > today) return 'The date of birth can\'t be in the future.';
      if (check === 'dob-adult' && ageOn(v, today) < 18) return 'The person filling out this form needs to be 18 or older.';
      return '';
    }
    return '';
  }
  function check(el) {
    if (!el.setCustomValidity || el.disabled) return true;
    el.setCustomValidity(messageFor(el));
    if (el.classList.contains('wsj-touched')) showError(el);
    return el.checkValidity();
  }
  // Under-the-field message, shown once the person has left the field. Several boxes can share one
  // .field (the kids' age boxes): it shows the first wrong one among them.
  function showError(el) {
    const field = el.closest('.field') || el.parentElement;
    let box = field.querySelector(':scope > .wsj-err');
    const bad = [...field.querySelectorAll(FIELDS)].find((f) => f.classList.contains('wsj-touched') && !f.checkValidity());
    const msg = bad ? bad.validationMessage : '';
    if (!msg) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'wsj-err'; field.appendChild(box); }
    box.textContent = msg;
  }
  const FIELDS = 'input, select, textarea';
  function checkAll(root) {
    let ok = true;
    root.querySelectorAll(FIELDS).forEach((el) => { if (!check(el)) ok = false; });
    return ok;
  }
  // Mark fields as touched so their messages show (used before reportValidity on Next / Submit)
  function touchAll(root) { root.querySelectorAll(FIELDS).forEach((el) => { el.classList.add('wsj-touched'); check(el); }); }

  // Fill citizenship lists, set max dates and sensible length limits inside a form
  function prepare(root) {
    const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    root.querySelectorAll('select[data-country]').forEach((s) => { if (!s.options.length) setCountry(s, s.dataset.value || ''); });
    root.querySelectorAll('input[data-check^="dob"]').forEach((d) => { d.max = iso; d.min = '1900-01-01'; });
    root.querySelectorAll('input[type="text"]:not([maxlength]), input[type="email"]:not([maxlength])').forEach((i) => { i.maxLength = 120; });
    root.querySelectorAll('input[type="tel"]:not([maxlength])').forEach((i) => { i.maxLength = 25; });
    root.querySelectorAll('textarea:not([maxlength])').forEach((t) => { t.maxLength = 3000; });
  }

  const inForm = (el) => el && el.closest && el.closest('form[data-validate]');
  const LIVE = ['travelers', 'kids', 'kidage'];
  document.addEventListener('input', (e) => {
    const form = inForm(e.target); if (!form) return;
    if (LIVE.includes(e.target.dataset.check) && e.target.value !== '') e.target.classList.add('wsj-touched');
    check(e.target);
    // the kids box depends on the travelers box
    if (e.target.id) form.querySelectorAll(`[data-travelers="${e.target.id}"]`).forEach(check);
  });
  document.addEventListener('change', (e) => {
    const form = inForm(e.target); if (!form) return;
    check(e.target);
    // the phone can become required when "Best way to reach you?" changes
    if (e.target.name === 'contactMethod') form.querySelectorAll('input[type="tel"]').forEach(check);
  });
  document.addEventListener('focusout', (e) => {
    if (!inForm(e.target) || !e.target.matches(FIELDS)) return;
    if (!e.target.value && !e.target.classList.contains('wsj-touched')) return; // just tabbing through
    e.target.classList.add('wsj-touched'); check(e.target);
  });
  // before the page's own submit handler runs (capture phase)
  document.addEventListener('submit', (e) => { const f = e.target; if (f.matches && f.matches('form[data-validate]')) { prepare(f); touchAll(f); } }, true);
  // fields added later (passenger steps) get the same limits
  new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && inForm(n)) prepare(n); })))
    .observe(document.documentElement, { childList: true, subtree: true });
  const ready = () => document.querySelectorAll('form[data-validate]').forEach(prepare);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ready) : ready();

  const css = document.createElement('style');
  css.textContent = `form[data-validate] .wsj-touched:invalid{border-color:#c14a2f !important;}
    form[data-validate] .wsj-err{color:#c14a2f;font-size:13px;line-height:1.4;margin-top:5px;}`;
  document.head.appendChild(css);

  // true when the travelers + kids boxes hold a sensible pair (then the age boxes and passenger steps are drawn)
  function countsOk(travelersBox, kidsBox) {
    const t = whole(travelersBox.value), k = whole(kidsBox.value);
    return t >= 1 && t <= MAX_TRAVELERS && k >= 0 && k <= t - 1;
  }

  return { MAX_TRAVELERS, countsOk, countryOptions, setCountry, normalize, check, checkAll, touchAll, prepare, messageFor };
})();
