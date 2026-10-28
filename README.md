# Worldschooling Journeys website: where to edit what

## Shared pieces (edit once, every page follows)

| What | File |
|---|---|
| Navbar (menu items, links) | `partials/nav.html` |
| Footer (links, social icons, legal line) | `partials/footer.html` |
| Phone menu behaviour | `js/nav.js` |
| Navbar styles | `css/nav.css` |
| Footer styles | `css/footer.css` |
| Page headers (hero) sizes | `css/hero.css` |
| Rounded card corners | `css/cards.css` |
| Land trip booking: WeTravel UUIDs / booking links per trip and year (no UUID = waitlist) | `js/booking.js` |
| Waitlist popup (land trips + Coming Soon idea cards) | `js/waitlist.js`, `css/waitlist.css` |
| Cruise + journey booking form steps (Book now / Pricing question, who's traveling, one step per passenger) | `js/booking-steps.js` (styles: `.bs-` in `css/trip-page.css`) |
| Where cruise/journey/port/cabin pictures load from (API `/uploads/...` or this site): used by every page that shows them | `js/picture-url.js` |
| Zipchat chat bubble + "Connect via ChatBot" links (loaded by the footer) | `js/chatbot.js` |
| Contact form "Send A Message" (Home, About, Contact, Stay Updated): one inbox per reason (sending not set up yet) | `js/contact-form.js` |
| Page addresses without .html (a land trip's address comes from its title in `js/trips.js`) | `tools/clean-urls.js` |
| "Page not found" page | `404.html` |
| Server routing (Caddy) copy + old WordPress redirects | `server/Caddyfile.site`, `server/old-site-redirects.caddy` |
| sitemap.xml / robots.txt (made at every deploy) | `tools/sitemap.js` |
| Newsletter (Moosend via the Google Apps Script): Sign Up boxes + every form also subscribes (loaded by the footer) | `js/newsletter.js` |
| Phones/tablets: trip cards open in the same tab + "Back to ..." buttons on trip pages (loaded by the footer) | `js/trip-links.js` |
| "Read More" article on the Cruises / Land Trips pages | `about-our-trips.html` |
| Roadmap page ("Vote Now" links): ProductLift boards | `roadmap.html` |

Pages pull the navbar and footer in with a marker:

```html
<!-- include nav active="trips" -->
<!-- include footer -->
```

`active` is the menu item highlighted on that page: `home`, `trips`, `about`, `stay` or `contact`
(leave it out to highlight nothing). The marker is filled in by `node server.js` when testing
locally and by `deploy` when uploading, so the live site gets plain, complete pages.

## Shared styles, by page family

Each page loads the shared files for its family, then its own short `<style>` block
(only what's unique to that page), so a page can always override a shared rule.

| File | Used by |
|---|---|
| `css/site.css` | every page |
| `css/content-page.css` | Home, About, Contact, Stay Updated, FAQ, the 3 policy pages |
| `css/home-sections.css` | Home, About, Contact, Stay Updated, FAQ |
| `css/trip-strips.css` | Home, About, Contact, Stay Updated (trip carousels, Coming Soon, testimonials) |
| `css/policy.css` | the 3 policy pages |
| `css/listing.css` | Group Cruises and Land Trips listing pages |
| `css/trip-page.css` | every cruise, journey and land trip page |
| `css/cruise-page.css` | cruise and journey pages |
| `css/land-trip.css` | every land trip page |
| `css/retreat.css` | Austria retreats and Dude Ranch |

A few pages repeat a shared rule in their own `<style>` with a comment saying so
("Also in css/... Repeated here so it still wins..."). If you change one of those, change both.

## After changing a shared .css or .js file

Nothing extra to do: `deploy` stamps every link to a file in `css/` or `js/` with a
fingerprint of that file (`?v=...`), so browsers fetch the new version as soon as it changes.

## Other folders

- `tools/`: `build.js` (used by `deploy`) and `includes.js` (fills in the markers). Not uploaded.
- `templates/`: design mockups. Not uploaded.
- `admin.html`: the admin dashboard. Uploaded with the site (trips.worldschoolingjourneys.com/admin.html); everything in it needs the staff password.
