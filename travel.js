/* ============================================================================
   travel.js — logic for travel.html
   ============================================================================

   ╔═══════════════════════════════════════════════════════════════════════╗
   ║                                                                       ║
   ║   ███████╗ ██████╗  ██╗ ████████╗    ███╗   ███╗ ███████╗            ║
   ║   ██╔════╝ ██╔══██╗ ██║ ╚══██╔══╝    ████╗ ████║ ██╔════╝            ║
   ║   █████╗   ██║  ██║ ██║    ██║       ██╔████╔██║ █████╗              ║
   ║   ██╔══╝   ██║  ██║ ██║    ██║       ██║╚██╔╝██║ ██╔══╝              ║
   ║   ███████╗ ██████╔╝ ██║    ██║       ██║ ╚═╝ ██║ ███████╗            ║
   ║   ╚══════╝ ╚═════╝  ╚═╝    ╚═╝       ╚═╝     ╚═╝ ╚══════╝            ║
   ║                                                                       ║
   ║   EVERYTHING YOU EVER NEED TO EDIT LIVES IN THIS BLOCK.               ║
   ║   Add a state / park / country below and the maps, stamps,            ║
   ║   chips and animated counters all update automatically.               ║
   ║                                                                       ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

/* US states you have visited — lowercase two-letter USPS codes.
   ("dc" is also supported for the District of Columbia.)                    */
const VISITED_STATES = [
  "ok", "pa", "ny", "nj", "nv", "mt", "md", "il",
  "id", "co", "ca", "az", "ut", "tx", "wa", "wy",
  "dc", /* lights up on the map but doesn't count toward the /50 stat */
];

/* National parks you have visited — name (without "National Park"),
   state code, and optionally the year of the visit ({ ..., year: 2024 }).
   Order = order of the stamps.                                              */
const VISITED_PARKS = [
  { name: "Grand Teton",    state: "WY" },
  { name: "Grand Canyon",   state: "AZ" },
  { name: "Death Valley",   state: "CA" },
  { name: "Bryce Canyon",   state: "UT" },
  { name: "Mount Rainier",  state: "WA" },
  { name: "Rocky Mountain", state: "CO" },
  { name: "Sequoia",        state: "CA" },
  { name: "Yellowstone",    state: "WY" },
  { name: "Yosemite",       state: "CA" },
  { name: "Zion",           state: "UT" },
];

/* Countries you have visited — lowercase ISO 3166-1 alpha-2 code,
   display name, and emoji flag.                                             */
const VISITED_COUNTRIES = [
  { code: "in", name: "India",         flag: "🇮🇳" },
  { code: "us", name: "United States", flag: "🇺🇸" },
];

/* Denominators shown in the stat tiles.                                     */
const TOTAL_US_STATES      = 50;
const TOTAL_NATIONAL_PARKS = 63;
const TOTAL_COUNTRIES      = 195;

/* ═══════════════════════ END OF THE "EDIT ME" BLOCK ═══════════════════════
   Nothing below needs touching to update your travels.
   ========================================================================== */

