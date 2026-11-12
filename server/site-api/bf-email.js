// The Black Friday "your discount code is live" email (HTML + plain text), one per family,
// listing only the sale trips they signed up for. Used by the Admin "send" feature and the test script.
// Keep SALE_TRIPS in step with js/black-friday.js (codes) and js/trips.js / js/booking.js (dates, prices, booking links).
'use strict';

const SITE = 'https://worldschoolingjourneys.com';
const WETRAVEL = (uuid) => `https://everyavenuetravel.wetravel.com/checkout_embed?uuid=${uuid}&source=widget_book_now`;

const SALE_TRIPS = {
  'austria-wellness': {
    title: 'Austria Health & Wellness Retreat', dates: 'May 4–25, 2027', length: '21 days', place: 'Salzburgerland, Austria',
    highlights: 'Thermal spas · Mountain air · Time for your health while the kids explore',
    price: '€1,802', code: 'BFAUSTRIA', saving: '€50', family: '€200',
    photo: '/images/land-trips/austria/wellness-header.webp', page: '/land-trips/austria-health-wellness-retreat?year=2027', book: WETRAVEL('21359722'),
  },
  'austria-summer': {
    title: 'Austrian Mountain Summer Retreat', dates: 'May 30 – Jul 11, 2027 (3 sessions)', length: '14 days per session', place: 'Salzburgerland, Austria',
    highlights: 'Forests & waterfalls · Thermal spas · Mountain villages',
    price: '€1,852', code: 'BFAUSTRIA', saving: '€50', family: '€200',
    photo: '/images/land-trips/austria-summer.webp', page: '/land-trips/austrian-mountain-summer-retreat?year=2027', book: WETRAVEL('74908621'),
  },
  'austria-fall': {
    title: 'Austrian Fall Mountain Retreat', dates: 'Sep 11–25, 2027', length: '14 days', place: 'Salzburgerland, Austria',
    highlights: 'Golden peaks · Alpine traditions · Thermal spas',
    price: '€1,740', code: 'BFAUSTRIA', saving: '€50', family: '€200',
    photo: '/images/land-trips/austria-fall.webp', page: '/land-trips/austrian-fall-mountain-retreat?year=2027', book: WETRAVEL('50555278'),
  },
  'austria-winter': {
    title: 'Austrian Skiing & Christmas Markets Retreat', dates: 'Dec 5–19, 2027', length: '14 days', place: 'Salzburgerland, Austria',
    highlights: 'Ski & snowboard · Christmas markets · Krampus parade',
    price: '€1,505', code: 'BFAUSTRIA', saving: '€50', family: '€200',
    photo: '/images/land-trips/austria-winter.webp', page: '/land-trips/austrian-skiing-christmas-markets-retreat?year=2027', book: WETRAVEL('64756176'),
  },
  'new-zealand': {
    title: 'New Zealand Roadtrip', dates: 'Oct 19 – Nov 8, 2027', length: '21 days', place: 'North & South Islands, New Zealand',
    highlights: 'Glaciers & national parks · Māori culture · Hobbiton',
    price: '$4,997', code: 'BFNEWZEALAND', saving: '$50', family: '$200',
    photo: '/images/land-trips/new-zealand.webp', page: '/land-trips/new-zealand-roadtrip?departure=2027-10', book: WETRAVEL('5999768167'),
  },
};

const C = { dark: '#152230', paper: '#f4f1e9', white: '#fffdf7', green: '#708F53', gold: '#d9a441', red: '#c8102e', muted: '#5a5343', line: '#e2ddd0' };
const SERIF = "'Libre Baskerville', Georgia, 'Times New Roman', serif";
const SANS = "'Titillium Web', 'Segoe UI', Arial, Helvetica, sans-serif";
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// the sale trips a family signed up for (skips trips without a code yet)
function saleTripsFor(trips) {
  return (trips || []).map((t) => (typeof t === 'string' ? t : t.slug)).filter((s, i, a) => SALE_TRIPS[s] && a.indexOf(s) === i);
}

