# 🚀 LAUNCHWINDOW — Cape Canaveral Launch Schedule

A creative, space-themed landing page that tracks **upcoming and potential
rocket launches** from Florida's Space Coast — Cape Canaveral Space Force
Station and the adjacent Kennedy Space Center.

![pads](https://img.shields.io/badge/pads-SLC--40%20%C2%B7%20SLC--41%20%C2%B7%20LC--39A-5cf2d6) ![status](https://img.shields.io/badge/feed-live%20%2F%20fallback-7b8cff)

## Features

- **Animated starfield** — a drifting, twinkling canvas backdrop.
- **Live countdown** to the very next vehicle off the pad, with a liftoff state.
- **The Manifest** — a vertical mission timeline. Click any launch to expand
  full mission details (orbit, payload, vehicle, site).
- **Provider filters** — pivot the manifest by SpaceX, ULA, NASA, etc.
- **At-a-glance stats** — confirmed "Go" vs. potential/TBD launches.
- **Status colour coding** — `GO`, `TBD`, `NET` (no earlier than), `HOLD`.

## Live data

On load the page calls the free
[Launch Library 2](https://thespacedevs.com/) API, filtered to the Cape
Canaveral and Kennedy pad groups. If the network is unavailable or rate
limited, it transparently falls back to a curated manifest in
[`data.js`](./data.js) so the page always looks alive. The header badge shows
which source is active (`live feed` vs `curated manifest`).

## Run it

It's a static site — no build step. Just open `index.html`, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup & structure |
| `styles.css` | Space-coast theme, animations, responsive layout |
| `app.js` | Starfield, data fetch + fallback, countdown, filtering, render |
| `data.js` | Curated fallback launch manifest |

> Schedules slip. Always confirm with the launch provider before heading to
> the beach. 🌊