(function () {
  "use strict";

  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Full code → name map for the US map tooltips (50 states + DC). */
  var US_STATE_NAMES = {
    al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas",
    ca: "California", co: "Colorado", ct: "Connecticut", de: "Delaware",
    fl: "Florida", ga: "Georgia", hi: "Hawaii", id: "Idaho",
    il: "Illinois", in: "Indiana", ia: "Iowa", ks: "Kansas",
    ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
    ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
    mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada",
    nh: "New Hampshire", nj: "New Jersey", nm: "New Mexico", ny: "New York",
    nc: "North Carolina", nd: "North Dakota", oh: "Ohio", ok: "Oklahoma",
    or: "Oregon", pa: "Pennsylvania", ri: "Rhode Island", sc: "South Carolina",
    sd: "South Dakota", tn: "Tennessee", tx: "Texas", ut: "Utah",
    vt: "Vermont", va: "Virginia", wa: "Washington", wv: "West Virginia",
    wi: "Wisconsin", wy: "Wyoming", dc: "District of Columbia",
  };

  var VISITED_STATE_SET = {};
  VISITED_STATES.forEach(function (c) { VISITED_STATE_SET[c] = true; });

  var VISITED_COUNTRY_BY_CODE = {};
  VISITED_COUNTRIES.forEach(function (c) { VISITED_COUNTRY_BY_CODE[c.code] = c; });

  /* Class tokens on world-map shapes that are NOT country codes. */
  var NON_CODE_TOKENS = {
    landxx: 1, coastxx: 1, antxx: 1, limitxx: 1, circlexx: 1,
    oceanxx: 1, subxx: 1, unxx: 1, noxx: 1, eu: 1, eaeu: 1,
  };

  var REGION_NAMES = null;
  try {
    REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
  } catch (e) { /* older browsers: fall back to the ISO code */ }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  /* Let the site's custom cursor react to dynamically created controls. */
  var cursorInnerEl = document.getElementById("cursor-inner");
  var cursorOuterEl = document.getElementById("cursor-outer");
  function wireCursor(el) {
    if (!cursorInnerEl || !cursorOuterEl) return;
    el.addEventListener("mouseenter", function () {
      cursorInnerEl.classList.add("hover");
      cursorOuterEl.classList.add("hover");
    });
    el.addEventListener("mouseleave", function () {
      cursorInnerEl.classList.remove("hover");
      cursorOuterEl.classList.remove("hover");
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Silky scroll reveals (.lg-reveal -> .lg-in)                        */
  /* ------------------------------------------------------------------ */
  function initReveals() {
    var els = $$(".lg-reveal");
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("lg-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("lg-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ */
  /*  Stat tiles — animated count-up                                     */
  /* ------------------------------------------------------------------ */
  /* DC lights up on the map but isn't one of the 50 states */
  var TRUE_STATE_COUNT = VISITED_STATES.filter(function (c) {
    return c !== "dc";
  }).length;

  var STATS = {
    states:    { value: TRUE_STATE_COUNT,         total: TOTAL_US_STATES },
    parks:     { value: VISITED_PARKS.length,     total: TOTAL_NATIONAL_PARKS },
    countries: { value: VISITED_COUNTRIES.length, total: TOTAL_COUNTRIES },
  };

  function countUp(el, target) {
    if (REDUCED) { el.textContent = String(target); return; }
    var DURATION = 1400;
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      var eased = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initStats() {
    $$(".stat-num").forEach(function (el) {
      var stat = STATS[el.getAttribute("data-stat")];
      if (stat) el.textContent = "0";
    });
    $$(".stat-denom").forEach(function (el) {
      var stat = STATS[el.getAttribute("data-stat")];
      if (stat) el.textContent = "/" + stat.total;
    });

    var strip = $(".travel-stats");
    if (!strip) return;
    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      $$(".stat-num", strip).forEach(function (el) {
        var stat = STATS[el.getAttribute("data-stat")];
        if (stat) countUp(el, stat.value);
      });
    }
    if (REDUCED || !("IntersectionObserver" in window)) { fire(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        fire();
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(strip);
  }

  /* ------------------------------------------------------------------ */
  /*  Glass tooltip (shared by both maps)                                */
  /* ------------------------------------------------------------------ */
  var tooltip = null;
  function getTooltip() {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "travel-tooltip";
      tooltip.setAttribute("aria-hidden", "true");
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }
  function showTooltip(name, visited) {
    var tip = getTooltip();
    tip.innerHTML =
      '<span class="tt-dot' + (visited ? " tt-dot-visited" : "") + '"></span>' +
      '<span class="tt-name">' + escapeHTML(name) + "</span>" +
      '<span class="tt-badge">' + (visited ? "visited" : "not yet") + "</span>";
    tip.classList.add("show");
  }
  function moveTooltip(x, y) {
    if (!tooltip) return;
    var pad = 14;
    var rect = tooltip.getBoundingClientRect();
    var left = x + 18;
    var top = y + 20;
    if (left + rect.width > window.innerWidth - pad) left = x - rect.width - 16;
    if (top + rect.height > window.innerHeight - pad) top = y - rect.height - 16;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }
  function hideTooltip() {
    if (tooltip) tooltip.classList.remove("show");
  }

  /* ------------------------------------------------------------------ */
  /*  Map helpers                                                        */
  /* ------------------------------------------------------------------ */
  var SVG_NS = "http://www.w3.org/2000/svg";

  /* Purple → pink → blue sweep across the whole map, shared by every
     visited shape (userSpaceOnUse keeps it continuous across states).   */
  function addMapGradient(svg, id) {
    var vb = svg.viewBox.baseVal;
    var defs = document.createElementNS(SVG_NS, "defs");
    var grad = document.createElementNS(SVG_NS, "linearGradient");
    grad.setAttribute("id", id);
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    grad.setAttribute("x1", 0);
    grad.setAttribute("y1", 0);
    grad.setAttribute("x2", vb.width);
    grad.setAttribute("y2", vb.height);
    [["0%", "#8000ff"], ["50%", "#cf59e6"], ["100%", "#6bc5f8"]]
      .forEach(function (stop) {
        var s = document.createElementNS(SVG_NS, "stop");
        s.setAttribute("offset", stop[0]);
        s.setAttribute("stop-color", stop[1]);
        grad.appendChild(s);
      });
    defs.appendChild(grad);
    svg.insertBefore(defs, svg.firstChild);
  }

  function markVisited(shapes, gradId, index) {
    shapes.forEach(function (el) {
      el.classList.add("is-visited");
      el.style.fill = "url(#" + gradId + ")";
      el.style.setProperty("--d", (index * 40) + "ms");
    });
  }

  function lightUpWhenVisible(panel, svg) {
    if (REDUCED || !("IntersectionObserver" in window)) {
      svg.classList.add("map-lit");
      return;
    }
    /* if the panel is already on screen (common for the lazily fetched
       world map), light up on the next frame without waiting on IO */
    var rect = panel.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setTimeout(function () { svg.classList.add("map-lit"); }, 60);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        svg.classList.add("map-lit");
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(panel);
  }

  /* resolveCode(element) -> two-letter code or null; walks up the tree so
     island groups whose children carry no class (e.g. Japan) still work. */
  function makeCodeResolver(svg, validate) {
    return function (target) {
      var el = target;
      while (el && el !== svg) {
        if (el.classList) {
          for (var i = 0; i < el.classList.length; i++) {
            var t = el.classList[i];
            if (/^[a-z]{2}$/.test(t) && !NON_CODE_TOKENS[t] && validate(t)) {
              return t;
            }
          }
          var id = el.getAttribute && el.getAttribute("id");
          if (id && /^[a-z]{2}$/.test(id) && !NON_CODE_TOKENS[id] && validate(id)) {
            return id;
          }
        }
        el = el.parentNode;
      }
      return null;
    };
  }

  /* All drawable shapes for a code: leaf matches + descendants of groups. */
  function shapesForCode(svg, code) {
    if (!/^[a-z]{2}$/.test(code)) return [];
    var out = [];
    var seen = [];
    function push(el) {
      if (seen.indexOf(el) === -1) { seen.push(el); out.push(el); }
    }
    $$("path." + code + ", circle." + code, svg).forEach(push);
    $$("g." + code + ", g[id='" + code + "']", svg).forEach(function (g) {
      $$("path, circle", g).forEach(push);
    });
    return out;
  }

  function attachMapHover(holder, svg, resolve, describe) {
    var hovered = null; /* [els] currently highlighted */
    var shapeCache = {};
    function shapes(code) {
      if (!shapeCache[code]) shapeCache[code] = shapesForCode(svg, code);
      return shapeCache[code];
    }
    function clearHover() {
      if (hovered) {
        hovered.forEach(function (el) { el.classList.remove("hovered"); });
        hovered = null;
      }
    }
    holder.addEventListener("pointerover", function (e) {
      var code = resolve(e.target);
      clearHover();
      if (!code) { hideTooltip(); return; }
      hovered = shapes(code);
      hovered.forEach(function (el) { el.classList.add("hovered"); });
      var info = describe(code);
      if (info) {
        showTooltip(info.name, info.visited);
        moveTooltip(e.clientX, e.clientY);
      } else {
        hideTooltip();
      }
    });
    holder.addEventListener("pointermove", function (e) {
      moveTooltip(e.clientX, e.clientY);
    });
    holder.addEventListener("pointerleave", function () {
      clearHover();
      hideTooltip();
    });
    return shapes;
  }

  function showMapFallback(panel) {
    var holder = $(".map-holder", panel);
    var fallback = $(".map-fallback", panel);
    if (holder) holder.hidden = true;
    if (fallback) fallback.hidden = false;
  }

  function fetchSVG(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  United States map                                                  */
  /* ------------------------------------------------------------------ */
  function initUSMap() {
    var panel = $("#us-map-panel");
    var holder = $("#us-map");
    if (!panel || !holder) return;

    fetchSVG("src/maps/us-states.svg").then(function (txt) {
      holder.innerHTML = txt;
      var svg = $("svg", holder);
      if (!svg) throw new Error("no svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label",
        "Map of the United States with " + TRUE_STATE_COUNT +
        " visited states and the District of Columbia highlighted");
      addMapGradient(svg, "map-grad-us");

      VISITED_STATES.forEach(function (code, i) {
        markVisited(shapesForCode(svg, code), "map-grad-us", i);
      });

      var resolve = makeCodeResolver(svg, function (t) {
        return !!US_STATE_NAMES[t];
      });
      attachMapHover(holder, svg, resolve, function (code) {
        return {
          name: US_STATE_NAMES[code] || code.toUpperCase(),
          visited: !!VISITED_STATE_SET[code],
        };
      });

      lightUpWhenVisible(panel, svg);
    }).catch(function () {
      showMapFallback(panel);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  World map — lazily fetched when the section approaches viewport    */
  /* ------------------------------------------------------------------ */
  var worldShapesLookup = null; /* set once the world map is live */

  function initWorldMap() {
    var panel = $("#world-map-panel");
    var holder = $("#world-map");
    if (!panel || !holder) return;

    var loaded = false;
    function load() {
      if (loaded) return;
      loaded = true;
      fetchSVG("src/maps/world-min.svg").then(function (txt) {
        holder.innerHTML = txt;
        var svg = $("svg", holder);
        if (!svg) throw new Error("no svg");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label",
          "World map with " + VISITED_COUNTRIES.length +
          " visited countries highlighted");
        addMapGradient(svg, "map-grad-world");

        VISITED_COUNTRIES.forEach(function (c, i) {
          markVisited(shapesForCode(svg, c.code), "map-grad-world", i);
        });

        var resolve = makeCodeResolver(svg, function () { return true; });
        worldShapesLookup = attachMapHover(holder, svg, resolve, function (code) {
          var visited = VISITED_COUNTRY_BY_CODE[code];
          var name = visited ? visited.name : null;
          if (!name && REGION_NAMES) {
            try { name = REGION_NAMES.of(code.toUpperCase()); } catch (e) { }
          }
          return { name: name || code.toUpperCase(), visited: !!visited };
        });

        lightUpWhenVisible(panel, svg);
      }).catch(function () {
        showMapFallback(panel);
      });
    }

    if (!("IntersectionObserver" in window)) { load(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        load();
      }
    }, { rootMargin: "800px 0px 800px 0px" });
    io.observe(panel);
  }

  /* ------------------------------------------------------------------ */
  /*  Flag chips — hovering pulses the country on the map                */
  /* ------------------------------------------------------------------ */
  function initFlagChips() {
    var row = $("#flag-chips");
    if (!row) return;
    VISITED_COUNTRIES.forEach(function (c) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "lg-material lg-flat lg-chip lg-interactive flag-chip";
      chip.setAttribute("aria-label", c.name + " — visited");
      chip.innerHTML =
        '<span class="flag" aria-hidden="true">' + escapeHTML(c.flag) + "</span>" +
        '<span class="flag-chip-name">' + escapeHTML(c.name) + "</span>";
      function pulseOn() {
        if (!worldShapesLookup) return;
        worldShapesLookup(c.code).forEach(function (el) {
          el.classList.add("pulse");
        });
      }
      function pulseOff() {
        if (!worldShapesLookup) return;
        worldShapesLookup(c.code).forEach(function (el) {
          el.classList.remove("pulse");
        });
      }
      chip.addEventListener("mouseenter", pulseOn);
      chip.addEventListener("mouseleave", pulseOff);
      chip.addEventListener("focus", pulseOn);
      chip.addEventListener("blur", pulseOff);
      wireCursor(chip);
      row.appendChild(chip);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  National-park passport stamps                                      */
  /* ------------------------------------------------------------------ */
  /* Park-specific stamp artwork — line-art fragments drawn in the 168×168
     stamp space (art zone ≈ x 44–124, y 44–106). Keyed by lowercase park
     name; parks without custom art fall back to the generic peaks, so new
     EDIT-ME entries always render. */
  var DEFAULT_GLYPH =
    '<circle class="stamp-glyph" cx="64" cy="68" r="6" fill="none" stroke-width="2"/>' +
    '<path class="stamp-glyph" d="M 50,100 L 73,70 L 85,86 L 95,72 L 118,100 Z" ' +
    'fill="none" stroke-width="3" stroke-linejoin="round"/>';

  var PARK_GLYPHS = {
    /* needle-sharp Teton spires with a snowline */
    "grand teton":
      '<path class="stamp-glyph" d="M 46,102 L 64,58 L 73,80 L 84,50 L 95,76 L 106,64 L 122,102" ' +
      'fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 78,64 L 90,64" fill="none" stroke-width="2.5" stroke-linecap="round"/>',
    /* strata bands cut by the deep V of the canyon, river at the bottom */
    "grand canyon":
      '<path class="stamp-glyph" d="M 46,58 L 74,58 M 94,58 L 122,58 ' +
      'M 46,70 L 78,70 M 90,70 L 122,70 M 46,82 L 81,82 M 87,82 L 122,82" ' +
      'fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 74,58 L 82,88 M 94,58 L 86,88" ' +
      'fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 78,97 Q 84,92 90,97" fill="none" stroke-width="2.5" stroke-linecap="round"/>',
    /* rolling dunes under a desert sun */
    "death valley":
      '<circle class="stamp-glyph" cx="100" cy="58" r="7" fill="none" stroke-width="2.5"/>' +
      '<path class="stamp-glyph" d="M 44,102 Q 62,72 88,96" fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 68,90 Q 94,66 124,100" fill="none" stroke-width="3" stroke-linecap="round"/>',
    /* three knobby hoodoos, stamped solid like a real passport stamp */
    "bryce canyon":
      '<path class="stamp-glyph" style="fill:var(--ink)" stroke="none" ' +
      'd="M 55,64 L 65,64 L 68,104 L 52,104 Z"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="60" cy="61" rx="8" ry="7"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="60" cy="80" rx="7" ry="5.5"/>' +
      '<path class="stamp-glyph" style="fill:var(--ink)" stroke="none" ' +
      'd="M 79,50 L 89,50 L 92,104 L 76,104 Z"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="84" cy="47" rx="8" ry="7"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="84" cy="66" rx="7" ry="5.5"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="84" cy="84" rx="7.5" ry="5.5"/>' +
      '<path class="stamp-glyph" style="fill:var(--ink)" stroke="none" ' +
      'd="M 103,76 L 113,76 L 116,104 L 100,104 Z"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="108" cy="73" rx="8" ry="7"/>' +
      '<ellipse class="stamp-glyph" style="fill:var(--ink)" stroke="none" cx="108" cy="90" rx="7" ry="5.5"/>',
    /* broad glaciated dome, snowline and crevasses */
    "mount rainier":
      '<path class="stamp-glyph" d="M 44,102 Q 64,98 72,76 Q 78,56 84,56 Q 90,56 96,76 Q 104,98 124,102" ' +
      'fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 72,76 Q 84,84 96,76" fill="none" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 80,64 L 82,72 M 88,64 L 86,72" fill="none" stroke-width="2" stroke-linecap="round"/>',
    /* rugged front-range peaks behind a lone pine */
    "rocky mountain":
      '<path class="stamp-glyph" d="M 60,100 L 80,60 L 90,76 L 102,56 L 122,100" ' +
      'fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 52,102 L 52,74" fill="none" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 52,74 L 44,86 M 52,74 L 60,86 M 52,84 L 42,98 M 52,84 L 62,98" ' +
      'fill="none" stroke-width="2.5" stroke-linecap="round"/>',
    /* giant sequoia: broad canopy over a colossal trunk, tiny pine for scale */
    "sequoia":
      '<path class="stamp-glyph" d="M 58,56 Q 58,44 68,44 Q 70,34 84,36 Q 98,34 100,44 Q 110,44 110,56 ' +
      'Q 102,60 84,60 Q 66,60 58,56 Z" ' +
      'fill="none" stroke-width="3" stroke-linejoin="round"/>' +
      '<path class="stamp-glyph" d="M 75,60 L 74,104 M 93,60 L 94,104" ' +
      'fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 46,104 L 46,92 M 46,92 L 40,100 M 46,92 L 52,100 ' +
      'M 46,96 L 39,104 M 46,96 L 53,104" ' +
      'fill="none" stroke-width="2" stroke-linecap="round"/>',
    /* Old Faithful mid-eruption */
    "yellowstone":
      '<path class="stamp-glyph" d="M 52,104 Q 70,94 78,92 L 90,92 Q 98,94 116,104" ' +
      'fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 78,92 Q 76,72 70,62 M 84,92 L 84,54 M 90,92 Q 92,72 98,62" ' +
      'fill="none" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle class="stamp-glyph" cx="66" cy="54" r="2.2" fill="none" stroke-width="2"/>' +
      '<circle class="stamp-glyph" cx="84" cy="46" r="2.2" fill="none" stroke-width="2"/>' +
      '<circle class="stamp-glyph" cx="102" cy="54" r="2.2" fill="none" stroke-width="2"/>',
    /* Half Dome: sheer face falling into the rounded back */
    "yosemite":
      '<path class="stamp-glyph" d="M 48,104 L 60,98 L 64,62 Q 66,50 80,48 Q 100,46 107,66 Q 112,84 116,104" ' +
      'fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 64,72 Q 74,66 80,56" fill="none" stroke-width="2" stroke-linecap="round"/>',
    /* Angels Landing: the sheer fin, switchback trail zigzagging to the top */
    "zion":
      '<path class="stamp-glyph" d="M 46,104 Q 58,100 66,82 Q 76,58 84,52 Q 88,49 92,56 Q 100,72 106,86 Q 112,99 122,104" ' +
      'fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="stamp-glyph" d="M 66,100 L 74,95 L 68,90 L 76,84 L 70,79 L 78,72 L 73,66 L 80,60 L 84,54" ' +
      'fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  };

  function stampSVG(park, i) {
    var name = String(park.name).toUpperCase();
    var topSize = name.length > 11 ? 12 : 14;
    var bottom = "★ NATIONAL PARK · " + escapeHTML(park.state) + " ★";
    return (
      '<svg class="stamp-art" viewBox="0 0 168 168" aria-hidden="true" focusable="false">' +
      "<defs>" +
      '<path id="stamp-arc-top-' + i + '" d="M 24,84 A 60,60 0 0 1 144,84" fill="none"/>' +
      '<path id="stamp-arc-bot-' + i + '" d="M 24,84 A 60,60 0 0 0 144,84" fill="none"/>' +
      "</defs>" +
      '<circle class="stamp-ring" cx="84" cy="84" r="78" fill="none" stroke-width="3"/>' +
      '<circle class="stamp-ring" cx="84" cy="84" r="70" fill="none" stroke-width="1.4" stroke-dasharray="4 5"/>' +
      '<text class="stamp-arc" font-size="' + topSize + '">' +
      '<textPath href="#stamp-arc-top-' + i + '" startOffset="50%" text-anchor="middle">' +
      escapeHTML(name) + "</textPath></text>" +
      '<text class="stamp-arc stamp-arc-small" font-size="10">' +
      '<textPath href="#stamp-arc-bot-' + i + '" startOffset="50%" text-anchor="middle">' +
      bottom + "</textPath></text>" +
      (PARK_GLYPHS[String(park.name).toLowerCase()] || DEFAULT_GLYPH) +
      (park.year
        ? '<text class="stamp-year" x="84" y="124" text-anchor="middle">' +
          escapeHTML(park.year) + "</text>"
        : "") +
      "</svg>"
    );
  }

  function initStamps() {
    var wall = $("#stamp-wall");
    if (!wall) return;

    /* one shared "rough ink" filter for an authentic stamped look */
    var filterHost = document.createElementNS(SVG_NS, "svg");
    filterHost.setAttribute("width", "0");
    filterHost.setAttribute("height", "0");
    filterHost.setAttribute("aria-hidden", "true");
    filterHost.style.position = "absolute";
    filterHost.innerHTML =
      '<filter id="stamp-rough" x="-6%" y="-6%" width="112%" height="112%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.8"/>' +
      "</filter>";
    wall.appendChild(filterHost);

    VISITED_PARKS.forEach(function (park, i) {
      var stamp = document.createElement("div");
      /* deterministic pseudo-random tilt: -6deg … +6deg */
      var rot = ((i * 137) % 13) - 6;
      stamp.className = "park-stamp ink-" + (i % 3);
      stamp.style.setProperty("--rot", rot + "deg");
      stamp.style.setProperty("--stamp-delay", (i * 90) + "ms");
      stamp.setAttribute("role", "img");
      stamp.setAttribute("aria-label",
        park.name + " National Park, " + park.state +
        (park.year ? ", " + park.year : ""));
      stamp.innerHTML = stampSVG(park, i);
      wall.appendChild(stamp);
    });

    var caption = $("#stamp-caption");
    if (caption) {
      caption.textContent =
        "// " + VISITED_PARKS.length + " of " + TOTAL_NATIONAL_PARKS +
        " parks stamped — the wall grows every year";
    }

    if (REDUCED || !("IntersectionObserver" in window)) {
      wall.classList.add("stamped");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        wall.classList.add("stamped");
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(wall);
  }

  /* ------------------------------------------------------------------ */
  /*  Boot                                                               */
  /* ------------------------------------------------------------------ */
  initReveals();
  initStats();
  initUSMap();
  initWorldMap();
  initFlagChips();
  initStamps();
})();
