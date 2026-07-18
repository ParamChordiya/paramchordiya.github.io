/* ============================================================
   LIQUID GLASS — refraction lens engine
   ------------------------------------------------------------
   Gives the glass material real edge refraction ("lensing"),
   like Apple's clear Liquid Glass: the backdrop bends around
   the rim of every pane while the centre stays perfectly clear.

   How: for each glass element we generate a displacement map
   (canvas → data-URL) encoding a rounded-rect bezel — neutral
   grey in the middle (no distortion), with the R/G channels
   ramping along the outward normal near the edge. The map
   drives an SVG feDisplacementMap applied via
   `backdrop-filter: url(#lens) blur() saturate()`.

   SVG filters inside backdrop-filter are Chromium-only, so the
   lens is a progressive enhancement: Safari/Firefox keep the
   clear-glass fallback styled in liquid-glass.css.

   Also drives the pointer-tracked specular highlight
   (--lg-px / --lg-py / --lg-lit consumed by liquid-glass.css).

   Kill switch: append ?nolens to the URL.
   ============================================================ */
(function () {
  "use strict";

  var REDUCED_MOTION = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var REDUCED_TRANSPARENCY = window.matchMedia &&
    window.matchMedia("(prefers-reduced-transparency: reduce)").matches;

  /* ---------------- pointer-tracked specular (all engines) -------------- */
  if (!REDUCED_MOTION &&
      window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    var SHEEN_TARGETS = ".lg-material";
    var litEl = null;
    var pending = null;

    document.addEventListener("pointermove", function (e) {
      pending = e;
      if (pending.rafQueued) return;
      pending.rafQueued = true;
      requestAnimationFrame(function () {
        var ev = pending;
        if (!ev) return;
        ev.rafQueued = false;
        var el = ev.target && ev.target.closest
          ? ev.target.closest(SHEEN_TARGETS)
          : null;
        if (litEl && litEl !== el) {
          litEl.style.setProperty("--lg-lit", "0");
        }
        if (el) {
          var r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            el.style.setProperty("--lg-px",
              (((ev.clientX - r.left) / r.width) * 100).toFixed(2) + "%");
            el.style.setProperty("--lg-py",
              (((ev.clientY - r.top) / r.height) * 100).toFixed(2) + "%");
            el.style.setProperty("--lg-lit", "1");
          }
        }
        litEl = el;
      });
    }, { passive: true });

    document.addEventListener("pointerleave", function () {
      if (litEl) {
        litEl.style.setProperty("--lg-lit", "0");
        litEl = null;
      }
    });
  }

  /* ---------------- refraction lens (Chromium only) --------------------- */
  if (REDUCED_TRANSPARENCY) return;
  if (/[?&]nolens\b/.test(window.location.search)) return;
  var isChromium = !!(navigator.userAgentData &&
    navigator.userAgentData.brands &&
    navigator.userAgentData.brands.some(function (b) {
      return /Chromium/i.test(b.brand);
    }));
  if (!isChromium) return;

  var LENS_TARGETS =
    ".navbar, .lg-material, .lg-fab, .project-box, .letsTalkBtn-text";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MAP_MAX_DIM = 600;   /* maps are generated at most this large (uniform
                              downscale keeps the optics undistorted) */

  var host = document.createElementNS(SVG_NS, "svg");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  var defs = document.createElementNS(SVG_NS, "defs");
  host.appendChild(defs);

  /* Rounded-rect signed distance + outward normal → displacement map.
     Encoding: sampling is pulled toward the centre at the rim (rim
     magnification — how a thick glass edge actually bends light). */
  function generateMap(w, h, radius) {
    var s = Math.min(1, MAP_MAX_DIM / Math.max(w, h));
    var mw = Math.max(2, Math.round(w * s));
    var mh = Math.max(2, Math.round(h * s));
    var r = Math.min(radius * s, mw / 2, mh / 2);
    var bez = Math.min(
      Math.max(r * 0.9, 12 * s),
      34 * s,
      Math.min(mw, mh) * 0.42
    );

    var canvas = document.createElement("canvas");
    canvas.width = mw;
    canvas.height = mh;
    var ctx = canvas.getContext("2d");
    var img = ctx.createImageData(mw, mh);
    var data = img.data;
    var hw = mw / 2;
    var hh = mh / 2;
    var ax = hw - r; /* half-extent minus corner radius */
    var ay = hh - r;

    for (var y = 0; y < mh; y++) {
      var py = y + 0.5 - hh;
      var qy = Math.abs(py) - ay;
      for (var x = 0; x < mw; x++) {
        var px = x + 0.5 - hw;
        var qx = Math.abs(px) - ax;
        var vx = qx > 0 ? qx : 0;
        var vy = qy > 0 ? qy : 0;
        var interior = Math.min(Math.max(qx, qy), 0);
        var dIn = -(Math.sqrt(vx * vx + vy * vy) + interior - r);

        var R = 127.5;
        var G = 127.5;
        if (dIn < bez) {
          var t = 1 - (dIn > 0 ? dIn : 0) / bez;
          var m = Math.pow(t, 1.8);
          var nx, ny;
          if (vx > 0 || vy > 0) {
            var vl = Math.sqrt(vx * vx + vy * vy);
            nx = (vx / vl) * (px < 0 ? -1 : 1);
            ny = (vy / vl) * (py < 0 ? -1 : 1);
          } else if (qx > qy) {
            nx = px < 0 ? -1 : 1;
            ny = 0;
          } else {
            nx = 0;
            ny = py < 0 ? -1 : 1;
          }
          R = 127.5 - nx * m * 127.5;
          G = 127.5 - ny * m * 127.5;
        }
        var o = (y * mw + x) * 4;
        data[o] = R;
        data[o + 1] = G;
        data[o + 2] = 127;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  function cornerRadius(el, w, h) {
    var raw = getComputedStyle(el).borderTopLeftRadius || "";
    var r;
    if (raw.indexOf("%") !== -1) {
      r = (parseFloat(raw) / 100) * Math.min(w, h);
    } else {
      r = parseFloat(raw) || 0;
    }
    return Math.min(r, Math.min(w, h) / 2);
  }

  var uid = 0;
  var records = [];

  function attachLens(el) {
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    if (!w || !h) return null;

    var id = "lg-lens-" + uid++;
    var filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    var feImage = document.createElementNS(SVG_NS, "feImage");
    feImage.setAttribute("result", "lgmap");
    feImage.setAttribute("preserveAspectRatio", "none");
    var feDisp = document.createElementNS(SVG_NS, "feDisplacementMap");
    feDisp.setAttribute("in", "SourceGraphic");
    feDisp.setAttribute("in2", "lgmap");
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
    filter.appendChild(feImage);
    filter.appendChild(feDisp);
    defs.appendChild(filter);

    var rec = { el: el, filter: filter, feImage: feImage, feDisp: feDisp,
                w: 0, h: 0 };
    updateLens(rec);

    el.classList.add("lg-lensed");
    var bf = "url(#" + id + ") blur(var(--lg-lens-blur)) " +
             "saturate(var(--lg-lens-saturate))";
    el.style.setProperty("backdrop-filter", bf);
    el.style.setProperty("-webkit-backdrop-filter", bf);
    return rec;
  }

  function updateLens(rec) {
    var w = rec.el.offsetWidth;
    var h = rec.el.offsetHeight;
    if (!w || !h || (Math.abs(w - rec.w) < 2 && Math.abs(h - rec.h) < 2)) {
      return;
    }
    rec.w = w;
    rec.h = h;

    var r = cornerRadius(rec.el, w, h);
    var bezReal = Math.min(Math.max(r * 0.9, 12), 34, Math.min(w, h) * 0.42);

    ["x", "y"].forEach(function (a) {
      rec.filter.setAttribute(a, "0");
      rec.feImage.setAttribute(a, "0");
    });
    rec.filter.setAttribute("width", w);
    rec.filter.setAttribute("height", h);
    rec.feImage.setAttribute("width", w);
    rec.feImage.setAttribute("height", h);
    /* displaced by scale * 0.5 px at the very rim */
    rec.feDisp.setAttribute("scale",
      Math.round(Math.min(Math.max(bezReal * 1.5, 14), 44)));

    var url = generateMap(w, h, r);
    rec.feImage.setAttribute("href", url);
    rec.feImage.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
  }

  function init() {
    document.body.appendChild(host);

    var seen = new Set();
    var els = document.querySelectorAll(LENS_TARGETS);
    var queue = [];
    els.forEach(function (el) {
      if (!seen.has(el)) {
        seen.add(el);
        queue.push(el);
      }
    });

    /* build lenses incrementally so page load never janks */
    var ro = ("ResizeObserver" in window)
      ? new ResizeObserver(function () {
          if (ro.timer) clearTimeout(ro.timer);
          ro.timer = setTimeout(function () {
            records.forEach(updateLens);
          }, 150);
        })
      : null;

    (function step() {
      var el = queue.shift();
      if (!el) return;
      var rec = attachLens(el);
      if (rec) {
        records.push(rec);
        if (ro) ro.observe(el);
      }
      if (queue.length) {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(step, { timeout: 120 });
        } else {
          setTimeout(step, 16);
        }
      }
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
