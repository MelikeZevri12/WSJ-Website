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
