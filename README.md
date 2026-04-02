# Artemis Tracker MVP

Small static demo showing:

- Earth and Moon in a lightweight 3D scene
- A stylized Artemis free-return trajectory
- Checkpoint nodes with news/photo cards
- A clean adapter point for NASA live data later

## Run locally

Use a local static server so ES modules load correctly:

```bash
cd /home/jackyko/Projects/space_track
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

The workflow file `.github/workflows/deploy-pages.yml` deploys the site automatically on every push to `main`.

**First-time setup** (only needed once):

1. Create the remote repository on GitHub (must be named `Artemis-Tracker` under `jackyko1991`):

   ```bash
   gh repo create jackyko1991/Artemis-Tracker --public
   ```

   Or create it manually at https://github.com/new.

2. Initialise git and push:

   ```bash
   git init
   git remote add origin git@github.com:jackyko1991/Artemis-Tracker.git
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git push -u origin main
   ```

3. Enable GitHub Pages in the repository settings:
   - Go to **Settings → Pages**.
   - Set **Source** to **GitHub Actions**.

4. The Actions workflow will run automatically and publish the site. Once it finishes the live URL will be:

   https://jackyko1991.github.io/Artemis-Tracker/

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
