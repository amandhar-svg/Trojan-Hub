/* js/map.js */
/* Trojan Hub — campus map (SVG) drawn from real OpenStreetMap geometry (TH.GEO).
 * Illustrated, warm, Disney-park-map feel: soft lawns, warm USC buildings, cardinal accents.
 *
 * API (CONTRACT, v1-compatible):
 *   const mv = new TH.MapView(el, {filter, safety, hour, onSelect, view})
 *   mv.renderPins() mv.applyScale() mv.setSafety(on, hour) mv.showRoute(r, alt) mv.clearRoute()
 *   mv.centerOn(x, y, w) mv.zoom(f) mv.select(id) mv.destroy()   mv.view = {x, y, w, h}
 *   view is in map meters, north-up: view.y is the TOP edge's y; the renderer flips (svgY = -y).
 * Extras: mv.setFilter(fn) mv.setHour(h) mv.fitBounds(minx,miny,maxx,maxy,padPx) mv.highlightBuilding(id)
 *
 * Performance: static geometry is built once into a few combined <path>s. Pan/zoom only change the
 * viewBox and one CSS variable (--k = meters per screen pixel), so pins/labels keep a constant screen size
 * without touching geometry. Label collision runs after zoom/pan settles.
 */
(function (TH) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => (TH.esc ? TH.esc(s) : String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const f1 = v => (Math.round(v * 2) / 2).toString();

  // ---------------------------------------------------------------------------
  // Tolerant accessors for TH.GEO (shapes per CONTRACT, with fallbacks)
  // ---------------------------------------------------------------------------
  function pairs(a) {
    if (!a || !a.length) return [];
    if (typeof a[0] === 'number') { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; }
    return a;
  }
  function ringsOf(poly) { // → [[ [x,y],... ], ...]
    if (!poly || !poly.length) return [];
    if (typeof poly[0] === 'number') return [pairs(poly)];
    if (typeof poly[0][0] === 'number') return [poly];
    if (Array.isArray(poly[0][0]) && typeof poly[0][0][0] === 'number') return poly;
    return poly.flatMap(ringsOf); // deeper nesting (multipolygon)
  }
  const ringD = r => { if (!r.length) return ''; let s = 'M' + f1(r[0][0]) + ' ' + f1(-r[0][1]); for (let i = 1; i < r.length; i++) s += 'L' + f1(r[i][0]) + ' ' + f1(-r[i][1]); return s + 'Z'; };
  const lineD = p => { if (!p.length) return ''; let s = 'M' + f1(p[0][0]) + ' ' + f1(-p[0][1]); for (let i = 1; i < p.length; i++) s += 'L' + f1(p[i][0]) + ' ' + f1(-p[i][1]); return s; };
  const polyD = poly => ringsOf(poly).map(ringD).join('');
  const kindOf = k => String(k || '').replace(/^[a-z_]+=/, '');

  function geo() {
    const G = TH.GEO || {};
    const bb = G.bbox || {};
    const bbox = { xmin: bb.xmin ?? -1014, ymin: bb.ymin ?? -945, xmax: bb.xmax ?? 783.5, ymax: bb.ymax ?? 1445.5 };
    const campus = (G.campus || []).map(c => Array.isArray(c) ? { usc: true, rings: ringsOf(c) } : { name: c.name, usc: c.usc !== false, rings: ringsOf(c.rings || c.poly) });
    const buildings = (G.buildings || []).map((b, i) => ({
      id: b.id ?? 'b' + i, name: b.name || b.n || '', code: b.code || b.ref || '', x: +b.x, y: +b.y,
      rings: ringsOf(b.poly || b.rings || b.p), kind: b.kind || b.k || 'building', usc: !!(b.usc ?? b.onCampus), area: b.area || 0,
    }));
    let blocksSrc = G.blocks || (G.minorBuildings && G.minorBuildings.items) || [];
    if (blocksSrc && !Array.isArray(blocksSrc) && blocksSrc.items) blocksSrc = blocksSrc.items;
    const blocks = blocksSrc.map(it => Array.isArray(it) ? (typeof it[0] === 'string' ? it.slice(1).flatMap(ringsOf) : ringsOf(it)) : ringsOf(it.poly || it.rings || it.p));
    const land = (G.land || G.landuse || []).map(l => ({ kind: kindOf(l.kind || l.k || l.c), name: l.name || l.n || '', rings: ringsOf(l.poly || l.rings || l.p) }));
    const ways = (G.ways || G.streets || []).map(w => {
      const t = w.tags || {};
      const fl = w.f || w.flags || '';
      return { cls: w.c || w.class || w.cls || w.k || '', name: w.n || w.name || '', pts: pairs(w.pts || w.p || w.g), indoor: fl.includes('i') || t.indoor === 'yes' || t.indoor === 'corridor', tunnel: fl.includes('t') || fl.includes('c') || !!t.tunnel };
    });
    const rail = (G.rail || []).map(r => ({ cls: r.c || r.class || r.cls || '', pts: pairs(r.pts || r.p), name: r.n || r.name || '' }));
    return { bbox, campus, buildings, blocks, land, ways, rail, attribution: G.attribution || '© OpenStreetMap contributors (ODbL)' };
  }
  let GEOC = null; const getGeo = () => (GEOC && GEOC.src === TH.GEO) ? GEOC : (GEOC = Object.assign(geo(), { src: TH.GEO }));

  // road classes → style group
  const ROAD = {
    motorway: 'mw', motorway_link: 'mw', trunk: 'mw', trunk_link: 'mw',
    primary: 'pri', primary_link: 'pri', secondary: 'sec', secondary_link: 'sec',
    tertiary: 'ter', tertiary_link: 'ter', residential: 'res', unclassified: 'res', living_street: 'res', busway: 'svc', service: 'svc',
    pedestrian: 'ped', footway: 'foot', path: 'foot', cycleway: 'cyc', track: 'foot', steps: 'steps', bridleway: 'foot',
  };
  const ROAD_ORDER = ['svc', 'res', 'ter', 'sec', 'pri', 'mw'];
  const LAND = {
    grass: 'lawn', park: 'park', garden: 'lawn', village_green: 'lawn', recreation_ground: 'park', playground: 'park', meadow: 'lawn', wood: 'wood', forest: 'wood',
    pitch: 'pitch', track: 'track', stadium: 'stadium', sports_centre: 'stadium', golf_course: 'lawn', fitness_station: 'park',
    water: 'water', swimming_pool: 'water', fountain: 'water', reservoir: 'water',
    parking: 'lot', pedestrian_area: 'plaza', pedestrian: 'plaza', construction: 'cons', railway: 'lot',
  };

  // ---------------------------------------------------------------------------
  // Static base art (built once per TH.GEO, cached as a string)
  // ---------------------------------------------------------------------------
  let BASE = null;
  function buildBase() {
    const g = getGeo();
    if (BASE && BASE.src === g) return BASE;
    const b = g.bbox, pad = 1600;
    let s = `<rect class="mv-ground" x="${b.xmin - pad}" y="${-b.ymax - pad}" width="${b.xmax - b.xmin + 2 * pad}" height="${b.ymax - b.ymin + 2 * pad}"/>`;
    // campus tint
    const camp = g.campus.filter(c => c.usc).map(c => c.rings.map(ringD).join('')).join('');
    s += `<path class="mv-campus" d="${camp}"/>`;
    // land use
    const L = {};
    g.land.forEach(l => { const c = LAND[l.kind]; if (!c) return; (L[c] = L[c] || []).push(l.rings.map(ringD).join('')); });
    for (const c of ['lot', 'cons', 'plaza', 'park', 'lawn', 'wood', 'stadium', 'pitch', 'track', 'water']) if (L[c]) s += `<path class="mv-land mv-l-${c}" d="${L[c].join('')}"/>`;
    // roads: casing then fill by class
    const R = {}; const foot = [], cyc = [], steps = [], ped = [], indoor = [];
    g.ways.forEach(w => {
      if (w.pts.length < 2) return; const c = ROAD[w.cls]; if (!c) return; const d = lineD(w.pts);
      if (w.indoor) { indoor.push(d); return; }
      if (c === 'foot') foot.push(d); else if (c === 'cyc') cyc.push(d); else if (c === 'steps') steps.push(d); else if (c === 'ped') ped.push(d); else (R[c] = R[c] || []).push(d);
    });
    s += `<path class="mv-ped-case" d="${ped.join('')}"/>`;
    for (const c of ROAD_ORDER) if (R[c]) s += `<path class="mv-road-case mv-r-${c}" d="${R[c].join('')}"/>`;
    s += `<path class="mv-ped" d="${ped.join('')}"/>`;
    s += `<path class="mv-foot" d="${foot.join('')}"/><path class="mv-cyc" d="${cyc.join('')}"/><path class="mv-steps" d="${steps.join('')}"/>`;
    for (const c of ROAD_ORDER) if (R[c]) s += `<path class="mv-road mv-r-${c}" d="${R[c].join('')}"/>`;
    // rail (E Line)
    const rl = g.rail.filter(r => r.cls !== 'platform' && r.pts.length > 1).map(r => lineD(r.pts)).join('');
    const pf = g.rail.filter(r => r.cls === 'platform').map(r => ringD(r.pts)).join('');
    s += `<path class="mv-platform" d="${pf}"/><path class="mv-rail-case" d="${rl}"/><path class="mv-rail" d="${rl}"/>`;
    // buildings
    s += `<path class="mv-blocks" d="${g.blocks.map(rs => rs.map(ringD).join('')).join('')}"/>`;
    const off = [], usc = [], res = [], park = [];
    g.buildings.forEach(bd => { const d = bd.rings.map(ringD).join(''); if (!bd.usc) off.push(d); else if (bd.kind === 'residence') res.push(d); else if (bd.kind === 'parking') park.push(d); else usc.push(d); });
    s += `<path class="mv-bldg-off" d="${off.join('')}"/>`;
    const all = usc.concat(res, park).join('');
    s += `<path class="mv-bldg-shadow" transform="translate(1.6 1.8)" d="${all}"/>`;
    s += `<path class="mv-bldg mv-b-usc" d="${usc.join('')}"/><path class="mv-bldg mv-b-res" d="${res.join('')}"/><path class="mv-bldg mv-b-park" d="${park.join('')}"/>`;
    BASE = { src: g, svg: s };
    return BASE;
  }

  // ---------------------------------------------------------------------------
  // Labels (built once; visibility decided by collision layout)
  // ---------------------------------------------------------------------------
  function wrap(name, max = 16) {
    const words = name.split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) lines.push(cur);
    if (lines.length > 3) { const l = lines.slice(0, 3); l[2] = l[2].replace(/\s*\S*$/, '') + '…'; return l; }
    return lines;
  }
  const shortName = n => n.replace(/^USC\s+/, '').replace(/\s*\((?:[^)]*)\)\s*$/, '').replace(/^(?:The )?(?:Ronald|Ron)\s+Tutor\s+Campus\s+Center$/, 'Tutor Campus Center').trim();
  function labelSet() {
    const g = getGeo(); const L = [];
    // area labels
    const areas = (TH.AREAS && TH.AREAS.length) ? TH.AREAS.filter(a => a.x != null && a.y != null).map(a => ({ name: a.name, x: a.x, y: a.y }))
      : g.campus.filter(c => c.usc && c.name && !/^University of Southern/.test(c.name)).map(c => { const r = c.rings[0] || []; let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); return { name: c.name, x: x / (r.length || 1), y: y / (r.length || 1) }; });
    areas.forEach(a => L.push({ t: 'area', x: a.x, y: a.y, pri: 1000, text: { far: wrap(a.name.toUpperCase(), 20), mid: wrap(a.name.toUpperCase(), 22), near: null } }));
    // buildings
    g.buildings.forEach(b => {
      if (!b.name && !b.code) return;
      if (!b.usc && !b.name) return;
      const area = b.area || estArea(b.rings);
      const nm = shortName(b.name || b.code); const code = b.code ? String(b.code).split(/[;,\s]/)[0] : '';
      const big = area > 2500;
      const pri = (b.usc ? 500 : 100) + Math.min(400, Math.sqrt(area) * 3) + (code ? 60 : 0);
      L.push({ t: b.usc ? 'bldg' : 'bldg-off', id: b.id, x: b.x, y: b.y, pri, area,
        text: { far: b.usc && code && area > 4000 ? [code] : null, mid: b.usc ? (code ? [code] : (big ? wrap(nm, 14) : null)) : (area > 6000 ? wrap(nm, 14) : null), near: wrap(nm, 16) } });
    });
    // land names (parks, quads, fields)
    g.land.forEach(l => {
      if (!l.name) return; const c = LAND[l.kind]; if (!c || c === 'lot') return;
      const r = l.rings[0] || []; let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); x /= r.length || 1; y /= r.length || 1;
      const area = estArea(l.rings); if (area < 1200) return;
      L.push({ t: 'land', x, y, pri: 200 + Math.min(200, Math.sqrt(area)), text: { far: area > 40000 ? wrap(l.name, 18) : null, mid: area > 8000 ? wrap(l.name, 16) : null, near: wrap(l.name, 16) } });
    });
    // streets: merge same-named ways into chains, then label the long, nearly straight runs
    const RP = { mw: 5, pri: 4, sec: 4, ter: 3, res: 2, ped: 2, svc: 1, foot: 1, cyc: 1 };
    const byName = new Map();
    g.ways.forEach(w => {
      if (!w.name || w.indoor || w.pts.length < 2) return; const c = ROAD[w.cls]; if (!c || c === 'steps') return;
      if (/niversit/i.test(w.name)) return;
      const k = w.name + '|' + c; (byName.get(k) || byName.set(k, { name: w.name, c, ways: [] }).get(k)).ways.push(w.pts);
    });
    byName.forEach(({ name: full, c, ways }) => {
      const name = full.replace(/^(West|East|North|South) /, '').replace(/ Boulevard$/, ' Blvd').replace(/ Street$/, ' St').replace(/ Avenue$/, ' Ave').replace(/ Parkway$/, ' Pkwy').replace(/ Drive$/, ' Dr');
      const major = RP[c] >= 4;
      chainWays(ways).forEach(ch => straightRuns(ch).forEach(run => {
        if (run.len < 40) return;
        let ang = Math.atan2(-(run.q[1] - run.p[1]), run.q[0] - run.p[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        L.push({ t: 'street', cls: c, major, x: run.m[0], y: run.m[1], ang, seg: run.len, name, pri: 300 + RP[c] * 60 + Math.min(80, run.len / 6),
          text: { far: major ? [name] : null, mid: RP[c] >= 2 ? [name] : null, near: [name] } });
      }));
    });
    return L;
  }
  function chainWays(ways) {
    const key = p => p[0] + ',' + p[1]; const ends = new Map(); const used = new Array(ways.length).fill(false);
    ways.forEach((w, i) => { for (const p of [w[0], w[w.length - 1]]) { const k = key(p); (ends.get(k) || ends.set(k, []).get(k)).push(i); } });
    const take = p => { const L = ends.get(key(p)) || []; for (const j of L) if (!used[j]) { used[j] = true; return j; } return -1; };
    const out = [];
    ways.forEach((w, i) => {
      if (used[i]) return; used[i] = true; let ch = w.slice();
      for (let j; (j = take(ch[ch.length - 1])) >= 0;) { const o = ways[j]; ch = ch.concat((key(o[0]) === key(ch[ch.length - 1]) ? o : o.slice().reverse()).slice(1)); }
      for (let j; (j = take(ch[0])) >= 0;) { const o = ways[j]; ch = (key(o[o.length - 1]) === key(ch[0]) ? o : o.slice().reverse()).slice(0, -1).concat(ch); }
      out.push(ch);
    });
    return out;
  }
  function straightRuns(pts) {
    const runs = []; let i = 0;
    while (i < pts.length - 1) {
      let j = i + 1, len = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
      const a0 = Math.atan2(pts[j][1] - pts[i][1], pts[j][0] - pts[i][0]);
      while (j < pts.length - 1) {
        const a = Math.atan2(pts[j + 1][1] - pts[j][1], pts[j + 1][0] - pts[j][0]); let d = Math.abs(a - a0); if (d > Math.PI) d = 2 * Math.PI - d;
        if (d > 0.22) break; len += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++;
      }
      // midpoint along the run
      let acc = 0, m = pts[i];
      for (let k = i + 1; k <= j; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); if (acc + d >= len / 2) { const t = d ? (len / 2 - acc) / d : 0; m = [pts[k - 1][0] + t * (pts[k][0] - pts[k - 1][0]), pts[k - 1][1] + t * (pts[k][1] - pts[k - 1][1])]; break; } acc += d; }
      runs.push({ p: pts[i], q: pts[j], len, m });
      i = j;
    }
    return runs;
  }
  function estArea(rings) { let a = 0; for (const r of rings) { for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); } return Math.abs(a / 2); }
  function pointInRings(x, y, rings) {
    let inside = false;
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function buildingAt(x, y) {
    const g = getGeo(); let hit = null;
    for (const b of g.buildings) {
      if (Math.abs(b.x - x) > 250 || Math.abs(b.y - y) > 250) continue;
      if (pointInRings(x, y, b.rings)) { if (!hit || (b.area || 0) < (hit.area || 0)) hit = b; }
    }
    return hit;
  }
  TH.buildingAt = buildingAt;

  const FONT = { area: 12.5, bldg: 11, 'bldg-off': 10, land: 10.5, street: 10, streetMajor: 11 };
  const CHAR = 0.58;

  // ---------------------------------------------------------------------------
  // MapView
  // ---------------------------------------------------------------------------
  class MapView {
    constructor(el, opts = {}) {
      const t0 = performance.now();
      this.el = el; this.opts = opts; this.filter = opts.filter || null; this.safety = !!opts.safety; this.hour = opts.hour ?? 12;
      const g = getGeo(); this.bbox = g.bbox;
      const home = { x: -10, y: 250, w: 760 };
      const ov = opts.view;
      const okView = ov && isFinite(ov.x) && isFinite(ov.w) && ov.w > 50 && (ov.x + ov.w / 2) > g.bbox.xmin && (ov.x + ov.w / 2) < g.bbox.xmax && (ov.y - (ov.h || ov.w) / 2) > g.bbox.ymin && (ov.y - (ov.h || ov.w) / 2) < g.bbox.ymax;
      this.view = okView ? { x: ov.x, y: ov.y, w: ov.w, h: ov.h || ov.w } : { x: home.x - home.w / 2, y: home.y + home.w / 2, w: home.w, h: home.w };
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.classList.add('mv-host');
      const base = buildBase();
      el.innerHTML = `<svg class="mv-svg" xmlns="${NS}" role="application" tabindex="0" aria-label="USC campus map from OpenStreetMap. Drag to pan; pinch, scroll or use + and − to zoom; arrow keys pan.">
          <g class="mv-base">${base.svg}</g><g class="mv-layer-hl"></g><g class="mv-layer-safety"></g><g class="mv-layer-labels"></g><g class="mv-layer-route"></g><g class="mv-layer-pins"></g><g class="mv-layer-me"></g><g class="mv-layer-top"></g>
        </svg>
        <div class="mv-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL)</div>
        <div class="mv-callout" hidden></div>`;
      this.svg = el.querySelector('svg');
      const q = s => this.svg.querySelector(s);
      this.gHl = q(".mv-layer-hl"); this.gSafety = q(".mv-layer-safety"); this.gLabels = q(".mv-layer-labels"); this.gRoute = q(".mv-layer-route"); this.gPins = q(".mv-layer-pins"); this.gMe = q(".mv-layer-me"); this.gTop = q(".mv-layer-top");
      this.callout = el.querySelector('.mv-callout');
      this.buildLabels();
      this.bind(); this.fit(); this.render();
      this.ro = new ResizeObserver(() => { this.fit(); this.applyScale(); this.scheduleLayout(); }); this.ro.observe(el);
      this.renderMs = +(performance.now() - t0).toFixed(1);
    }
    // ----- view math -----
    fit() {
      const r = this.el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const ar = r.height / r.width, v = this.view;
      const cx = v.x + v.w / 2, cy = v.y - v.h / 2;
      v.h = v.w * ar; v.x = cx - v.w / 2; v.y = cy + v.h / 2; this.clamp(); this.apply();
    }
    /** Pan by screen pixels. Small pans are composited (CSS translate of the already-rasterized SVG);
     *  the viewBox is committed every ~180 ms or after ~22% of the viewport, and when the gesture ends. */
    panBy(dx, dy) { const k = this.scale(); this.view.x -= dx * k; this.view.y += dy * k; this.clamp(); this.apply(true); }
    apply(fast) {
      const v = this.view, vb = this._vb;
      if (fast && vb && Math.abs(vb.w - v.w) < 1e-6) {
        const k = this.scale(), tx = (vb.x - v.x) / k, ty = (v.y - vb.y) / k, W = this.el.clientWidth || 400, H = this.el.clientHeight || 600;
        if (performance.now() - vb.t < 180 && Math.abs(tx) < W * 0.22 && Math.abs(ty) < H * 0.22) {
          this.svg.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
          if (!this.callout.hidden) this.placeCallout();
          return;
        }
      }
      this._vb = { x: v.x, y: v.y, w: v.w, t: performance.now() };
      if (this.svg.style.transform) this.svg.style.transform = '';
      this.svg.setAttribute('viewBox', `${v.x.toFixed(2)} ${(-v.y).toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`);
      const k = this.scale();
      const z = k > 2.6 ? 'far' : k > 1.25 ? 'mid' : 'near';
      if (this.svg.dataset.zoom !== z) { this.svg.dataset.zoom = z; this.scheduleLayout(0); }
      if (this._pinK && (z !== this._pinZ || Math.abs(k / this._pinK - 1) > 0.3)) { this._pinK = k; clearTimeout(this._rp); this._rp = setTimeout(() => { if (!this.destroyed) this.renderPins(); }, 120); }
      if (!this.callout.hidden) this.placeCallout();
    }
    scale() { const w = this.el.clientWidth || 400; return this.view.w / w; }
    applyScale() { this.svg.style.setProperty('--k', this.scale().toFixed(4)); }
    clamp() {
      const v = this.view, b = this.bbox, r = this.el.getBoundingClientRect();
      const maxW = Math.max(b.xmax - b.xmin, (b.ymax - b.ymin) * (r.width && r.height ? r.width / r.height : 1)) * 1.1;
      const minW = Math.max(90, (r.width || 400) * 0.18);
      if (v.w > maxW) { const f = maxW / v.w; const cx = v.x + v.w / 2, cy = v.y - v.h / 2; v.w *= f; v.h *= f; v.x = cx - v.w / 2; v.y = cy + v.h / 2; }
      if (v.w < minW) { const f = minW / v.w; const cx = v.x + v.w / 2, cy = v.y - v.h / 2; v.w *= f; v.h *= f; v.x = cx - v.w / 2; v.y = cy + v.h / 2; }
      // keep the view center inside the bbox
      const cx = Math.max(b.xmin, Math.min(b.xmax, v.x + v.w / 2)), cy = Math.max(b.ymin, Math.min(b.ymax, v.y - v.h / 2));
      v.x = cx - v.w / 2; v.y = cy + v.h / 2;
    }
    toMap(px, py) { const r = this.el.getBoundingClientRect(), v = this.view; return { x: v.x + (px - r.left) / r.width * v.w, y: v.y - (py - r.top) / r.height * v.h }; }
    toScreen(x, y) { const v = this.view, k = this.scale(); return { x: (x - v.x) / k, y: (v.y - y) / k }; }
    zoomAt(f, px, py) {
      const v = this.view, r = this.el.getBoundingClientRect();
      const m = this.toMap(px, py);
      const before = v.w; v.w *= f; v.h *= f; this.clamp(); f = v.w / before;
      v.x = m.x - (px - r.left) / r.width * v.w; v.y = m.y + (py - r.top) / r.height * v.h;
      this.clamp(); this.apply(); this.applyScale(); this.scheduleLayout();
    }
    zoom(f) { const r = this.el.getBoundingClientRect(); this.animateTo(this.view.x + this.view.w / 2, this.view.y - this.view.h / 2, this.view.w * f, 260); }
    centerOn(x, y, w) { this.animateTo(x, y, w || this.view.w, 450); }
    fitBounds(minx, miny, maxx, maxy, padPx = 48) {
      const r = this.el.getBoundingClientRect(); const W = r.width || 400, H = r.height || 600;
      const w = Math.max((maxx - minx) * W / Math.max(60, W - 2 * padPx), (maxy - miny) * W / Math.max(60, H - 2 * padPx - 120), 220);
      this.animateTo((minx + maxx) / 2, (miny + maxy) / 2 - 0.08 * w * H / W, w, 450);
    }
    animateTo(cx, cy, w, D) {
      const v = this.view, ar = v.h / v.w; this.stopInertia();
      const start = { ...v }, end = { w, h: w * ar, x: cx - w / 2, y: cy + w * ar / 2 };
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || !D) { Object.assign(v, end); this.clamp(); this.apply(); this.applyScale(); this.scheduleLayout(); return; }
      const t0 = performance.now(); const tok = this._anim = {};
      const step = now => {
        if (this._anim !== tok) return;
        const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
        for (const p of ['x', 'y', 'w', 'h']) v[p] = start[p] + (end[p] - start[p]) * e;
        if (k >= 1) this.clamp();
        this.apply(); this.applyScale();
        if (k < 1) requestAnimationFrame(step); else this.scheduleLayout();
      };
      requestAnimationFrame(step);
    }
    stopInertia() { this._inertia = null; }
    // ----- input -----
    bind() {
      const svg = this.svg, pts = new Map(); let moved = 0, last = null, pinchD = 0, vel = [0, 0], lastT = 0;
      const onDown = e => {
        if (e.button > 0) return;
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
        pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY]; vel = [0, 0]; lastT = performance.now();
        this._anim = null; this.stopInertia();
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); }
      };
      const onMove = e => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinchD && d) this.zoomAt(pinchD / d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinchD = d; moved += 10; return; }
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6 && !this.callout.hidden) this.hideCallout();
        const now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
        vel = [vel[0] * 0.5 + 0.5 * dx / dt, vel[1] * 0.5 + 0.5 * dy / dt];
        this.panBy(dx, dy);
      };
      const onUp = e => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId); if (pts.size < 2) pinchD = 0;
        if (pts.size === 1) { last = [...pts.values()][0]; return; }
        if (moved < 8 && e.type === 'pointerup') { this.tap(e.clientX, e.clientY); return; }
        // inertia
        const sp = Math.hypot(vel[0], vel[1]);
        if (sp > 0.25 && performance.now() - lastT < 80 && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
          let [vx, vy] = vel; const tok = this._inertia = {}; let tp = performance.now();
          const step = now => {
            if (this._inertia !== tok) return; const dt = now - tp; tp = now; const decay = Math.pow(0.94, dt / 16);
            vx *= decay; vy *= decay; this.panBy(vx * dt, vy * dt);
            if (Math.hypot(vx, vy) > 0.02) requestAnimationFrame(step); else { this._inertia = null; this.apply(); this.scheduleLayout(); this.emitView(); }
          };
          requestAnimationFrame(step);
        } else { this.apply(); this.scheduleLayout(); this.emitView(); }
      };
      svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove);
      svg.addEventListener('pointerup', onUp); svg.addEventListener('pointercancel', onUp);
      svg.addEventListener('wheel', e => { e.preventDefault(); this._anim = null; this.stopInertia(); const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; this.zoomAt(Math.exp(Math.max(-60, Math.min(60, dy)) * 0.0022), e.clientX, e.clientY); this.hideCallout(); }, { passive: false });
      svg.addEventListener('keydown', e => {
        const k = this.scale() * 60; const m = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, k], ArrowDown: [0, -k] }[e.key];
        if (m) { this.view.x += m[0]; this.view.y += m[1]; this.clamp(); this.apply(); this.scheduleLayout(); this.emitView(); e.preventDefault(); }
        else if (e.key === '+' || e.key === '=') { this.zoom(0.7); e.preventDefault(); }
        else if (e.key === '-' || e.key === '_') { this.zoom(1.4); e.preventDefault(); }
        else if (e.key === 'Escape') this.hideCallout();
      });
      this.callout.addEventListener('click', e => { const b = e.target.closest('[data-mv-place]'); if (b && this.opts.onSelect) { const p = placeById(b.dataset.mvPlace); if (p) this.opts.onSelect(p); } this.hideCallout(); });
    }
    emitView() { if (typeof this.opts.onView === 'function') this.opts.onView({ ...this.view }); }
    tap(cx, cy) {
      const hit = document.elementFromPoint(cx, cy);
      const clu = hit && hit.closest && hit.closest('.mv-cluster');
      if (clu && this._clusters) { const gr = this._clusters[+clu.dataset.cluster]; if (gr && this.view.w <= 220) { this.showCallout({ name: gr.ps.length + ' places here', x: gr.ps[0].x, y: gr.ps[0].y }, gr.ps, 10); return; }
        if (gr) { this.hideCallout(); const xs = gr.ps.map(p => p.x), ys = gr.ps.map(p => p.y); const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); this.centerOn(gr.cx, gr.cy, Math.max(150, Math.min(this.view.w / 2.2, span * 3 + 120))); } return; }
      const pin = hit && hit.closest && hit.closest('.mv-pin');
      if (pin) { const p = placeById(pin.dataset.id); this.hideCallout(); if (p && this.opts.onSelect) this.opts.onSelect(p); return; }
      const m = this.toMap(cx, cy); const b = buildingAt(m.x, m.y);
      if (!b) { this.hideCallout(); this.highlightBuilding(null); return; }
      // a place in this building?
      const inB = (TH.PLACES || []).filter(p => p.bldg === b.id || (p.x != null && pointInRings(p.x, p.y, b.rings)));
      const visible = inB.filter(p => !this.filter || this.filter(p));
      this.highlightBuilding(b.id);
      this.showCallout(b, visible.length ? visible : inB);
    }
    showCallout(b, places, max = 4) {
      const name = b.name || (b.code ? `Building ${b.code}` : 'Building');
      const rows = places.slice(0, max).map(p => { const c = (TH.CATS && TH.CATS[p.cat]) || {}; return `<button type="button" class="mv-co-row" data-mv-place="${esc(p.id)}" style="--pc:${c.color || 'var(--cardinal)'}"><svg class="mv-co-ic" aria-hidden="true"><use href="#i-${c.icon || 'info'}"/></svg><span>${esc(p.name)}</span></button>`; }).join('');
      this.callout.innerHTML = `<b>${esc(name)}</b>${b.code ? `<span class="mv-co-code">${esc(b.code)}</span>` : ''}${rows}`;
      this.callout.hidden = false; this._co = b; this.placeCallout();
    }
    placeCallout() {
      const b = this._co; if (!b) return; const s = this.toScreen(b.x, b.y), r = this.el.getBoundingClientRect();
      const w = this.callout.offsetWidth || 180;
      this.callout.style.transform = `translate(${Math.round(Math.max(8, Math.min(r.width - w - 8, s.x - w / 2)))}px, ${Math.round(s.y - this.callout.offsetHeight - 14)}px)`;
    }
    hideCallout() { if (this.callout && !this.callout.hidden) { this.callout.hidden = true; this._co = null; } }
    highlightBuilding(id) {
      this._hl = id; if (!id) { this.gHl.innerHTML = ''; return; }
      const b = getGeo().buildings.find(x => x.id === id); if (!b) { this.gHl.innerHTML = ''; return; }
      this.gHl.innerHTML = `<path class="mv-bldg-sel" d="${b.rings.map(ringD).join('')}"/>`;
    }
    // ----- rendering -----
    setFilter(f) { this.filter = f; this.renderPins(); }
    setHour(h) { this.hour = h; if (this.safety) this.renderSafety(); }
    setSafety(on, hour) { this.safety = !!on; if (hour != null) this.hour = hour; this.svg.classList.toggle('mv-safety-on', this.safety); this.renderSafety(); this.renderPins(); }
    render() { this.svg.classList.toggle('mv-safety-on', this.safety); this.renderSafety(); this.renderPins(); this.renderMe(); this.applyScale(); this.layoutLabels(); }
    renderMe() {
      const me = TH.ME; let s = '';
      const H = TH.HOME;
      if (H && H.x != null) s += `<g class="mv-home" style="transform:translate(${f1(H.x)}px,${f1(-H.y)}px) scale(var(--k))"><title>${esc(H.label || 'Home')}</title><circle r="11"/><path d="M-5.5 0.5 L0 -5 L5.5 0.5 V5.5 H-5.5Z"/></g>`;
      if (me) s += `<g class="mv-me-g" style="transform:translate(${f1(me.x)}px,${f1(-me.y)}px) scale(var(--k))"><title>${esc(me.label || 'You are here')}</title><circle class="mv-me-pulse" r="20"/><circle class="mv-me-halo" r="12"/><circle class="mv-me-dot" r="7.5"/></g>`;
      this.gMe.innerHTML = s;
    }
    renderSafety() {
      if (!this.safety || !TH.graph || !TH.edgeRisk) { this.gSafety.innerHTML = ''; return; }
      const g = TH.graph, h = this.hour; const by = { low: [], med: [], high: [] };
      for (const e of g.edges) {
        if (e.indoor || (e.priv && !e.campus) || !e.main) continue;
        const r = TH.edgeRisk(e, h), lv = TH.riskLevel(r);
        // keep the green "fewer reports" layer light: streets and named walks only (thousands of tiny paths are costly to paint)
        if (lv === 'low' && !e.name && (e.len < 25 || /^(footway|service|cycleway|path|steps)$/.test(e.cls))) continue;
        by[lv].push(lineD(e.pts));
      }
      let s = `<rect class="mv-dim" x="${this.bbox.xmin - 2000}" y="${-this.bbox.ymax - 2000}" width="${this.bbox.xmax - this.bbox.xmin + 4000}" height="${this.bbox.ymax - this.bbox.ymin + 4000}"/><path class="mv-risk mv-risk-low" d="${by.low.join('')}"/><path class="mv-risk mv-risk-med" d="${by.med.join('')}"/><path class="mv-risk mv-risk-high" d="${by.high.join('')}"/>`;
      // non-sensitive reports near this hour (sensitive rows never appear as points)
      const inc = TH.incidentsAt ? TH.incidentsAt(h, { window: 1.5, days: 60 }) : [];
      const CL = { violent: 'Violent-crime report', personal: 'Personal-safety report', property: 'Property-crime report' };
      const fmtD = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
      s += inc.map(i => `<circle class="mv-inc mv-inc-${i.cat}" cx="${f1(i.x)}" cy="${f1(-i.y)}"><title>${CL[i.cat] || 'Report'} · ${fmtD(i.date)}, around ${TH.fmtMin ? TH.fmtMin(Math.round(i.hour * 60) % 1440) : Math.floor(i.hour) + ':00'} (reported to USC DPS)</title></circle>`).join('');
      // active DPS alerts (< 12 h), never for sensitive alerts
      const now = TH.clock && TH.clock.now ? TH.clock.now().getTime() : Date.now();
      (TH.DPS_ALERTS || []).filter(a => a.x != null && a.y != null && !a.sensitive && a.level !== 'info' && now - Date.parse(a.date) >= 0 && now - Date.parse(a.date) < 12 * 3600e3)
        .forEach(a => { s += `<circle class="mv-alert-ring" cx="${f1(a.x)}" cy="${f1(-a.y)}" r="70"><title>DPS ${esc(a.level)}: ${esc(a.title)}</title></circle>`; });
      this.gSafety.innerHTML = s;
    }
    renderPins() {
      const list = (TH.PLACES || []).filter(p => p.x != null && !p.hidden && (!this.filter || this.filter(p)));
      const now = TH.clock && TH.clock.now ? TH.clock.now() : new Date();
      // Pins that would overlap on screen at this zoom are grouped: 2–4 are spread around their spot; 5+ (away from
      // near zoom) become one numbered cluster pin that zooms in when tapped. Main venues and real places come first,
      // inferred "restrooms inside" entries last, so a building's own pin is never hidden under its restroom pin.
      const k = this.scale(), z = k > 2.6 ? 'far' : k > 1.25 ? 'mid' : 'near';
      const rank = p => (p.inferred ? 3 : p.cat === 'restroom' ? 2 : /^(landmark|gate|service)$/.test(p.cat) ? 1 : 0) - (p.hall || p.seats || p.crowd ? 0.5 : 0);
      const ordered = list.slice().sort((a, b) => rank(a) - rank(b));
      // pin bodies are ~26 x 36 px: group pins whose bodies would overlap at this zoom (screen space)
      const PX = p => [p.x / k, -p.y / k], groups = [];
      ordered.forEach(p => { const [X, Y] = PX(p); const g = groups.find(g2 => Math.abs(g2.X - X) < 27 && Math.abs(g2.Y - Y) < 37); if (g) g.ps.push(p); else groups.push({ x: p.x, y: p.y, X, Y, ps: [p] }); });
      const offs = new Map(), clusters = [];
      const ring = gr => { const n = gr.ps.length, R = 19 + n * 3; return gr.ps.map((p, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, [X, Y] = PX(p); return [p, Math.round(gr.X - X + Math.cos(a) * R), Math.round(gr.Y - Y + Math.sin(a) * R * 0.85)]; }); };
      groups.forEach(gr => { gr.cl = gr.ps.length > 3 && !gr.ps.some(p => p.id === this.sel); });
      // a spread-out group whose pins would land on a neighbour's pins becomes a cluster too (two passes)
      const boxesOf = gr => gr.ps.length === 1 ? [[gr.X - 14, gr.Y - 36, gr.X + 14, gr.Y + 3]] : gr.cl ? [[gr.X - 19, gr.Y - 19, gr.X + 19, gr.Y + 19]] : ring(gr).map(([p, ox, oy]) => { const [X, Y] = PX(p); return [X + ox - 14, Y + oy - 36, X + ox + 14, Y + oy + 3]; });
      const ov = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      for (let pass = 0; pass < 2; pass++) {
        const all = groups.map(boxesOf);
        groups.forEach((gr, i) => { if (gr.cl || gr.ps.length < 2 || gr.ps.some(p => p.id === this.sel)) return; if (all[i].some(bx => groups.some((g2, j) => j !== i && all[j].some(b2 => ov(bx, b2))))) gr.cl = true; });
      }
      groups.forEach(gr => {
        if (gr.ps.length < 2) return;
        if (gr.cl) { clusters.push(gr); gr.ps.forEach((p, i) => offs.set(p.id, i ? null : [Math.round(gr.X - PX(p)[0]), Math.round(gr.Y - PX(p)[1])])); return; } // the group's main place stays as a pin, with a "+N" chip
        ring(gr).forEach(([p, ox, oy]) => offs.set(p.id, [ox, oy]));
      });
      this._pinList = []; this._pinZ = z; this._pinK = k;
      const pins = list.filter(p => offs.get(p.id) !== null).map(p => {
        const c = (TH.CATS && TH.CATS[p.cat]) || { color: 'var(--cardinal)', icon: 'info' };
        let st = { open: true }; try { st = TH.status ? TH.status(p, now) : st; } catch (e) { /* keep */ }
        let lv = null; try { lv = TH.live ? TH.live(p, now) : null; } catch (e) { /* none */ }
        const open = st.open !== false;
        const badge = lv && lv.value != null ? `${lv.value}${lv.unit === 'min' ? 'm' : lv.unit === '%' ? '%' : ''}` : '';
        const bw = badge.length * 6.6 + 30;
        const [ox, oy] = offs.get(p.id) || [0, 0];
        const sel = p.id === this.sel;
        this._pinList.push({ id: p.id, x: p.x, y: p.y, off: [ox, oy], name: pinName(p), bw: badge ? bw : 0 });
        return `<g class="mv-pin${open ? '' : ' closed'}${sel ? ' sel' : ''}" data-id="${esc(p.id)}" style="--pc:${c.color};transform:translate(${f1(p.x)}px,${f1(-p.y)}px) scale(var(--k)) translate(${ox}px,${oy}px)">
          <title>${esc(p.name)}${open ? '' : ' (closed now)'}${badge ? ` · estimated ${esc(lv.label || '')} ${esc(badge)}` : ''}</title>
          <g class="mv-pin-in"><circle class="mv-pin-hit" r="18" cy="-14"/><ellipse class="mv-pin-shadow" rx="5" ry="2" cy="1"/>
          <path class="mv-pin-body" d="M0 0 C-3 -5 -13 -10 -13 -19.5 A13 13 0 1 1 13 -19.5 C13 -10 3 -5 0 0Z"/>
          <use class="mv-pin-icon" href="#i-${c.icon}" x="-7.5" y="-27" width="15" height="15"/>
          ${badge ? `<g class="mv-pin-badge" transform="translate(9 -40)"><rect x="0" y="-8.5" width="${bw.toFixed(0)}" height="17" rx="8.5"/><text x="7" y="3.6"><tspan class="mv-est">EST</tspan><tspan dx="3">${esc(badge)}</tspan></text></g>` : ''}
          <text class="mv-pin-label" y="14">${esc(pinName(p))}</text></g></g>`;
      });
      const cl = clusters.map((gr, i) => {
        gr.cx = gr.ps.reduce((a, p) => a + p.x, 0) / gr.ps.length; gr.cy = gr.ps.reduce((a, p) => a + p.y, 0) / gr.ps.length;
        const lead = gr.ps[0], names = gr.ps.slice(1, 7).map(p => pinName(p)).join(', ') + (gr.ps.length > 7 ? '…' : '');
        this._pinList.push({ id: 'cluster-' + i, x: lead.x, y: lead.y, off: offs.get(lead.id) || [0, 0], name: '', bw: 0, cluster: true });
        const [ox, oy] = offs.get(lead.id) || [0, 0];
        return `<g class="mv-cluster" data-cluster="${i}" style="transform:translate(${f1(lead.x)}px,${f1(-lead.y)}px) scale(var(--k)) translate(${ox - 15}px,${oy - 38}px)"><title>${gr.ps.length - 1} more here: ${esc(names)}. Tap to zoom in.</title>
          <circle class="mv-cluster-hit" r="12"/><circle class="mv-cluster-dot" r="10"/><text y="3.8">+${gr.ps.length - 1}</text></g>`;
      });
      this._clusters = clusters;
      this.gPins.innerHTML = pins.join('') + cl.join('');
      if (this.sel) { const n = this.gPins.querySelector(`.mv-pin[data-id="${cssEsc(this.sel)}"]`); if (n) this.gPins.appendChild(n); }
      this.scheduleLayout(0);
    }
    select(id) {
      if (id && this._clusters && this._clusters.some(g => g.ps.some(p => p.id === id))) { this.sel = id; this.renderPins(); }
      this.sel = id; let selNode = null;
      this.gPins.querySelectorAll('.mv-pin').forEach(p => { const on = p.dataset.id === id; p.classList.toggle('sel', on); if (on) selNode = p; });
      if (selNode) this.gPins.appendChild(selNode);
      const p = id && placeById(id);
      if (p) { const b = (p.bldg && getGeo().buildings.find(x => x.id === p.bldg)) || buildingAt(p.x, p.y); this.highlightBuilding(b ? b.id : null); } else this.highlightBuilding(null);
      this.scheduleLayout(0);
    }
    showRoute(r, alt) {
      if (!r || !r.pts || r.pts.length < 2) { this.clearRoute(); return; }
      const pl = pts => pts.map(p => f1(p[0]) + ',' + f1(-p[1])).join(' ');
      let s = '';
      if (alt && alt.pts && alt.pts.length > 1) s += `<polyline class="mv-route-alt-case" points="${pl(alt.pts)}"/><polyline class="mv-route-alt" points="${pl(alt.pts)}"/>`;
      const tone = TH.riskLevel ? TH.riskLevel(r.risk || 0) : 'low';
      s += `<polyline class="mv-route-case" points="${pl(r.pts)}"/><polyline class="mv-route mv-route-${r.mode || 'safe'}" points="${pl(r.pts)}"/><polyline class="mv-route-dash" points="${pl(r.pts)}"/>`;
      const a = r.pts[0], b = r.pts[r.pts.length - 1];
      s += `<circle class="mv-route-start" style="transform:translate(${f1(a[0])}px,${f1(-a[1])}px) scale(var(--k))" r="6"/>`;
      let top = `<g class="mv-route-end" style="transform:translate(${f1(b[0])}px,${f1(-b[1])}px) scale(var(--k))"><path d="M0 0 C-3 -5 -11 -9 -11 -17 A11 11 0 1 1 11 -17 C11 -9 3 -5 0 0Z"/><circle cy="-17" r="4.2"/></g>`;
      // time bubbles at each route's midpoint
      const mid = (pts, fr = 0.5) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); let acc = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + d >= L * fr) { const t = d ? (L * fr - acc) / d : 0; return [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])]; } acc += d; } return pts[0]; };
      const k0 = this.scale() || 2, mMain = mid(r.pts); let altFr = 0.5;
      if (alt && alt.pts && alt.pts.length > 1) for (const fr of [0.5, 0.3, 0.7, 0.2, 0.8]) { const m = mid(alt.pts, fr); altFr = fr; if (Math.hypot(m[0] - mMain[0], m[1] - mMain[1]) > 60 * k0) break; }
      const bubble = (rt, cls, label, fr = 0.5) => { const m = mid(rt.pts, fr); const txt = `${rt.minutes} min${label ? ' · ' + label : ''}`; const w = txt.length * 6.4 + 16; return `<g class="mv-rbub ${cls}" style="transform:translate(${f1(m[0])}px,${f1(-m[1])}px) scale(var(--k))"><rect x="${(-w / 2).toFixed(1)}" y="-11" width="${w.toFixed(1)}" height="22" rx="11"/><text y="4">${esc(txt)}</text></g>`; };
      if (alt && alt.pts && alt.pts.length > 1) top += bubble(alt, 'alt', alt.mode === 'fast' ? 'fastest' : alt.mode === 'safe' ? 'safest' : '', altFr);
      top += bubble(r, 'main mv-tone-' + tone, alt ? (r.mode === 'fast' ? 'fastest' : r.mode === 'safe' ? 'safest' : '') : '');
      this.gRoute.innerHTML = s; this.gTop.innerHTML = top;
      this._bubbles = [[mid(r.pts), `${r.minutes} min · safest`.length]].concat(alt && alt.pts && alt.pts.length > 1 ? [[mid(alt.pts, altFr), 16]] : []);
      this._routePts = r.pts.concat(alt && alt.pts ? alt.pts : []);
      const xs = this._routePts.map(p => p[0]), ys = this._routePts.map(p => p[1]);
      this.fitBounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 56);
      this.scheduleLayout();
    }
    clearRoute() { this.gRoute.innerHTML = ''; this.gTop.innerHTML = ''; this._routePts = null; this._bubbles = null; this.scheduleLayout(0); }
    destroy() { this.ro && this.ro.disconnect(); clearTimeout(this._lt); this._anim = null; this._inertia = null; this.destroyed = true; }

    // ----- labels -----
    buildLabels() {
      const L = this._labels = labelSet();
      let s = '';
      L.forEach((l, i) => {
        const tr = l.t === 'street' ? `transform="translate(${f1(l.x)} ${f1(-l.y)}) rotate(${(-l.ang).toFixed(1)})"` : `transform="translate(${f1(l.x)} ${f1(-l.y)})"`;
        s += `<text class="mv-lbl mv-lbl-${l.t}${l.major ? ' major' : ''}" data-i="${i}" ${tr}></text>`;
      });
      this.gLabels.innerHTML = s;
      this._lblNodes = [...this.gLabels.children];
      this._lblState = new Array(L.length).fill(null);
    }
    scheduleLayout(delay = 140) { clearTimeout(this._lt); this._lt = setTimeout(() => { if (!this.destroyed) this.layoutLabels(); }, delay); }
    layoutLabels() {
      const L = this._labels; if (!L) return;
      const t0 = performance.now();
      const k = this.scale(), z = this.svg.dataset.zoom || 'mid', v = this.view;
      const W = this.el.clientWidth || 400, H = this.el.clientHeight || 600;
      const C = 48, grid = new Map(); const boxes = [];
      const hit = (b) => { const i0 = Math.floor(b[0] / C), i1 = Math.floor(b[2] / C), j0 = Math.floor(b[1] / C), j1 = Math.floor(b[3] / C); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = grid.get(i * 9973 + j); if (c) for (const o of c) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true; } return false; };
      const add = (b) => { boxes.push(b); const i0 = Math.floor(b[0] / C), i1 = Math.floor(b[2] / C), j0 = Math.floor(b[1] / C), j1 = Math.floor(b[3] / C); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i * 9973 + j; (grid.get(key) || grid.set(key, []).get(key)).push(b); } };
      const scr = (x, y) => [(x - v.x) / k, (v.y - y) / k];
      // reserve pins (and pin labels at near zoom)
      const pinScale = z === 'far' ? 0.72 : 1;
      const showPinLbl = z === 'near';
      // the OSM attribution box is never covered by a label
      const at = this.el.querySelector('.mv-attr'); if (at && at.offsetWidth) { const er = this.el.getBoundingClientRect(), ar = at.getBoundingClientRect(); add([ar.left - er.left - 2, ar.top - er.top - 2, ar.right - er.left + 2, ar.bottom - er.top + 2]); }
      // pass 1: pin bodies and badges; pass 2: pin labels only where they fit (selected pin first)
      const pinScr = [];
      (this._pinList || []).forEach(p => {
        const [sx0, sy0] = scr(p.x, p.y); const sx = sx0 + p.off[0], sy = sy0 + p.off[1];
        if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) return;
        add([sx - 13 * pinScale, sy - 34 * pinScale, sx + 13 * pinScale, sy + 2]);
        if (p.cluster) { add([sx - 27, sy - 50, sx - 3, sy - 26]); return; }
        if (p.bw && z !== 'far') add([sx + 9, sy - 49, sx + 9 + p.bw, sy - 31]);
        pinScr.push([p, sx, sy]);
      });
      pinScr.sort((a, b) => (b[0].id === this.sel) - (a[0].id === this.sel));
      const pinNodes = new Map(); this.gPins.querySelectorAll('.mv-pin').forEach(n => pinNodes.set(n.dataset.id, n));
      pinScr.forEach(([p, sx, sy]) => {
        const node = pinNodes.get(p.id); let show = false;
        if (showPinLbl || p.id === this.sel) {
          const w = p.name.length * 10 * CHAR + 6; const b = [sx - w / 2, sy + 4, sx + w / 2, sy + 18];
          if (p.id === this.sel || (!hit(b) && b[0] >= 2 && b[2] <= W - 2 && b[3] <= H - 2)) { add(b); show = true; }
        }
        if (node) node.classList.toggle('nolbl', !show);
      });
      if (this._routePts) { // keep labels off the route line and its time bubbles
        const P = this._routePts.map(p => scr(p[0], p[1]));
        for (let i = 1; i < P.length; i++) {
          const [ax, ay] = P[i - 1], [bx, by] = P[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 12));
          for (let j = 0; j <= n; j++) { const sx = ax + (bx - ax) * j / n, sy = ay + (by - ay) * j / n; if (sx > -20 && sy > -20 && sx < W + 20 && sy < H + 20) add([sx - 5, sy - 5, sx + 5, sy + 5]); }
        }
        for (const [m, n] of this._bubbles || []) { const [sx, sy] = scr(m[0], m[1]); const w = n * 6.4 + 16; add([sx - w / 2, sy - 12, sx + w / 2, sy + 12]); }
      }
      // candidate labels sorted by priority
      const order = this._order || (this._order = L.map((l, i) => i).sort((a, b) => L[b].pri - L[a].pri));
      const MIN_SAME = 260; const placedStreets = new Map(); const areaBoxes = [];
      for (const i of order) {
        const l = L[i]; const node = this._lblNodes[i];
        let lines = l.text[z];
        if (!lines) { if (this._lblState[i] !== null) { node.textContent = ''; node.classList.remove('on'); this._lblState[i] = null; } continue; }
        const [sx, sy] = scr(l.x, l.y);
        let ok = sx > -80 && sy > -40 && sx < W + 80 && sy < H + 40;
        let box = null;
        if (ok) {
          const fs = l.t === 'street' ? (l.major ? FONT.streetMajor : FONT.street) : FONT[l.t] || 11;
          const tw = Math.max(...lines.map(s => s.length)) * fs * (l.t === 'area' ? 0.78 : CHAR) + 4, th = lines.length * fs * 1.12 + 2;
          if (l.t === 'street') {
            if (l.seg / k < tw + 10) ok = false;
            else {
              const prev = placedStreets.get(l.name);
              if (prev && prev.some(([px, py]) => Math.hypot(px - sx, py - sy) < MIN_SAME)) ok = false;
              const a = l.ang * Math.PI / 180, c = Math.abs(Math.cos(a)), s2 = Math.abs(Math.sin(a));
              const bw = tw * c + th * s2, bh = tw * s2 + th * c; box = [sx - bw / 2, sy - bh / 2, sx + bw / 2, sy + bh / 2];
            }
          } else box = [sx - tw / 2, sy - th / 2, sx + tw / 2, sy + th / 2];
          // labels never run off the map's edges (streets may, they follow the line)
          if (ok && box && l.t !== 'street' && (box[0] < 2 || box[1] < 2 || box[2] > W - 2 || box[3] > H - 2)) ok = false;
          // area names stay off pins, badges and other labels too, so they're never chopped up by pins
          if (ok && box && (l.t === 'area' ? (areaBoxes.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]) || hit(box)) : hit(box))) ok = false;
        }
        if (ok) {
          if (l.t === 'area') { areaBoxes.push(box); add(box); } else add(box);
          if (l.t === 'street') { const a = placedStreets.get(l.name) || []; a.push([sx, sy]); placedStreets.set(l.name, a); }
          const key = z + '|' + lines.join('\n');
          if (this._lblState[i] !== key) {
            if (lines.length === 1) node.textContent = lines[0];
            else node.innerHTML = lines.map((s, n) => `<tspan x="0" dy="${n === 0 ? (-(lines.length - 1) * 0.56).toFixed(2) : 1.12}em">${esc(s)}</tspan>`).join('');
            this._lblState[i] = key;
          }
          node.classList.add('on');
        } else if (this._lblState[i] !== null) { node.classList.remove('on'); }
      }
      this.layoutMs = +(performance.now() - t0).toFixed(1);
    }
  }
  function pinName(p) { return String(p.short || p.name || '').replace(/ \(.*\)$/, '').replace(/^(Shuttle Stop|Zipcar|Blue Light Phone|Safety Ambassador)[:·]? ?/, ''); }
  function placeById(id) { return (TH.byId && TH.byId[id]) || (TH.PLACES || []).find(p => p.id === id) || null; }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

  TH.MapView = MapView;
})(window.TH = window.TH || {});

