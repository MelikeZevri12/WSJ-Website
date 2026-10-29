// Land trip "Current Roster" cards, synced from the team's Notion "Rosters" pages through the API
// (GET /land-trip-rosters?trip=<body data-trip>: counts and kid ages only, refreshed every 5 minutes).
// Notion page names: "<Trip> <Year>" (Austria: one table per session, in order) or "<Trip> <Month> <Year>"
// for trips with several departures a year ("Morocco November 2027"; add the day if two share a month).
// Once the API answers, it decides every roster on the page: a departure without a Notion page shows none.
// If the API can't be reached, the page keeps the numbers written in its own data.
//   LandRoster.sync(SEASONS, renderSelection)     Austria + Dude Ranch (SEASONS[year].sessions)
//   LandRoster.sync(DEPARTURES, renderDeparture)  fixed-date trips
//   LandRoster.kidsHTML([roster, ...])            the "Kid Ages" chips in the card's right column
// Loaded before the page's own script (the first render already draws the chips).
window.LandRoster = (function(){
  const API = 'https://api.worldschoolingjourneys.com';
  const ymd = iso => iso.split('-').map(Number);

  const byAge = (a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);
  const labelsOf = r => r.kidLabels || (r.kidAges || []).map(String);

  function counts(sessions){
    const kidAges = sessions.flatMap(s => s.kidAges).sort((a, b) => a - b);
    const kidLabels = sessions.flatMap(labelsOf).sort(byAge);
    const sum = k => sessions.reduce((n, s) => n + s[k], 0);
    return {families: sum('families'), adults: sum('adults'), kids: sum('kids'), kidAges, kidLabels};
  }

  // Every kid on the roster(s), youngest first, as chips like the cruise pages: "6b", "10g"
  // (b = boy, g = girl; no letter when Notion doesn't say). Same CSS (.rf-kid in css/trip-page.css).
  function kidsHTML(rosters){
    const kids = rosters.flatMap(labelsOf).sort(byAge);
    if(!kids.length) return '<div class="rf-sub">No kids on this trip yet.</div>';
    const chips = kids.map(k => {
      const m = /^(\d+)([bg]?)$/.exec(k) || [, k, ''];
      const age = m[1] === '0' ? '<1' : m[1];
      return `<span class="rf-kid ${m[2]}" aria-label="${age}${m[2] ? (m[2] === 'g' ? ' girl' : ' boy') : ''}">${age.replace('<', '&lt;')}${m[2] ? `<small>${m[2]}</small>` : ''}</span>`;
    });
    const key = ['b', 'g'].filter(c => kids.some(k => k.endsWith(c)))
      .map(c => `<span><span class="rf-kid ${c}"><small>${c}</small></span> ${c === 'g' ? 'girl' : 'boy'}</span>`).join('');
    return `<div class="rf-ages-label">Kid Ages</div><div class="rf-kids">${chips.join('<span class="rf-sep">, </span>')}</div>${key ? `<div class="rf-kids-key">${key}</div>` : ''}`;
  }

  function applySeasons(seasons, rosters){
    Object.entries(seasons).forEach(([year, season]) => {
      const page = rosters.find(r => r.year === Number(year));
      season.sessions.forEach(s => {
        const t = page && page.sessions.find(x => x.n === s.n);
        s.roster = t ? counts([t]) : null;
      });
    });
  }

  function applyDepartures(departures, rosters){
    departures.forEach(d => {
      const [y, m, day] = ymd(d.start);
      const sameYear = departures.filter(o => ymd(o.start)[0] === y);
      const sameMonth = sameYear.filter(o => ymd(o.start)[1] === m);
      const page = rosters.find(r => r.year === y &&
        (r.month == null ? sameYear.length === 1 : r.month === m && (r.day == null ? sameMonth.length === 1 : r.day === day)));
      d.roster = page ? counts(page.sessions) : null;
    });
  }

  function sync(data, rerender){
    const trip = document.body.dataset.trip;
    if(!trip) return;
    fetch(`${API}/land-trip-rosters?trip=${encodeURIComponent(trip)}`)
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(rosters => {
        if(!Array.isArray(rosters)) return;
        Array.isArray(data) ? applyDepartures(data, rosters) : applySeasons(data, rosters);
        rerender();
      })
      .catch(() => {});
  }

  return {sync, kidsHTML};
})();
