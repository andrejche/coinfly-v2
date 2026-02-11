const IDS = [
  "bitcoin",
  "ethereum",
  "tether",
  "usd-coin",
  "solana",
  "litecoin",
  "binancecoin",
  "ripple",
  "dogecoin",
  "bitcoin-cash",
  "monero",
  "apecoin"
].join(",");

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets" +
  `?vs_currency=usd&ids=${encodeURIComponent(IDS)}` +
  "&order=market_cap_desc&per_page=250&page=1" +
  "&sparkline=true&price_change_percentage=24h";

function toSpark1D(spark7d) {
  if (!Array.isArray(spark7d) || spark7d.length < 2) return [];
  return spark7d.slice(-24);
}

async function fetchJSON(url, timeoutMs = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        accept: "application/json",
        "user-agent": "CoinFly/1.0 (vercel)"
      },
      redirect: "follow"
    });
    if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

module.exports = async function handler(req, res) {
  // Cache on Vercel for 15 minutes; allow stale while revalidating.
  // This gives you the "updates every 15 min" behavior without cron.
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");

  try {
    const markets = await fetchJSON(COINGECKO_URL);

    const data = {};
    for (const c of markets) {
      const spark7 = c?.sparkline_in_7d?.price || [];
      data[c.id] = {
        usd: c.current_price,
        usd_24h_change_pct: c.price_change_percentage_24h,
        sparkline_1d: toSpark1D(spark7),
        sparkline_7d: spark7,
        name: c.name,
        symbol: String(c.symbol || "").toUpperCase()
      };
    }

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      data
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
};
