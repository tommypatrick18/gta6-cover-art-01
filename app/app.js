// Vice Heat — Cover Studio: turns your own photos into GTA-style cover art.
// One canvas renderer draws the poster at any size, so the live preview and the
// exported PNG are the same drawing. Photos never leave the machine.
"use strict";

const $ = (id) => document.getElementById(id);
const canvas = $("poster");
const ctx = canvas.getContext("2d");

// ---------------------------------------------------------------- state
const TAGLINES = {
  1: "SMALL TIME, BIG DREAMS",
  2: "THE HEAT IS ON",
  3: "GOLDEN HOUR, DARK DEEDS",
  4: "THE CITY NEVER SLEEPS",
  5: "MOST WANTED",
};
const LEVEL_WORDS = {
  1: "SMALL TIME",
  2: "WARMING UP",
  3: "HEATING UP",
  4: "RED HOT",
  5: "MOST WANTED",
};
const PANEL_COUNTS = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 };

const GRADES = [
  { id: "sunset", name: "VICE SUNSET", sky: ["#2b1055", "#ff7e3d"], tint: "#ff5e3a", tintAlpha: 0.16,
    title: ["#fff3b0", "#ffd23f", "#ff7e3d", "#ff5e8a", "#ffd23f"], tagline: "#ff6ec7", frame: "#f5b942" },
  { id: "neon", name: "NEON NIGHTS", sky: ["#12082b", "#b5179e"], tint: "#7b2ff7", tintAlpha: 0.20,
    title: ["#c77dff", "#9d4edd", "#00f5d4", "#7b2ff7", "#e0aaff"], tagline: "#00f5d4", frame: "#00f5d4" },
  { id: "golden", name: "GOLDEN HOUR", sky: ["#3d1e00", "#ffb347"], tint: "#ff9f1c", tintAlpha: 0.14,
    title: ["#fff8e1", "#ffd23f", "#ff9f1c", "#fff3b0", "#ffe08a"], tagline: "#fff3b0", frame: "#ffd23f" },
  { id: "noir", name: "PALM NOIR", sky: ["#04121a", "#0f5132"], tint: "#0aff9d", tintAlpha: 0.12,
    title: ["#e8fff4", "#9df5d0", "#0aff9d", "#5ec8a0", "#d8ffe9"], tagline: "#7dffd4", frame: "#0aff9d" },
  { id: "heatwave", name: "HEATWAVE PINK", sky: ["#2d0a2e", "#ff2e88"], tint: "#ff2e88", tintAlpha: 0.18,
    title: ["#ffe3f1", "#ff5e8a", "#ff2e88", "#ff9f1c", "#ffd319"], tagline: "#ffd319", frame: "#ff2e88" },
  { id: "daylight", name: "PALM DAYLIGHT", sky: ["#f7e8c9", "#ffd9a0"], tint: "#fff2cc", tintAlpha: 0.10,
    title: ["#5b2a86", "#8e44ad", "#ff7e3d", "#d6336c", "#5b2a86"], tagline: "#d6336c", frame: "#8e44ad" },
];

// Role, place, time and boast defaults, written for the seven sample photos:
// one photo per panel, so no face repeats. Every panel gets its own
// micro-story: PLACE · TIME · BOAST.
const PANEL_DEFAULTS = [
  { role: "THE GETAWAY", place: "OCEAN BOULEVARD", time: "6:47 PM", boast: "DRIVES INTO THE SUNSET" },
  { role: "THE OLD SALT", place: "NORTH PIER", time: "9:12 AM", boast: "NEVER MISSES A CATCH" },
  { role: "THE TIDE RIDER", place: "SUNSET BEACH", time: "6:15 PM", boast: "RIDES EVERY WAVE" },
  { role: "THE COMMODORE", place: "MARINA BAY", time: "8:05 PM", boast: "OWNS EVERY BERTH" },
  { role: "THE NIGHT RUNNER", place: "NEON ROW", time: "11:20 PM", boast: "KNOWS EVERY ALLEY" },
  { role: "THE SKYLINE", place: "ROOFTOP 9", time: "9:40 PM", boast: "ABOVE IT ALL" },
  { role: "THE WHEELMAN", place: "CRUISE MILE", time: "7:30 PM", boast: "NEVER STOPS FOR RED" },
];

