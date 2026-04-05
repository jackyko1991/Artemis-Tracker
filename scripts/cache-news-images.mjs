import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MISSION_DATA } from "../src/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const newsDir = path.join(repoRoot, "assets", "news");
const manifestPath = path.join(newsDir, "manifest.json");

const PAGE_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; ArtemisTrackerCache/1.0)",
  "accept": "text/html,application/xhtml+xml",
};

const IMAGE_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; ArtemisTrackerCache/1.0)",
  "accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normaliseImageUrl(rawUrl, pageUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl.replace(/&amp;/g, "&"), pageUrl).href;
  } catch {
    return null;
  }
}

function extractImageCandidates(html, pageUrl) {
  const candidates = [];
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(html))) {
      const url = normaliseImageUrl(match[1], pageUrl);
      if (url) candidates.push(url);
    }
  });

  return uniq(candidates).sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
}

function scoreImageCandidate(url) {
  let score = 0;
  if (url.includes("assets.science.nasa.gov")) score += 100;
  if (url.includes("dynamicimage")) score += 60;
  if (url.includes("images-assets.nasa.gov")) score -= 100;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) score += 15;
  if (/logo|icon|favicon/i.test(url)) score -= 50;
  return score;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: PAGE_HEADERS, redirect: "follow" });
  if (!response.ok) throw new Error(`page fetch failed: ${response.status} ${url}`);
  return response.text();
}

function decodeCdata(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#038;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function fetchFeedItems() {
  const xml = await fetchText("https://www.nasa.gov/missions/artemis/feed/");
  const items = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const rawItem of itemMatches) {
    const title = rawItem.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
    const link = rawItem.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "";
    const contentEncoded = rawItem.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i)?.[1] || "";
    items.push({
      title: decodeCdata(title),
      link,
      contentEncoded: decodeCdata(contentEncoded),
    });
  }
  return items;
}

async function downloadImage(url) {
  const response = await fetch(url, { headers: IMAGE_HEADERS, redirect: "follow" });
  if (!response.ok) throw new Error(`image download failed: ${response.status} ${url}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`not an image response: ${contentType || "unknown"} ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, contentType };
}

function extensionFromContentType(contentType, url) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  const cleanPath = new URL(url).pathname;
  const ext = path.extname(cleanPath);
  return ext || ".jpg";
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function cacheCheckpointImage(checkpoint, feedItem = null) {
  const feedCandidates = feedItem?.contentEncoded
    ? extractImageCandidates(feedItem.contentEncoded, feedItem.link || checkpoint.sourceUrl)
    : [];

  let pageCandidates = [];
  if (feedCandidates.length === 0) {
    const html = await fetchText(checkpoint.sourceUrl);
    pageCandidates = extractImageCandidates(html, checkpoint.sourceUrl);
  }

  const candidates = uniq([...feedCandidates, ...pageCandidates]);

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const { bytes, contentType } = await downloadImage(candidate);
      const ext = extensionFromContentType(contentType, candidate);
      const fileName = `${checkpoint.id}${ext}`;
      const filePath = path.join(newsDir, fileName);
      await fs.writeFile(filePath, bytes);
      return {
        checkpointId: checkpoint.id,
        localPath: `./assets/news/${fileName}`,
        remoteUrl: candidate,
        sourceUrl: checkpoint.sourceUrl,
        contentType,
        cachedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`no usable image candidates found for ${checkpoint.id}`);
}

async function main() {
  await ensureDir(newsDir);
  const manifest = {};
  const feedItems = await fetchFeedItems();

  for (const [index, checkpoint] of DEFAULT_MISSION_DATA.checkpoints.entries()) {
    try {
      const entry = await cacheCheckpointImage(checkpoint, feedItems[index] || null);
      manifest[checkpoint.id] = entry;
      console.log(`cached ${checkpoint.id}: ${entry.localPath}`);
    } catch (error) {
      console.warn(`skipped ${checkpoint.id}: ${error.message}`);
    }
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
