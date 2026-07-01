/**
 * Fetches items from one or more Webflow CMS collections and writes them
 * to a JSON file (default: ./public/data.json).
 *
 * Required environment variables:
 *   WEBFLOW_API_TOKEN   - Webflow API v2 token (Site token or App token with cms:read scope)
 *   WEBFLOW_SITE_ID     - Your Webflow site ID
 *
 * Optional environment variables:
 *   WEBFLOW_COLLECTION_ID  - A single collection ID to export.
 *                            If omitted, ALL collections on the site are exported.
 *   OUTPUT_PATH            - Where to write the JSON file (default: public/data.json)
 */

const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.webflow.com/v2";
const TOKEN = process.env.WEBFLOW_API_TOKEN;
const SITE_ID = process.env.WEBFLOW_SITE_ID;
const SINGLE_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const OUTPUT_PATH = process.env.OUTPUT_PATH || "public/data.json";

if (!TOKEN) {
  console.error("Missing WEBFLOW_API_TOKEN environment variable.");
  process.exit(1);
}
if (!SITE_ID) {
  console.error("Missing WEBFLOW_SITE_ID environment variable.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json",
};

async function webflowGet(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Webflow API error ${res.status} for ${url}: ${body}`);
  }
  return res.json();
}

async function listCollections(siteId) {
  const data = await webflowGet(`${API_BASE}/sites/${siteId}/collections`);
  return data.collections || [];
}

async function listAllItems(collectionId, useLive = false) {
  const limit = 100;
  let offset = 0;
  let allItems = [];
  const path = useLive ? "items/live" : "items";

  while (true) {
    const data = await webflowGet(
      `${API_BASE}/collections/${collectionId}/${path}?limit=${limit}&offset=${offset}`
    );
    const items = data.items || [];
    allItems = allItems.concat(items);

    if (items.length < limit) break;
    offset += limit;
  }

  return allItems;
}

async function main() {
  let collections;

  if (SINGLE_COLLECTION_ID) {
    collections = [{ id: SINGLE_COLLECTION_ID, displayName: "collection" }];
  } else {
    collections = await listCollections(SITE_ID);
  }

  const result = {
    fetchedAt: new Date().toISOString(),
    siteId: SITE_ID,
    collections: {},
  };

  for (const collection of collections) {
    console.log(`Fetching items for collection: ${collection.displayName || collection.id}`);
    const useLive = Boolean(SINGLE_COLLECTION_ID);
    const items = await listAllItems(collection.id, useLive);
    result.collections[collection.slug || collection.id] = {
      id: collection.id,
      displayName: collection.displayName,
      itemCount: items.length,
      items,
    };
  }

  const outputPath = path.resolve(process.cwd(), OUTPUT_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`Wrote CMS data to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
