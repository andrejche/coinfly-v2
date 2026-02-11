function updateTime() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const el = document.getElementById("current-time");
  if (el) el.textContent = time;
}
updateTime();
setInterval(updateTime, 1000);

const COINS = [
  { key: "bitcoin",      symbol: "BTC",  name: "Bitcoin",      icon: "crypto-icons/btc.svg" },
  { key: "ethereum",     symbol: "ETH",  name: "Ethereum",     icon: "crypto-icons/eth.svg" },
  { key: "tether",       symbol: "USDT", name: "Tether",       icon: "crypto-icons/usdt.svg" },
  { key: "usd-coin",     symbol: "USDC", name: "USD Coin",     icon: "crypto-icons/usdc.svg" },
  { key: "solana",       symbol: "SOL",  name: "Solana",       icon: "crypto-icons/sol.svg" },
  { key: "litecoin",     symbol: "LTC",  name: "Litecoin",     icon: "crypto-icons/ltc.svg" },
  { key: "binancecoin",  symbol: "BNB",  name: "BNB",          icon: "crypto-icons/bnb.svg" },
  { key: "ripple",       symbol: "XRP",  name: "XRP",          icon: "crypto-icons/xrp.svg" },
  { key: "dogecoin",     symbol: "DOGE", name: "Dogecoin",     icon: "crypto-icons/doge.svg" },
  { key: "bitcoin-cash", symbol: "BCH",  name: "Bitcoin Cash", icon: "crypto-icons/bch.svg" },
  { key: "monero",       symbol: "XMR",  name: "Monero",       icon: "crypto-icons/xmr.svg" },
  { key: "apecoin",      symbol: "APE",  name: "ApeCoin",      icon: "crypto-icons/ape.svg" }
];

const $ = (id) => document.getElementById(id);

const fmtUSD = (n) => {
  if (typeof n !== "number") return "—";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 0 : 4 });
};

const fmtPct = (n) => {
  if (typeof n !== "number") return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

const pctClass = (n) => {
  if (typeof n !== "number") return "text-slate-400";
  return n >= 0 ? "text-indigo-300" : "text-rose-300";
};

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function setHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }

async function loadPrices() {
  const res = await fetch("/api/prices", { cache: "no-store" });
  if (!res.ok) throw new Error(`/api/prices HTTP ${res.status}`);
  return res.json();
}

async function loadNewsJSON() {
  const res = await fetch("/api/news", { cache: "no-store" });
  if (!res.ok) throw new Error(`/api/news HTTP ${res.status}`);
  return res.json();
}

let AI_TYPER = null;

function typeInto(el, text, speed = 14) {
  if (!el) return;
  if (AI_TYPER) clearInterval(AI_TYPER);
  el.textContent = "";
  let i = 0;
  AI_TYPER = setInterval(() => {
    el.textContent += text[i] || "";
    i++;
    if (i >= text.length) { clearInterval(AI_TYPER); AI_TYPER = null; }
  }, speed);
}

function trendFromSpark(spark) {
  if (!Array.isArray(spark) || spark.length < 2) return { label: "Trend: —", cls: "text-slate-300" };
  const first = spark[0], last = spark[spark.length - 1];
  if (typeof first !== "number" || typeof last !== "number" || first === 0) return { label: "Trend: —", cls: "text-slate-300" };
  const pct = ((last - first) / first) * 100;
  if (Math.abs(pct) < 0.25) return { label: "Trend: steady", cls: "text-slate-200" };
  if (pct > 0) return { label: "Market confidence rising", cls: "text-indigo-200" };
  return { label: "Market confidence weakening", cls: "text-rose-200" };
}

