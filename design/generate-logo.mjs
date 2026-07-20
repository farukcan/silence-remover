#!/usr/bin/env node
/**
 * Generative brand mark for Silence Remover by Puhulab.
 *
 * Concept: a tight waveform with a bright "cut" through the quiet gap —
 * silence removed, speech kept.
 *
 * Usage:
 *   node design/generate-logo.mjs
 *   node design/generate-logo.mjs --seed 42
 *
 * Writes:
 *   design/out/{logo,icon,favicon}.svg
 *   apps/web/public/brand/{logo,icon,favicon}.svg
 *   apps/web/src/app/icon.svg
 */

import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(__dirname, "out");
const PUBLIC = join(ROOT, "apps/web/public/brand");
const APP_ICON = join(ROOT, "apps/web/src/app/icon.svg");

const COLORS = {
  ink: "#0b1110",
  panel: "#17211e",
  accent: "#d6ff4b",
  accent2: "#7dffc3",
  mute: "#3a4a44",
};

function parseSeed(argv) {
  const i = argv.indexOf("--seed");
  if (i >= 0 && argv[i + 1]) return Number(argv[i + 1]) || 20260720;
  return 20260720;
}

/** Mulberry32 — tiny seeded PRNG for reproducible generative marks. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Build bar heights: speech clusters with a silent valley in the middle
 * (the gap we "cut" out of the mark).
 */
function generateBars(rand, count = 13) {
  const mid = (count - 1) / 2;
  const bars = [];
  for (let i = 0; i < count; i++) {
    const dist = Math.abs(i - mid) / mid;
    const speech = dist > 0.22 ? 0.55 + rand() * 0.45 : 0.08 + rand() * 0.12;
    const wobble = 0.85 + rand() * 0.3;
    bars.push(clamp(speech * wobble, 0.06, 1));
  }
  return bars;
}

function round(n, d = 2) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function barsToPath(bars, { x, y, w, h, gap = 0.28 }) {
  const n = bars.length;
  const slot = w / n;
  const barW = slot * (1 - gap);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const bh = bars[i] * h;
    const bx = x + i * slot + (slot - barW) / 2;
    const by = y + (h - bh) / 2;
    const r = Math.min(barW / 2, 2.2);
    parts.push(roundRectPath(bx, by, barW, bh, r));
  }
  return parts.join(" ");
}

function roundRectPath(x, y, w, h, r) {
  x = round(x);
  y = round(y);
  w = round(w);
  h = round(h);
  const rr = round(Math.min(r, w / 2, h / 2));
  return [
    `M${x + rr} ${y}`,
    `H${x + w - rr}`,
    `Q${x + w} ${y} ${x + w} ${y + rr}`,
    `V${y + h - rr}`,
    `Q${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H${x + rr}`,
    `Q${x} ${y + h} ${x} ${y + h - rr}`,
    `V${y + rr}`,
    `Q${x} ${y} ${x + rr} ${y}`,
    "Z",
  ].join(" ");
}

function cutSlashPath({ cx, cy, len, thickness }) {
  const a = (-38 * Math.PI) / 180;
  const dx = Math.cos(a) * len;
  const dy = Math.sin(a) * len;
  const nx = (-Math.sin(a) * thickness) / 2;
  const ny = (Math.cos(a) * thickness) / 2;
  const x0 = cx - dx / 2;
  const y0 = cy - dy / 2;
  const x1 = cx + dx / 2;
  const y1 = cy + dy / 2;
  const pts = [
    [x0 + nx, y0 + ny],
    [x1 + nx, y1 + ny],
    [x1 - nx, y1 - ny],
    [x0 - nx, y0 - ny],
  ].map(([px, py]) => [round(px), round(py)]);
  return [
    `M${pts[0][0]} ${pts[0][1]}`,
    `L${pts[1][0]} ${pts[1][1]}`,
    `L${pts[2][0]} ${pts[2][1]}`,
    `L${pts[3][0]} ${pts[3][1]}`,
    "Z",
  ].join(" ");
}

function renderIconSvg(bars, size = 512) {
  const pad = size * 0.14;
  const inner = size - pad * 2;
  const wave = barsToPath(bars, {
    x: pad,
    y: pad + inner * 0.12,
    w: inner,
    h: inner * 0.76,
    gap: 0.3,
  });
  const cut = cutSlashPath({
    cx: size / 2,
    cy: size / 2,
    len: size * 0.72,
    thickness: size * 0.07,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Silence Remover">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.panel}"/>
      <stop offset="100%" stop-color="${COLORS.ink}"/>
    </linearGradient>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.accent}"/>
      <stop offset="100%" stop-color="${COLORS.accent2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <path d="${wave}" fill="url(#a)"/>
  <path d="${cut}" fill="${COLORS.ink}" opacity="0.92"/>
  <path d="${cut}" fill="none" stroke="${COLORS.accent}" stroke-width="${size * 0.018}" opacity="0.55"/>
</svg>
`;
}

function renderLogoSvg(bars) {
  // Horizontal lockup: mark + wordmark for header use.
  const mark = 128;
  const w = 720;
  const h = 160;
  const pad = 16;
  const wave = barsToPath(bars, {
    x: pad + 14,
    y: pad + 18,
    w: mark - 44,
    h: mark - 52,
    gap: 0.3,
  });
  const cut = cutSlashPath({
    cx: pad + mark / 2,
    cy: h / 2,
    len: mark * 0.7,
    thickness: mark * 0.07,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Silence Remover by Puhulab">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.panel}"/>
      <stop offset="100%" stop-color="${COLORS.ink}"/>
    </linearGradient>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.accent}"/>
      <stop offset="100%" stop-color="${COLORS.accent2}"/>
    </linearGradient>
  </defs>
  <rect x="${pad}" y="${(h - mark) / 2}" width="${mark}" height="${mark}" rx="28" fill="url(#g)"/>
  <path d="${wave}" fill="url(#a)"/>
  <path d="${cut}" fill="${COLORS.ink}" opacity="0.92"/>
  <g fill="#eef3ea" font-family="Archivo Black, Arial Black, sans-serif">
    <text x="${pad + mark + 28}" y="78" font-size="44" letter-spacing="-1.2">Silence Remover</text>
    <text x="${pad + mark + 28}" y="118" font-size="20" fill="#9aaca2" letter-spacing="2" font-family="Figtree, Arial, sans-serif">BY PUHULAB</text>
  </g>
</svg>
`;
}

function writeAll(files) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(PUBLIC, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const outPath = join(OUT, name);
    writeFileSync(outPath, content, "utf8");
    copyFileSync(outPath, join(PUBLIC, name));
    console.log("wrote", outPath);
  }
  copyFileSync(join(OUT, "icon.svg"), APP_ICON);
  console.log("wrote", APP_ICON);
}

const seed = parseSeed(process.argv);
const rand = mulberry32(seed);
const bars = generateBars(rand);

writeAll({
  "icon.svg": renderIconSvg(bars),
  "favicon.svg": renderIconSvg(bars, 64),
  "logo.svg": renderLogoSvg(bars),
});

writeFileSync(
  join(OUT, "meta.json"),
  JSON.stringify(
    {
      seed,
      generatedAt: new Date().toISOString(),
      concept: "waveform-with-silence-cut",
      colors: COLORS,
      bars,
    },
    null,
    2,
  ),
);
copyFileSync(join(OUT, "meta.json"), join(PUBLIC, "meta.json"));

console.log(`\nSilence Remover mark generated (seed=${seed}).`);
