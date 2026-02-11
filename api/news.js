// fetchNews.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Node <18 fallback
let _fetch = global.fetch;
if (!_fetch) _fetch = (...args) => import("node-fetch").then(m => m.default(...args));

const OUT_FILE = path.join(__dirname, "public", "news.json");
const IMG_DIR = path.join(__dirname, "public", "news-img");

// CryptoCompare News API (no key needed for basic use)
const NEWS_URL = "https://min-api.cryptocompare.com/data/v2/news/?lang=EN";
const IMG_HOST = "https://www.cryptocompare.com";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extFromContentType(ct = "") {
  ct = ct.toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  return ".jpg";
}

function extFromUrl(url = "") {
  const u = url.toLowerCase();
  if (u.includes(".png")) return ".png";
  if (u.includes(".webp")) return ".webp";
  if (u.includes(".gif")) return ".gif";
  if (u.includes(".jpeg")) return ".jpg";
  if (u.includes(".jpg")) return ".jpg";
  return "";
}

function absImgUrl(u) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return IMG_HOST + u; // CryptoCompare returns /media/...
  return u;
}

async function downloadImageToPublic(url) {
  url = absImgUrl(url);
  if (!url) return null;

  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
  let ext = extFromUrl(url);

  // reuse if already downloaded
  for (const e of [ext || ".jpg", ".jpg", ".png", ".webp", ".gif"]) {
    const fp = path.join(IMG_DIR, `${hash}${e}`);
    if (fs.existsSync(fp)) return `/news-img/${hash}${e}`;
  }

  const res = await _fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "CoinFly/1.0 (+local cache)",
      "Accept": "image/*,*/*;q=0.8",
    }
  }).catch(() => null);

  if (!res || !res.ok) return null;

  const ct = res.headers.get("content-type") || "";
  if (!ext) ext = extFromContentType(ct);

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf || buf.length < 1500) return null; // skip tiny junk
  if (buf.length > 2_000_000) return null;    // skip huge files

  const outPath = path.join(IMG_DIR, `${hash}${ext}`);
  fs.writeFileSync(outPath, buf);
  return `/news-img/${hash}${ext}`;
}

async function fetchAndBuildNews() {
  ensureDir(path.dirname(OUT_FILE));
  ensureDir(IMG_DIR);

  const res = await _fetch(NEWS_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`CryptoCompare HTTP ${res.status}`);

  const json = await res.json();
  const data = Array.isArray(json?.Data) ? json.Data : [];

  // normalize
  const items = data.slice(0, 24).map((n) => {
    const image = absImgUrl(n.imageurl || "");
    return {
      title: n.title || "Untitled",
      url: n.url || "#",
      source: n.source_info?.name || n.source || "News",
      publishedAt: n.published_on ? new Date(n.published_on * 1000).toISOString() : null,
      image: image || null,      // remote
      imageLocal: null           // will become /news-img/xxxx.jpg
    };
  });

  // download images (best effort)
  for (const it of items) {
    if (!it.image) continue;
    try {
      it.imageLocal = await downloadImageToPublic(it.image);
    } catch {
      it.imageLocal = null;
    }
  }

  const payload = { updatedAt: new Date().toISOString(), items };
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`✅ news.json updated (${items.length} items)`);
}

async function runOnceAndSchedule() {
  try {
    await fetchAndBuildNews();
  } catch (e) {
    console.error("❌ fetchNews failed:", e.message || e);
  }

  setInterval(async () => {
    try {
      await fetchAndBuildNews();
    } catch (e) {
      console.error("❌ fetchNews failed:", e.message || e);
    }
  }, 15 * 60 * 1000);
}

runOnceAndSchedule();