const state = {
  wanted: 5,
  gradeId: "sunset",
  size: "1920x1080",
  title: "VICE HEAT",
  tagline: TAGLINES[5],
  taglineEdited: false,
  quote: "THE COAST HAS NEVER LOOKED THIS GOOD",
  quoteBy: "THE VICE HERALD",
  studio: "A VICE HEAT PICTURES PRODUCTION",
  vol: "VOL. 1",
  comingSoon: true,
  seal: true,
  photos: [], // { id, name, img, fx, fy }
  panels: [], // { photoId, role, place, time, boast, zoom, ox, oy }
  selectedPanel: 0,
  selectedPhoto: -1,
  layout: null, // panel rects from the last render, for hit-testing
};

let photoSeq = 0;

// ---------------------------------------------------------------- fonts
const fontsReady = Promise.all([
  document.fonts.load('40px "Anton"'),
  document.fonts.load('40px "Yellowtail"'),
]).catch(() => {});

// ---------------------------------------------------------------- face finder
// Face-aware crop, no model and no network: skin-tone pixels cluster on a
// coarse grid, and the densest cluster's centroid is the face point.
function findFacePoint(img) {
  const S = 48;
  const off = document.createElement("canvas");
  off.width = S; off.height = S;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0, S, S);
  const d = octx.getImageData(0, 0, S, S).data;
  const G = 12, cell = S / G;
  const counts = new Float32Array(G * G);
  const sumX = new Float32Array(G * G);
  const sumY = new Float32Array(G * G);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const skin = r > 90 && g > 40 && b > 20 && r > g && g >= b && (r - g) > 12 && (r - b) > 25 && r < 250;
      if (!skin) continue;
      const gx = Math.min(G - 1, (px / cell) | 0);
      const gy = Math.min(G - 1, (py / cell) | 0);
      const k = gy * G + gx;
      counts[k]++; sumX[k] += px; sumY[k] += py;
    }
  }
  let best = -1, bestScore = 0;
  // Faces sit in the upper part of a photo; arms and legs below them are
  // skin too, so only the top two thirds of the frame can win.
  for (let k = 0; k < G * G; k++) {
    const gy = (k / G) | 0;
    if (gy >= 8) continue;
    const score = counts[k] * (1.25 - gy / G);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  if (best < 0 || bestScore < 4) return { fx: 0.5, fy: 0.38 };
  const bx = best % G, by = (best / G) | 0;
  let sx = 0, sy = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = bx + dx, gy = by + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const k = gy * G + gx;
      sx += sumX[k]; sy += sumY[k]; n += counts[k];
    }
  }
  if (!n) return { fx: 0.5, fy: 0.38 };
  const clamp = (v) => Math.min(0.85, Math.max(0.15, v));
  return { fx: clamp(sx / n / S), fy: clamp(sy / n / S) };
}

