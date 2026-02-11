// api/news-img.js (Vercel Serverless - production image proxy)

const ALLOWED_HOSTS = new Set([
  "www.cryptocompare.com",
  "images.cryptocompare.com",
  "min-api.cryptocompare.com",
]);

function pickCT(url = "") {
  const u = url.toLowerCase();
  if (u.includes(".png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  if (u.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

module.exports = async function handler(req, res) {
  const u = req.query?.u;
  if (!u || typeof u !== "string") {
    res.status(400).send("Missing ?u=");
    return;
  }

  let target;
  try {
    target = new URL(u);
  } catch {
    res.status(400).send("Bad url");
    return;
  }

  if (!ALLOWED_HOSTS.has(target.host)) {
    res.status(403).send("Host not allowed");
    return;
  }

  try {
    const r = await fetch(target.toString(), {
      redirect: "follow",
      headers: {
        "user-agent": "CoinFly/1.0 (vercel)",
        accept: "image/*,*/*;q=0.8",
        // Some hosts require referer:
        referer: "https://www.cryptocompare.com/",
      },
    });

    if (!r.ok) {
      res.status(404).send("Image not found");
      return;
    }

    // Cache images longer
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");

    const ct = r.headers.get("content-type") || pickCT(target.pathname);
    res.setHeader("Content-Type", ct);

    const buf = Buffer.from(await r.arrayBuffer());
    res.status(200).send(buf);
  } catch {
    res.status(502).send("Proxy failed");
  }
};
