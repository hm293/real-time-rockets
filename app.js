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
      const provider = r.launch_service_provider?.name || "—";
      const padName = r.pad?.name || "";
      const site = r.pad?.location?.name || "Cape Canaveral";
      const statusAbbr = r.status?.abbrev || r.status?.name || "TBD";
      return {
        name: (r.mission?.name || r.name?.split("|").pop() || r.name || "Mission").trim(),
        provider,
        rocket,
        pad: padName.replace(/^.*?(SLC|LC)/, "$1") || padName,
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

  /* ---------- THE VERDICT ---------- */
  function renderVerdict(launches) {
    const tripLaunches = launches.filter(inTrip);
    const n = tripLaunches.length;
    const goNow = tripLaunches.filter((l) => l.status === "GO").length;

    let big, sub, pct;
    if (n === 0) {
      big = "HMMMM. SLIM. 😬";
      pct = 12;
      sub =
        "Nothing's officially on the range for your exact dates <em>yet</em> — but this is " +
        "Cape Canaveral, where rockets appear on the schedule like buses. Keep refreshing, " +
        "keep the faith, and maybe befriend a local with a scanner.";
    } else if (n === 1) {
      big = "ODDS: DECENT. 🤞";
      pct = 58;
      sub =
        `There's <b>1 launch</b> penciled in while you're in town. One scrub and it's gone, ` +
        `so cross everything, check the weather, and have a backup plan involving a theme park.`;
    } else {
      big = "STATISTICALLY INEVITABLE. 🚀🔥";
      pct = Math.min(96, 70 + n * 6);
      sub =
        `<b>${n} launches</b> are currently targeting your window` +
        (goNow ? ` (${goNow} already flagged GO)` : "") +
        `. Frankly, if Harry and Jimmy <em>don't</em> see a rocket, that's a skill issue. ` +
        `Pack sunscreen, point your phone at the sky, and prepare to overreact.`;
    }

    $("verdictBig").textContent = big;
    $("verdictSub").innerHTML = sub;
    $("verdictFoot").textContent =
      n > 0
        ? `${n} launch${n > 1 ? "es" : ""} in window · 5–10 July 2026 · Cape Canaveral & Kennedy Space Center`
        : "Trip window: 5–10 July 2026 · Cape Canaveral & Kennedy Space Center";
    requestAnimationFrame(() => { $("verdictFill").style.width = pct + "%"; });
  }

  /* ---------- 7. CARDS ---------- */
  function cardHTML(l, i) {
    const { date, time } = fmtDate(l.net);
    const node = NODE_COLOR[l.status] || "#5cf2d6";
    const payload = l.payloadKg ? `${l.payloadKg.toLocaleString()} kg` : "—";
    const trip = inTrip(l);
    const tripFlag = trip
      ? `<div><span class="trip-flag">🎯 YOU MIGHT ACTUALLY SEE THIS ONE</span></div>`
      : "";
    return `
      <article class="launch ${trip ? "in-trip" : ""}" style="--node:${node}; animation-delay:${i * 60}ms" data-i="${i}">
        ${tripFlag}
        <div class="launch-top">
          <div>
            <div class="launch-name">${l.name}</div>
            <div class="launch-sub">
              <span class="prov">${l.provider}</span>
              <span>${l.rocket}</span>
              <span>· ${l.pad}, ${l.site}</span>
            </div>
          </div>
          <div class="launch-when"><b>${date}</b> · ${time}</div>
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
    renderVerdict(launches);
    renderStats(launches);
    renderFilters();
    renderTimeline();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
