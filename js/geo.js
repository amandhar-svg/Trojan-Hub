/* js/geo.js */
/* Trojan Hub — geo: walking graph from TH.GEO.graph (real OpenStreetMap ways),
 * snapping, A* routing (binary heap) and a street-by-hour risk model built from
 * real USC DPS log entries (TH.INCIDENTS) and active DPS alerts (TH.DPS_ALERTS).
 *
 * Coordinates are meters, north-positive (x east, y north), per CONTRACT.
 * Everything is lazy: nothing is built until first use (side-effect free at load).
 *
 * Public API (CONTRACT): TH.ME, TH.graph, TH.nearestNode(x,y), TH.route(from,to,opts),
 * TH.edgeRisk(edge,hour), TH.riskLevel(r), TH.riskLabel.
 * Extras: TH.snap(x,y), TH.routeCompare(from,to,opts), TH.riskCaption, TH.isControlledHour(h),
 *         TH.edgesNear(x,y,r), TH.incidentsAt(hour,opts).
 */
(function (TH) {
  'use strict';

  // ---------------------------------------------------------------------------
  // "You are here": in front of the Ronald Tutor Campus Center, toward Trousdale Parkway
  // (TCC centroid -82,-18.5 from research/map/buildings_index.json; the point sits on the
  // centerline at x≈15 here). Lat/lon derived with the CONTRACT projection.
  // ---------------------------------------------------------------------------
  const KX = 92162.65, KY = 111195.08, LAT0 = 34.0205, LON0 = -118.2855;
  const ME_X = -28, ME_Y = 6;
  TH.ME = { x: ME_X, y: ME_Y, lat: +(LAT0 + ME_Y / KY).toFixed(6), lon: +(LON0 + ME_X / KX).toFixed(6), label: 'You (Tutor Campus Center)', short: 'TCC, Trousdale side' };

  const DEMO_NOW = new Date('2026-11-09T12:00:00-08:00');
  const nowDate = () => (TH.clock && TH.clock.now ? TH.clock.now() : DEMO_NOW);

  // ---------------------------------------------------------------------------
  // Graph (built lazily from TH.GEO.graph)
  // edges: [a, b, meters, name, class, onCampus, flags, inner?]
  // ---------------------------------------------------------------------------
  let G = null;
  function pairs(arr) { // accepts [[x,y],...] or flat [x,y,x,y]
    if (!arr || !arr.length) return [];
    if (typeof arr[0] === 'number') { const o = []; for (let i = 0; i + 1 < arr.length; i += 2) o.push([arr[i], arr[i + 1]]); return o; }
    return arr;
  }
  // a few OSM ways carry the university's name (incl. a translated one) instead of a street name
  const cleanName = n => (!n || /niversit|Üniversitesi|^USC$/i.test(n)) ? '' : String(n);
  function build() {
    const src = (TH.GEO && (TH.GEO.graph || TH.GEO.walk)) || { nodes: [], edges: [] };
    const nodes = pairs(src.nodes);
    const N = nodes.length;
    const nx = new Float64Array(N), ny = new Float64Array(N);
    for (let i = 0; i < N; i++) { nx[i] = nodes[i][0]; ny[i] = nodes[i][1]; }
    const edges = [];
    const deg = new Int32Array(N);
    src.edges.forEach((r, i) => {
      const a = r[0], b = r[1], flags = r[6] || '';
      const inner = pairs(r[7]);
      const pts = [[nx[a], ny[a]], ...inner, [nx[b], ny[b]]];
      let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const m = r[2] > 0 ? r[2] : len;
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const p of pts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
      const e = {
        id: i, a, b, len: m, geomLen: len || m, name: cleanName(r[3]), cls: r[4] || '', campus: !!r[5], flags,
        priv: flags.includes('p'), steps: flags.includes('s'), indoor: flags.includes('i'), covered: flags.includes('c'), crossing: flags.includes('x'),
        pts, minx, miny, maxx, maxy, main: false,
      };
      // v1 compatibility (assistant.js / old screens draw edges as lines)
      e.x1 = pts[0][0]; e.y1 = pts[0][1]; e.x2 = pts[pts.length - 1][0]; e.y2 = pts[pts.length - 1][1];
      edges.push(e); deg[a]++; deg[b]++;
    });
    // CSR adjacency
    const off = new Int32Array(N + 1);
    for (let i = 0; i < N; i++) off[i + 1] = off[i] + deg[i];
    const fill = off.slice(0, N), adjE = new Int32Array(off[N]);
    edges.forEach(e => { adjE[fill[e.a]++] = e.id; adjE[fill[e.b]++] = e.id; });
    // connected components → main one
    const comp = new Int32Array(N).fill(-1); let best = -1, bestN = 0, c = 0;
    const stack = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0) continue; let sp = 0, n = 0; stack[sp++] = s; comp[s] = c;
      while (sp) { const u = stack[--sp]; n++; for (let k = off[u]; k < off[u + 1]; k++) { const e = edges[adjE[k]], v = e.a === u ? e.b : e.a; if (comp[v] < 0) { comp[v] = c; stack[sp++] = v; } } }
      if (n > bestN) { bestN = n; best = c; } c++;
    }
    edges.forEach(e => { e.main = comp[e.a] === best; });
    // spatial grid of snappable segments (main component, not private)
    const CELL = 40, grid = new Map();
    const key = (i, j) => i * 100003 + j;
    edges.forEach(e => {
      if (!e.main || e.priv) return;
      for (let k = 1; k < e.pts.length; k++) {
        const p = e.pts[k - 1], q = e.pts[k];
        const i0 = Math.floor(Math.min(p[0], q[0]) / CELL), i1 = Math.floor(Math.max(p[0], q[0]) / CELL);
        const j0 = Math.floor(Math.min(p[1], q[1]) / CELL), j1 = Math.floor(Math.max(p[1], q[1]) / CELL);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = key(i, j); let L = grid.get(kk); if (!L) grid.set(kk, L = []); L.push(e.id, k - 1); }
      }
    });
    G = { nodes: nodes.map((p, i) => ({ id: i, x: p[0], y: p[1] })), nx, ny, edges, off, adjE, comp, main: best, mainCount: bestN, grid, CELL, key, N };
    return G;
  }
  const graph = () => G || build();
  try { delete TH.graph; } catch (e) { /* not configurable */ }
  Object.defineProperty(TH, 'graph', { configurable: true, enumerable: true, get: graph, set(v) { /* v1 core.js may assign; ignore */ } });

  // ---------------------------------------------------------------------------
  // Snapping
  // ---------------------------------------------------------------------------
  function projSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const x = ax + t * dx, y = ay + t * dy; return { t, x, y, d: Math.hypot(px - x, py - y) };
  }
  /** Nearest point on the nearest non-private main-component edge. */
  TH.snap = function (x, y) {
    const g = graph(); const C = g.CELL;
    const ci = Math.floor(x / C), cj = Math.floor(y / C);
    let best = null;
    for (let r = 0; r < 60; r++) {
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
        if (r && i > ci - r && i < ci + r && j > cj - r && j < cj + r) continue; // ring only
        const L = g.grid.get(g.key(i, j)); if (!L) continue;
        for (let k = 0; k < L.length; k += 2) {
          const e = g.edges[L[k]], s = L[k + 1], p = e.pts[s], q = e.pts[s + 1];
          const pr = projSeg(x, y, p[0], p[1], q[0], q[1]);
          if (!best || pr.d < best.d) best = { edge: e, seg: s, t: pr.t, x: pr.x, y: pr.y, d: pr.d };
        }
      }
      if (best && best.d < r * C) break; // anything farther ring is ≥ r*C away
    }
    if (!best) return null;
    // distance along the edge from a to the snap point
    const e = best.edge; let along = 0;
    for (let k = 0; k < best.seg; k++) along += Math.hypot(e.pts[k + 1][0] - e.pts[k][0], e.pts[k + 1][1] - e.pts[k][1]);
    along += Math.hypot(best.x - e.pts[best.seg][0], best.y - e.pts[best.seg][1]);
    best.along = along; best.frac = e.geomLen ? Math.min(1, along / e.geomLen) : 0;
    return best;
  };
  /** v1 API: nearest graph node on the main component (via the snapped edge). */
  TH.nearestNode = function (x, y) {
    const s = TH.snap(x, y); if (!s) return null;
    const g = graph(), e = s.edge;
    const n = s.frac < 0.5 ? e.a : e.b;
    return Object.assign({}, g.nodes[n], { snap: s });
  };

  // ---------------------------------------------------------------------------
  // Risk model
  // ---------------------------------------------------------------------------
  const CAT_W = { violent: 3, personal: 2, property: 1 };
  const DIST_SIGMA = 60;        // m — distance kernel from the edge
  const DIST_CUT = 150;         // m — ignore incidents farther than this
  const HOUR_SIGMA = 1.6;       // h — time-of-day kernel
  const RECENCY_TAU = 30;       // days
  const hourDiff = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };
  function parseHM(s) { // '9 PM' | '21:00' | '6 AM'
    if (s == null) return null; s = String(s).trim();
    let m = s.match(/^(\d{1,2}):(\d{2})$/); if (m) return +m[1] + m[2] / 60;
    m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]?/); if (m) { let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return h + (m[2] ? m[2] / 60 : 0); }
    return null;
  }
  let ctrlWin = null;
  function controlledWindow() {
    if (ctrlWin) return ctrlWin;
    let a = 21, b = 6; // USC: controlled access 9 PM – 6 AM (research/facts/safety.json)
    const acc = TH.SAFETY && TH.SAFETY.access;
    const txt = acc && (acc.idCheck || (acc.id_check_hours && `${acc.id_check_hours.start}–${acc.id_check_hours.end}`));
    if (typeof txt === 'string') { const parts = txt.split(/\s*[–-]\s*|\s+to\s+/); const pa = parseHM(parts[0]), pb = parseHM(parts[1]); if (pa != null && pb != null) { a = pa; b = pb; } }
    return (ctrlWin = [a, b]);
  }
  TH.isControlledHour = h => { const [a, b] = controlledWindow(); h = ((h % 24) + 24) % 24; return a > b ? (h >= a || h < b) : (h >= a && h < b); };
  const isNight = h => { h = ((h % 24) + 24) % 24; return h >= 19 || h < 6; };
  const isLate = h => { h = ((h % 24) + 24) % 24; return h >= 22 || h < 4; };
  TH.isNight = isNight;

  function daysAgo(dateStr) {
    if (!dateStr) return 30;
    const t = Date.parse(String(dateStr).length <= 10 ? dateStr + 'T12:00:00-08:00' : dateStr);
    if (isNaN(t)) return 30;
    return Math.max(0, (DEMO_NOW.getTime() - t) / 864e5);
  }
  function distToEdge(px, py, e) {
    let d = Infinity;
    for (let k = 1; k < e.pts.length; k++) { const p = e.pts[k - 1], q = e.pts[k]; const r = projSeg(px, py, p[0], p[1], q[0], q[1]).d; if (r < d) d = r; }
    return d;
  }
  // Per-edge list of nearby incidents with their hour-independent weight.
  let near = null, incRef = null;
  function prepIncidents() {
    const list = TH.INCIDENTS || [];
    if (near && incRef === list) return near;
    const g = graph(); incRef = list;
    const inc = list.map(i => {
      const w = (CAT_W[i.cat] || 0) * (i.conf == null ? 0.7 : +i.conf) * (0.3 + 0.7 * Math.exp(-daysAgo(i.date) / RECENCY_TAU));
      return { x: +i.x, y: +i.y, hour: +i.hour || 0, durH: Math.max(0, +i.durH || 0), w };
    }).filter(i => i.w > 0 && isFinite(i.x) && isFinite(i.y));
    const C = 100, grid = new Map();
    inc.forEach((i, n) => { const k = Math.floor(i.x / C) * 100003 + Math.floor(i.y / C); let L = grid.get(k); if (!L) grid.set(k, L = []); L.push(n); });
    near = new Array(g.edges.length);
    g.edges.forEach((e, n) => {
      const out = [];
      const i0 = Math.floor((e.minx - DIST_CUT) / C), i1 = Math.floor((e.maxx + DIST_CUT) / C), j0 = Math.floor((e.miny - DIST_CUT) / C), j1 = Math.floor((e.maxy + DIST_CUT) / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const L = grid.get(i * 100003 + j); if (!L) continue;
        for (const id of L) { const it = inc[id], d = distToEdge(it.x, it.y, e); if (d <= DIST_CUT) out.push(it, it.w * Math.exp(-((d / DIST_SIGMA) ** 2))); }
      }
      near[n] = out;
    });
    near.inc = inc;
    return near;
  }
  function timeKernel(i, h) {
    // the incident "began" at i.hour; if the log gives a window (durH), any hour inside it counts
    let d;
    if (i.durH > 0.25) {
      const span = Math.min(i.durH, 24), rel = ((h - i.hour) % 24 + 24) % 24;
      d = rel <= span ? 0 : Math.min(rel - span, 24 - rel);
      return Math.exp(-((d / HOUR_SIGMA) ** 2)) / Math.sqrt(1 + span / 3);
    }
    d = hourDiff(h, i.hour);
    return Math.exp(-((d / HOUR_SIGMA) ** 2));
  }
  function activeAlerts() {
    const now = nowDate().getTime();
    return (TH.DPS_ALERTS || []).filter(a => a && a.x != null && a.y != null && !a.sensitive && a.level !== 'info' && (() => { const t = Date.parse(a.date); return !isNaN(t) && now - t >= 0 && now - t < 12 * 3600e3; })());
  }
  const riskCache = new Map(); let alertKey = '';
  const K_RAW = 0.3;
  /** Risk 0..1 for an edge object (or edge id) at an hour (0–24, fractional ok). */
  TH.edgeRisk = function (e, hour) {
    const g = graph(); if (typeof e === 'number') e = g.edges[e]; if (!e) return 0;
    if (e.id == null || !g.edges[e.id] || g.edges[e.id] !== e) return legacyRisk(e, hour);
    hour = ((+hour % 24) + 24) % 24;
    const hk = Math.round(hour * 4) / 4;
    const al = activeAlerts(); const ak = al.map(a => a.id).join(',');
    if (ak !== alertKey) { riskCache.clear(); alertKey = ak; }
    let arr = riskCache.get(hk);
    if (!arr) { arr = new Float32Array(g.edges.length).fill(-1); riskCache.set(hk, arr); }
    const c = arr[e.id]; if (c >= 0) return c;
    const nb = prepIncidents()[e.id];
    let raw = 0;
    for (let k = 0; k < nb.length; k += 2) raw += nb[k + 1] * timeKernel(nb[k], hk);
    for (const a of al) { const d = distToEdge(a.x, a.y, e); if (d < 250) raw += (a.level === 'alert' ? 3 : 1.5) * Math.exp(-((d / 90) ** 2)); }
    const base = e.campus ? (isNight(hk) ? 0.02 : 0) : (isLate(hk) ? 0.16 : isNight(hk) ? 0.1 : 0.01);
    let r = 1 - Math.exp(-(raw * K_RAW + base));
    if (e.campus) r *= TH.isControlledHour(hk) ? 0.5 : 0.8; // gated campus with ID checks at night; patrolled by day
    if (e.priv) r *= 0.9;
    r = Math.max(0, Math.min(1, r));
    arr[e.id] = r; return r;
  };
  function legacyRisk(e, hour) { // risk for a foreign segment {x1,y1,x2,y2}
    const s = TH.snap(((e.x1 || 0) + (e.x2 || 0)) / 2, ((e.y1 || 0) + (e.y2 || 0)) / 2);
    return s ? TH.edgeRisk(s.edge, hour) : 0;
  }
  TH.riskLevel = r => r < 0.25 ? 'low' : r < 0.5 ? 'med' : 'high';
  TH.riskLabel = { low: 'Fewer reports', med: 'Some reports', high: 'More reports' };
  TH.riskCaption = 'Reports to USC DPS, not proof a crime occurred. Scores describe streets at times of day, not neighborhoods or people.';
  /** All edge risks for an hour as a Float32Array (index = edge id). */
  TH.riskAll = function (hour) { const g = graph(); const out = new Float32Array(g.edges.length); for (const e of g.edges) out[e.id] = TH.edgeRisk(e, hour); return out; };
  /** Non-sensitive incidents near an hour (for map dots). No labels for sensitive rows; they are excluded. */
  TH.incidentsAt = function (hour, opts = {}) {
    const win = opts.window ?? 2, maxDays = opts.days ?? 60;
    return (TH.INCIDENTS || []).filter(i => !i.sensitive && daysAgo(i.date) <= maxDays && hourDiff(i.hour, hour) <= win);
  };
  TH.edgesNear = function (x, y, r = 40) { const g = graph(); return g.edges.filter(e => x >= e.minx - r && x <= e.maxx + r && y >= e.miny - r && y <= e.maxy + r && distToEdge(x, y, e) <= r); };

  // ---------------------------------------------------------------------------
  // Routing: A* with a binary heap, split-edge endpoints
  // ---------------------------------------------------------------------------
  class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
      if (n) {
        let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
        k[i] = lk; v[i] = lv;
      }
      return top;
    }
    peekKey() { return this.k[0]; }
  }
  const PRIV_PEN = 25;
  function weightFn(mode, hour, accessible) {
    const safe = mode === 'safe';
    return e => {
      if (accessible && e.steps) return Infinity;
      let f = 1;
      if (e.priv) f *= PRIV_PEN;
      if (safe) { const r = TH.edgeRisk(e, hour); f *= 1 + 10 * r * r + (isNight(hour) && !e.campus ? 0.15 : 0); }
      else if (e.cls === 'service' && !e.campus) f *= 1.05; // tiny preference for real sidewalks
      if (e.steps) f *= 1.15;
      return e.len * f;
    };
  }
  function partialPts(e, along, fromA) {
    // geometry from the snap point to node a (fromA=true) or to node b
    const pts = e.pts; let acc = 0; const out = [];
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k - 1], q = pts[k], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (acc + L >= along) {
        const t = L ? (along - acc) / L : 0; const sp = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
        if (fromA) { out.push(sp); for (let j = k - 1; j >= 0; j--) out.push(pts[j]); }
        else { out.push(sp); for (let j = k; j < pts.length; j++) out.push(pts[j]); }
        return out;
      }
      acc += L;
    }
    return fromA ? pts.slice().reverse() : [pts[pts.length - 1]];
  }
  const pt = p => (p && (p.x != null ? { x: +p.x, y: +p.y } : Array.isArray(p) ? { x: +p[0], y: +p[1] } : null));

  // building footprints (to know when an endpoint is a building centroid)
  let BLD = null;
  function buildings() {
    if (BLD) return BLD;
    const ringsOf = poly => (!poly || !poly.length) ? [] : typeof poly[0] === 'number' ? [pairs(poly)] : typeof poly[0][0] === 'number' ? [poly] : poly;
    BLD = ((TH.GEO && TH.GEO.buildings) || []).map(b => {
      const rings = ringsOf(b.poly || b.rings || b.p); let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      rings.forEach(r => r.forEach(q => { if (q[0] < minx) minx = q[0]; if (q[0] > maxx) maxx = q[0]; if (q[1] < miny) miny = q[1]; if (q[1] > maxy) maxy = q[1]; }));
      return { rings, minx, miny, maxx, maxy };
    });
    return BLD;
  }
  function inBuilding(x, y) {
    for (const b of buildings()) {
      if (x < b.minx || x > b.maxx || y < b.miny || y > b.maxy) continue;
      let inside = false;
      for (const r of b.rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; }
      if (inside) return b;
    }
    return null;
  }
  /** Several snap candidates on distinct edges: a point inside a building may leave by any side. */
  function snapMulti(x, y, noSteps) {
    const first = TH.snap(x, y); if (!first) return [];
    const tol = inBuilding(x, y) ? 40 : noSteps && first.edge.steps ? 60 : 8, R = first.d + tol, g = graph(), C = g.CELL;
    const ci = Math.floor(x / C), cj = Math.floor(y / C), rr = Math.ceil(R / C) + 1, best = new Map();
    for (let i = ci - rr; i <= ci + rr; i++) for (let j = cj - rr; j <= cj + rr; j++) {
      const L = g.grid.get(g.key(i, j)); if (!L) continue;
      for (let k = 0; k < L.length; k += 2) {
        const e = g.edges[L[k]], sg = L[k + 1], p = e.pts[sg], q = e.pts[sg + 1], pr = projSeg(x, y, p[0], p[1], q[0], q[1]);
        if (pr.d > R || (noSteps && e.steps)) continue; const o = best.get(e.id); if (!o || pr.d < o.d) best.set(e.id, { edge: e, seg: sg, t: pr.t, x: pr.x, y: pr.y, d: pr.d });
      }
    }
    const out = [...best.values()].sort((a, b) => a.d - b.d).slice(0, 8);
    out.forEach(sn => { const e = sn.edge; let along = 0; for (let k = 0; k < sn.seg; k++) along += Math.hypot(e.pts[k + 1][0] - e.pts[k][0], e.pts[k + 1][1] - e.pts[k][1]); along += Math.hypot(sn.x - e.pts[sn.seg][0], sn.y - e.pts[sn.seg][1]); sn.along = Math.min(along, e.geomLen); });
    return out.length ? out : [first];
  }
  TH.snapMulti = snapMulti;

  /**
   * TH.route(from, to, {hour, mode:'safe'|'fast'|'accessible', accessible})
   * → {pts:[[x,y]] (meters, north-up), edges, meters, minutes (80 m/min), risk 0..1, worst, streets, mode, hour, ms}
   */
  TH.route = function (from, to, opts = {}) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const g = graph();
    const now = nowDate();
    const hour = opts.hour != null ? +opts.hour : now.getHours() + now.getMinutes() / 60;
    const mode = opts.mode === 'fast' || opts.mode === 'accessible' ? 'fast' : 'safe';
    const accessible = !!opts.accessible || opts.mode === 'accessible';
    const A = pt(from), B = pt(to);
    const outMode = opts.mode === 'accessible' ? 'accessible' : mode;
    const straight = () => { const m = A && B ? Math.hypot(B.x - A.x, B.y - A.y) : 0; return { pts: A && B ? [[A.x, A.y], [B.x, B.y]] : [], edges: [], meters: Math.round(m), minutes: Math.max(1, Math.round(m / 80)), risk: 0, worst: 0, streets: [], mode: outMode, accessible, hour, ms: 0 }; };
    if (!A || !B) return straight();
    const SA = snapMulti(A.x, A.y, accessible), SB = snapMulti(B.x, B.y, accessible);
    if (!SA.length || !SB.length) return straight();
    const W = weightFn(mode, hour, accessible);
    const wOf = e => { const w = W(e); return isFinite(w) ? w : e.len * 50; };
    const N = g.N; const dist = new Float64Array(N).fill(Infinity); const prevE = new Int32Array(N).fill(-1); const startOf = new Int32Array(N).fill(-1); const done = new Uint8Array(N);
    const heap = new Heap();
    const tx = B.x, ty = B.y, minLegB = SB[0].d;
    const h = n => Math.max(0, Math.hypot(g.nx[n] - tx, g.ny[n] - ty) - minLegB - 45); // admissible (targets may sit up to tol+leg away)
    const seed = (n, c, si) => { if (c < dist[n]) { dist[n] = c; prevE[n] = -2; startOf[n] = si; heap.push(c + h(n), n); } };
    SA.forEach((s, si) => { const e = s.edge, w = wOf(e), f = e.geomLen ? s.along / e.geomLen : 0; seed(e.a, s.d + w * f, si); seed(e.b, s.d + w * (1 - f), si); });
    const fin = new Map(); // node → [[targetIdx, cost]]
    SB.forEach((t, ti) => { const e = t.edge, w = wOf(e), f = e.geomLen ? t.along / e.geomLen : 0; for (const [n, c] of [[e.a, t.d + w * f], [e.b, t.d + w * (1 - f)]]) (fin.get(n) || fin.set(n, []).get(n)).push([ti, c]); });
    let best = Infinity, bestEnd = -1, bestT = -1, direct = null;
    SA.forEach((s, si) => SB.forEach((t, ti) => { if (s.edge !== t.edge) return; const e = s.edge, c = s.d + t.d + wOf(e) * Math.abs(t.along - s.along) / (e.geomLen || 1); if (c < best) { best = c; direct = [si, ti]; bestEnd = -3; } }));
    while (heap.size) {
      if (heap.peekKey() >= best) break;
      const u = heap.pop(); if (done[u]) continue; done[u] = 1;
      const du = dist[u];
      const F = fin.get(u); if (F) for (const [ti, c] of F) if (du + c < best) { best = du + c; bestEnd = u; bestT = ti; direct = null; }
      for (let k = g.off[u]; k < g.off[u + 1]; k++) {
        const e = g.edges[g.adjE[k]]; const v = e.a === u ? e.b : e.a; if (done[v]) continue;
        const w = W(e); if (!isFinite(w)) continue;
        const nd = du + w; if (nd < dist[v]) { dist[v] = nd; prevE[v] = e.id; startOf[v] = startOf[u]; heap.push(nd + h(v), v); }
      }
    }
    if (bestEnd === -1) return straight();
    // reconstruct
    let pts = [], edges = [], meters = 0, expo = 0, worst = 0, gm = 0;
    const addRisk = (e, len) => { len = Math.max(0, len); const r = TH.edgeRisk(e, hour); expo += r * len; gm += len; if (len > 5 && r > worst) worst = r; meters += len; };
    let sa, sb;
    if (bestEnd === -3) {
      sa = SA[direct[0]]; sb = SB[direct[1]];
      const e = sa.edge, lo = Math.min(sa.along, sb.along), hi = Math.max(sa.along, sb.along), P = e.pts, mid = []; let acc = 0;
      for (let k = 1; k < P.length - 1; k++) { acc += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); if (acc > lo && acc < hi) mid.push(P[k]); }
      if (sa.along > sb.along) mid.reverse();
      pts = [[sa.x, sa.y], ...mid, [sb.x, sb.y]]; edges = [e]; addRisk(e, hi - lo);
    } else {
      sb = SB[bestT];
      const chain = []; let cur = bestEnd;
      while (prevE[cur] >= 0) { const e = g.edges[prevE[cur]]; chain.push([e, cur]); cur = e.a === cur ? e.b : e.a; }
      const startNode = cur; sa = SA[startOf[startNode]]; chain.reverse();
      const ea = sa.edge, eb = sb.edge;
      const startFromA = startNode === ea.a;
      pts.push(...partialPts(ea, sa.along, startFromA)); edges.push(ea);
      addRisk(ea, startFromA ? sa.along : ea.geomLen - sa.along);
      for (const [e, endN] of chain) { const P = e.b === endN ? e.pts : e.pts.slice().reverse(); for (let k = 1; k < P.length; k++) pts.push(P[k]); edges.push(e); addRisk(e, e.geomLen); }
      const endFromA = bestEnd === eb.a;
      const ep = partialPts(eb, sb.along, endFromA).reverse(); for (let k = 1; k < ep.length; k++) pts.push(ep[k]);
      if (eb !== edges[edges.length - 1]) edges.push(eb);
      addRisk(eb, endFromA ? sb.along : eb.geomLen - sb.along);
    }
    const legA = Math.hypot(A.x - sa.x, A.y - sa.y), legB = Math.hypot(B.x - sb.x, B.y - sb.y);
    if (legA > 0.5) pts.unshift([A.x, A.y]);
    if (legB > 0.5) pts.push([B.x, B.y]);
    meters += legA + legB;
    const clean = []; for (const p of pts) { const q = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; const l = clean[clean.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) clean.push(q); }
    const streets = []; const seen = new Set(); let campusWalk = false;
    for (const e of edges) {
      if (e.name) { if (!seen.has(e.name)) { seen.add(e.name); streets.push(e.name); } }
      else if (e.campus && /footway|pedestrian|path|cycleway|service|steps/.test(e.cls)) campusWalk = true;
    }
    if (campusWalk && streets.length < 4) streets.push('campus walkways');
    if (!streets.length) streets.push('local walkways');
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return {
      pts: clean, edges, meters: Math.round(meters), minutes: Math.max(1, Math.round(meters / 80)),
      risk: gm ? expo / gm : 0, worst, streets, mode: outMode, accessible, hour, ms: +(t1 - t0).toFixed(1),
    };
  };
  /** Both routes at once; `same` is true when they coincide. */
  TH.routeCompare = function (from, to, opts = {}) {
    const safe = TH.route(from, to, { ...opts, mode: 'safe' }), fast = TH.route(from, to, { ...opts, mode: 'fast' });
    return { safe, fast, same: safe.pts.join() === fast.pts.join() };
  };
})(window.TH = window.TH || {});

