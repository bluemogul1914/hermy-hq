"use client";

import { useRef, useEffect, useMemo } from "react";
import type { Agent } from "./OfficeView";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · VirtualCity — Canvas 2D isometric city renderer
   inspired by Hermesville (MIT). Renders one landmark building per
   agent, colored by status, with walkers, cars, sky cycle, and
   pan/zoom camera. No three.js or WebGL dependencies.
   ─────────────────────────────────────────────────────────── */

export const CALM_LUXURY = {
  navy: "#0a1120",
  navyGround: "#0f172a",
  gold: "#D4AF37",
  green: "#22c55e",
  amber: "#f59e0b",
  gray: "#9ca3af",
  red: "#ef4444",
} as const;

const STATUS_COLOR: Record<string, string> = {
  working: CALM_LUXURY.green,
  online: CALM_LUXURY.green,
  active: CALM_LUXURY.green,
  idle: CALM_LUXURY.amber,
  completed: CALM_LUXURY.amber,
  offline: CALM_LUXURY.gray,
  error: CALM_LUXURY.red,
};

/** Resolve a marker color from an agent status string. */
export function statusColor(status: string | undefined): string {
  return STATUS_COLOR[status ?? "offline"] ?? CALM_LUXURY.gray;
}

export interface VirtualCityProps {
  agents: Agent[];
}

/* ── isometric constants ── */
const TW = 64;
const TH = 32;
const N = 31;
const BLK = 5;
const isRoad = (i: number, j: number) => i % BLK === 0 || j % BLK === 0;
const P = (i: number, j: number, z = 0) => [(i - j) * TW / 2, (i + j) * TH / 2 - z] as [number, number];
const up = (p: [number, number], h: number): [number, number] => [p[0], p[1] - h];

