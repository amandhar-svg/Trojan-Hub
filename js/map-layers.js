/* js/map-layers.js */
/* Trojan Hub — map extras: the campus fence with live gate status, the DPS patrol zone, the free USC Lyft
 * zone, and building-code search ("THH", "SGM 123").
 *
 * Real: the campus perimeter (OpenStreetMap campus outline), gate locations and hours, the 9 PM – 6 AM controlled
 * access rule, the Lyft boundary streets (USC Transportation: Normandie / Washington / Main / MLK).
 * Approximate (labeled in the UI): both zone outlines are drawn from street bearings in the map data, and the DPS
 * outline follows DPS's "about 2.5 square miles around UPC" description, not its official map.
 *
 * API: TH.ZONES  TH.inZone(id, x, y)  TH.gateStatus(place, date)  TH.gatesAt(date)  TH.nearestOpenGate(pt, date)
 *      TH.findBuilding(text)  TH.searchBuildings(text)  TH.BLDG()
 *      MapView#setOverlay({fence, dps, lyft, hour})  MapView#showBuilding(b)
 */
(function (TH) {
  'use strict';
  const esc = TH.esc, NS = 'http://www.w3.org/2000/svg';
  const f1 = n => (Math.round(n * 10) / 10).toString();

  // ---------- zones (map meters, x east / y north) ----------
  const ZONES = TH.ZONES = {
    lyft: {
      name: 'Free USC Lyft zone', color: '#ff00bf', approx: true,
      poly: [[-1364, 2168], [85, 2168], [1942, 1208], [732, -1067], [-1364, -1067]],
      edges: [['Washington Blvd', -640, 2168], ['Main St', 1337, 70], ['Martin Luther King Jr. Blvd', -316, -1067], ['Normandie Ave', -1250, 700]],
      note: 'Rides must start and end inside the zone. 7 PM – 2 AM daily.',
    },
    dps: {
      name: 'DPS patrol zone', color: '#0d7d8c', approx: true,
      poly: [[-1364, 2168], [85, 2168], [1596, 1386], [324, -1067], [-1364, -1067]],
      edges: [['Washington Blvd', -640, 2168], ['Grand Ave', 960, 160], ['Martin Luther King Jr. Blvd', -520, -1067], ['Normandie Ave', -1250, 400]],
      note: 'DPS patrols about 2.5 square miles around UPC, 24/7. Outline is approximate.',
    },
  };
  function inPoly(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  TH.inZone = (id, x, y) => !!ZONES[id] && inPoly(x, y, ZONES[id].poly);
  const EXT = { xmin: -1500, xmax: 2050, ymin: -1180, ymax: 2280 };

  // ---------- gates ----------
  const access = () => (TH.SAFETY && TH.SAFETY.access) || {};
  const tmin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
  TH.isControlled = function (date) {
    const A = access(), m = TH.minOfDay(date || TH.clock.now()), a = tmin(A.start || '21:00'), b = tmin(A.end || '06:00');
    return a > b ? (m >= a || m < b) : (m >= a && m < b);
  };
  const status0 = TH.status;
  TH.gateStatus = function (p, at) {
    const now = at || TH.clock.now(), A = access();
    if (TH.isControlled(now)) {
      const open = (A.after9 || []).includes(p.id);
      return open ? { open: true, label: 'Open · ID check', detail: 'USCard or registered guest with photo ID, until 6 AM', tone: 'warn', controlled: true }
        : { open: false, label: 'Closed overnight', detail: 'Reopens 6 AM', tone: 'bad', controlled: true };
    }
    if (p.hours == null) return { open: true, label: 'Open', detail: 'Pedestrian entrance · closes 9 PM', tone: 'ok' };
    return status0(p, now);
  };
  TH.status = function (place, at) { return place && place.cat === 'gate' ? TH.gateStatus(place, at) : status0(place, at); };
  TH.gates = () => (TH.PLACES || []).filter(p => p.cat === 'gate');
  TH.gatesAt = function (date) { const g = TH.gates(), open = g.filter(p => TH.gateStatus(p, date).open); return { all: g, open, closed: g.filter(p => !open.includes(p)), controlled: TH.isControlled(date) }; };
  TH.nearestOpenGate = function (pt, date) {
    const me = pt || TH.ME || { x: 0, y: 0 };
    return TH.gatesAt(date).open.map(g => [g, Math.hypot(g.x - me.x, g.y - me.y)]).sort((a, b) => a[1] - b[1]).map(x => x[0])[0] || null;
  };
  TH.dateAtHour = h => { const d = TH.dayStart(TH.clock.now()); d.setMinutes(Math.round(h * 60)); return d; };
  const fenceRing = () => { const c = ((TH.GEO || {}).campus || []).find(x => x.name === 'University Park Campus'); return c ? c.rings[0] : []; };
  function snap(p, ring) { // nearest point on the fence line
    let best = [p.x, p.y], bd = 1e9;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(p.x - q[0], p.y - q[1]);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  // ---------- building codes ----------
  // codes missing from the map data, matched to OpenStreetMap building names (official USC three-letter codes)
  const EXTRA = [['ACC', 'Leventhal School of Accounting'], ['AHF', 'Allan Hancock Foundation'], ['ASC', 'Annenberg School for Communication'], ['BIT', 'Bing Theater'], ['BKS', 'USC Bookstores'], ['BRI', 'Bridge Hall'],
    ['CAS', 'College Academic Services'], ['FIG', 'Figueroa Building'], ['GEC', 'Galen Center'], ['HAR', 'Harris Hall'], ['HNB', 'Hedco Neurosciences'], ['HER', 'Heritage Hall'], ['HOH', 'Hoffman Hall'], ['HSH', 'Hall Building'],
    ['JEF', 'Jefferson Building'], ['JFF', 'Fertitta Hall'], ['JHH', 'Hubbard Hall'], ['JMC', 'John Mckay Center'], ['JEP', 'Joint Educational Project'], ['KDC', 'Kaufman International Dance'], ['LAW', 'Musick Law Building'],
    ['LRC', 'Lyon Recreation Center'], ['MRF', 'Montgomery Ross Fisher'], ['NCT', 'Norris Cinema'], ['RGL', 'Lewis Hall'], ['SCA', 'Cinematic Arts - SCA'], ['SCB', 'Cinematic Arts -SCB'], ['SCC', 'Cinematic Arts - SCC'],
    ['SCE', 'Cinematic Arts - SCE'], ['SCI', 'Cinematic Arts - SCI'], ['SCX', 'Cinematic Arts - SCX'], ['SSL', 'Seaver Science Library'], ['STO', 'Stonier Hall'], ['STU', 'Student Union'], ['SWC', 'Social Work Center'],
    ['TGF', 'Town and Gown'], ['TTL', 'Technical Theatre Laboratory'], ['SCD', 'Scene Dock Theatre'], ['UAC', 'Uytengsu Aquatics'], ['URC', 'University Religious Center'], ['UUC', 'United University Church'],
    ['VPD', 'Dauterive Hall'], ['MCC', 'McClintock Hall'], ['WTO', 'Webb Tower'], ['ALM', 'Widney Alumni House'], ['PSB', 'Jefferson Blvd. Parking Structure'], ['PSD', 'Royal Street Parking Structure']];
  const ALIAS = { TCC: 'RTCC', VKC: null };
  let BL = null;
  TH.BLDG = function () {
    if (BL) return BL;
    const B = ((TH.GEO || {}).buildings || []), out = [], seen = {};
    const add = (code, b) => { if (!b || seen[code]) return; seen[code] = 1; out.push({ code, name: b.name || `Building ${code}`, x: b.x, y: b.y, id: b.id, usc: !!b.usc, lv: b.lv || null }); };
    B.forEach(b => { if (b.code) add(String(b.code).toUpperCase(), b); });
    EXTRA.forEach(([code, frag]) => add(code, B.find(b => b.name && b.name.toLowerCase().includes(frag.toLowerCase()))));
    Object.keys(ALIAS).forEach(a => { const t = ALIAS[a] && out.find(x => x.code === ALIAS[a]); if (t) out.push(Object.assign({}, t, { code: a, aliasOf: t.code })); });
    BL = out.sort((a, b) => a.code < b.code ? -1 : 1);
    return BL;
  };
  const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  function floorOf(room) {
    const r = String(room || '').toUpperCase();
    if (!r) return null;
    if (/^B/.test(r)) return 'basement level';
    if (/^G/.test(r)) return 'ground floor';
    if (/^LL/.test(r)) return 'lower level';
    const m = /^(\d)(\d{2})[A-Z]?$/.exec(r);
    return m ? (m[1] === '0' ? 'ground floor' : `${ord(+m[1])} floor`) : null;
  }
  // "THH" · "thh 201" · "SGM-123" · "room 101 in VKC" → { b, room, floor } or null
  TH.findBuilding = function (text) {
    const t = String(text || '').trim(); if (t.length < 2) return null;
    const L = TH.BLDG(), by = c => L.find(b => b.code === c);
    let m = /^([A-Za-z]{2,4})[\s-]*((?:B|G|LL)?\d{1,3}[A-Za-z]?)?$/.exec(t);
    if (m && by(m[1].toUpperCase())) return { b: by(m[1].toUpperCase()), room: m[2] ? m[2].toUpperCase() : null, floor: floorOf(m[2]) };
    m = /\b(?:room|rm\.?)\s*((?:B|G|LL)?\d{1,3}[A-Za-z]?)\s*(?:in|at|of|,)?\s*([A-Za-z]{2,4})\b/i.exec(t) || null;
    if (m && by(m[2].toUpperCase())) return { b: by(m[2].toUpperCase()), room: m[1].toUpperCase(), floor: floorOf(m[1]) };
    m = /\b([A-Z]{3,4})\s?((?:B|G|LL)?\d{2,3}[A-Za-z]?)\b/.exec(t) || /\b([A-Z]{3,4})\b/.exec(t);
    if (m && by(m[1])) return { b: by(m[1]), room: m[2] ? m[2].toUpperCase() : null, floor: floorOf(m[2]) };
    return null;
  };
  TH.searchBuildings = function (text) {
    const q = String(text || '').trim().toLowerCase(); if (q.length < 2) return [];
    const hit = TH.findBuilding(text), out = hit ? [hit] : [];
    if (q.length >= 3) {
      const seen = new Set(out.map(h => h.b.id)), L = TH.BLDG();
      ((TH.GEO || {}).buildings || []).filter(b => b.usc && b.name && b.name.toLowerCase().includes(q) && !seen.has(b.id)).slice(0, 4)
        .forEach(b => { const c = L.find(x => x.id === b.id && !x.aliasOf); out.push({ b: c || { code: null, name: b.name, x: b.x, y: b.y, id: b.id, usc: true }, room: null, floor: null }); });
    }
    return out.slice(0, 5);
  };
  TH.bldgLabel = h => `${h.b.code ? h.b.code + ' · ' : ''}${h.b.name}${h.room ? ` · Room ${h.room}${h.floor ? ', ' + h.floor : ''}` : ''}`;

  // ---------- bike parking ----------
  // The map data has no rack points (only three Metro Bike Share docks, which are real OpenStreetMap nodes), so racks
  // are placed beside the buildings where USC keeps them: APPROXIMATE positions, labeled as such in the UI.
  const RACK_AT = ['LVL', 'DML', 'THH', 'SGM', 'RTCC', 'GFS', 'SAL', 'KAP', 'WPH', 'SOS', 'ZHS', 'OHE', 'RTH', 'EEB', 'MHP', 'ACB', 'ADM', 'ANN', 'JFF', 'HOH', 'LRC', 'ESH', 'MCB', 'SSL', 'STU', 'WAH', 'VHE', 'LAW', 'ASC', 'GEC', 'PED', 'IYH'];
  const RACK_NAMES = ['Cowlings Residential College', 'McCarthy Honors Residential College', 'Parkside Apartments', 'Webb Tower', 'Marks Tower', 'Pardee Tower', 'Cale Residential College', 'Nemirovsky Residential College'];
  let RACKS = null;
  TH.bikeRacks = function () {
    if (RACKS) return RACKS;
    const B = ((TH.GEO || {}).buildings || []), L = TH.BLDG(), out = [];
    const put = (b, code) => {
      if (!b) return; const ring = (b.poly && b.poly[0]) || []; if (!ring.length) return;
      const v = ring.reduce((a, q) => q[1] < a[1] ? q : a);                        // the building's south corner, a few meters out
      out.push({ id: 'bk-' + (code || b.id), x: v[0], y: v[1] - 6, near: (b.name || '').replace(/^(Edward L |Grace Ford |Frank R |Ronald |Steven and Katherine |Wallis )/, '').replace(/ of Letters, Arts and Sciences| Junior Memorial| Residential College/, ''), code: code || null, kind: 'rack' });
    };
    RACK_AT.forEach(c => { const e = L.find(x => x.code === c); put(e && B.find(b => b.id === e.id), c); });
    RACK_NAMES.forEach(n => put(B.find(b => b.name === n)));
    ((TH.GEO || {}).pois || []).filter(p => p.kind === 'bike_share').forEach(p => out.push({ id: 'bs-' + p.id, x: p.x, y: p.y, near: 'Metro Bike Share dock', kind: 'share' }));
    RACKS = out;
    return out;
  };
  TH.nearestBike = function (pt) {
    const me = pt || TH.ME || { x: 0, y: 0 };
    const r = TH.bikeRacks().filter(x => x.kind === 'rack').map(x => [x, Math.hypot(x.x - me.x, x.y - me.y)]).sort((a, b) => a[1] - b[1])[0];
    return r ? Object.assign({ walk: Math.max(1, Math.round(r[1] * 1.3 / 80)) }, r[0]) : null;
  };
  Object.assign(TH.iconPaths, { bike: '<circle cx="6" cy="16" r="3.500"/><circle cx="18" cy="16" r="3.500"/><path d="M6 16l4-8h5l3 8M10 8l4 8M9 8h2.500M15 8l-1-2.500h2.500"/>' });

  // ---------- MapView overlay ----------
  const MV = TH.MapView; if (!MV) return;
  const ringD = r => 'M' + r.map(p => `${f1(p[0])} ${f1(-p[1])}`).join('L') + 'Z';
  MV.prototype.setOverlay = function (o) {
    this.ov = Object.assign({ fence: false, dps: false, lyft: false, bikes: false, hour: null }, this.ov || {}, o || {});
    if (!this.gZones) {
      this.gZones = document.createElementNS(NS, 'g'); this.gZones.setAttribute('class', 'mv-layer-zones');
      this.svg.insertBefore(this.gZones, this.gHl);
      this.gGates = document.createElementNS(NS, 'g'); this.gGates.setAttribute('class', 'mv-layer-gates');
      this.svg.insertBefore(this.gGates, this.gMe);
      this._bbox0 = this.bbox;
    }
    const wide = this.ov.dps || this.ov.lyft;
    this.bbox = wide ? Object.assign({}, this._bbox0, EXT) : this._bbox0;
    if (!wide) { this.clamp(); this.apply(); }
    this.renderOverlay();
  };
  MV.prototype.renderOverlay = function () {
    if (!this.gZones) return;
    const ov = this.ov || {}; let s = '';
    ['dps', 'lyft'].forEach(id => {
      if (!ov[id]) return; const z = ZONES[id];
      s += `<path class="mv-zone mv-zone-${id}" d="${ringD(z.poly)}"/>`;
      z.edges.forEach(([name, x, y]) => { s += `<g class="mv-zone-lbl mv-zone-lbl-${id}" style="transform:translate(${f1(x)}px,${f1(-y)}px) scale(var(--k))"><rect x="${-(name.length * 3.3 + 8)}" y="${id === 'dps' ? 4 : -22}" width="${name.length * 6.6 + 16}" height="18" rx="9"/><text y="${id === 'dps' ? 17 : -9}">${esc(name)}</text></g>`; });
    });
    let gs = '';
    if (ov.fence) {
      const ring = fenceRing(), d = ringD(ring), date = ov.hour == null ? TH.clock.now() : TH.dateAtHour(ov.hour);
      s += `<path class="mv-fence-base" d="${d}"/><path class="mv-fence-posts" d="${d}"/>`;
      gs = TH.gates().map(g => {
        const st = TH.gateStatus(g, date), [x, y] = snap(g, ring), short = g.name.replace(/ (Entrance|Ave\.|Blvd\.).*$/, '').replace(/\s*\(pedestrian\)/, '').replace('Jefferson Blvd & ', '').replace('Exposition Blvd & ', '');
        return `<g class="mv-pin mv-gate ${st.open ? 'open' : 'shut'}" data-id="${esc(g.id)}" style="transform:translate(${f1(x)}px,${f1(-y)}px) scale(var(--k))"><title>${esc(g.name)}: ${esc(st.label)}</title>
          <circle class="mv-gate-hit" r="18"/><rect class="mv-gate-box" x="-11" y="-11" width="22" height="22" rx="6"/>
          ${st.open ? '<path class="mv-gate-ic" d="M-5 6V-3l5-4 5 4v9M-1.500 6V0h3v6"/>' : '<path class="mv-gate-ic" d="M-4.500 -4.500l9 9M4.500 -4.500l-9 9"/>'}
          <text class="mv-gate-lbl" y="24">${esc(short)}</text></g>`;
      }).join('');
    }
    if (ov.bikes) gs += TH.bikeRacks().map(r => `<g class="mv-bike ${r.kind}" style="transform:translate(${f1(r.x)}px,${f1(-r.y)}px) scale(var(--k))"><title>${r.kind === 'share' ? 'Metro Bike Share dock' : 'Bike racks by ' + esc(r.near) + ' (approximate spot)'}</title><circle r="9"/><use href="#i-bike" x="-6.500" y="-6.500" width="13" height="13"/></g>`).join('');
    this.gZones.innerHTML = s; this.gGates.innerHTML = gs;
    this.svg.classList.toggle('mv-fence-on', !!ov.fence);
  };
  MV.prototype.fitZone = function (id) { const p = ZONES[id].poly, xs = p.map(q => q[0]), ys = p.map(q => q[1]); this.fitBounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 30); };
  MV.prototype.fitFence = function () { const r = fenceRing(), xs = r.map(q => q[0]), ys = r.map(q => q[1]); if (r.length) this.fitBounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 56); };
  MV.prototype.showBuilding = function (h) {
    const b = h.b || h; this.centerOn(b.x, b.y, 300); this.highlightBuilding(b.id);
    const places = (TH.PLACES || []).filter(p => p.bldg === b.id).slice(0, 3);
    setTimeout(() => { if (this.destroyed) return; this.showCallout({ name: b.name, code: b.code, x: b.x, y: b.y }, places); if (h.room) this.callout.insertAdjacentHTML('beforeend', `<span class="mv-co-room">Room ${esc(h.room)}${h.floor ? ' · usually the ' + esc(h.floor) : ''}</span>`); this.placeCallout(); }, 480);
  };
})(window.TH = window.TH || {});
