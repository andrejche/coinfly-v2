const crypto = require("crypto");
const { put } = require("@vercel/blob");

const COINGECKO =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin,solana,litecoin,binancecoin,ripple,dogecoin,bitcoin-cash,monero,apecoin&vs_currencies=usd&include_24hr_change=true&include_sparkline=true";

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function extFromContentType(ct = "") {
  ct = ct.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

function safeText(s) {
  return typeof s === "string" ? s : "";
}

async function fetchJSON(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function downloadToBlob(url) {
  if (!url) return null;

  const hash = sha1(url).slice(0, 20);

  let res;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    return null;
  }
  if (!res || !res.ok) return null;

  const ct = res.headers.get("content-type") || "";
  const ext = extFromContentType(ct);

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf || buf.length < 2000) return null;

  const pathname = `news-img/${hash}.${ext}`;

  const out = await put(pathname, buf, {
    access: "public",
    addRandomSuffix: false,
    contentType: ct || `image/${ext}`,
    cacheControlMaxAge: 60 * 60 * 24
  });

  return out.url;
}

async function fetchNewsItems() {
  const RSS =
    "https://news.google.com/rss/search?q=cryptocurrency%20OR%20bitcoin%20OR%20ethereum&hl=en-US&gl=US&ceid=US:en";

  const r = await fetch(RSS, { redirect: "follow" });
  if (!r.ok) throw new Error(`RSS HTTP ${r.status}`);
  const xml = await r.text();

  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items = [];

  const extract = (b, tag) => {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = b.match(re);
    return safeText(m && m[1]).replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  };
  const attr = (b, tag, a) => {
    const re = new RegExp(`<${tag}[^>]*\\s${a}="([^"]+)"[^>]*\\/?>`, "i");
    const m = b.match(re);
    return safeText(m && m[1]).trim();
  };
  const pick = (...vals) => vals.find((v) => typeof v === "string" && v.trim()) || "";

  for (const b of blocks) {
    const title = extract(b, "title");
    const link = extract(b, "link");
    const pubDate = extract(b, "pubDate");
    const source = extract(b, "source");

    const img = pick(
      attr(b, "media:content", "url"),
      attr(b, "media:thumbnail", "url"),
      attr(b, "enclosure", "url")
    );

    if (!title || !link) continue;

    let publishedAt = null;
    if (pubDate) {
      const dt = new Date(pubDate);
      if (!Number.isNaN(dt.getTime())) publishedAt = dt.toISOString();
    }

    items.push({
      title,
      url: link,
      source: source || "News",
      publishedAt,
      image: img || null,
      imageLocal: null
    });
  }

  return items.slice(0, 24);
}

module.exports = async function handler(req, res) {
  try {
    const prices = await fetchJSON(COINGECKO);
    const newsItems = await fetchNewsItems();

    for (const it of newsItems) {
      if (!it.image) continue;
      it.imageLocal = await downloadToBlob(it.image);
    }

    const now = new Date().toISOString();

    const pricesPayload = {
      updatedAt: now,
      data: Object.fromEntries(
        Object.entries(prices).map(([k, v]) => [
          k,
          {
            usd: v.usd,
            usd_24h_change_pct: v.usd_24h_change,
            sparkline_7d: (v.usd_sparkline_7d && v.usd_sparkline_7d) || []
          }
        ])
      )
    };

    const newsPayload = { updatedAt: now, items: newsItems };

    await put("cache/prices.json", JSON.stringify(pricesPayload, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60
    });

    await put("cache/news.json", JSON.stringify(newsPayload, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60
    });

    res.status(200).json({ ok: true, updatedAt: now, prices: true, news: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
