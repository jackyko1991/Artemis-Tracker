# Artemis Tracker MVP

Small static demo showing:

- Earth and Moon in a lightweight 3D scene
- A stylized Artemis free-return trajectory
- Checkpoint nodes with news/photo cards
- A clean adapter point for NASA live data later

## Run

Use a local static server so ES modules load correctly:

```bash
cd /home/jackyko/Projects/space_track
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

This repo is configured for GitHub Pages via GitHub Actions.

Expected remote:

```bash
git@github.com:jackyko1991/Artemis-Tracker.git
```

Workflow file:

- `.github/workflows/deploy-pages.yml`

After the first push:

1. Open the GitHub repo settings.
2. Go to `Pages`.
3. Set `Source` to `GitHub Actions` if it is not already selected.
4. Push to `main` to trigger deployment.

## Current MVP Scope

- `index.html`: layout and UI shell
- `styles.css`: responsive styling
- `app.js`: Three.js scene, mocked mission data, node interactions

## Next Step For Live NASA Data

Replace the mocked `missionData` object in `app.js` with:

- Artemis II AROW ephemeris/state vectors for spacecraft position
- A simple Moon ephemeris source
- NASA Artemis RSS/blog/news matching by timestamp for node content

Keep the rendering layer unchanged and only swap the data source.
