/* =========================================================================
   LAUNCHWINDOW · Cape Canaveral launch schedule
   - Tries the live Launch Library 2 API (Cape Canaveral + Kennedy pads)
   - Falls back to the curated manifest in data.js when offline / rate-limited
   ========================================================================= */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------- 0. THE TRIP ---------- */
  // Harry & Jimmy are loitering on the Space Coast for these dates (UTC-ish).
  const TRIP_START = Date.parse("2026-07-05T00:00:00Z");
  const TRIP_END = Date.parse("2026-07-10T23:59:59Z");
  const inTrip = (l) => {
    const t = Date.parse(l.net);
    return !isNaN(t) && t >= TRIP_START && t <= TRIP_END;
  };

  /* ---------- 1. STARFIELD ---------- */
  function starfield() {
    const c = $("starfield");
    const ctx = c.getContext("2d");
    let stars = [];
    let w, h;

    function resize() {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
      const count = Math.min(220, Math.floor((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2,      // depth → size + speed
        tw: Math.random() * Math.PI * 2,    // twinkle phase
      }));
    }

    function tick(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.z * 0.18;                  // gentle drift downward
        if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
        const r = s.z * 1.4;
        const a = 0.45 + 0.55 * Math.sin(t * 0.001 + s.tw) * s.z;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${200 + s.z * 40}, ${220}, 255, ${a})`;
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(tick);
  }

  /* ---------- 1b. FLYING ROCKETS ---------- */
  function rockets() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = $("rocketLayer");
    const EMOJI = ["🚀", "🛰️", "🚀", "🛸", "🚀"];

    function launchOne() {
      const el = document.createElement("div");
      el.className = "flyrocket";
      el.textContent = EMOJI[(Math.random() * EMOJI.length) | 0];
      layer.appendChild(el);

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // fly from lower-left-ish up to upper-right-ish, with a random tilt
      const startX = -80;
      const startY = vh * (0.4 + Math.random() * 0.55);
      const endX = vw + 80;
      const endY = vh * (0.05 + Math.random() * 0.35);
      const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;
      const dur = 7000 + Math.random() * 9000;
      const size = 22 + Math.random() * 26;
      el.style.fontSize = size + "px";

      const anim = el.animate(
        [
          { transform: `translate(${startX}px, ${startY}px) rotate(${angle + 45}deg)`, opacity: 0 },
          { offset: 0.08, opacity: 1 },
          { offset: 0.92, opacity: 1 },
          { transform: `translate(${endX}px, ${endY}px) rotate(${angle + 45}deg)`, opacity: 0 },
        ],
        { duration: dur, easing: "linear" }
      );
      anim.onfinish = () => { el.remove(); scheduleNext(); };
    }

    function scheduleNext() {
      setTimeout(launchOne, 1500 + Math.random() * 4000);
    }

    // a couple in flight at once
    launchOne();
    setTimeout(launchOne, 2500);
    setTimeout(launchOne, 5000);
  }

  /* ---------- 2. CLOCK ---------- */
  function clock() {
    const el = $("clock");
    const fmt = (n) => String(n).padStart(2, "0");
    function update() {
      const d = new Date();
      el.textContent = `${fmt(d.getUTCHours())}:${fmt(d.getUTCMinutes())}:${fmt(d.getUTCSeconds())} UTC`;
    }
    update();
    setInterval(update, 1000);
  }

  /* ---------- 3. DATA ---------- */
  // Cape Canaveral SFS (12) + Kennedy Space Center (27) pad-location ids in LL2
  const LL2 =
    "https://ll.thespacedevs.com/2.2.0/launch/upcoming/" +
    "?location__ids=27,12&limit=12&mode=list&hide_recent_previous=true";

  const STATUS_MAP = {
    Go: "GO", "Go for Launch": "GO", Success: "GO",
    TBD: "TBD", "To Be Determined": "TBD",
    TBC: "NET", "To Be Confirmed": "NET",
    Hold: "HOLD", "In Flight": "GO", Partial: "TBD",
  };

  function normalizeLive(results) {
    return results.map((r) => {
      const rocket = r.rocket?.configuration?.name || r.name?.split("|")[0]?.trim() || "Rocket";
      // list mode returns lsp_name / pad / location as flat strings; detail mode nests them.
      const provider = r.launch_service_provider?.name || r.lsp_name || "—";
      const padName = (typeof r.pad === "string" ? r.pad : r.pad?.name) || "";
      const site = (typeof r.location === "string" ? r.location : r.pad?.location?.name) || "Cape Canaveral";
      const statusAbbr = r.status?.abbrev || r.status?.name || "TBD";
      return {
        name: (r.mission?.name || r.name?.split("|").pop() || r.name || "Mission").trim(),
        provider,
        rocket,
        pad: padName.replace(/^Space Launch Complex\s*/i, "SLC-").replace(/^Launch Complex\s*/i, "LC-") || padName,
        site: site.includes("Cape") ? "Cape Canaveral SFS" : "Kennedy Space Center",
        net: r.net,
        window: r.window_start && r.window_end && r.window_start !== r.window_end
          ? "Open window" : "Instantaneous",
        status: STATUS_MAP[statusAbbr] || STATUS_MAP[r.status?.name] || "TBD",
        mission: r.mission?.description || "Mission details to be released closer to launch.",
        orbit: r.mission?.orbit?.name || "—",
        payloadKg: null,
        booster: r.rocket?.configuration?.full_name || rocket,
      };
    });
  }

  async function loadData() {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(LL2, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (!json.results || !json.results.length) throw new Error("empty");
      return { launches: normalizeLive(json.results), live: true };
    } catch (e) {
      return { launches: window.FALLBACK_LAUNCHES.slice(), live: false };
    }
  }

  /* ---------- 4. FORMAT HELPERS ---------- */
  const NODE_COLOR = { GO: "#4ade80", TBD: "#ffd166", NET: "#7b8cff", HOLD: "#ff6b4a" };

  // brand colour + glyph for the company flying each mission
  const BRANDS = [
    { match: /spacex/i,            name: "SpaceX",  color: "#1b2a4a", glyph: "🚀" },
    { match: /amazon|kuiper/i,     name: "Amazon",  color: "#e47911", glyph: "📦" },
    { match: /nasa/i,              name: "NASA",    color: "#0b3d91", glyph: "🚀" },
    { match: /noaa/i,              name: "NOAA",    color: "#0e7c7b", glyph: "🛰️" },
    { match: /\bula\b|united launch|atlas|vulcan|delta/i, name: "ULA", color: "#13294b", glyph: "🛰️" },
    { match: /blue origin/i,       name: "Blue Origin", color: "#1f6feb", glyph: "🪶" },
    { match: /firefly/i,           name: "Firefly", color: "#6d28d9", glyph: "✨" },
    { match: /rocket lab/i,        name: "Rocket Lab", color: "#111827", glyph: "🛰️" },
    { match: /space force|ussf|national/i, name: "U.S. Space Force", color: "#2a3550", glyph: "🛡️" },
  ];
  function brandOf(provider) {
    const b = BRANDS.find((x) => x.match.test(provider));
    if (b) return b;
    const name = provider.split("/")[0].trim() || "Launch";
    return { name, color: "#3a4660", glyph: "🚀" };
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return { date: "Date TBD", time: "" };
    const date = d.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    }) + " UTC";
    return { date, time };
  }

  // Local Eastern time — what the lads will actually experience on the coast.
  function fmtLocalET(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return { date: "Date TBD", time: "" };
    const date = d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
    });
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/New_York",
    });
    return { date, time };
  }

  function chip(text, cls = "") {
    return `<span class="chip ${cls}">${text}</span>`;
  }

  /* ---------- 5. COUNTDOWN ---------- */
  let cdTimer = null;
  function startCountdown(launch) {
    const target = new Date(launch.net).getTime();
    const nextEl = $("next");
    function render() {
      const now = Date.now();
      let diff = Math.floor((target - now) / 1000);
      const lifted = diff <= 0;
      nextEl.classList.toggle("lifted", lifted);
      if (lifted) {
        $("cdD").textContent = "00"; $("cdH").textContent = "00";
        $("cdM").textContent = "00"; $("cdS").textContent = "00";
        $("nextDetail").textContent = "🚀 Liftoff! Climbing downrange…";
        return;
      }
      const d = Math.floor(diff / 86400); diff -= d * 86400;
      const h = Math.floor(diff / 3600);  diff -= h * 3600;
      const m = Math.floor(diff / 60);    const s = diff - m * 60;
      const p = (n) => String(n).padStart(2, "0");
      $("cdD").textContent = p(d); $("cdH").textContent = p(h);
      $("cdM").textContent = p(m); $("cdS").textContent = p(s);
    }
    render();
    if (cdTimer) clearInterval(cdTimer);
    cdTimer = setInterval(render, 1000);
  }

  function renderNext(launch) {
    if (!launch) return;
    $("nextName").textContent = launch.name;
    const { date, time } = fmtDate(launch.net);
    $("nextDetail").textContent =
      `${launch.rocket} · ${launch.pad}, ${launch.site} · ${date} ${time}`;
    $("nextChips").innerHTML =
      chip(launch.status, "status " + launch.status) +
      chip(launch.provider) +
      chip(launch.orbit);
    startCountdown(launch);
  }

  /* ---------- 6. STATS ---------- */
  function renderStats(launches) {
    $("statTotal").textContent = launches.length;
    $("statTrip").textContent = launches.filter(inTrip).length;
    $("statGo").textContent = launches.filter((l) => l.status === "GO").length;
    $("statProviders").textContent = new Set(
      launches.map((l) => l.provider.split("/")[0].trim())
    ).size;
  }

  /* ---------- WEATHER + LIKELIHOOD MODEL ---------- */
  // Known Space Coast pads → coordinates (weather is ~uniform at this scale;
  // the general Cape fallback is fine for anything unmatched).
  const PAD_COORDS = [
    { match: /slc-?40|space launch complex 40/i, lat: 28.562, lon: -80.577 },
    { match: /slc-?41|space launch complex 41/i, lat: 28.583, lon: -80.583 },
    { match: /slc-?37|space launch complex 37/i, lat: 28.531, lon: -80.565 },
    { match: /39a|launch complex 39a/i,          lat: 28.608, lon: -80.604 },
    { match: /39b|launch complex 39b/i,          lat: 28.627, lon: -80.621 },
  ];
  function padCoords(l) {
    const hay = `${l.pad} ${l.site}`;
    const hit = PAD_COORDS.find((p) => p.match.test(hay));
    return hit || { lat: 28.49, lon: -80.57 }; // Cape Canaveral, general
  }

  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

  // Local (Eastern) date + hour for a launch's NET, so we index the right forecast hour.
  function etParts(iso) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit",
        day: "2-digit", hour: "2-digit", hour12: false,
      }).formatToParts(new Date(iso)).reduce((o, p) => (o[p.type] = p.value, o), {});
      const hour = parts.hour === "24" ? 0 : Number(parts.hour);
      return { date: `${parts.year}-${parts.month}-${parts.day}`, hour };
    } catch { return null; }
  }

  // Pull the launch-hour forecast from Open-Meteo (keyless, CORS-friendly).
  // Returns { gust, precip, cape, cloud } in kn / % / J/kg / %, or null.
  async function fetchWeather(l) {
    const et = etParts(l.net);
    if (!et) return null;
    const { lat, lon } = padCoords(l);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=wind_gusts_10m,precipitation_probability,cloud_cover,cape` +
      `&wind_speed_unit=kn&timezone=America%2FNew_York` +
      `&start_date=${et.date}&end_date=${et.date}`;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const times = j.hourly?.time || [];
      let i = times.findIndex((t) => Number(t.slice(11, 13)) === et.hour);
      if (i < 0) i = 0;
      const at = (arr) => (arr && arr[i] != null ? arr[i] : null);
      const gust = at(j.hourly.wind_gusts_10m);
      if (gust == null) return null;
      return {
        gust,
        precip: at(j.hourly.precipitation_probability) ?? 0,
        cape: at(j.hourly.cape) ?? 0,
        cloud: at(j.hourly.cloud_cover) ?? 0,
        etHour: et.hour,
      };
    } catch { return null; }
  }

  // Confidence the range/provider will even attempt on time.
  const SCHED_CONF = { GO: 0.9, NET: 0.6, TBD: 0.35, HOLD: 0.2 };

  // Combine schedule confidence × weather-go × window into a single %.
  // Every input is transparent so the commentary can explain the number.
  function likelihood(l, wx) {
    // The three top-level drivers. Each is a 0..1 favourability, and they
    // multiply to the headline % — so the three bars literally explain the number.
    const sched = SCHED_CONF[l.status] ?? 0.4;
    const windowFav = l.window === "Open window" ? 1.0 : 0.85;

    let weatherGo = null, worst = null;
    if (wx) {
      // Weather itself is a blend of four sub-factors (kept for the "why" line).
      const F = [
        { key: "storms", label: "Storms", p: clamp((wx.cape - 500) / 2000),
          hi: "storm energy is building (the classic Florida afternoon-storm risk)" },
        { key: "rain", label: "Rain", p: clamp((wx.precip - 15) / 55),
          hi: "there's a real chance of rain through the window" },
        { key: "wind", label: "Wind", p: clamp((wx.gust - 25) / 15),
          hi: "surface winds are gusting near the limit" },
        { key: "cloud", label: "Cloud", p: clamp((wx.cloud - 60) / 40),
          hi: "thick cloud cover could trip the cloud rules" },
      ];
      const W = { storms: 0.35, rain: 0.3, wind: 0.25, cloud: 0.1 };
      const violation = F.reduce((s, f) => s + W[f.key] * f.p, 0);
      weatherGo = clamp(1 - violation, 0.05, 0.98);
      // watch-item ranked by weighted contribution, not raw value
      worst = F.slice().sort((a, b) => W[b.key] * b.p - W[a.key] * a.p)[0];
    }
    // No live weather → treat weather as neutral (unknown), don't penalise.
    const wEff = weatherGo == null ? 1.0 : weatherGo;
    const pct = Math.round(clamp(sched * wEff * windowFav, 0.03, 0.97) * 100);
    return { pct, sched, weatherGo, windowFav, wx, worst };
  }

  // Colour + glow for a per-launch certainty number.
  function pctColor(pct) {
    if (pct >= 75) return { color: "var(--go)", glow: "rgba(74,222,128,0.45)" };
    if (pct >= 50) return { color: "var(--gold)", glow: "rgba(255,209,102,0.45)" };
    if (pct >= 35) return { color: "var(--gold)", glow: "rgba(255,209,102,0.4)" };
    return { color: "var(--hot)", glow: "rgba(255,107,74,0.45)" };
  }

  // Written, number-free headline for the whole panel, keyed off the best launch.
  function verdictHeadline(best) {
    if (best >= 75) return "LOOKING GOOD 🚀🔥";
    if (best >= 55) return "DECENT SHOUT, LADS 🤞";
    if (best >= 40) return "GENUINELY A COIN FLIP 🪙";
    return "LONG SHOTS — BUT NOT ZERO 🌠";
  }

  // Short per-launch "why" (status + weather headline + window). No number.
  function reasonLine(l, L) {
    const status =
      l.status === "GO" ? "It's flagged <b>GO</b>"
      : l.status === "NET" ? "It's on the schedule but still <b>to-be-confirmed</b>"
      : l.status === "TBD" ? "The date's still a <b>rough placeholder</b> (TBD)"
      : l.status === "HOLD" ? "It's currently on <b>hold</b>"
      : "It's on the manifest";

    let weather;
    if (!L.wx) {
      weather = "and live weather wasn't available, so this is the schedule signal only";
    } else if (L.weatherGo >= 0.85) {
      weather = L.worst.p >= 0.5
        ? `and the forecast is largely green — the one watch-item is that ${L.worst.hi}`
        : "and the launch-hour forecast is a green light";
    } else if (L.weatherGo >= 0.7) {
      weather = `but keep an eye on the weather — ${L.worst.hi}`;
    } else {
      weather = `and weather is a genuine risk — ${L.worst.hi}`;
    }

    const win = l.window === "Open window"
      ? "the multi-hour window gives several cracks at it"
      : "it's an instantaneous window, so one shot";

    return `${status}, ${weather}. And ${win}.`;
  }

  const bandFromFav = (f) => (f >= 0.75 ? "green" : f >= 0.45 ? "amber" : "red");

  const statusWord = (s) =>
    ({ GO: "Go for launch", NET: "To be confirmed", TBD: "Date placeholder", HOLD: "On hold" }[s] || "On manifest");

  function weatherWord(L) {
    if (L.weatherGo == null) return "no live data";
    if (L.weatherGo >= 0.85) return "Green light";
    if (L.weatherGo >= 0.7) return `${L.worst.label} watch`;
    return `${L.worst.label} risk`;
  }

  // The three top-level drivers — Schedule × Weather × Window — as coloured bars.
  function factorsHTML(l, L) {
    const rows = [
      { label: "Schedule", fav: L.sched, band: bandFromFav(L.sched), value: statusWord(l.status) },
      { label: "Weather",
        fav: L.weatherGo,
        band: L.weatherGo == null ? "muted"
          : L.weatherGo >= 0.85 ? "green" : L.weatherGo >= 0.7 ? "amber" : "red",
        value: weatherWord(L) },
      { label: "Window", fav: L.windowFav, band: bandFromFav(L.windowFav),
        value: l.window === "Open window" ? "multi-hour" : "instantaneous" },
    ];
    return `<div class="factors">` + rows.map((f) => {
      const pctTxt = f.fav == null ? "—" : `${Math.round(f.fav * 100)}%`;
      const w = f.fav == null ? 0 : Math.round(f.fav * 100);
      return `<div class="factor ${f.band}">` +
        `<span class="f-label">${f.label}</span>` +
        `<div class="f-track"><i style="width:${w}%"></i></div>` +
        `<span class="f-pct">${pctTxt}</span>` +
        `<span class="f-val">${f.value}</span>` +
      `</div>`;
    }).join("") + `</div>`;
  }

  // One launch's whole block: header + certainty % + reason + factor bars + change chip.
  function launchCardHTML(l, L, change) {
    const c = pctColor(L.pct);
    const { date, time } = fmtLocalET(l.net);
    const chg = change
      ? `<div class="vlaunch-change ${change.cls}">${change.text}</div>` : "";
    return `
      <article class="vlaunch">
        <div class="vlaunch-head">
          <div class="vlaunch-id">
            <div class="vlaunch-name">${l.name}<span class="vl-status ${l.status}">${l.status}</span></div>
            <div class="vlaunch-when">${l.rocket} · ${date}, ${time} ET</div>
          </div>
          <div class="vlaunch-pct" style="--pct-color:${c.color};--pct-glow:${c.glow}">${L.pct}<span>%</span></div>
        </div>
        <p class="vlaunch-reason">${reasonLine(l, L)}</p>
        ${factorsHTML(l, L)}
        ${chg}
      </article>`;
  }

  // Remember the last reading per launch so we can flag movement between visits.
  function changeNote(l, pct) {
    const key = "lw:verdict:" + (l.name + "|" + l.pad).replace(/\s+/g, "_");
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
    try { localStorage.setItem(key, JSON.stringify({ pct, status: l.status, net: l.net })); } catch {}
    if (!prev) return null;

    if (prev.status !== l.status) {
      return { cls: l.status === "GO" ? "up" : "info", text: `Status moved ${prev.status} → ${l.status} since your last check` };
    }
    if (prev.net !== l.net) {
      const d = Date.parse(l.net) - Date.parse(prev.net);
      const mins = Math.round(Math.abs(d) / 60000);
      const h = Math.floor(mins / 60), m = mins % 60;
      const span = (h ? h + "h " : "") + (m || !h ? m + "m" : "");
      return { cls: "info", text: `T-0 slipped ${d > 0 ? "later" : "earlier"} by ${span} since your last check` };
    }
    const delta = pct - prev.pct;
    if (Math.abs(delta) >= 3) {
      return { cls: delta > 0 ? "up" : "down", text: `${delta > 0 ? "▲ Up" : "▼ Down"} ${Math.abs(delta)} pts since your last check` };
    }
    return { cls: "info", text: "No change since your last check" };
  }

  /* ---------- THE VERDICT ---------- */
  async function renderVerdict(launches) {
    const box = $("verdictLaunches");
    const trip = launches
      .filter(inTrip)
      .filter((l) => !isNaN(Date.parse(l.net)))
      .sort((a, b) => Date.parse(a.net) - Date.parse(b.net));

    // Nothing in the window: written verdict only, no launch cards.
    if (!trip.length) {
      const before = launches
        .filter((l) => { const t = Date.parse(l.net); return !isNaN(t) && t < TRIP_START; })
        .sort((a, b) => Date.parse(b.net) - Date.parse(a.net))[0];
      let sub;
      if (before) {
        const { date, time } = fmtDate(before.net);
        sub =
          `No launch is officially on the schedule for <b>5–10 July</b> right now. ` +
          `<b>BUT</b> — <b>${before.name}</b> (${before.rocket}) is slated for <b>${date}, ${time}</b>, ` +
          `just before the lads land… and Cape rockets slip <em>constantly</em>. One scrub and it bumps ` +
          `straight into the window. Keep the faith. 🙏`;
      } else {
        sub =
          `No launch is officially on the schedule for <b>5–10 July</b> just yet — but this is Cape ` +
          `Canaveral, where rockets pop onto the manifest like buses. Keep refreshing, keep hoping.`;
      }
      $("verdictBig").textContent = "NOTHING FIRM… YET 🤞";
      $("verdictSub").innerHTML = sub;
      box.innerHTML = "";
      $("verdictFoot").textContent =
        "Nothing scheduled in window · 5–10 July 2026 · Cape Canaveral & Kennedy Space Center";
      return;
    }

    // Interim state while each launch's forecast is fetched.
    $("verdictBig").textContent = "READING THE SKIES…";
    $("verdictSub").innerHTML = `Pulling each launch's forecast and scoring it…`;
    box.innerHTML = trip
      .map((l) => `<div class="vlaunch skeleton">Scoring <b>${l.name}</b>…</div>`)
      .join("");

    // Each launch gets its own forecast (different day/hour → different weather).
    const results = await Promise.all(trip.map(async (l) => {
      const wx = await fetchWeather(l);
      const L = likelihood(l, wx);
      return { l, L, change: changeNote(l, L.pct) };
    }));

    const best = Math.max(...results.map((r) => r.L.pct));
    const n = trip.length;
    $("verdictBig").textContent = verdictHeadline(best);
    $("verdictSub").innerHTML =
      `<b>${n}</b> launch${n > 1 ? "es are" : " is"} targeting your window — here's how each stacks up. ` +
      `Each score is <b>schedule × weather × window</b>:`;
    box.innerHTML = results.map((r) => launchCardHTML(r.l, r.L, r.change)).join("");
    $("verdictFoot").textContent =
      `certainty per launch = schedule × weather × window · unofficial estimate`;
  }

  /* ---------- 7. CARDS ---------- */
  function cardHTML(l, i) {
    const { date, time } = fmtDate(l.net);
    const node = NODE_COLOR[l.status] || "#5cf2d6";
    const payload = l.payloadKg ? `${l.payloadKg.toLocaleString()} kg` : "—";
    const trip = inTrip(l);
    const b = brandOf(l.provider);
    const tripFlag = trip
      ? `<div><span class="trip-flag">🎯 YOU MIGHT ACTUALLY SEE THIS ONE</span></div>`
      : "";
    return `
      <article class="launch ${trip ? "in-trip" : ""}" style="--node:${node}; animation-delay:${i * 60}ms" data-i="${i}">
        ${tripFlag}
        <div class="launch-head">
          <span class="co-badge" style="--co:${b.color}">
            <span class="co-glyph">${b.glyph}</span>${b.name}
          </span>
          <div class="launch-when"><b>${date}</b> · ${time}</div>
        </div>
        <div class="launch-top">
          <div>
            <div class="launch-name">${l.name}</div>
            <div class="launch-sub">
              <span>${l.rocket}</span>
              <span>· ${l.pad}, ${l.site}</span>
            </div>
          </div>
        </div>
        <div class="chips">
          ${chip(l.status, "status " + l.status)}
          ${chip(l.orbit)}
          ${chip(l.window)}
        </div>
        <div class="detail">
          <div class="detail-grid">
            <p class="mission-line">${l.mission}</p>
            <div class="field"><label>Target orbit</label><span>${l.orbit}</span></div>
            <div class="field"><label>Payload mass</label><span>${payload}</span></div>
            <div class="field"><label>Vehicle</label><span>${l.booster}</span></div>
            <div class="field"><label>Launch site</label><span>${l.site}</span></div>
          </div>
        </div>
      </article>`;
  }

  let ALL = [];
  let activeFilter = "ALL";

  function renderTimeline() {
    const tl = $("timeline");
    const list = activeFilter === "ALL"
      ? ALL
      : ALL.filter((l) => l.provider.split("/")[0].trim() === activeFilter);
    if (!list.length) {
      tl.innerHTML = `<div class="loading">No launches match “${activeFilter}”.</div>`;
      return;
    }
    tl.innerHTML = list.map(cardHTML).join("");
    tl.querySelectorAll(".launch").forEach((el) => {
      el.addEventListener("click", () => el.classList.toggle("open"));
    });
  }

  function renderFilters() {
    const providers = ["ALL", ...new Set(ALL.map((l) => l.provider.split("/")[0].trim()))];
    const box = $("filters");
    box.innerHTML = providers
      .map((p) => `<button class="filter ${p === "ALL" ? "active" : ""}" data-p="${p}">${p}</button>`)
      .join("");
    box.querySelectorAll(".filter").forEach((b) => {
      b.addEventListener("click", () => {
        activeFilter = b.dataset.p;
        box.querySelectorAll(".filter").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        renderTimeline();
      });
    });
  }

  /* ---------- 8. BOOT ---------- */
  async function boot() {
    starfield();
    rockets();
    clock();

    const { launches, live } = await loadData();
    // sort soonest-first; valid dates before TBD
    launches.sort((a, b) => {
      const ta = new Date(a.net).getTime() || Infinity;
      const tb = new Date(b.net).getTime() || Infinity;
      return ta - tb;
    });
    ALL = launches;

    $("feedDot").className = "dot " + (live ? "live" : "cached");
    $("feedLabel").textContent = live ? "live feed · LL2" : "curated manifest";

    renderNext(launches[0]);
    renderVerdict(launches);        // async: paints an interim state, then the weather-backed verdict
    renderStats(launches);
    renderFilters();
    renderTimeline();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