function addPhoto(img, name) {
  const face = findFacePoint(img);
  const photo = { id: ++photoSeq, name, img, fx: face.fx, fy: face.fy };
  state.photos.push(photo);
  return photo;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Face points for the shipped samples, measured from the photos themselves:
// the skin-cluster finder drifts on tall portraits (it pulls toward neck
// and shoulders), so the samples carry their own face point. User photos
// still go through findFacePoint in addPhoto.
const SAMPLE_FACES = {
  boulevard: { fx: 0.42, fy: 0.16 },
  pier: { fx: 0.50, fy: 0.30 },
  beach: { fx: 0.50, fy: 0.50 },
  marina: { fx: 0.55, fy: 0.34 },
  street: { fx: 0.50, fy: 0.49 },
  rooftop: { fx: 0.50, fy: 0.50 },
  car: { fx: 0.52, fy: 0.34 },
};

async function loadSamples() {
  const names = ["boulevard", "pier", "beach", "marina", "street", "rooftop", "car"];
  for (const name of names) {
    if (state.photos.some((p) => p.name === name)) continue;
    try {
      const img = await loadImage(`samples/${name}.jpg`);
      const photo = addPhoto(img, name);
      const known = SAMPLE_FACES[name];
      if (known) { photo.fx = known.fx; photo.fy = known.fy; }
    } catch (e) { /* sample missing: keep going */ }
  }
  rebuildPanels();
  renderAll();
}

// ---------------------------------------------------------------- panels
function panelCount() {
  return PANEL_COUNTS[state.wanted] || 5;
}

function rebuildPanels() {
  const count = panelCount();
  const kept = state.panels.slice(0, count);
  while (kept.length < count) {
    const idx = kept.length;
    const def = PANEL_DEFAULTS[idx % PANEL_DEFAULTS.length];
    const photo = state.photos.length
      ? state.photos[idx % state.photos.length]
      : null;
    kept.push({
      photoId: photo ? photo.id : -1,
      role: def.role, place: def.place, time: def.time, boast: def.boast,
      zoom: idx === 0 ? 1.12 : 1.0, ox: 0, oy: 0,
    });
  }
  state.panels = kept;
  if (state.selectedPanel >= count) state.selectedPanel = 0;
}

function grade() {
  return GRADES.find((g) => g.id === state.gradeId) || GRADES[0];
}

// Heat scales the grade: more stars, hotter tint and a bigger title.
function heatAlpha() {
  const g = grade();
  return Math.min(0.34, g.tintAlpha + 0.035 * (state.wanted - 1));
}
function titleScale() {
  return 1 + 0.05 * (state.wanted - 1);
}

// ---------------------------------------------------------------- layout
function computeLayout(W, H, count) {
  const m = Math.round(W * 0.018);
  const gap = Math.max(4, Math.round(W * 0.006));
  const topH = Math.round(H * 0.075);
  const titleH = Math.round(H * 0.10);
  const footH = Math.round(H * 0.085);
  const panelsY = m + topH + gap;
  const panelsH = H - m * 2 - topH - titleH - footH - gap * 3;
  const panelsX = m;
  const panelsW = W - m * 2;
  const rects = [];
  const portrait = H > W;
  if (portrait) {
    const heroH = Math.round(panelsH * 0.44);
    rects.push({ x: panelsX, y: panelsY, w: panelsW, h: heroH, hero: true });
    const rest = count - 1;
    const cols = 2;
    const rows = Math.ceil(rest / cols);
    const cw = (panelsW - gap * (cols - 1)) / cols;
    const ch = (panelsH - heroH - gap - gap * (rows - 1)) / rows;
    for (let i = 0; i < rest; i++) {
      const cx = panelsX + (i % cols) * (cw + gap);
      const cy = panelsY + heroH + gap + Math.floor(i / cols) * (ch + gap);
      rects.push({ x: cx, y: cy, w: cw, h: ch, hero: false });
    }
  } else {
    const heroW = Math.round(panelsW * 0.44);
    rects.push({ x: panelsX, y: panelsY, w: heroW, h: panelsH, hero: true });
    const rest = count - 1;
    const cols = 2;
    const rows = Math.ceil(rest / cols);
    const rx = panelsX + heroW + gap;
    const rw = panelsW - heroW - gap;
    const cw = (rw - gap * (cols - 1)) / cols;
    const ch = (panelsH - gap * (rows - 1)) / rows;
    for (let i = 0; i < rest; i++) {
      const cx = rx + (i % cols) * (cw + gap);
      const cy = panelsY + Math.floor(i / cols) * (ch + gap);
      rects.push({ x: cx, y: cy, w: cw, h: ch, hero: false });
    }
  }
  return {
    m, gap, topH, titleH, footH,
    panelsY, panelsH,
    titleY: panelsY + panelsH + gap,
    footY: panelsY + panelsH + gap + titleH + gap,
    rects,
  };
}

// ---------------------------------------------------------------- drawing
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function fitFont(c, text, fontFamily, maxW, startSize) {
  let size = startSize;
  for (let i = 0; i < 6; i++) {
    c.font = `${size}px "${fontFamily}"`;
    if (c.measureText(text).width <= maxW || size <= 10) break;
    size = Math.floor(size * (maxW / c.measureText(text).width) * 0.96);
  }
  return size;
}

function stripeGradient(c, x0, y0, x1, y1, colors) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    g.addColorStop(i / n, colors[i]);
    g.addColorStop((i + 1) / n, colors[i]);
  }
  return g;
}

// Hex colour to rgba(), for the warm glow in the title band.
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawCoverPhoto(c, photo, rect, panel) {
  const img = photo.img;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
  const dw = iw * scale, dh = ih * scale;
  let dx = rect.x + rect.w / 2 - photo.fx * dw + panel.ox;
  let dy = rect.y + rect.h / 2 - photo.fy * dh + panel.oy;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - dw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - dh, dy));
  c.save();
  roundRectPath(c, rect.x, rect.y, rect.w, rect.h, Math.max(3, rect.w * 0.008));
  c.clip();
  c.drawImage(img, dx, dy, dw, dh);
  // Grade tint over the photo, hotter with more wanted stars.
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = heatAlpha();
  c.fillStyle = grade().tint;
  c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.restore();
}

