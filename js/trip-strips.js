// Home + About trip strips, filled from js/trips.js:
//   #soonGrid   - "Departing Soon": the next 4 departures (cruises + land trips), not sold out
//   #cruise-grid - every upcoming cruise and 3+ cruise journey (not sold out), sideways slider
//   #land-grid   - every upcoming land trip, sideways slider
// Each slider's year buttons are built from the years that actually have trips;
// picking a year on the land trips also links each card to that year.
(function(){
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // "8-day Worldschooling Mediterranean Ravenna to Barcelona Cruise" -> "Mediterranean Ravenna to Barcelona Cruise"
  const shortTitle = (t) => String(t || "").replace(/^(\d+-(leg|day)\s+)+/i, "").replace(/^(mini\s+)?worldschooling\s+/i, "");
  const bySoonest = (a, b) => String(a.sortDate).localeCompare(String(b.sortDate));

  function priceBadge(c){
    if (!c.price) return `<div class="sp-price"><b>${c.tag && /waitlist/i.test(c.tag) ? "Waitlist" : "Coming soon"}</b></div>`;
    return `<div class="sp-price">From <b>${esc(c.price)}</b> ${c.per === "family" ? "/ family" : "pp"}</div>`;
  }
  function cardHTML(c){
    const photo = c.photo ? ` has-photo" style="background-image:linear-gradient(180deg, rgba(21,34,48,0.05) 0%, rgba(13,22,32,0.15) 60%), url('${esc(c.photo)}')` : "";
    return `<a href="${esc(c.href)}" class="spotlight-card style-photo${photo}">` +
      (c.photo ? "" : `<span class="sp-caption">Photo: ${esc(c.photoLabel)}</span>`) +
      priceBadge(c) +
      `<div class="sp-overlay"><div class="spotlight-dates">${esc(c.dates)}</div><div class="spotlight-title">${esc(shortTitle(c.title))}</div></div></a>`;
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
      row.innerHTML = '<button type="button" class="trip-filter-btn active" data-year="all">All</button>' +
        years.map((y) => `<button type="button" class="trip-filter-btn" data-year="${y}">${y}</button>`).join("");
      row.hidden = years.length < 2;
      row.addEventListener("click", (e) => {
        const btn = e.target.closest(".trip-filter-btn");
        if (!btn) return;
        row.querySelectorAll(".trip-filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
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
      if (cruiseGrid) cruiseGrid.outerHTML = '<p class="trip-empty-note">Cruises couldn’t be loaded right now. <a href="/cruises.html">See all cruises</a></p>';
      if (soon) soon.innerHTML = W.landTrips().sort(bySoonest).slice(0, 4).map(cardHTML).join("");
      return;
    }
    const cruiseCards = [...data.cruises, ...data.journeys].filter((c) => !c.soldOut);
    const cruiseYears = [...new Set(cruiseCards.map((c) => c.year))].sort();
    setupSlider("cruise-grid", cruiseYears, (y) => cruiseCards.filter((c) => !y || c.year === y));
    if (soon) {
      // individual cruises + land trips (journeys repeat their first cruise's date)
      const next = [...data.cruises.filter((c) => !c.soldOut), ...W.landTrips()].sort(bySoonest).slice(0, 4);
      soon.innerHTML = next.map(cardHTML).join("");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
