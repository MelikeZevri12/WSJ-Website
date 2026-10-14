// Home + About trip strips, filled from js/trips.js:
//   #soonGrid   - "Departing Soon": the next 3 departures (cruises + land trips), not sold out
//   #cruise-grid - every upcoming cruise and 3+ cruise journey (not sold out), sideways slider
//   #land-grid   - every upcoming land trip, sideways slider
// Each slider's year buttons are built from the years that actually have trips;
// picking a year on the land trips also links each card to that year.
(function(){
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // "8-day Worldschooling Mediterranean Ravenna to Barcelona Cruise" -> "Mediterranean Ravenna to Barcelona Cruise"
  const shortTitle = (t) => String(t || "").replace(/^(\d+-(leg|day)\s+)+/i, "").replace(/^(mini\s+)?worldschooling\s+/i, "");
  const bySoonest = (a, b) => String(a.sortDate).localeCompare(String(b.sortDate));

  const CALENDAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  function priceHTML(c){
    if (!c.price) return `<div><div class="cc-price">${c.tag && /waitlist/i.test(c.tag) ? "Waitlist" : "Coming soon"}</div></div>`;
    return `<div><div class="cc-price-label">Starting from</div><div class="cc-price">${esc(c.price)} <small>/ ${c.per === "family" ? "family" : "person"}</small></div></div>`;
  }
  // Two stacked zones: the photo on top (fully visible), the dates, name,
  // price and Learn More on a navy band underneath.
  function cardHTML(c){
    return `<a href="${esc(c.href)}" target="_blank" rel="noopener" class="spotlight-card style-photo trip-card${c.photo ? " has-photo" : ""}">` +
      `<div class="sp-photo"${c.photo ? ` style="background-image:url('${esc(c.photo)}')"` : ""}></div>` +
      (c.photo ? "" : `<span class="sp-caption">Photo: ${esc(c.photoLabel)}</span>`) +
      (c.tag ? `<span class="cc-tag">${esc(c.tag)}</span>` : "") +
      `<div class="sp-overlay"><div class="spotlight-dates">${CALENDAR}<span>${esc(c.dates)}</span></div>` +
      `<div class="spotlight-title">${esc(shortTitle(c.title))}</div>` +
      `<div class="cc-foot">${priceHTML(c)}<span class="cc-more">Learn More</span></div></div></a>`;
  }

  function setupSlider(gridId, years, cardsFor){
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const row = document.querySelector(`.trip-filter-row[data-filter-target="${gridId}"]`);
    const emptyNote = document.querySelector(`.trip-empty-note[data-empty-for="${gridId}"]`);
    let year = null;
    // ‹ › buttons, only shown when there's more to scroll to
    const arrows = document.createElement("div");
    arrows.className = "strip-arrows";
    arrows.innerHTML = '<button type="button" class="strip-arrow" data-dir="-1" aria-label="Previous trips">&#8249;</button><button type="button" class="strip-arrow" data-dir="1" aria-label="More trips">&#8250;</button>';
    (row || grid).insertAdjacentElement(row ? "afterend" : "beforebegin", arrows);
    const [prev, next] = arrows.querySelectorAll("button");
    function updateArrows(){
      const max = grid.scrollWidth - grid.clientWidth;
      arrows.hidden = max <= 2;
      prev.disabled = grid.scrollLeft <= 2;
      next.disabled = grid.scrollLeft >= max - 2;
    }
    arrows.addEventListener("click", (e) => {
      const btn = e.target.closest(".strip-arrow");
      if (!btn) return;
      const card = grid.querySelector(".spotlight-card");
      const step = card ? card.getBoundingClientRect().width + 18 : grid.clientWidth;
      grid.scrollBy({ left: Number(btn.dataset.dir) * step, behavior: "smooth" });
    });
    grid.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);

    function draw(){
      const cards = cardsFor(year).sort(bySoonest);
      grid.innerHTML = cards.map(cardHTML).join("");
      grid.scrollLeft = 0;
      if (emptyNote) emptyNote.hidden = cards.length > 0;
      updateArrows();
    }
    if (row) {
      row.innerHTML = '<button type="button" class="trip-filter-btn active" data-year="all" aria-pressed="true">All</button>' +
        years.map((y) => `<button type="button" class="trip-filter-btn" data-year="${y}" aria-pressed="false">${y}</button>`).join("");
      row.hidden = years.length < 2;
      row.addEventListener("click", (e) => {
        const btn = e.target.closest(".trip-filter-btn");
        if (!btn) return;
        row.querySelectorAll(".trip-filter-btn").forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
        year = btn.dataset.year === "all" ? null : Number(btn.dataset.year);
        draw();
      });
    }
    draw();
  }

  async function init(){
    const W = window.WSJ;
    // Land trips need no network - draw them straight away
    setupSlider("land-grid", W.landYears(), (y) => W.landTrips(y));

    const soon = document.getElementById("soonGrid");
    const cruiseGrid = document.getElementById("cruise-grid");
    if (!soon && !cruiseGrid) return;
    let data;
    try {
      data = await W.loadCruiseCards();
    } catch (e) {
      if (cruiseGrid) cruiseGrid.outerHTML = '<p class="trip-empty-note">Cruises couldn’t be loaded right now. <a href="/cruises">See all cruises</a></p>';
      if (soon) soon.innerHTML = W.landTrips().sort(bySoonest).slice(0, 3).map(cardHTML).join("");
      return;
    }
    const cruiseCards = [...data.cruises, ...data.journeys].filter((c) => !c.soldOut);
    const cruiseYears = [...new Set(cruiseCards.map((c) => c.year))].sort();
    setupSlider("cruise-grid", cruiseYears, (y) => cruiseCards.filter((c) => !y || c.year === y));
    if (soon) {
      // individual cruises + land trips (journeys repeat their first cruise's date)
      const next = [...data.cruises.filter((c) => !c.soldOut), ...W.landTrips()].sort(bySoonest).slice(0, 3);
      soon.innerHTML = next.map(cardHTML).join("");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
