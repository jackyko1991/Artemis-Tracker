# Artemis Tracker

Live tracking visualisation for the Artemis II crewed lunar flyby mission.

**Live site:** https://jackyko1991.github.io/Artemis-Tracker/

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules require a server — opening `index.html` directly won't work.

## Deploy

Push to `main` — GitHub Actions deploys automatically.

**First time only:** go to **Settings → Pages → Source** and set it to **GitHub Actions**, then push again.