function setAIOverviewFromBTC(btc24hPct, btcSpark = []) {
  const textEl = $("aiOverviewText");
  const tagEl = $("aiTag");
  const confEl = $("aiConfidence");
  const trendEl = $("aiTrend");
  if (!textEl || !tagEl || !confEl || !trendEl) return;

  if (typeof btc24hPct !== "number") {
    textEl.textContent = "Market overview is unavailable right now.";
    tagEl.textContent = "—";
    confEl.textContent = "AI confidence: —";
    trendEl.textContent = "Trend: —";
    return;
  }

  let tag = "Neutral";
  let tagCls = "border-white/10 bg-white/5 text-slate-200";
  if (btc24hPct <= -1) { tag = "Bearish"; tagCls = "border-rose-400/30 bg-rose-500/15 text-rose-200"; }
  else if (btc24hPct >= 1) { tag = "Bullish"; tagCls = "border-indigo-400/30 bg-indigo-500/15 text-indigo-200"; }

  const a = Math.abs(btc24hPct);
  const conf = a >= 4 ? "high" : a >= 2 ? "medium" : "low";

  const sentence =
    tag === "Bearish"
      ? "The market today is under selling pressure, with Bitcoin leading declines as short-term volatility stays elevated."
      : tag === "Bullish"
        ? "The market today is showing strength, with Bitcoin leading gains while momentum remains supportive."
        : "The market today looks mixed, with Bitcoin stabilizing and short-term volatility staying moderate.";

  typeInto(textEl, sentence, 14);

  tagEl.textContent = tag;
  tagEl.className = `text-xs px-3 py-1.5 rounded-full border font-semibold ${tagCls}`;

  confEl.textContent = `AI confidence: ${conf}`;
  confEl.className = "text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300";

  const t = trendFromSpark(btcSpark);
  trendEl.textContent = t.label;
  trendEl.className = `text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 ${t.cls}`;
}

function makeSparklineSVG(values, w, h) {
  if (!Array.isArray(values) || values.length < 2) {
    return {
      svg: `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 ${h/2} H ${w}" stroke="rgba(255,255,255,0.15)" stroke-width="2" fill="none" />
      </svg>`,
      points: [],
      min: 0,
      max: 0
    };
  }

  const maxPoints = 40;
  const step = Math.max(1, Math.floor(values.length / maxPoints));
  const sampled = [];
  for (let i = 0; i < values.length; i += step) sampled.push(values[i]);
  if (sampled[sampled.length - 1] !== values[values.length - 1]) sampled.push(values[values.length - 1]);

  let min = Math.min(...sampled);
  let max = Math.max(...sampled);
  if (min === max) { min -= 1; max += 1; }

  const padTop = 6;
  const xStep = w / (sampled.length - 1);

  const points = sampled.map((v, i) => {
    const x = i * xStep;
    const t = (v - min) / (max - min);
    const y = padTop + (1 - t) * (h - padTop);
    return { x, y, v };
  });

  const d = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const up = sampled[sampled.length - 1] >= sampled[0];
  const stroke = up ? "rgba(129,140,248,0.95)" : "rgba(251,113,133,0.95)";
  const fill = up ? "rgba(129,140,248,0.14)" : "rgba(251,113,133,0.14)";
  const area = `${d} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

  const svg = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;" xmlns="http://www.w3.org/2000/svg">
      <path d="${area}" fill="${fill}" />
      <path d="${d}" stroke="${stroke}" stroke-width="1.6" fill="none" stroke-linecap="butt" stroke-linejoin="miter" />
      <line id="hoverLine" x1="0" y1="0" x2="0" y2="${h}" stroke="rgba(255,255,255,0.18)" stroke-width="1" opacity="0"/>
      <circle id="hoverDot" cx="0" cy="0" r="5" fill="${stroke}" stroke="rgba(0,0,0,0.4)" stroke-width="2" opacity="0"/>
    </svg>
  `;

  return { svg, points, min, max };
}

const WL_KEY = "coinfly_watchlist";

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveWatchlist(keys) {
  localStorage.setItem(WL_KEY, JSON.stringify(keys));
}

function isInWatchlist(key) {
  return loadWatchlist().includes(key);
}

function ensureDefaultWatchlist() {
  const wl = loadWatchlist();
  if (wl.length === 0) saveWatchlist(["bitcoin", "ethereum", "tether"]);
}

let LAST_PRICE_MAP = null;
let LAST_UPDATED_AT = null;

function toggleWatchlist(key) {
  const wl = loadWatchlist();
  const i = wl.indexOf(key);
  if (i >= 0) wl.splice(i, 1);
  else wl.unshift(key);
  saveWatchlist(wl.slice(0, 30));
  rerenderAfterWatchlistChange();
}

