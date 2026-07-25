// Previously received Webflow CMS webhooks and dispatched the GitHub Actions
// workflow that regenerates public/data.json on every CMS edit. Disabled to
// keep Netlify build minutes down — data.json now refreshes on the workflow's
// own schedule (see .github/workflows/update-cms-data.yml) instead of on
// every edit. Left in place so Webflow's configured webhook doesn't start
// failing; it just acknowledges receipt without triggering a build.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  return {
    statusCode: 202,
    body: "Received, but ignored: CMS data now refreshes on a schedule instead of per-edit.",
  };
};
