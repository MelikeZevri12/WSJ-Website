# site-api: the website's own small server

The website's internal data, kept apart from the cruise API. For now that's the
**testimonials** (admin → Testimonials tab: add, edit, delete). Plain Node, no packages.

| | |
|---|---|
| Code | `server.js` (this folder; not uploaded by `deploy`, the `server/` folder is skipped) |
| Starting data | `seed/testimonials.json`: the 58 testimonials the website had on 2026-11-02 (testimonials page, home/about strip, cruise pages, Austria pages). Only used the very first time, when there's no data file yet |
| On the VPS | `~/apps/site-api` (systemd service `site-api`, 127.0.0.1:3100) |
| Data on the VPS | `~/apps/site-api/data/testimonials.json`, every change backed up first to `data/backups/` (last 100 kept) |
| Address | `https://worldschoolingjourneys.com/site-api/...` (Caddy `handle /site-api/*` in `server/Caddyfile.site`) |
| Login | The admin page's staff login. The server only checks the login token's signature with the cruise API's `JWT_SECRET` (copied into `~/apps/site-api/.env` on the server; never print it) |
| Tests | `node --test server/site-api/server.test.js` (from the `frontend` folder) |

Endpoints: `GET /site-api/health`, `GET /site-api/testimonials[?category=cruise|land_trip|port_excursion|austria_retreat]`
(public), `POST /site-api/testimonials`, `PUT` and `DELETE /site-api/testimonials/<id>` (staff login).
A testimonial: `{ id, name, fullText, shortVersion, category, featured, carousel, sortOrder, createdAt, updatedAt }`
(`featured` = marked as one of the best in admin; shown first on the website; missing on older rows = not featured; `carousel` = picked for the website carousels with the admin Carousel switch, same rules).

## First-time setup (done once)

On the PC (cmd):
```
cd /d C:\Users\admin\Desktop\website\frontend
ssh melike@178.105.202.222 "mkdir -p ~/apps/site-api/seed"
scp server\site-api\server.js melike@178.105.202.222:~/apps/site-api/
scp server\site-api\seed\testimonials.json melike@178.105.202.222:~/apps/site-api/seed/
scp server\Caddyfile.site melike@178.105.202.222:~/wsj-site.caddy
```
On the VPS (bash):
```
cd ~/apps/site-api
node -v
ss -ltn | grep -q ':3100 ' && echo "PORT 3100 IS TAKEN - stop here" || echo "port 3100 is free"
grep '^JWT_SECRET=' ~/apps/cruise-backend/.env > .env && chmod 600 .env
grep -q '^JWT_SECRET=' .env && echo "login key copied" || echo "LOGIN KEY NOT FOUND - stop here"
sudo tee /etc/systemd/system/site-api.service > /dev/null <<EOF
[Unit]
Description=Worldschooling Journeys website server (site-api)
After=network.target

[Service]
User=melike
WorkingDirectory=/home/melike/apps/site-api
EnvironmentFile=/home/melike/apps/site-api/.env
ExecStart=$(which node) /home/melike/apps/site-api/server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now site-api
sudo systemctl status site-api --no-pager
curl -s http://127.0.0.1:3100/site-api/health
sudo cp /etc/caddy/wsj-site.caddy ~/wsj-site.caddy.bak
sudo cp ~/wsj-site.caddy /etc/caddy/wsj-site.caddy && sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy
curl -s https://worldschoolingjourneys.com/site-api/health
```
Both `curl` lines should print `{"ok":true}`.

## Updating the server code later

PC: `scp server\site-api\server.js melike@178.105.202.222:~/apps/site-api/`
VPS: `sudo systemctl restart site-api && sudo systemctl status site-api --no-pager`

The data file is never overwritten by an update (the seed file is only read when there's no data file).
If the cruise API's `JWT_SECRET` ever changes, copy it again on the VPS
(`cd ~/apps/site-api && grep '^JWT_SECRET=' ~/apps/cruise-backend/.env > .env`) and restart `site-api`.

## Adding testimonials in bulk (import)

`import-testimonials.js` + a file in `imports/` (`{ "add": [...], "fillFullText": [{ "id", "fullText" }] }`). It only adds
testimonials that aren't there yet and fills in empty full texts, so nothing edited in admin is overwritten. Without
`--apply` it only shows what it would do; with `--apply` it needs `site-api` stopped (the running server keeps the list in
memory) and backs the data up first. Used on 2026-11-02 for `imports/2026-11-02-old-site.json` (9 reviews from the old
WordPress testimonials page that were missing + the full text of Natiera, Christina and Matea). Also `"removeIds"` (take out exact ids) and `"replaceCategory"` (take out every testimonial of that type not in `add`): used on 2026-11-04 for `imports/2026-11-04-austria.json` (the 14 new Austria Retreat testimonials replace the old 9; two Austria reviews filed as Land Trip moved over).
```
cd ~/apps/site-api
node import-testimonials.js imports/<file>.json
sudo systemctl stop site-api; node import-testimonials.js imports/<file>.json --apply; sudo systemctl start site-api
```

## Undoing a change

Every save leaves the previous version in `~/apps/site-api/data/backups/testimonials-<date-time>.json`. To go back:
`cp data/backups/<file> data/testimonials.json && sudo systemctl restart site-api`.
