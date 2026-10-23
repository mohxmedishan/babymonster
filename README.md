# BABYMONSTER.HUB — MONSTIEZ fan terminal

A responsive BABYMONSTER fan dashboard with a black/chrome/crimson/acid-lime visual identity, randomized official YG portrait wallpaper, dynamic music discovery, official member profile portraits, news aggregation, and local event countdowns.

## What's included

- `index.html` — single-file frontend: Tailwind CSS CDN, styles, and native ES6 JavaScript.
- `api/news.js` — Vercel serverless Google News RSS route.
- `api/discography.js` — Vercel serverless route that merges public Apple/iTunes Search metadata with MusicBrainz release-group data and enriches a small set of releases with track names.
- `vercel.json` — minimal deployment configuration.

## Run locally

Requires Node.js and npm.

```bash
npm install --global vercel
vercel dev
```

Open the local URL printed by Vercel. The app calls `/api/news` and `/api/discography`, so use a serverless-capable local host rather than opening `index.html` with `file://`.

## Deploy

1. Import the **entire `babymonster-hub` folder** into Vercel (not just `index.html`). The `api/` folder must sit next to `index.html` at the project root.
2. Deploy with the Vercel CLI or the Vercel dashboard.
3. After deployment, visit `/api/news` and `/api/discography` on your domain; each should return JSON. If either shows a 404, fix the Vercel project Root Directory so it points to the folder containing `index.html`, `api/`, and `vercel.json`. No music API key is required for the public catalog sources.

## How dynamic discography works

The route queries Apple/iTunes Search and MusicBrainz, merges records by normalized title and year, filters out most non-primary release-group types, deduplicates results, sorts by release date, and adds artwork and platform search links. It enriches up to 12 recent iTunes collections with track names when available. Public catalogs may be incomplete, delayed, or occasionally misclassify editions; this is a best-effort discovery layer rather than a guaranteed official feed.

MusicBrainz requests identify the application with a User-Agent. If you deploy a fork at scale, review MusicBrainz's current API rate-limit and attribution guidance.

## Member portraits

The member cards use image URLs from YG Entertainment's public BABYMONSTER profile page. Those images remain the property of their rights holders and can change. A built-in initials fallback appears if a portrait fails to load.

## Notes

- Google Fonts and Tailwind's CDN require an internet connection.
- News RSS and music catalog routes require internet access from the server.
- The browser stores only user-added events and the optional news key setting in local storage. No API secret is required by the music catalog route.
- This is a fan-made project and is not affiliated with YG Entertainment.