function drawPanelChrome(c, rect, panel, index) {
  const r = Math.max(3, rect.w * 0.008);
  c.save();
  roundRectPath(c, rect.x, rect.y, rect.w, rect.h, r);
  c.strokeStyle = "rgba(255,255,255,0.85)";
  c.lineWidth = Math.max(2, rect.w * 0.006);
  c.stroke();
  c.restore();
  if (index === state.selectedPanel && !document.body.classList.contains("shot-cover")) {
    c.save();
    roundRectPath(c, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, r + 3);
    c.strokeStyle = "#f5b942";
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  }
  // Role tag chip + micro-story line, bottom-left inside the panel.
  const pad = Math.max(6, rect.w * 0.03);
  const roleSize = Math.max(11, Math.round(rect.w * 0.052));
  c.font = `${roleSize}px "Anton"`;
  const roleW = c.measureText(panel.role).width;
  const chipH = roleSize * 1.7;
  const chipY = rect.y + rect.h - pad - chipH - Math.max(10, rect.w * 0.045) - 4;
  c.fillStyle = "rgba(10,6,18,0.88)";
  roundRectPath(c, rect.x + pad, chipY, roleW + pad * 1.4, chipH, 3);
  c.fill();
  c.fillStyle = "#ffd97a";
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillText(panel.role, rect.x + pad * 1.7, chipY + chipH / 2 + 1);
  const storySize = Math.max(9, Math.round(rect.w * 0.032));
  c.font = `700 ${storySize}px system-ui, sans-serif`;
  c.fillStyle = "#ffffff";
  c.shadowColor = "rgba(0,0,0,0.9)";
  c.shadowBlur = 4;
  const story = `${panel.place} · ${panel.time} · ${panel.boast}`;
  c.fillText(story, rect.x + pad, rect.y + rect.h - pad - storySize * 0.4, rect.w - pad * 2);
  c.shadowBlur = 0;
}

function drawStars(c, x, y, size, filled) {
  c.save();
  c.font = `${size}px system-ui, sans-serif`;
  c.textBaseline = "middle";
  c.textAlign = "left";
  for (let i = 0; i < 5; i++) {
    const on = i < filled;
    c.fillStyle = on ? "#ff5a3c" : "#4a3f5e";
    if (on) { c.shadowColor = "rgba(255,90,60,0.9)"; c.shadowBlur = size * 0.5; }
    c.fillText("★", x + i * size * 1.15, y);
    c.shadowBlur = 0;
  }
  c.restore();
}

