// Receives Webflow CMS webhooks and triggers the GitHub Actions workflow
// that regenerates public/data.json.
//
// Requires the GH_DISPATCH_TOKEN environment variable (set in the Netlify
// dashboard): a GitHub fine-grained PAT with Actions read/write on the repo.

const REPO = "Pankajdweb/Jgi-Events";
const WORKFLOW = "update-cms-data.yml";
const DEBOUNCE_MS = 60_000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return { statusCode: 500, body: "GH_DISPATCH_TOKEN is not configured" };
  }

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "jgivent-webflow-webhook",
  };

  // Debounce: bulk CMS edits fire one webhook per item, so skip dispatch if a
  // run was already created within the last minute.
  const since = new Date(Date.now() - DEBOUNCE_MS).toISOString();
  const recentRes = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?created=${encodeURIComponent(">" + since)}&per_page=1`,
    { headers: ghHeaders }
  );
  if (recentRes.ok) {
    const { total_count: totalCount } = await recentRes.json();
    if (totalCount > 0) {
      return { statusCode: 202, body: "Skipped: workflow already triggered within the last minute" };
    }
  }

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (dispatchRes.status === 204) {
    return { statusCode: 200, body: "Workflow dispatched" };
  }
  const detail = await dispatchRes.text();
  return { statusCode: 502, body: `GitHub dispatch failed: ${dispatchRes.status} ${detail}` };
};