/* ── color helpers ── */
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (c1: string, c2: string, k: number) => {
  const a = hex(c1);
  const b = hex(c2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(",")})`;
};

const SKY: [number, string, string][] = [
  [0, "#070d24", "#16204a"],
  [5, "#0a1333", "#1d2a5c"],
  [6, "#2b2d63", "#8a5a86"],
  [6.6, "#4a5fa8", "#f19a6c"],
  [7.4, "#5aa0e6", "#ffd2a0"],
  [9, "#4f9be8", "#bfe3fb"],
  [16.5, "#4f9be8", "#bfe3fb"],
  [18, "#5870b8", "#f6a26a"],
  [18.8, "#2d2a60", "#b0557a"],
  [19.8, "#0c1332", "#1f2552"],
  [24, "#070d24", "#16204a"],
];

function sky(hour: number): [string, string] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, t0, b0] = SKY[i];
    const [h1, t1, b1] = SKY[i + 1];
    if (hour >= h0 && hour <= h1) {
      const k = (hour - h0) / (h1 - h0);
      return [mix(t0, t1, k), mix(b0, b1, k)];
    }
  }
  return [SKY[0][1], SKY[0][2]];
}

const darkness = (h: number) =>
  h < 6 || h > 19.5 ? 1 : h < 7 ? 1 - (h - 6) : h > 18.3 ? (h - 18.3) / 1.2 : 0;

const NIGHT_SHADE = "#141a33";
function shade(c: string, dk: number) {
  if (dk <= 0) return c;
  return mix(c, NIGHT_SHADE, Math.min(1, dk * 0.06));
}

/* ── RNG helpers ── */
function rndState(s: number) {
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function pick<T>(a: T[], r: () => number): T {
  return a[Math.floor(r() * a.length)];
}

const HOUSE_ROOFS = ["#c95b5b", "#3f9b86", "#d9a441", "#6a78d1", "#b8577f"];
const PAL = {
  tower: { body: "#56617c", side: "#434c63", roof: "#6b7792", win: "#a9c3dd" },
  glass: { body: "#3f6e8c", side: "#305670", roof: "#5a8aa8", win: "#bfe0f2" },
  brick: { body: "#9a4f3c", side: "#7a3d2e", roof: "#5e3226", win: "#e8c9a0" },
};
const CUSTOM_BLOCKS: [number, number][] = [
  [1, 3], [3, 1], [4, 2], [2, 4], [4, 3], [3, 4], [4, 1], [1, 4], [0, 2], [2, 0], [0, 3], [3, 0],
];

/* ── building data shapes ── */
interface Building {
  i: number;
  j: number;
  fw: number;
  fd: number;
  h: number;
  kind: string;
  body: string;
  side: string;
  roof: string;
  win: string;
  seed: number;
  pyramid?: boolean;
  id?: string;
  name?: string;
  status?: string;
}
interface Walker {
  i: number; j: number; ti: number; tj: number; k: number;
  sp: number; c: string; name: string;
  ox: number; oy: number; say: string; sayUntil: number; nextSay: number;
  pi: number; pj: number;
}
interface Car {
  axis: string; line: number; pos: number; dir: number; sp: number; c: string;
}

interface CityLayout {
  buildings: Building[];
  trees: [number, number][];
  lmById: Record<string, Building & { id: string; name: string; status: string }>;
  parkTile: Set<string>;
  walkers: Walker[];
  cars: Car[];
  roadTiles: [number, number][];
  LOTX: number;
  LOTY: number;
  LOT_BLOCK: [number, number];
  PLAZA_BLOCK: [number, number];
}

function buildCityLayout(agents: Agent[]): CityLayout {
  const rnd = rndState(7);
  const buildings: Building[] = [];
  const trees: [number, number][] = [];
  const lmById: Record<string, Building & { id: string; name: string; status: string }> = {};
  const parkTile = new Set<string>();
  const LOT_BLOCK: [number, number] = [3, 3];
  const PLAZA_BLOCK: [number, number] = [1, 1];
  const LOTX = LOT_BLOCK[0] * BLK + 1;
  const LOTY = LOT_BLOCK[1] * BLK + 1;

  const occupiedBlocks = new Set<string>();

  // One landmark building per agent
  agents.forEach((agent, idx) => {
    const [bi, bj] = CUSTOM_BLOCKS[idx % CUSTOM_BLOCKS.length];
    occupiedBlocks.add(`${bi},${bj}`);
    const ox = bi * BLK + 1;
    const oy = bj * BLK + 1;
    const col = statusColor(agent.status);
    const h = 90 + ((agent.id.charCodeAt(0) * 7 + agent.id.charCodeAt(agent.id.length - 1) * 3) % 60);

    const lm: Building & { id: string; name: string; status: string } = {
      i: ox, j: oy, fw: 3, fd: 3, h, kind: "lm",
      id: agent.id, name: agent.name, status: agent.status,
      body: col, side: mix(col, "#000000", 0.2),
      roof: mix(col, "#000000", 0.35), win: "#cfe3f5",
      seed: agent.id.charCodeAt(0) * 1000,
    };
    lmById[agent.id] = lm;
    buildings.push(lm);
    trees.push([ox + 3.5, oy + 0.5], [ox + 3.5, oy + 2.5], [ox + 0.5, oy + 3.5], [ox + 2.5, oy + 3.5]);
  });

  // Fill remaining blocks with random buildings
  for (let bi = 0; bi < 6; bi++) {
    for (let bj = 0; bj < 6; bj++) {
      if (occupiedBlocks.has(`${bi},${bj}`)) continue;
      if (bi === LOT_BLOCK[0] && bj === LOT_BLOCK[1]) continue;
      if (bi === PLAZA_BLOCK[0] && bj === PLAZA_BLOCK[1]) {
        const ox = bi * BLK + 1, oy = bj * BLK + 1;
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) trees.push([ox + a + 0.5, oy + b + 0.5]);
        continue;
      }
      const ox = bi * BLK + 1, oy = bj * BLK + 1;
      const central = Math.abs(bi - 2) <= 1 && Math.abs(bj - 2) <= 1;
      for (let qi = 0; qi < 2; qi++) {
        for (let qj = 0; qj < 2; qj++) {
          const i = ox + qi * 2, j = oy + qj * 2;
          const r = rnd();
          if (r < (central ? 0.36 : 0.28)) {
            const pal = rnd() < 0.35 ? PAL.glass : PAL.tower;
            buildings.push({ i, j, fw: 2, fd: 2, h: 70 + rnd() * (central ? 60 : 90), kind: "tower", ...pal, seed: 0 });
          } else if (r < 0.62) {
            buildings.push({ i, j, fw: 2, fd: 2, h: 42 + rnd() * 36, kind: "brick", ...PAL.brick, seed: 0 });
          } else if (r < 0.82) {
            const roof = pick(HOUSE_ROOFS, rnd);
            buildings.push({ i, j, fw: 1, fd: 2, h: 26 + rnd() * 10, kind: "house", body: "#e8dccb", side: "#cbbfae", roof, win: "#8fb3d1", seed: 0, pyramid: true });
            buildings.push({ i: i + 1, j, fw: 1, fd: 2, h: 22 + rnd() * 12, kind: "house", body: "#efe5d6", side: "#d3c7b6", roof: pick(HOUSE_ROOFS, rnd), win: "#8fb3d1", seed: 0, pyramid: true });
          } else {
            trees.push([i + 0.5, j + 0.5], [i + 1.5, j + 1.3], [i + 1.2, j + 0.4]);
          }
        }
      }
    }
  }

  // Park tile set
  for (let bi = 0; bi < 6; bi++) {
    for (let bj = 0; bj < 6; bj++) {
      const ox = bi * BLK + 1, oy = bj * BLK + 1;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) parkTile.add(`${ox + a},${oy + b}`);
    }
  }
  buildings.forEach((b) => {
    for (let a = 0; a < b.fw; a++) for (let c = 0; c < b.fd; c++) parkTile.delete(`${b.i + a},${b.j + c}`);
  });
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) parkTile.delete(`${LOTX + a},${LOTY + b}`);

  // Road tiles
  const roadTiles: [number, number][] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (isRoad(i, j)) roadTiles.push([i, j]);

  // Walkers
  const NAMES = ["Nova","Pip","Juno","Kai","Mo","Zed","Ivy","Rex","Lumi","Taro","Vega","Bo","Sage","Remy","Ori","Tess","Quin","Yuki","Fen","Dot","Ash","Milo","Cleo","Beau","Rin","Lux","Nell","Arlo","Wren","Ezra"];
  const BLOBS = ["#ff9aa8","#8fd3ff","#b79cff","#ffd36b","#8ee6b6","#ffb37a","#7fb2ff","#f59bd8"];
  const walkers: Walker[] = Array.from({ length: 46 }, () => {
    const s = pick(roadTiles, rnd);
    return {
      i: s[0], j: s[1], ti: s[0], tj: s[1], k: 1,
      sp: 0.7 + rnd() * 0.6, c: pick(BLOBS, rnd),
      name: NAMES[Math.floor(rnd() * NAMES.length)],
      ox: (rnd() - 0.5) * 0.5, oy: (rnd() - 0.5) * 0.5,
      say: "", sayUntil: 0, nextSay: 2000 + rnd() * 14000, pi: -1, pj: -1,
    };
  });

  // Cars
  const CAR_COLS = ["#e84d4d","#f2c14e","#4d9be8","#ececec","#3fbf7f","#ff8a3d","#8a5cf0"];
  const cars: Car[] = Array.from({ length: 18 }, () => {
    const line = Math.floor(rnd() * 7) * BLK;
    return {
      axis: rnd() < 0.5 ? "i" : "j", line,
      pos: rnd() * N, dir: rnd() < 0.5 ? 1 : -1,
      sp: 1.6 + rnd() * 1.4, c: pick(CAR_COLS, rnd),
    };
  });

  return { buildings, trees, lmById, parkTile, walkers, cars, roadTiles, LOTX, LOTY, LOT_BLOCK, PLAZA_BLOCK };
}

/* ── drawing helpers ── */
function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath();
  ctx.fill();
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBox(
  ctx: CanvasRenderingContext2D, b: Building, st: string, dk: number, now: number
) {
  const A = P(b.i, b.j), B = P(b.i + b.fw, b.j), C = P(b.i + b.fw, b.j + b.fd), D = P(b.i, b.j + b.fd), h = b.h;
  poly(ctx, [D, C, up(C, h), up(D, h)], shade(b.body, dk));
  poly(ctx, [C, B, up(B, h), up(C, h)], shade(b.side, dk));
  const busy = st === "working" || st === "sending";
  const lit = busy ? 2 : dk > 0.35 ? 1 : 0;
  const day = shade(b.win || "#a9c3dd", dk);
  if (b.kind !== "house") {
    winRows(ctx, D, C, h, lit, day, b.seed, b.kind === "brick" ? [4, 6] : [6, 5]);
    winRows(ctx, C, B, h, lit, shade(mix(b.win || "#a9c3dd", "#000000", 0.15), dk), b.seed >> 3, b.kind === "brick" ? [4, 6] : [6, 5]);
  } else {
    ctx.fillStyle = dk > 0.35 ? "#ffd86b" : day;
    const m: [number, number] = [lerp(D[0], C[0], 0.5), lerp(D[1], C[1], 0.5) - h * 0.55];
    ctx.fillRect(m[0] - 3, m[1] - 3, 6, 6);
  }
  if (b.pyramid) {
    const apex = P(b.i + b.fw / 2, b.j + b.fd / 2, h + (b.kind === "lm" ? 46 : 18));
    poly(ctx, [up(D, h), up(C, h), apex], shade(b.roof, dk));
    poly(ctx, [up(C, h), up(B, h), apex], shade(mix(b.roof, "#000000", 0.22), dk));
    poly(ctx, [up(A, h), up(D, h), apex], shade(mix(b.roof, "#ffffff", 0.08), dk));
  } else {
    poly(ctx, [up(A, h), up(B, h), up(C, h), up(D, h)], shade(b.roof, dk));
  }
  if (b.kind === "lm") {
    // door
    const d0: [number, number] = [lerp(D[0], C[0], 0.42), lerp(D[1], C[1], 0.42)];
    const d1: [number, number] = [lerp(D[0], C[0], 0.58), lerp(D[1], C[1], 0.58)];
    poly(ctx, [d0, d1, up(d1, 22), up(d0, 22)], "#3a2a22");
    roofProps(ctx, b, st, now);
  }
}

function winRows(
  ctx: CanvasRenderingContext2D,
  p0: [number, number], p1: [number, number], h: number, lit: number, day: string, seed: number, dash: number[]
) {
  ctx.lineWidth = 5;
  ctx.setLineDash(dash);
  const floors = Math.floor((h - 14) / 15);
  for (let f = 0; f < floors; f++) {
    const z = 14 + f * 15;
    const on = lit === 2 || (lit === 1 && ((seed >> (f % 20)) & 1));
    ctx.strokeStyle = on ? "#ffd86b" : day;
    ctx.beginPath();
    ctx.moveTo(lerp(p0[0], p1[0], 0.12), lerp(p0[1], p1[1], 0.12) - z);
    ctx.lineTo(lerp(p0[0], p1[0], 0.88), lerp(p0[1], p1[1], 0.88) - z);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function roofProps(ctx: CanvasRenderingContext2D, b: Building, st: string, now: number) {
  const busy = st === "working" || st === "sending";
  const top = P(b.i + b.fw / 2, b.j + b.fd / 2, b.h);
  const glow = busy ? 0.55 + 0.45 * Math.sin(now / 160) : 0.35;
  ctx.strokeStyle = "#1c2233";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(top[0], top[1]);
  ctx.lineTo(top[0], top[1] - 30);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.25 * glow})`;
  ctx.beginPath();
  ctx.arc(top[0], top[1] - 32, 14, 0, 7);
  ctx.fill();
  ctx.fillStyle = b.body;
  ctx.beginPath();
  ctx.arc(top[0], top[1] - 32, 5, 0, 7);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, t: [number, number], dk: number) {
  const [x, y] = P(t[0], t[1]);
  ctx.fillStyle = shade("#6b4a2e", dk);
  ctx.fillRect(x - 2, y - 12, 4, 12);
  ctx.fillStyle = shade("#2f7a41", dk);
  ctx.beginPath();
  ctx.arc(x, y - 20, 11, 0, 7);
  ctx.fill();
  ctx.fillStyle = shade("#3f9a52", dk);
  ctx.beginPath();
  ctx.arc(x - 3, y - 23, 7, 0, 7);
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, c: Car, dk: number) {
  const i = c.axis === "i" ? c.pos : c.line + 0.5 + (c.dir > 0 ? 0.18 : -0.18);
  const j = c.axis === "i" ? c.line + 0.5 + (c.dir > 0 ? -0.18 : 0.18) : c.pos;
  const L = c.axis === "i" ? [0.26, 0.13] : [0.13, 0.26];
  const hgt = 7;
  const A = P(i - L[0], j - L[1]), B = P(i + L[0], j - L[1]);
  const C = P(i + L[0], j + L[1]), D = P(i - L[0], j + L[1]);
  poly(ctx, [D, C, up(C, hgt), up(D, hgt)], shade(c.c, dk));
  poly(ctx, [C, B, up(B, hgt), up(C, hgt)], shade(mix(c.c, "#000000", 0.25), dk));
  poly(ctx, [up(A, hgt), up(B, hgt), up(C, hgt), up(D, hgt)], shade(mix(c.c, "#ffffff", 0.25), dk));
  const g = [0.6, 0.6];
  poly(ctx, [P(i - L[0] * g[0], j - L[1] * g[1], hgt + 5), P(i + L[0] * g[0], j - L[1] * g[1], hgt + 5), P(i + L[0] * g[0], j + L[1] * g[1], hgt + 5), P(i - L[0] * g[0], j + L[1] * g[1], hgt + 5)], "#2a3346");
}