function button(href, label, solid) {
  return `<a href="${esc(href)}" target="_blank" style="display:inline-block;font-family:${SANS};font-size:15px;font-weight:700;text-decoration:none;margin:5px 0;` +
    `padding:12px 22px;border-radius:6px;${solid ? `background:${C.green};color:#ffffff;border:2px solid ${C.green};` : `background:#ffffff;color:${C.dark};border:2px solid ${C.dark};`}">${esc(label)}</a>`;
}

function tripCard(t) {
  return `
  <tr><td style="padding:0 28px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#ffffff;border:1px solid ${C.line};border-radius:12px;overflow:hidden;">
      <tr><td style="padding:0;line-height:0;">
        <a href="${esc(SITE + t.page)}" target="_blank"><img src="${esc(SITE + t.photo)}" width="542" alt="${esc(t.title)}" style="display:block;width:100%;max-width:542px;height:auto;border:0;border-radius:12px 12px 0 0;"></a>
      </td></tr>
      <tr><td style="padding:22px 24px 8px;">
        <div style="font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.green};">${esc(t.dates)}</div>
        <div style="font-family:${SERIF};font-size:22px;font-weight:700;line-height:1.3;color:${C.dark};margin:6px 0 6px;">${esc(t.title)}</div>
        <div style="font-family:${SANS};font-size:15px;line-height:1.5;color:${C.muted};">${esc(t.length)} · ${esc(t.place)}</div>
        <div style="font-family:${SANS};font-size:15px;line-height:1.5;color:${C.muted};margin-top:2px;">${esc(t.highlights)}</div>
        <div style="font-family:${SANS};font-size:15px;color:${C.dark};margin-top:12px;">Starting from <strong style="font-family:${SERIF};font-size:19px;">${esc(t.price)}</strong> / person</div>
      </td></tr>
      <tr><td style="padding:14px 24px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#fdf1f3;border:2px dashed ${C.red};border-radius:10px;">
          <tr><td align="center" style="padding:16px 12px;">
            <div style="font-family:${SANS};font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${C.red};">Save ${esc(t.saving)} per person with code</div>
            <div style="font-family:${SANS};font-size:28px;font-weight:800;letter-spacing:.08em;color:${C.dark};margin:4px 0 2px;">${esc(t.code)}</div>
            <div style="font-family:${SANS};font-size:13.5px;color:${C.muted};">Enter it at checkout when you book. A family of 4 saves ${esc(t.family)}!</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:18px 24px 24px;">
        ${button(SITE + t.page, 'Learn More About the Trip', false)}
        <span style="display:inline-block;width:10px;height:10px;"></span>
        ${button(t.book, 'Book Now', true)}
      </td></tr>
    </table>
  </td></tr>`;
}

