# Webflow CMS → JSON → Netlify

Automatically exports your Webflow CMS collection(s) to a static `data.json`
file, committed to this repo on a schedule, and served by Netlify.

## How it works

1. `scripts/fetch-cms.js` calls the Webflow API and writes `public/data.json`.
2. `.github/workflows/update-cms-data.yml` runs that script on a schedule
   (every 30 min by default) via GitHub Actions, and commits the file if it
   changed.
3. Netlify is connected to this repo and auto-deploys on every push, so the
   JSON is always live at:
   `https://YOUR-SITE-NAME.netlify.app/data.json`

## One-time setup

### 1. Get your Webflow API token
Webflow dashboard → **Site settings → Apps & integrations → API access**
→ generate a **Site token** (or use a Workspace/App token) with at least
`cms:read` scope.

### 2. Get your Site ID
Webflow dashboard → **Site settings → General** → copy the Site ID.
(You can also get it from the Webflow API `GET /sites` endpoint.)

### 3. (Optional) Get a specific Collection ID
Only needed if you want to export just one collection instead of all of
them. Find it in **CMS → [Collection] → Settings**, or via the API.

### 4. Add GitHub repo secrets
In your repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name             | Value                                   |
|--------------------------|------------------------------------------|
| `WEBFLOW_API_TOKEN`      | Your Webflow API token                   |
| `WEBFLOW_SITE_ID`        | Your Webflow Site ID                     |
| `WEBFLOW_COLLECTION_ID`  | *(optional)* a single collection ID      |

If you set `WEBFLOW_COLLECTION_ID`, the workflow will export only that
collection instead of every collection on the site.

### 5. Connect the repo to Netlify
Netlify → **Add new site → Import from Git** → pick this repo.

Because this project only serves static JSON, no build is required. Set:
- **Publish directory**: `public`
- **Build command**: leave blank, or use `echo 'No build required'`

This repo also includes `netlify.toml` to pin the publish directory to `public`.

> The exported file will be written to `public/data.json`, so Netlify must
> serve from the `public` folder for `https://YOUR-SITE-NAME.netlify.app/data.json`
> to work.

### 6. Test it
Go to your repo's **Actions** tab → select **Update Webflow CMS Data** →
**Run workflow** to trigger it manually and confirm `public/data.json` gets
created/updated and pushed.

## Adjusting the schedule

Edit the `cron` line in `.github/workflows/update-cms-data.yml`. Examples:

- Every 15 minutes: `*/15 * * * *`
- Every hour: `0 * * * *`
- Every day at 6am UTC: `0 6 * * *`

## Running locally

```bash
export WEBFLOW_API_TOKEN=your_token
export WEBFLOW_SITE_ID=69032fdb6b02b3d538173e9e
export WEBFLOW_COLLECTION_ID=697b17d1196b23a749bea2c1
node scripts/fetch-cms.js
```

Use your own `WEBFLOW_API_TOKEN`; the site ID and collection ID above can be used to test the same collection locally before enabling the GitHub Actions workflow.