function drawBlob(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, now: number, walking: boolean) {
  const bob = walking ? Math.abs(Math.sin(now / 120)) * 2.5 : Math.sin(now / 500 + x) * 1.2;
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, 7, 3, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y - 10 - bob, 8, 10, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 3, y - 13 - bob, 2.6, 0, 7);
  ctx.arc(x + 3, y - 13 - bob, 2.6, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#1c2233";
  ctx.beginPath();
  ctx.arc(x - 2.4, y - 13 - bob, 1.3, 0, 7);
  ctx.arc(x + 3.6, y - 13 - bob, 1.3, 0, 7);
  ctx.fill();
}

function stepWalker(w: Walker, dt: number, now: number) {
  w.k += dt * w.sp;
  if (w.k >= 1) {
    w.i = w.ti; w.j = w.tj; w.k = 0;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([a, b]) => [w.i + a, w.j + b] as [number, number])
      .filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && isRoad(a, b));
    const fwd = opts.filter(([a, b]) => !(a === w.pi && b === w.pj));
    const n = pick(fwd.length && Math.random() < 0.85 ? fwd : opts, () => Math.random());
    w.pi = w.i; w.pj = w.j; w.ti = n[0]; w.tj = n[1];
  }
  if (now > w.nextSay) {
    const CHAT = ["coffee first","shipping it","any updates?","on my way","gm","lunch?","rerun it","looks good","back in 5","nice weather","who's on call?","deploying…","ping me","almost done","great reel today"];
    w.say = pick(CHAT, () => Math.random());
    w.sayUntil = now + 2600;
    w.nextSay = now + 7000 + Math.random() * 16000;
  }
}

