// Shared trip data for the Home, About and Land Trips pages.
//
// Land trips are static for now (no backend): for each year with an available
// departure (not past / sold out; waitlist counts), the dates, price and tag a
// card shows when that year is picked. Prices are in the trip's own terms:
// per "person" ($) or per "family" (€, the Austria retreats). "param" is how
// the trip page takes a preselected year in its link (?year= / ?departure=).
// When a trip page's dates or prices change, update its entry here.
//
// Cruises and 3+ cruise journeys come from the live API, with the same rules
// and starting price (cheapest 2-guest cabin, per person) as the Group Cruises page.
(function(){
  const API = "https://api.worldschoolingjourneys.com";
  const todayStr = new Date().toISOString().slice(0, 10);

  const LAND_TRIPS = [
    {"slug":"new-zealand","param":"departure","title":"19-day Worldschooling New Zealand Roadtrip","nights":18,"regions":["Oceania"],"per":"person","photo":"/images/land-trips/new-zealand.webp","photoLabel":"New Zealand", "years": {
      2026: {"dates":"Oct 16 – Nov 3, 2026","sortDate":"2026-10-16","price":"$4,717","departures":1},
      2027: {"dates":"Oct 19 – Nov 6, 2027","sortDate":"2027-10-19","price":"$4,997","departures":1} } },
    {"slug":"morocco","param":"departure","title":"12-day Worldschooling Morocco Family Journey","nights":11,"regions":["Africa"],"per":"person","photo":"/images/land-trips/morocco.webp","photoLabel":"Morocco", "years": {
      2026: {"dates":"Nov 1–12, 2026","sortDate":"2026-11-01","price":"$2,200","tag":"Few spots left","departures":1},
      2027: {"dates":"Mar 19–30 & Nov 1–12, 2027","sortDate":"2027-03-19","price":"$2,300","departures":2} } },
    {"slug":"austria-winter","param":"year","title":"14-day Worldschooling Austrian Skiing & Christmas Markets Retreat","nights":14,"regions":["Europe"],"per":"family","photo":"/images/land-trips/austria-winter.webp","photoLabel":"Austrian Alps in winter", "years": {
      2026: {"dates":"Dec 4–18, 2026","sortDate":"2026-12-04","price":"€2,700","tag":"Few spots left","departures":1},
      2027: {"dates":"Dec 5–19, 2027","sortDate":"2027-12-05","price":"€3,010","departures":1} } },
    {"slug":"egypt-jordan","param":"departure","title":"15-day Worldschooling Egypt & Jordan Adventure","nights":14,"regions":["Africa","Middle East"],"per":"person","photo":"/images/land-trips/egypt-jordan.webp","photoLabel":"Egypt & Jordan", "years": {
      2027: {"dates":"Jan 25 – Feb 8, 2027","sortDate":"2027-01-25","price":"$2,999","departures":1} } },
    {"slug":"austria-wellness","param":"year","title":"21-day Worldschooling Austria Health & Wellness Retreat","nights":21,"regions":["Europe"],"per":"family","photo":"/images/land-trips/austria-wellness.webp","photoLabel":"Bad Gastein wellness", "years": {
      2027: {"dates":"May 4–25, 2027","sortDate":"2027-05-04","price":"€3,604","departures":1} } },
    {"slug":"austria-summer","param":"year","title":"14-day Worldschooling Austrian Mountain Summer Retreat","nights":14,"regions":["Europe"],"per":"family","photo":"/images/land-trips/austria-summer.webp","photoLabel":"Austrian Alps in summer", "years": {
      2027: {"dates":"May 30 – Jul 11, 2027 · 3 sessions","sortDate":"2027-05-30","price":"€3,704","departures":3} } },
    {"slug":"galapagos","param":"departure","title":"8-day Worldschooling Galápagos Island Hopping Tour","nights":7,"regions":["South America"],"per":"person","photo":"/images/land-trips/galapagos.webp","photoLabel":"Galápagos", "years": {
      2027: {"dates":"Aug 8–15, 2027","sortDate":"2027-08-08","price":"$3,735","departures":1} } },
    {"slug":"austria-fall","param":"year","title":"14-day Worldschooling Austrian Fall Mountain Retreat","nights":14,"regions":["Europe"],"per":"family","photo":"/images/land-trips/austria-fall.webp","photoLabel":"Austrian Alps in fall", "years": {
      2027: {"dates":"Sep 5–19, 2027","sortDate":"2027-09-05","price":"€3,480","departures":1} } },
    {"slug":"dude-ranch","param":"year","title":"7-day Worldschooling Horseback Riding Dude Ranch Experience","nights":6,"regions":["North America"],"per":"person","photo":"/images/land-trips/dude-ranch.webp","photoLabel":"VeeBar Guest Ranch", "years": {
      2027: {"dates":"Sep 5–11, 2027","sortDate":"2027-09-05","price":"$3,200","departures":1},
      2028: {"dates":"September 2028","sortDate":"2028-09-03","price":null,"tag":"Waitlist open","departures":1} } },
    {"slug":"xcaret","param":"departure","title":"8-day Worldschooling Xcaret Family Adventure","nights":7,"regions":["North America"],"per":"person","photo":"/images/land-trips/xcaret.webp","photoLabel":"Xcaret, Mexico", "years": {
      2027: {"dates":"November 2027","sortDate":"2027-11-01","price":null,"tag":"Waitlist open","departures":1} } }
  ];

  // A land trip's card for one year (or its earliest upcoming year when year
  // is null). Departures that have already started drop off on their own.
  function landTripView(t, year){
    const upcoming = Object.keys(t.years).filter(k => t.years[k].sortDate >= todayStr).sort();
    const key = year ? String(year) : upcoming[0];
    if(!key || !upcoming.includes(key)) return null;
    const v = t.years[key];
    return {
      kind: "land",
      href: `/land-trips/${t.slug}.html` + (year ? `?${t.param}=${year}` : ""),
      title: t.title, dates: v.dates, sortDate: v.sortDate, nights: t.nights, regions: t.regions,
      year: Number(key),
      departures: year ? v.departures : upcoming.reduce((n, k) => n + t.years[k].departures, 0),
      price: v.price, per: t.per,
      priceText: v.price ? `${v.price} <small>/ ${t.per}</small>` : null,
      tag: v.tag || null, heroImageUrl: t.photo, photo: t.photo, photoLabel: t.photoLabel,
      soldOut: false, startingPrice: null, largeFamilies: false,
    };
  }
  const landTrips = (year) => LAND_TRIPS.map(t => landTripView(t, year || null)).filter(Boolean);
  const landYears = () => [...new Set(LAND_TRIPS.flatMap(t => Object.keys(t.years).filter(k => t.years[k].sortDate >= todayStr)))].map(Number).sort();

  // ---- cruises (same rules as the Group Cruises page) ----
  const perPerson = (twoGuestPrice) => Math.round(twoGuestPrice / 2);
  function isPublishable(c){
    if (c.isAddOn || c.addOnForCruiseId || c.isIndividual) return false;
    if (c.departureDate.slice(0, 10) < todayStr) return false;
    return Boolean(c.destination && c.sailDates && c.nights != null);
  }
  function startingPrice(c){
    const prices = (c.cabinPrices || []).filter(r => r.guests === 2 && !r.soldOut && r.price != null).map(r => r.price);
    return prices.length ? perPerson(Math.min(...prices)) : null;
  }
  function formatRange(startIso, endIso){
    const d = (iso) => new Date(`${iso.slice(0,10)}T00:00:00Z`);
    const a = d(startIso), b = d(endIso);
    const md = (x) => x.toLocaleDateString("en-US", {month:"short", day:"numeric", timeZone:"UTC"});
    const y = (x) => x.getUTCFullYear();
    if (y(a) !== y(b)) return `${md(a)}, ${y(a)} – ${md(b)}, ${y(b)}`;
    if (a.getUTCMonth() === b.getUTCMonth()) return `${md(a)}–${b.getUTCDate()}, ${y(b)}`;
    return `${md(a)} – ${md(b)}, ${y(b)}`;
  }
  const money = (n) => "$" + n.toLocaleString("en-US");
  function cruiseCard(c){
    const p = startingPrice(c);
    return {
      kind: "cruise", href: `/cruises/${c.businessId}`, title: c.title || c.destination, dates: c.sailDates,
      sortDate: c.departureDate, year: Number(c.departureDate.slice(0, 4)), soldOut: !!c.soldOut,
      price: p != null ? money(p) : null, per: "person",
      photo: c.heroImageUrl ? API + c.heroImageUrl : null, photoLabel: c.destination || (c.ship && c.ship.name) || "",
    };
  }
  // 3+ cruise journey: each cabin category's 2-guest prices added up over every
  // cruise (categories all cruises offer, not sold out), cheapest, per person.
  function journeyCard(j){
    const legs = j.cruises, first = legs[0], last = legs[legs.length - 1];
    const endIso = new Date(Date.parse(`${last.departureDate.slice(0,10)}T00:00:00Z`) + (last.nights || 0) * 86400000).toISOString();
    const cats = new Set(legs.flatMap(l => l.cabinPrices.map(p => p.category)));
    const totals = [...cats].map(cat => {
      let total = 0;
      for (const l of legs) {
        const row = l.cabinPrices.find(p => p.category === cat && p.guests === 2);
        if (l.soldOut || !row || row.soldOut || row.price == null) return null;
        total += row.price;
      }
      return total;
    }).filter(t => t != null);
    return {
      kind: "journey", href: `/journeys/${j.slug}`, title: j.title || `${legs.length}-Cruise Back-to-Back Journey`,
      dates: formatRange(first.departureDate, endIso), sortDate: first.departureDate, year: Number(first.departureDate.slice(0, 4)),
      soldOut: legs.some(l => l.soldOut), price: totals.length ? money(perPerson(Math.min(...totals))) : null, per: "person",
      photo: j.heroImageUrl ? API + j.heroImageUrl : null, photoLabel: "Back-to-back journey",
    };
  }
  async function loadCruiseCards(){
    const res = await fetch(`${API}/cruises`);
    if (!res.ok) throw new Error("cruises " + res.status);
    const cruises = (await res.json()).filter(isPublishable).map(cruiseCard);
    let journeys = [];
    try {
      const r = await fetch(`${API}/back-to-backs/journeys`);
      if (r.ok) journeys = (await r.json()).filter(j => j.slug && j.cruises.length >= 3 && j.cruises[0].departureDate.slice(0, 10) >= todayStr).map(journeyCard);
    } catch (e) { /* cruises alone is fine */ }
    return { cruises, journeys };
  }

  window.WSJ = { API, todayStr, LAND_TRIPS, landTripView, landTrips, landYears, loadCruiseCards, formatRange };
})();