function drawBarcode(c, x, y, w, h) {
  // Seeded bars from the title, so the same poster always draws the same code.
  let seed = 0;
  for (const ch of state.title) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  c.fillStyle = "#ffffff";
  c.fillRect(x - 4, y - 4, w + 8, h + 18);
  c.fillStyle = "#111111";
  let bx = x;
  while (bx < x + w - 3) {
    const bw = 1 + Math.floor(rnd() * 4);
    if (rnd() > 0.45) c.fillRect(bx, y, bw, h);
    bx += bw + 1 + Math.floor(rnd() * 3);
  }
  c.fillStyle = "#111111";
  c.font = `${Math.max(9, Math.round(h * 0.22))}px system-ui, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "top";
  c.fillText("8 20261 11730 5", x + w / 2, y + h + 3);
}

function drawSeal(c, cx, cy, r) {
  c.save();
  c.translate(cx, cy);
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = "#f5b942"; c.fill();
  c.lineWidth = Math.max(2, r * 0.07);
  c.strokeStyle = "#8a5a12"; c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "#3a2404";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.font = `${Math.round(r * 0.34)}px "Anton"`;
  c.fillText("ORIGINAL", 0, -r * 0.28);
  c.fillText("COVER", 0, r * 0.08);
  c.fillText("ART", 0, r * 0.42);
  c.restore();
}

function renderPoster(c, W, H) {
  const g = grade();
  const count = panelCount();
  const L = computeLayout(W, H, count);
  state.layout = { rects: L.rects, W, H };

  // Backdrop: grade sky + vignette.
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, g.sky[0]);
  sky.addColorStop(1, g.sky[1]);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  const vg = c.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);

  // Frame.
  c.strokeStyle = g.frame;
  c.lineWidth = Math.max(3, W * 0.004);
  c.strokeRect(L.m / 2, L.m / 2, W - L.m, H - L.m);

  // Top strip: wanted stars, quote, volume badge. The quote shrinks to fit
  // the space between the stars and the badge, never under either.
  const topY = L.m + L.topH / 2;
  const starSize = Math.round(L.topH * 0.52);
  drawStars(c, L.m + 6, topY, starSize, state.wanted);
  const starsW = 5 * starSize * 1.15 + 12;
  let volSize = Math.max(11, Math.round(L.topH * 0.32));
  c.font = `${volSize}px "Anton"`;
  const volW = c.measureText(state.vol).width + 18;
  const quoteAvail = W - L.m * 2 - starsW - volW - 24;
  const quoteCx = L.m + starsW + quoteAvail / 2;
  let quoteSize = Math.max(11, Math.round(L.topH * 0.30));
  const quoteText = `“${state.quote}” — ${state.quoteBy}`;
  for (let i = 0; i < 8; i++) {
    c.font = `700 ${quoteSize}px system-ui, sans-serif`;
    if (c.measureText(quoteText).width <= quoteAvail || quoteSize <= 9) break;
    quoteSize = Math.max(9, Math.floor(quoteSize * 0.92));
  }
  c.fillStyle = "#ffffff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(quoteText, quoteCx, topY);
  c.font = `${volSize}px "Anton"`;
  c.strokeStyle = "#f5b942";
  c.lineWidth = 2;
  c.strokeRect(W - L.m - volW - 4, L.m + 6, volW, L.topH - 12);
  c.fillStyle = "#f5b942";
  c.fillText(state.vol, W - L.m - volW / 2 - 4, topY);

  // Panels: small ones first, hero last so it pops out over its neighbours.
  const order = L.rects.map((r, i) => i).sort((a, b) => (L.rects[a].hero ? 1 : 0) - (L.rects[b].hero ? 1 : 0));
  for (const i of order) {
    const rect = L.rects[i];
    const panel = state.panels[i];
    if (!panel) continue;
    const photo = state.photos.find((p) => p.id === panel.photoId) || state.photos[0];
    let drawRect = rect;
    if (rect.hero) {
      // Hero pop-out: slightly larger than its cell, overlapping neighbours.
      const ov = Math.max(4, Math.round(W * 0.008));
      drawRect = { x: rect.x - ov, y: rect.y - ov, w: rect.w + ov * 2, h: rect.h + ov * 2, hero: true };
      c.save();
      c.shadowColor = "rgba(0,0,0,0.55)";
      c.shadowBlur = ov * 3;
      c.shadowOffsetY = ov;
      roundRectPath(c, drawRect.x, drawRect.y, drawRect.w, drawRect.h, 6);
      c.fillStyle = "#ffffff";
      c.fill();
      c.restore();
    }
    if (photo) drawCoverPhoto(c, photo, drawRect, panel);
    else {
      c.fillStyle = "#241a33";
      roundRectPath(c, drawRect.x, drawRect.y, drawRect.w, drawRect.h, 6);
      c.fill();
    }
    drawPanelChrome(c, drawRect, panel, i);
  }

  // Title band: its own band, never over a face.
  const bandY = L.titleY;
  const bandGrad = c.createLinearGradient(0, bandY, 0, bandY + L.titleH);
  bandGrad.addColorStop(0, "rgba(8,4,16,0.92)");
  bandGrad.addColorStop(1, "rgba(30,10,40,0.92)");
  c.fillStyle = bandGrad;
  c.fillRect(L.m, bandY, W - L.m * 2, L.titleH);
  // Warm glow behind the title, in the grade's tint, so the shorter band
  // reads as sunset, not as an empty dark slab.
  const glow = c.createRadialGradient(W / 2, bandY + L.titleH * 0.42, 0, W / 2, bandY + L.titleH * 0.42, W * 0.34);
  glow.addColorStop(0, hexA(g.tint, 0.22));
  glow.addColorStop(1, hexA(g.tint, 0));
  c.fillStyle = glow;
  c.fillRect(L.m, bandY, W - L.m * 2, L.titleH);
  c.strokeStyle = "rgba(245,185,66,0.7)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(L.m, bandY); c.lineTo(W - L.m, bandY);
  c.moveTo(L.m, bandY + L.titleH); c.lineTo(W - L.m, bandY + L.titleH);
  c.stroke();

  const titleMaxW = W - L.m * 2 - 40;
  const titleSize = fitFont(c, state.title, "Anton", titleMaxW, Math.round(L.titleH * 0.62) * titleScale());
  c.font = `${titleSize}px "Anton"`;
  const tracking = Math.max(1, titleSize * 0.08);
  if ("letterSpacing" in c) c.letterSpacing = `${tracking}px`;
  const titleY = bandY + L.titleH * 0.36;
  const grad = stripeGradient(c, 0, titleY - titleSize * 0.55, 0, titleY + titleSize * 0.45, g.title);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = Math.max(3, titleSize * 0.07);
  c.strokeStyle = "#1a0a12";
  c.strokeText(state.title, W / 2, titleY);
  c.fillStyle = grad;
  c.fillText(state.title, W / 2, titleY);
  // Gold stars flank the title so the band reads full, not empty: three on
  // each side, measured from the title's own width including its tracking.
  const titleW = c.measureText(state.title).width + tracking * (state.title.length - 1);
  const flankSize = Math.round(titleSize * 0.30);
  const flankGap = Math.round(titleSize * 0.35);
  c.font = `${flankSize}px system-ui, sans-serif`;
  c.fillStyle = g.frame;
  c.shadowColor = "rgba(245,185,66,0.8)";
  c.shadowBlur = Math.max(6, flankSize * 0.4);
  c.textAlign = "right";
  for (let i = 0; i < 3; i++) {
    c.fillText("★", W / 2 - titleW / 2 - flankGap - i * flankSize * 1.25, titleY);
  }
  c.textAlign = "left";
  for (let i = 0; i < 3; i++) {
    c.fillText("★", W / 2 + titleW / 2 + flankGap + i * flankSize * 1.25, titleY);
  }
  c.shadowBlur = 0;
  if ("letterSpacing" in c) c.letterSpacing = "0px";

  // Neon script tagline and the wanted chip share one row under the title,
  // centred as a group, so the shorter band stays full: the chip still
  // names the wanted level, in words.
  const chipText = `WANTED LEVEL ${state.wanted} — ${LEVEL_WORDS[state.wanted]}`;
  const chipH = Math.max(12, Math.round(L.titleH * 0.17));
  const chipFont = Math.max(10, Math.round(chipH * 0.62));
  c.font = `700 ${chipFont}px system-ui, sans-serif`;
  const chipW = c.measureText(chipText).width + 20;
  const tagSize = Math.max(14, Math.round(L.titleH * 0.21));
  c.font = `${tagSize}px "Yellowtail"`;
  const tagW = c.measureText(state.tagline).width;
  const rowGap = Math.max(12, Math.round(L.titleH * 0.14));
  const rowW = tagW + rowGap + chipW;
  const rowY = bandY + L.titleH * 0.80;
  const rowX = W / 2 - rowW / 2;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillStyle = g.tagline;
  c.shadowColor = g.tagline;
  c.shadowBlur = Math.max(8, tagSize * 0.5);
  c.fillText(state.tagline, rowX, rowY);
  c.shadowBlur = 0;
  c.fillStyle = "rgba(255,90,60,0.9)";
  roundRectPath(c, rowX + tagW + rowGap, rowY - chipH / 2, chipW, chipH, 3);
  c.fill();
  c.font = `700 ${chipFont}px system-ui, sans-serif`;
  c.fillStyle = "#ffffff";
  c.textAlign = "center";
  c.fillText(chipText, rowX + tagW + rowGap + chipW / 2, rowY + 1);

  // Footer: COMING SOON, billing block, barcode, gold seal. The billing
  // lines shrink to fit the space between COMING SOON and the seal/barcode.
  const footY = L.footY;
  const barW = Math.round(W * 0.075);
  const barH = Math.round(L.footH * 0.52);
  const barX = W - L.m - barW - 4;
  const sealR = Math.round(L.footH * 0.62);
  const sealCx = state.seal ? barX - sealR - 14 : barX - 10;
  const rightEdge = state.seal ? sealCx - sealR - 12 : barX - 12;
  c.textAlign = "left";
  c.textBaseline = "middle";
  let csW = 0;
  if (state.comingSoon) {
    const csSize = Math.max(12, Math.round(L.footH * 0.34));
    c.font = `${csSize}px "Anton"`;
    if ("letterSpacing" in c) c.letterSpacing = `${Math.max(1, csSize * 0.12)}px`;
    csW = c.measureText("COMING SOON").width;
    c.fillStyle = "#ffd97a";
    c.fillText("COMING SOON", L.m + 4, footY + L.footH / 2);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
  }
  const billLeft = L.m + 4 + csW + 18;
  const billAvail = Math.max(60, rightEdge - billLeft);
  const billCx = billLeft + billAvail / 2;
  const billLine1 = state.studio;
  const billLine2 = "STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND";
  let billSize = Math.max(9, Math.round(L.footH * 0.16));
  for (let i = 0; i < 8; i++) {
    c.font = `700 ${billSize}px system-ui, sans-serif`;
    const w1 = c.measureText(billLine1).width;
    const w2 = c.measureText(billLine2).width;
    if (Math.max(w1, w2) <= billAvail || billSize <= 8) break;
    billSize = Math.max(8, Math.floor(billSize * 0.92));
  }
  c.textAlign = "center";
  c.fillStyle = "rgba(255,255,255,0.85)";
  c.fillText(billLine1, billCx, footY + L.footH * 0.34);
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.fillText(billLine2, billCx, footY + L.footH * 0.68);
  drawBarcode(c, barX, footY + L.footH * 0.12, barW, barH);
  if (state.seal) {
    drawSeal(c, sealCx, footY + L.footH / 2, sealR);
  }
}

function renderPreview() {
  const [w, h] = state.size.split("x").map(Number);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderPoster(ctx, w, h);
}

function renderAll() {
  renderPreview();
  renderWantedStars();
  renderGradeList();
  renderPhotoList();
  renderPanelList();
}

// ---------------------------------------------------------------- editor UI
function renderWantedStars() {
  const box = $("wantedStars");
  box.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement("span");
    s.textContent = "★";
    s.className = i <= state.wanted ? "on" : "off";
    s.addEventListener("click", () => setWanted(i));
    box.appendChild(s);
  }
  $("wantedWord").textContent = LEVEL_WORDS[state.wanted];
}

function setWanted(n) {
  state.wanted = n;
  if (!state.taglineEdited) {
    state.tagline = TAGLINES[n];
    $("taglineInput").value = state.tagline;
  }
  rebuildPanels();
  renderAll();
}

function renderGradeList() {
  const list = $("gradeList");
  list.innerHTML = "";
  for (const g of GRADES) {
    const b = document.createElement("button");
    b.className = "swatch" + (g.id === state.gradeId ? " selected" : "");
    b.innerHTML = `<span class="chip" style="display:block;background:linear-gradient(135deg, ${g.sky[0]}, ${g.sky[1]})"></span><span class="name">${g.name}</span>`;
    b.addEventListener("click", () => { state.gradeId = g.id; renderAll(); });
    list.appendChild(b);
  }
  $("gradeNote").textContent = `Heat scales with the wanted level — ${state.wanted} star${state.wanted > 1 ? "s" : ""} runs the tint hotter and the title bigger.`;
}

function renderPhotoList() {
  const list = $("photoList");
  list.innerHTML = "";
  for (const p of state.photos) {
    const img = document.createElement("img");
    img.src = p.img.src;
    img.alt = p.name;
    img.title = p.name;
    if (p.id === state.selectedPhoto) img.classList.add("selected");
    img.addEventListener("click", () => {
      state.selectedPhoto = p.id;
      const panel = state.panels[state.selectedPanel];
      if (panel) { panel.photoId = p.id; }
      renderAll();
    });
    list.appendChild(img);
  }
}

function renderPanelList() {
  const list = $("panelList");
  list.innerHTML = "";
  state.panels.forEach((panel, i) => {
    const row = document.createElement("div");
    row.className = "panel-row" + (i === state.selectedPanel ? " selected" : "");
    row.innerHTML = `<h3>Panel ${i + 1}${i === 0 ? " · HERO (pop-out)" : ""}</h3>`;
    const mkField = (label, value, key, max) => {
      const lab = document.createElement("label");
      lab.className = "field";
      lab.textContent = label;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = value;
      inp.maxLength = max;
      inp.addEventListener("input", () => { panel[key] = inp.value.toUpperCase(); renderPreview(); });
      lab.appendChild(inp);
      return lab;
    };
    const grid = document.createElement("div");
    grid.className = "grid2";
    const photoSel = document.createElement("label");
    photoSel.className = "field";
    photoSel.textContent = "Photo";
    const sel = document.createElement("select");
    for (const p of state.photos) {
      const opt = document.createElement("option");
      opt.value = String(p.id);
      opt.textContent = p.name;
      if (p.id === panel.photoId) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => { panel.photoId = Number(sel.value); renderAll(); });
    photoSel.appendChild(sel);
    grid.appendChild(photoSel);
    grid.appendChild(mkField("Role", panel.role, "role", 18));
    grid.appendChild(mkField("Place", panel.place, "place", 24));
    grid.appendChild(mkField("Time", panel.time, "time", 12));
    grid.appendChild(mkField("Boast", panel.boast, "boast", 28));
    const zoomLab = document.createElement("label");
    zoomLab.className = "field";
    zoomLab.textContent = `Zoom ${panel.zoom.toFixed(2)}×`;
    const zoom = document.createElement("input");
    zoom.type = "range"; zoom.min = "1"; zoom.max = "2.2"; zoom.step = "0.05";
    zoom.value = String(panel.zoom);
    zoom.addEventListener("input", () => {
      panel.zoom = Number(zoom.value);
      zoomLab.firstChild.textContent = `Zoom ${panel.zoom.toFixed(2)}×`;
      renderPreview();
    });
    zoomLab.appendChild(zoom);
    grid.appendChild(zoomLab);
    const faceBtn = document.createElement("button");
    faceBtn.className = "btn";
    faceBtn.textContent = "Find face";
    faceBtn.addEventListener("click", () => {
      const photo = state.photos.find((p) => p.id === panel.photoId);
      if (photo) {
        const f = findFacePoint(photo.img);
        photo.fx = f.fx; photo.fy = f.fy;
        panel.ox = 0; panel.oy = 0;
        renderPreview();
      }
    });
    grid.appendChild(faceBtn);
    row.appendChild(grid);
    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
      state.selectedPanel = i;
      renderPanelList();
      renderPreview();
    });
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------- export
function exportCoverPng() {
  const [w, h] = state.size.split("x").map(Number);
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  renderPoster(off.getContext("2d"), w, h);
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vice-heat-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}

// ---------------------------------------------------------------- canvas interaction
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
function panelAt(x, y) {
  if (!state.layout) return -1;
  const rects = state.layout.rects;
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i < 0) return;
  state.selectedPanel = i;
  renderPanelList();
  renderPreview();
  const panel = state.panels[i];
  drag = { i, x: p.x, y: p.y, ox: panel.ox, oy: panel.oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[drag.i];
  panel.ox = drag.ox + (p.x - drag.x);
  panel.oy = drag.oy + (p.y - drag.y);
  renderPreview();
});
canvas.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i < 0) return;
  const panel = state.panels[i];
  panel.zoom = Math.min(2.2, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  state.selectedPanel = i;
  renderPanelList();
  renderPreview();
}, { passive: false });

// ---------------------------------------------------------------- wiring
$("fileInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      addPhoto(img, f.name.replace(/\.[^.]+$/, "").slice(0, 24) || "photo");
    } catch (err) { /* unreadable file: skip */ }
  }
  rebuildPanels();
  renderAll();
  e.target.value = "";
});
$("samplesBtn").addEventListener("click", loadSamples);
$("titleInput").addEventListener("input", (e) => { state.title = e.target.value.toUpperCase() || "VICE HEAT"; renderPreview(); });
$("taglineInput").addEventListener("input", (e) => { state.tagline = e.target.value.toUpperCase(); state.taglineEdited = true; renderPreview(); });
$("quoteInput").addEventListener("input", (e) => { state.quote = e.target.value.toUpperCase(); renderPreview(); });
$("quoteByInput").addEventListener("input", (e) => { state.quoteBy = e.target.value.toUpperCase(); renderPreview(); });
$("studioInput").addEventListener("input", (e) => { state.studio = e.target.value.toUpperCase(); renderPreview(); });
$("volInput").addEventListener("input", (e) => { state.vol = e.target.value.toUpperCase(); renderPreview(); });
$("comingSoonInput").addEventListener("change", (e) => { state.comingSoon = e.target.checked; renderPreview(); });
$("sealInput").addEventListener("change", (e) => { state.seal = e.target.checked; renderPreview(); });
$("exportBtn").addEventListener("click", exportCoverPng);
document.querySelectorAll(".size-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".size-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.size = b.dataset.size;
    renderPreview();
  });
});

// ---------------------------------------------------------------- boot
async function boot() {
  const q = new URLSearchParams(location.search);
  const shot = q.get("shot");
  const caption = q.get("caption");
  const stars = Number(q.get("stars") || "0");
  const size = q.get("size");
  const photo = q.get("photo");
  if (caption) {
    state.title = caption.toUpperCase().slice(0, 24);
    $("titleInput").value = state.title;
  }
  if (stars >= 1 && stars <= 5) state.wanted = stars;
  if (size && /^\d+x\d+$/.test(size)) state.size = size;
  if (q.get("grade")) state.gradeId = q.get("grade");
  if (q.get("tagline")) {
    state.tagline = q.get("tagline").toUpperCase();
    state.taglineEdited = true;
    $("taglineInput").value = state.tagline;
  }
  if (shot === "cover") document.body.classList.add("shot-cover");
  // Demo photos for screenshots and first use.
  if (photo === "boulevard" || photo === "pier") {
    try {
      const img = await loadImage(`samples/${photo}.jpg`);
      addPhoto(img, photo);
    } catch (e) { await loadSamples(); }
  } else {
    await loadSamples();
  }
  if (!state.taglineEdited) state.tagline = TAGLINES[state.wanted];
  rebuildPanels();
  await fontsReady;
  renderAll();
  document.body.dataset.ready = "1";
}

boot();