/* ── camera helpers ── */
function clampCam(cam: { x: number; y: number; z: number }) {
  const hw = N * TW / 2;
  cam.x = Math.max(-hw, Math.min(hw, cam.x));
  cam.y = Math.max(-200, Math.min(N * TH, cam.y));
  cam.z = Math.max(0.35, Math.min(2.4, cam.z));
}

function landmarkAt(
  lmById: Record<string, Building & { id: string; name: string; status: string }>,
  cam: { x: number; y: number; z: number },
  sx: number, sy: number, cw: number, ch: number
): string | null {
  let best: string | null = null;
  let bestD = -1;
  for (const id of Object.keys(lmById)) {
    const b = lmById[id];
    const pts = [P(b.i, b.j), P(b.i + b.fw, b.j), P(b.i + b.fw, b.j + b.fd), P(b.i, b.j + b.fd)]
      .flatMap((p) => [p, up(p, b.h + 50)])
      .map((p) => [(p[0] - cam.x) * cam.z + cw / 2, (p[1] - cam.y) * cam.z + ch / 2] as [number, number]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const hit = sx >= Math.min(...xs) && sx <= Math.max(...xs) && sy >= Math.min(...ys) && sy <= Math.max(...ys);
    const d = b.i + b.j;
    if (hit && d > bestD) { best = id; bestD = d; }
  }
  return best;
}

/* ── main component ── */
export default function VirtualCity({ agents }: VirtualCityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const city = useMemo(() => buildCityLayout(agents), [agents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* ── mutable animation state ── */
    const cam = { x: 0, y: 0, z: 1 };
    let camTarget: { x: number; y: number } | null = null;
    let cw = 800, ch = 500, dpr = 1;
    let last = performance.now();
    let groundStep = -1;
    const walkers = city.walkers.map((w) => ({ ...w }));
    const cars = city.cars.map((c) => ({ ...c }));
    const { buildings, trees, lmById, parkTile, LOTX, LOTY, PLAZA_BLOCK } = city;

    /* ── offscreen ground cache ── */
    const GX0 = -N * TW / 2 - 40;
    const GY0 = -30;
    const GW = N * TW + 80;
    const GH = N * TH + 60;
    const GS = 1.5;
    const ground = document.createElement("canvas");
    ground.width = Math.round(GW * GS);
    ground.height = Math.round(GH * GS);
    const gctx = ground.getContext("2d")!;

    function paintGround(dk: number) {
      gctx.setTransform(GS, 0, 0, GS, -GX0 * GS, -GY0 * GS);
      gctx.clearRect(GX0, GY0, GW, GH);
      const tile = (i: number, j: number, col: string) => {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        gctx.fillStyle = col;
        gctx.beginPath();
        gctx.moveTo(a[0], a[1]);
        gctx.lineTo(b[0], b[1]);
        gctx.lineTo(c[0], c[1]);
        gctx.lineTo(d[0], d[1]);
        gctx.closePath();
        gctx.fill();
      };
      // island edge
      const e1 = P(N, 0), e2 = P(N, N), e3 = P(0, N);
      gctx.fillStyle = shade("#2c3348", dk);
      gctx.beginPath();
      gctx.moveTo(e3[0], e3[1]);
      gctx.lineTo(e2[0], e2[1]);
      gctx.lineTo(e2[0], e2[1] + 18);
      gctx.lineTo(e3[0], e3[1] + 18);
      gctx.closePath();
      gctx.fill();
      gctx.fillStyle = shade("#232a3d", dk);
      gctx.beginPath();
      gctx.moveTo(e2[0], e2[1]);
      gctx.lineTo(e1[0], e1[1]);
      gctx.lineTo(e1[0], e1[1] + 18);
      gctx.lineTo(e2[0], e2[1] + 18);
      gctx.closePath();
      gctx.fill();
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (isRoad(i, j)) tile(i, j, shade((i + j) % 2 ? "#3d4358" : "#3a4055", dk));
          else if (i >= LOTX && i < LOTX + 4 && j >= LOTY && j < LOTY + 4) tile(i, j, shade("#b08a5a", dk));
          else if (parkTile.has(`${i},${j}`)) tile(i, j, shade((i + j) % 2 ? "#6cbc5d" : "#66b457", dk));
          else tile(i, j, shade((i + j) % 2 ? "#bdb6a6" : "#b5ae9e", dk));
        }
      }
      // lane dashes
      gctx.strokeStyle = shade("#e9dd9a", dk);
      gctx.lineWidth = 1.6;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (!isRoad(i, j) || (i % BLK === 0 && j % BLK === 0)) continue;
          const a = i % BLK === 0 ? [P(i + 0.5, j + 0.3), P(i + 0.5, j + 0.7)] : [P(i + 0.3, j + 0.5), P(i + 0.7, j + 0.5)];
          gctx.beginPath();
          gctx.moveTo(a[0][0], a[0][1]);
          gctx.lineTo(a[1][0], a[1][1]);
          gctx.stroke();
        }
      }
      // plaza fountain
      const [px, py] = P(PLAZA_BLOCK[0] * BLK + 3, PLAZA_BLOCK[1] * BLK + 3);
      gctx.fillStyle = shade("#9fb2c8", dk);
      gctx.beginPath();
      gctx.ellipse(px, py, 34, 17, 0, 0, 7);
      gctx.fill();
      gctx.fillStyle = shade("#5bb6ff", dk);
      gctx.beginPath();
      gctx.ellipse(px, py, 26, 13, 0, 0, 7);
      gctx.fill();
      groundStep = Math.round(dk * 10);
    }

    /* ── resize ── */
    function fit() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = r.width;
      ch = r.height;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    fit();
    const ro = new ResizeObserver(() => { fit(); paintGround(0); groundStep = -1; });
    ro.observe(canvas);

    /* ── interaction ── */
    const ptrs = new Map<number, [number, number]>();
    let drag: { x: number; y: number; cx: number; cy: number; t: number; moved: boolean } | null = null;

    function localXY(e: PointerEvent) {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as [number, number];
    }
    function worldXY(sx: number, sy: number) {
      return [(sx - cw / 2) / cam.z + cam.x, (sy - ch / 2) / cam.z + cam.y] as [number, number];
    }

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, localXY(e));
      camTarget = null;
      if (ptrs.size === 1) {
        const [x, y] = localXY(e);
        drag = { x, y, cx: cam.x, cy: cam.y, t: performance.now(), moved: false };
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, localXY(e));
      if (drag) {
        const [x, y] = localXY(e);
        if (Math.hypot(x - drag.x, y - drag.y) > 6) drag.moved = true;
        cam.x = drag.cx - (x - drag.x) / cam.z;
        cam.y = drag.cy - (y - drag.y) / cam.z;
        clampCam(cam);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (drag && !drag.moved && ptrs.size === 1 && performance.now() - drag.t < 500) {
        const [sx, sy] = localXY(e);
        const id = landmarkAt(lmById, cam, sx, sy, cw, ch);
        if (id) console.log(id);
      }
      ptrs.delete(e.pointerId);
      drag = null;
    };
    const onPointerCancel = () => { ptrs.clear(); drag = null; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camTarget = null;
      const [x, y] = localXY(e as unknown as PointerEvent);
      const w = worldXY(x, y);
      cam.z *= Math.exp(-e.deltaY * 0.0015);
      clampCam(cam);
      cam.x = w[0] - (x - cw / 2) / cam.z;
      cam.y = w[1] - (y - ch / 2) / cam.z;
      clampCam(cam);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    /* ── animation loop ── */
    let frameId = 0;
    function frame(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dk = darkness(new Date().getHours() + new Date().getMinutes() / 60);
      const dkStep = Math.round(dk * 10);

      if (!cw || canvas.offsetParent === null) {
        frameId = requestAnimationFrame(frame);
        return;
      }

      // repaint ground cache when darkness changes
      if (groundStep !== dkStep) paintGround(dk);

      // smooth camera follow
      if (camTarget) {
        cam.x = lerp(cam.x, camTarget.x, 0.06);
        cam.y = lerp(cam.y, camTarget.y, 0.06);
        if (Math.hypot(cam.x - camTarget.x, cam.y - camTarget.y) < 2) camTarget = null;
      }

      // sky
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [top, bot] = sky(new Date().getHours() + new Date().getMinutes() / 60);
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);

      // world transform
      ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (cw / 2 - cam.x * cam.z), dpr * (ch / 2 - cam.y * cam.z));
      ctx.drawImage(ground, GX0, GY0, GW, GH);

      // visibility culling
      const vx0 = cam.x - cw / 2 / cam.z - 80;
      const vx1 = cam.x + cw / 2 / cam.z + 80;
      const vy0 = cam.y - ch / 2 / cam.z - 60;
      const vy1 = cam.y + ch / 2 / cam.z + 320;
      const vis = (i: number, j: number) => { const [x, y] = P(i, j); return x > vx0 && x < vx1 && y > vy0 && y < vy1; };

      // sort items by depth
      const items: { depth: number; draw: () => void }[] = [];

      buildings.forEach((b) => {
        if (vis(b.i + b.fw / 2, b.j + b.fd / 2)) {
          items.push({ depth: b.i + b.j + b.h * 0.01, draw: () => drawBox(ctx, b, b.kind === "lm" ? (b.status || "") : "", dk, now) });
        }
      });
      trees.forEach((tr) => {
        if (vis(tr[0], tr[1])) items.push({ depth: tr[0] + tr[1], draw: () => drawTree(ctx, tr, dk) });
      });

      // advance + draw cars
      cars.forEach((c) => {
        c.pos += c.dir * c.sp * dt;
        if (c.pos > N) c.pos -= N;
        if (c.pos < 0) c.pos += N;
        const ci = c.axis === "i" ? c.pos : c.line + 0.5;
        const cj = c.axis === "i" ? c.line + 0.5 : c.pos;
        if (vis(ci, cj)) items.push({ depth: ci + cj, draw: () => drawCar(ctx, c, dk) });
      });

      // advance + draw walkers
      const overlays: { kind: string; pos: [number, number]; text: string }[] = [];
      walkers.forEach((w) => {
        stepWalker(w, dt, now);
        const wi = lerp(w.i, w.ti, w.k) + 0.5 + w.ox * 0.6;
        const wj = lerp(w.j, w.tj, w.k) + 0.5 + w.oy * 0.6;
        if (!vis(wi, wj)) return;
        items.push({ depth: wi + wj, draw: () => drawBlob(ctx, ...P(wi, wj), w.c, now, true) });
        if (cam.z > 1.1) overlays.push({ kind: "name", pos: P(wi, wj, 26), text: w.name });
        if (now < w.sayUntil) overlays.push({ kind: "say", pos: P(wi, wj, 30), text: w.say });
      });

      // agent crews at front doors
      Object.keys(lmById).forEach((id) => {
        const b = lmById[id];
        const fi = b.i + 1, fj = b.j + b.fd;
        const busy = b.status === "working" || b.status === "sending";
        [[0.2, 0.15], [0.8, 0.35]].forEach(([a, bb], n) => {
          const wi = fi + a, wj = fj + bb;
          items.push({ depth: wi + wj, draw: () => drawBlob(ctx, ...P(wi, wj), b.body, now + n * 300, busy) });
        });
        if (busy) overlays.push({ kind: "say", pos: P(fi + 0.5, fj + 0.2, 34), text: "working on it…" });
      });

      items.sort((a, b) => a.depth - b.depth).forEach((it) => it.draw());

      // street lamps at night
      if (dk > 0.3) {
        ctx.fillStyle = `rgba(255,216,107,${0.55 * dk})`;
        for (let i = 0; i <= 30; i += BLK) {
          for (let j = 0; j <= 30; j += BLK) {
            if (!vis(i, j)) continue;
            const [x, y] = P(i + 0.5, j + 0.5);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 7);
            ctx.fill();
            ctx.fillStyle = `rgba(255,216,107,${0.12 * dk})`;
            ctx.beginPath();
            ctx.ellipse(x, y, 22, 11, 0, 0, 7);
            ctx.fill();
            ctx.fillStyle = `rgba(255,216,107,${0.55 * dk})`;
          }
        }
      }

      // screen-space labels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // agent labels above buildings
      const fsz = Math.max(11, Math.min(18, 17 * cam.z));
      const labelH = fsz + 6;
      Object.keys(lmById).forEach((id) => {
        const b = lmById[id];
        const wp = P(b.i + b.fw / 2, b.j + b.fd / 2, b.h + 50);
        const sx = (wp[0] - cam.x) * cam.z + cw / 2;
        const sy = (wp[1] - cam.y) * cam.z + ch / 2;
        if (sx < -120 || sx > cw + 120 || sy < -60 || sy > ch + 20) return;
        const label = b.name || id;
        ctx.font = `700 ${fsz}px 'Nunito Sans', sans-serif`;
        const tw = ctx.measureText(label).width + 16;
        const top = sy - labelH;
        ctx.fillStyle = "rgba(28,34,51,.94)";
        rr(ctx, sx - tw / 2, top, tw, labelH, 9);
        ctx.fill();
        ctx.fillStyle = statusColor(b.status);
        ctx.fillText(label, sx, top + labelH / 2);
      });

      // walker speech / name bubbles
      overlays.forEach(({ kind, pos, text }) => {
        const sx = (pos[0] - cam.x) * cam.z + cw / 2;
        const sy = (pos[1] - cam.y) * cam.z + ch / 2;
        if (sx < -60 || sx > cw + 60 || sy < -30 || sy > ch + 30) return;
        if (kind === "name") {
          ctx.font = "700 10px 'Nunito Sans', sans-serif";
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.fillText(text, sx, sy);
        } else {
          ctx.font = "700 12px 'Nunito Sans', sans-serif";
          const tw = ctx.measureText(text).width + 16;
          const yy = sy - 12;
          ctx.fillStyle = "#fff";
          rr(ctx, sx - tw / 2, yy - 11, tw, 22, 8);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(sx - 5, yy + 10);
          ctx.lineTo(sx + 5, yy + 10);
          ctx.lineTo(sx, yy + 16);
          ctx.fill();
          ctx.fillStyle = "#1c2233";
          ctx.fillText(text, sx, yy);
        }
      });

      frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);

    /* ── cleanup ── */
    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [city]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="city-canvas"
      style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
    />
  );
}
