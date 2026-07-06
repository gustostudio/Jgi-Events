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

  return allItems.filter((item) => !item.isArchived && !item.isDraft);
}

async function getCollectionSchema(collectionId) {
  return webflowGet(`${API_BASE}/collections/${collectionId}`);
}

// Reference/MultiReference fields store item IDs; Option fields store option IDs.
// Both need a lookup to resolve the human-readable name.
function findResolvableFields(schema) {
  return (schema.fields || [])
    .map((field) => {
      if (field.type === "Reference" || field.type === "MultiReference") {
        const refCollectionId = field.validations && field.validations.collectionId;
        if (!refCollectionId) return null;
        return { slug: field.slug, kind: "reference", multi: field.type === "MultiReference", refCollectionId };
      }
      if (field.type === "Option") {
        const options = (field.validations && field.validations.options) || [];
        const optionMap = {};
        for (const option of options) optionMap[option.id] = option.name;
        return { slug: field.slug, kind: "option", optionMap };
      }
      return null;
    })
    .filter(Boolean);
}

async function getReferenceLookup(collectionId, cache) {
  if (cache.has(collectionId)) return cache.get(collectionId);
  const items = await listAllItems(collectionId);
  const map = {};
  for (const item of items) {
    map[item.id] = {
      name: item.fieldData && item.fieldData.name,
      link: item.fieldData && item.fieldData.link,
    };
  }
  cache.set(collectionId, map);
  return map;
}

function enrichItemsWithNames(items, resolvableFields, referenceLookups) {
  for (const item of items) {
    const fieldData = item.fieldData;
    for (const field of resolvableFields) {
      const value = fieldData[field.slug];
      if (value == null) continue;

      if (field.kind === "option") {
        fieldData[`${field.slug}-name`] = field.optionMap[value] ?? null;
      } else {
        const lookup = referenceLookups[field.refCollectionId] || {};
        fieldData[`${field.slug}-name`] = field.multi
          ? value.map((id) => lookup[id]?.name ?? null)
          : lookup[value]?.name ?? null;
        fieldData[`${field.slug}-link`] = field.multi
          ? value.map((id) => lookup[id]?.link ?? null)
          : lookup[value]?.link ?? null;
      }
    }
  }
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

  const referenceLookupCache = new Map();

  for (const collection of collections) {
    console.log(`Fetching items for collection: ${collection.displayName || collection.id}`);
    const useLive = Boolean(SINGLE_COLLECTION_ID);
    const items = await listAllItems(collection.id, useLive);

    const schema = await getCollectionSchema(collection.id);
    const resolvableFields = findResolvableFields(schema);

    const referenceLookups = {};
    for (const field of resolvableFields) {
      if (field.kind !== "reference") continue;
      console.log(`  Resolving names for reference field "${field.slug}" -> collection ${field.refCollectionId}`);
      referenceLookups[field.refCollectionId] = await getReferenceLookup(field.refCollectionId, referenceLookupCache);
    }

    enrichItemsWithNames(items, resolvableFields, referenceLookups);

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
