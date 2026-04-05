# Artemis Tracker

Live tracking visualisation for the Artemis II crewed lunar flyby mission.

**Live site:** https://jackyko1991.github.io/Artemis-Tracker/

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules require a server — opening `index.html` directly won't work.

## Cache News Images Locally

```bash
node scripts/cache-news-images.mjs
```

This downloads the current checkpoint article images into `assets/news/` and writes
`assets/news/manifest.json`. The app loads that manifest at startup and prefers the
cached local files over remote hotlinks.

## Deploy

Push to `main` — GitHub Actions deploys automatically.

**First time only:** go to **Settings → Pages → Source** and set it to **GitHub Actions**, then push again.