// signup: { name, email, trips: [{slug}] }  ->  { subject, html, text, unsubscribe } (null when none of their trips has a code yet)
// unsubscribeUrl: this family's own one-click unsubscribe link (made by server.js); without it the footer points to the contact page
function renderBlackFridayEmail(signup, { test = false, unsubscribeUrl = '' } = {}) {
  const optOut = unsubscribeUrl || `${SITE}/contact`;
  const slugs = saleTripsFor(signup.trips);
  if (!slugs.length) return null;
  const trips = slugs.map((s) => SALE_TRIPS[s]);
  const one = trips.length === 1;
  const subject = (test ? '[Test] ' : '') + (one
    ? `Your Black Friday code is live: save ${trips[0].saving} per person on the ${trips[0].title}`
    : `Your Black Friday codes are live for ${trips.length} of your trips`);
  const intro = one
    ? `Good news: the Black Friday discount for the trip you signed up for is now live. Here’s your code.`
    : `Good news: the Black Friday discounts for the trips you signed up for are now live. Here are your codes.`;
  const preheader = one ? `Save ${trips[0].saving} per person on the ${trips[0].title} with code ${trips[0].code}.` : `Your Black Friday codes are inside.`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Libre+Baskerville:wght@700&family=Titillium+Web:wght@400;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 10px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.white};border-radius:14px;overflow:hidden;border:1px solid ${C.line};">
    <tr><td align="center" style="background:${C.dark};padding:26px 20px 22px;">
      <a href="${SITE}" target="_blank" style="text-decoration:none;">
        <span style="font-family:'Caveat', 'Brush Script MT', cursive;font-size:34px;font-weight:700;color:${C.gold};">Worldschooling</span>
        <span style="font-family:${SANS};font-size:26px;font-weight:300;color:#ffffff;letter-spacing:.02em;">&nbsp;Journeys</span>
      </a>
    </td></tr>
    <tr><td align="center" style="background:${C.red};padding:11px 20px;font-family:${SANS};font-size:15px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffffff;">Black Friday Sale</td></tr>
    <tr><td style="padding:30px 28px 22px;">
      <div style="font-family:${SERIF};font-size:24px;font-weight:700;color:${C.dark};margin:0 0 12px;">Hi ${esc(firstName(signup.name))},</div>
      <div style="font-family:${SANS};font-size:16.5px;line-height:1.6;color:${C.dark};">${esc(intro)}</div>
      <div style="font-family:${SANS};font-size:16.5px;line-height:1.6;color:${C.dark};margin-top:10px;">The sale ends soon, so if you’ve been thinking about joining us, now’s the time.</div>
    </td></tr>
    ${trips.map(tripCard).join('')}
    <tr><td style="padding:0 28px 30px;">
      <div style="font-family:${SANS};font-size:16px;line-height:1.6;color:${C.dark};">Questions about the trip or the booking? <a href="${SITE}/contact" target="_blank" style="color:${C.green};font-weight:700;">Get in touch with us here</a>. (This email address can’t receive replies.)</div>
      <div style="font-family:${SANS};font-size:16px;line-height:1.6;color:${C.dark};margin-top:14px;">See you out there,<br><strong>The Worldschooling Journeys Team</strong></div>
    </td></tr>
    <tr><td style="background:${C.dark};padding:20px 28px;font-family:${SANS};font-size:12.5px;line-height:1.6;color:#b8c0c8;" align="center">
      You’re getting this email because you joined our Black Friday waitlist on <a href="${SITE}" target="_blank" style="color:#ffffff;">worldschoolingjourneys.com</a>.
      Rather not hear about this sale? <a href="${esc(optOut)}" target="_blank" style="color:#ffffff;">Unsubscribe</a>.<br>
      Worldschooling Journeys, an Every Avenue Travel company · Florida Seller of Travel Reg. No. ST45213
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    `BLACK FRIDAY SALE`, ``, `Hi ${firstName(signup.name)},`, ``, intro,
    `The sale ends soon, so if you’ve been thinking about joining us, now’s the time.`, ``,
    ...trips.flatMap((t) => [
      `${t.title}`, `${t.dates} · ${t.length} · ${t.place}`, `Starting from ${t.price} / person`,
      `Save ${t.saving} per person with code ${t.code} (enter it at checkout; a family of 4 saves ${t.family})`,
      `Learn more: ${SITE + t.page}`, `Book now: ${t.book}`, ``,
    ]),
    `Questions? Get in touch with us at ${SITE}/contact (this email address can’t receive replies).`, ``, `See you out there,`, `The Worldschooling Journeys Team`, ``,
    `You’re getting this email because you joined our Black Friday waitlist on worldschoolingjourneys.com. Rather not hear about this sale? Unsubscribe: ${optOut}`,
  ].join('\n');

  return { subject, html, text, unsubscribe: unsubscribeUrl || '' };
}

module.exports = { renderBlackFridayEmail, saleTripsFor, SALE_TRIPS };