function rerenderAfterWatchlistChange() {
  renderWatchlist();

  if (LAST_PRICE_MAP) {
    const q = $("search")?.value || "";
    const qm = $("searchMobile")?.value || q;

    const rowsEl = $("marketRows");
    if (rowsEl) rowsEl.innerHTML = buildMarketRows(LAST_PRICE_MAP, q);

    const cardsEl = $("marketCards");
    if (cardsEl) cardsEl.innerHTML = buildMarketCards(LAST_PRICE_MAP, qm);
  }
}

function renderWatchlist() {
  const wrap = $("watchlistWrap");
  if (!wrap) return;

  const wl = loadWatchlist();
  if (!wl.length) {
    wrap.innerHTML = `<div class="text-slate-400 text-sm">No coins starred yet. Click ☆ next to a coin.</div>`;
    return;
  }

  const rows = wl.map((key) => COINS.find(c => c.key === key)).filter(Boolean).slice(0, 12);

  wrap.innerHTML = `
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      ${rows.map((c) => {
        const d = LAST_PRICE_MAP?.[c.key] || {};
        const price = d.usd;
        const chg = d.usd_24h_change_pct;

        return `
          <div class="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <img src="${c.icon}" class="w-9 h-9" alt="${c.name}">
                <div class="min-w-0">
                  <div class="font-semibold truncate">${c.name}</div>
                  <div class="text-xs text-slate-400">${c.symbol}</div>
                </div>
              </div>

              <button type="button"
                class="starBtn text-lg leading-none text-yellow-300 hover:text-yellow-200"
                data-key="${c.key}"
                title="Remove from watchlist"
                aria-label="Remove from watchlist"
              >★</button>
            </div>

            <div class="mt-3 flex items-end justify-between">
              <div>
                <div class="text-xs text-slate-400">Price</div>
                <div class="text-xl font-black">${fmtUSD(price)}</div>
              </div>
              <div class="text-right">
                <div class="text-xs text-slate-400">24h</div>
                <div class="text-sm font-semibold ${pctClass(chg)}">${fmtPct(chg)}</div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function escapeHTML(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function buildNewsExplorer(items) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="text-slate-400 text-sm">No news right now.</div>`;
  }

  const safe = (s) => escapeHTML(s || "");
  const fmtTime = (iso) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString(); } catch { return ""; }
  };
  const pickImg = (n) => n?.imageLocal || n?.image || "";

  const featured = items[0];
  const secondary = items[1];
  const leftList = items.slice(0, 6);
  const rightList = items.slice(7, 13);

  const featuredImgUrl = pickImg(featured);
  const featuredImg = featuredImgUrl
    ? `<img src="${safe(featuredImgUrl)}" class="absolute inset-0 w-full h-full object-cover opacity-95" loading="lazy" />`
    : `<div class="absolute inset-0 bg-gradient-to-br from-white/10 to-white/0"></div>`;

  const secondaryImgUrl = pickImg(secondary);
  const secondaryImg = secondaryImgUrl
    ? `<img src="${safe(secondaryImgUrl)}" class="absolute inset-0 w-full h-full object-cover opacity-95" loading="lazy" />`
    : `<div class="absolute inset-0 bg-gradient-to-br from-white/10 to-white/0"></div>`;

  return `
    <div class="grid gap-6 lg:grid-cols-12 items-start">
      <div class="lg:col-span-3">
        <div class="text-sm font-extrabold">News Explorer</div>
        <div class="text-xs text-slate-400 mb-3">Crypto headlines</div>

        <div class="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          ${leftList.map((n) => `
            <a href="${safe(n.url)}" target="_blank" rel="noopener"
               class="block px-4 py-3 border-b border-white/10 hover:bg-white/10 transition">
              <div class="text-[11px] text-slate-400">${safe(fmtTime(n.publishedAt))}</div>
              <div class="mt-1 font-semibold leading-snug">${safe(n.title)}</div>
            </a>
          `).join("")}
        </div>
      </div>

      <div class="lg:col-span-6 grid gap-4">
        <a href="${safe(featured.url)}" target="_blank" rel="noopener"
           class="block rounded-3xl border border-white/10 bg-white/5 overflow-hidden hover:bg-white/10 transition">
          <div class="relative aspect-[16/9]">
            ${featuredImg}
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
            <div class="absolute bottom-0 p-5">
              <div class="text-xs text-slate-300">${safe(featured.source || "News")}</div>
              <div class="mt-2 text-2xl md:text-3xl font-black leading-tight">${safe(featured.title)}</div>
              <div class="mt-2 text-xs text-slate-300">${safe(fmtTime(featured.publishedAt))}</div>
            </div>
          </div>
        </a>

        ${secondary ? `
          <a href="${safe(secondary.url)}" target="_blank" rel="noopener"
             class="block rounded-3xl border border-white/10 bg-white/5 overflow-hidden hover:bg-white/10 transition">
            <div class="relative aspect-[16/9]">
              ${secondaryImg}
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
              <div class="absolute bottom-0 p-4">
                <div class="text-xs text-slate-300">${safe(secondary.source || "News")}</div>
                <div class="mt-1 text-xl font-extrabold leading-tight">${safe(secondary.title)}</div>
              </div>
            </div>
          </a>
        ` : ""}
      </div>

      <div class="lg:col-span-3">
        <div class="text-sm font-extrabold">Discover</div>
        <div class="text-xs text-slate-400 mb-3">Fresh headlines</div>

        <div class="grid gap-3">
          ${rightList.map((n) => {
            const imgUrl = pickImg(n);
            const img = imgUrl
              ? `<img src="${safe(imgUrl)}" class="w-full h-full object-cover opacity-95" loading="lazy" />`
              : `<div class="w-full h-full bg-gradient-to-br from-white/10 to-white/0"></div>`;

            return `
              <a href="${safe(n.url)}" target="_blank" rel="noopener"
                 class="rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden block">
                <div class="grid grid-cols-[88px_1fr] gap-3 p-3">
                  <div class="w-[88px] h-[72px] rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                    ${img}
                  </div>
                  <div class="min-w-0">
                    <div class="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                      <span class="truncate">${safe(n.source || "News")}</span>
                      <span class="shrink-0">${safe(fmtTime(n.publishedAt))}</span>
                    </div>
                    <div class="mt-1 font-semibold leading-snug line-clamp-2">${safe(n.title)}</div>
                  </div>
                </div>
              </a>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderMoreNews(items) {
  const wrap = $("moreNewsWrap");
  if (!wrap) return;

  const safe = (s) => escapeHTML(s || "");
  const pickImg = (n) => n?.imageLocal || n?.image || "";

  const extra = (Array.isArray(items) ? items : []).slice(13, 16);
  if (!extra.length) {
    wrap.innerHTML = `<div class="text-slate-400 text-sm">No extra headlines.</div>`;
    return;
  }

  wrap.innerHTML = extra.map((n) => {
    const imgUrl = pickImg(n);
    return `
      <a href="${safe(n.url)}" target="_blank" rel="noopener"
         class="rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden block">
        <div class="relative aspect-[16/9] bg-black/20">
          ${imgUrl
            ? `<img src="${safe(imgUrl)}" class="absolute inset-0 w-full h-full object-cover opacity-95" loading="lazy" />`
            : `<div class="absolute inset-0 bg-gradient-to-br from-white/10 to-white/0"></div>`
          }
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
          <div class="absolute bottom-0 p-4">
            <div class="text-xs text-slate-300">${safe(n.source || "News")}</div>
            <div class="mt-1 font-extrabold leading-snug">${safe(n.title)}</div>
          </div>
        </div>
      </a>
    `;
  }).join("");
}

async function loadNews() {
  const section = $("newsSection");
  const wrap = $("newsWrap");
  const status = $("newsStatus");
  if (!section || !wrap || !status) return;

  section.classList.remove("hidden");
  status.textContent = "Loading news…";

  try {
    const payload = await loadNewsJSON();
    const items = payload?.items || [];
    wrap.innerHTML = buildNewsExplorer(items);
    status.textContent = "";
    renderMoreNews(items);
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="text-rose-300 text-sm">Failed to load news.</div>`;
    status.textContent = "News unavailable.";
    renderMoreNews([]);
  }
}

function ytIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
    if (u.searchParams.get("v")) return u.searchParams.get("v");
  } catch {}
  return null;
}

function renderLearnCrypto() {
  const el = $("learnCrypto");
  if (!el) return;

  const urls = [
    "https://www.youtube.com/watch?v=aaMFEk5Zuq4",
    "https://www.youtube.com/watch?v=8CF-fxIA4a8",
    "https://www.youtube.com/watch?v=IZWrAbFveSA"
  ];

  const vids = urls.map((u) => ({ url: u, id: ytIdFromUrl(u) })).filter(v => v.id);

  el.innerHTML = vids.map((v) => `
    <div class="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
      <div class="aspect-video bg-black/30">
        <iframe
          class="w-full h-full"
          src="https://www.youtube-nocookie.com/embed/${v.id}"
          title="YouTube video"
          frameborder="0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
      <div class="p-4">
        <div class="text-xs text-slate-400">Beginner tutorial</div>
        <a href="${v.url}" target="_blank" rel="noopener"
          class="mt-1 inline-block text-sm font-semibold text-indigo-200 hover:underline">
          Watch on YouTube →
        </a>
      </div>
    </div>
  `).join("");
}

function buildTickerItems(priceMap) {
  const items = COINS.map((c) => {
    const d = priceMap[c.key];
    const price = d?.usd;
    const chg = d?.usd_24h_change_pct;
    return `
      <div class="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
        <img src="${c.icon}" alt="${c.name}" class="w-5 h-5" />
        <span class="text-sm font-semibold">${c.symbol}</span>
        <span class="text-sm text-slate-200">${fmtUSD(price)}</span>
        <span class="text-xs font-semibold ${pctClass(chg)}">${fmtPct(chg)}</span>
      </div>
    `;
  }).join("");
  return items + items;
}

function buildMarketRows(priceMap, filterText = "") {
  const q = filterText.trim().toLowerCase();
  const filtered = COINS.filter((c) => !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  if (!filtered.length) return `<div class="px-4 py-8 text-center text-slate-400">No matches.</div>`;

  return filtered.map((c, idx) => {
    const d = priceMap[c.key];
    const price = d?.usd;
    const chg = d?.usd_24h_change_pct;
    const spark = d?.sparkline_1d || d?.sparkline_7d || [];
    const mini = makeSparklineSVG(spark, 90, 26).svg;

    const starred = isInWatchlist(c.key);
    const star = starred ? "★" : "☆";
    const starCls = starred ? "text-yellow-300" : "text-slate-400";

    return `
      <div class="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/5 transition">
        <div class="col-span-1 text-sm text-slate-400">${idx + 1}</div>

        <div class="col-span-4 flex items-center gap-3">
          <img src="${c.icon}" alt="${c.name}" class="w-8 h-8" />
          <div>
            <div class="font-semibold">${c.name}</div>
            <div class="text-xs text-slate-400">${c.symbol}</div>
          </div>
        </div>

        <div class="col-span-3 text-right font-extrabold">${fmtUSD(price)}</div>
        <div class="col-span-2 text-right text-sm font-semibold ${pctClass(chg)}">${fmtPct(chg)}</div>
        <div class="col-span-1 flex justify-end pl-4"><div class="opacity-90">${mini}</div></div>

        <div class="col-span-1 text-right flex items-center justify-end gap-3">
          <button type="button"
            class="starBtn text-lg leading-none ${starCls} hover:text-yellow-200"
            data-key="${c.key}"
            title="Watchlist"
            aria-label="Watchlist"
          >${star}</button>

          <button type="button"
            class="viewBtn text-sm font-semibold text-indigo-200 hover:text-indigo-100 hover:underline"
            data-key="${c.key}"
          >View</button>
        </div>
      </div>
    `;
  }).join("");
}

function buildMarketCards(priceMap, filterText = "") {
  const q = filterText.trim().toLowerCase();
  const filtered = COINS.filter((c) => !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  if (!filtered.length) return `<div class="px-2 py-6 text-center text-slate-400">No matches.</div>`;

  return filtered.map((c, idx) => {
    const d = priceMap[c.key];
    const price = d?.usd;
    const chg = d?.usd_24h_change_pct;
    const spark = d?.sparkline_1d || d?.sparkline_7d || [];
    const mini = makeSparklineSVG(spark, 260, 70).svg;

    const starred = isInWatchlist(c.key);
    const star = starred ? "★" : "☆";
    const starCls = starred ? "text-yellow-300" : "text-slate-400";

    return `
      <div class="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${c.icon}" class="w-10 h-10 shrink-0" alt="${c.name}">
            <div class="min-w-0">
              <div class="font-semibold truncate">${idx + 1}. ${c.name}</div>
              <div class="text-xs text-slate-400">${c.symbol}</div>
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <button type="button"
              class="starBtn text-lg leading-none ${starCls} hover:text-yellow-200"
              data-key="${c.key}"
              title="Watchlist"
              aria-label="Watchlist"
            >${star}</button>

            <button type="button"
              class="viewBtn text-sm font-semibold text-indigo-200 hover:text-indigo-100 hover:underline"
              data-key="${c.key}"
            >View</button>
          </div>
        </div>

        <div class="mt-3 flex items-end justify-between">
          <div>
            <div class="text-xs text-slate-400">Price</div>
            <div class="text-xl font-black">${fmtUSD(price)}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400">24h</div>
            <div class="text-sm font-semibold ${pctClass(chg)}">${fmtPct(chg)}</div>
          </div>
        </div>

        <div class="mt-3 opacity-95">${mini}</div>
      </div>
    `;
  }).join("");
}

function openModal(coin, priceMap, updatedAt) {
  const d = priceMap[coin.key] || {};
  const price = d.usd;
  const chg = d.usd_24h_change_pct;
  const spark = d?.sparkline_1d || d?.sparkline_7d || [];

  const modal = $("coinModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  const icon = $("modalIcon");
  const name = $("modalName");
  const symbol = $("modalSymbol");
  const mPrice = $("modalPrice");
  const mChange = $("modalChange");
  const mUpdated = $("modalUpdated");

  if (icon) icon.src = coin.icon;
  if (name) name.textContent = coin.name;
  if (symbol) symbol.textContent = coin.symbol;

  if (mPrice) mPrice.textContent = fmtUSD(price);
  if (mChange) {
    mChange.textContent = fmtPct(chg);
    mChange.className = `text-2xl font-black mt-1 ${pctClass(chg)}`;
  }

  if (mUpdated) {
    const dt = updatedAt ? new Date(updatedAt) : null;
    mUpdated.textContent = dt ? "" : "";
  }

  const chartBox = $("modalChart");
  const tip = $("chartTip");
  if (!chartBox) return;

  chartBox.classList.add("relative");
  chartBox.style.touchAction = "none";
  chartBox.querySelectorAll("svg").forEach((n) => n.remove());

  const out = makeSparklineSVG(spark, 900, 260);
  chartBox.insertAdjacentHTML("afterbegin", out.svg);

  const points = out.points || [];
  const hoverDot = chartBox.querySelector("#hoverDot");
  const hoverLine = chartBox.querySelector("#hoverLine");

  function hideHover() {
    if (hoverDot) hoverDot.style.opacity = 0;
    if (hoverLine) hoverLine.style.opacity = 0;
    if (tip) tip.classList.add("hidden");
  }

  function showHoverByClientX(clientX) {
    if (!points.length) return;
    const rect = chartBox.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = x / rect.width;
    const i = Math.round(t * (points.length - 1));
    const idx = Math.max(0, Math.min(points.length - 1, i));
    const p = points[idx];
    if (!p) return;

    if (hoverDot) {
      hoverDot.setAttribute("cx", p.x);
      hoverDot.setAttribute("cy", p.y);
      hoverDot.style.opacity = 1;
    }
    if (hoverLine) {
      hoverLine.setAttribute("x1", p.x);
      hoverLine.setAttribute("x2", p.x);
      hoverLine.style.opacity = 1;
    }

    if (tip) {
      tip.textContent = fmtUSD(p.v);
      tip.classList.remove("hidden");
      tip.style.left = "auto";
      tip.style.right = "12px";
      tip.style.top = "12px";
    }
  }

  chartBox.onmousemove = (e) => showHoverByClientX(e.clientX);
  chartBox.onmouseleave = hideHover;

  const copyBtn = $("modalCopy");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(`${coin.symbol} ${fmtUSD(price)} (${fmtPct(chg)} 24h)`);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy price"), 900);
      } catch {}
    };
  }

  const okBtn = $("modalOk");
  if (okBtn) okBtn.onclick = closeModal;
}

function closeModal() {
  const modal = $("coinModal");
  if (modal) modal.classList.add("hidden");
}

async function init() {
  setText("year", new Date().getFullYear());
  ensureDefaultWatchlist();

  document.addEventListener("click", (e) => {
    const s = e.target.closest(".starBtn");
    if (!s) return;
    e.preventDefault();
    e.stopPropagation();
    const key = s.getAttribute("data-key");
    if (!key) return;
    toggleWatchlist(key);
  });

  const toggleBtn = $("searchToggle");
  const mobileWrap = $("mobileSearchWrap");
  if (toggleBtn && mobileWrap) {
    toggleBtn.addEventListener("click", () => {
      mobileWrap.classList.toggle("hidden");
      const m = $("searchMobile");
      if (!mobileWrap.classList.contains("hidden") && m) m.focus();
    });
  }

  await loadNews();

  const refreshBtn = $("newsRefresh");
  if (refreshBtn) refreshBtn.onclick = () => loadNews();

  renderLearnCrypto();

  try {
    const payload = await loadPrices();
    const updatedAt = payload.updatedAt;
    const priceMap = payload.data || {};

    LAST_PRICE_MAP = priceMap;
    LAST_UPDATED_AT = updatedAt;

    const date = updatedAt ? new Date(updatedAt) : null;
    setText("lastUpdated", date ? `Updated: ${date.toLocaleString()}` : "Updated: —");

    const btc = priceMap["bitcoin"];
    const eth = priceMap["ethereum"];

    if (btc) {
      setText("btc-price", fmtUSD(btc.usd));
      setHTML("btc-change", `24h: <span class="${pctClass(btc.usd_24h_change_pct)} font-semibold">${fmtPct(btc.usd_24h_change_pct)}</span>`);
      setAIOverviewFromBTC(btc.usd_24h_change_pct, btc.sparkline_1d || btc.sparkline_7d || []);
    } else {
      setAIOverviewFromBTC(null, []);
    }

    if (eth) {
      setText("eth-price", fmtUSD(eth.usd));
      setHTML("eth-change", `24h: <span class="${pctClass(eth.usd_24h_change_pct)} font-semibold">${fmtPct(eth.usd_24h_change_pct)}</span>`);
    }

    const ticker = $("tickerTrack");
    if (ticker) ticker.innerHTML = buildTickerItems(priceMap);

    const rowsEl = $("marketRows");
    if (rowsEl) rowsEl.innerHTML = buildMarketRows(priceMap, "");

    const cardsEl = $("marketCards");
    if (cardsEl) cardsEl.innerHTML = buildMarketCards(priceMap, "");

    function applySearch(val) {
      if (!LAST_PRICE_MAP) return;
      const rows = $("marketRows");
      if (rows) rows.innerHTML = buildMarketRows(LAST_PRICE_MAP, val);
      const ce = $("marketCards");
      if (ce) ce.innerHTML = buildMarketCards(LAST_PRICE_MAP, val);
    }

    const search = $("search");
    if (search) search.addEventListener("input", (e) => applySearch(e.target.value || ""));

    const searchMobile = $("searchMobile");
    if (searchMobile) searchMobile.addEventListener("input", (e) => applySearch(e.target.value || ""));

    if (rowsEl) {
      rowsEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".viewBtn");
        if (!btn) return;
        const key = btn.getAttribute("data-key");
        const coin = COINS.find(c => c.key === key);
        if (!coin) return;
        openModal(coin, LAST_PRICE_MAP || {}, LAST_UPDATED_AT);
      });
    }

    if (cardsEl) {
      cardsEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".viewBtn");
        if (!btn) return;
        const key = btn.getAttribute("data-key");
        const coin = COINS.find(c => c.key === key);
        if (!coin) return;
        openModal(coin, LAST_PRICE_MAP || {}, LAST_UPDATED_AT);
      });
    }

    const closeBtn = $("coinModalClose");
    if (closeBtn) closeBtn.onclick = closeModal;

    const overlay = $("coinModalOverlay");
    if (overlay) overlay.onclick = closeModal;

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    renderWatchlist();
  } catch (err) {
    console.error(err);
    setText("lastUpdated", "Updated: failed to load /api/prices");
    const rowsEl = $("marketRows");
    if (rowsEl) rowsEl.innerHTML = `<div class="px-4 py-8 text-center text-rose-300">Failed to load prices.</div>`;
    renderWatchlist();
  }
}

init();