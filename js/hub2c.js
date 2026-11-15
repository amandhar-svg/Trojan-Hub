/* js/hub2c.js — Trojan Hub additions, round 3 (all SIMULATED on the demo account):
 * panic alert to DPS, discovery sections on Home with a per-category day/week/month calendar and a Tommy finder,
 * event requests on Home (no separate tab), Slack-style club messages with a student inbox for what clubs send,
 * availability-based room booking (students) and space booking (organizers), wait time in the order sheet.
 * Load after hub2b.js. */
(function (TH) {
  'use strict';
  const { X, save, uid, hash, ago, sim, top, row, note, primaryClub, similarClubs, NAMES, member, duesOf, recEvents, recJobs, hay, chatOpen, payDues, RTYPES, RWHEN, nearestPlace, clubName } = TH.x;
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hub = () => TH.H(), now = () => TH.clock.now(), nowMin = () => TH.minOfDay(now());
  const fmtMin = m => TH.fmtMin(m);
  delete TH.screens.foryou; delete TH.screens.requests;

  // =====================================================================
  // PANIC / SOS: one button. Counts down 3 seconds (so a slip can be cancelled), then the (simulated) alert goes out
  // with your location, and a details step lets you say what's happening with big one-tap chips, a note and a photo.
  // Real numbers stay on screen the whole time. Nothing reaches DPS in this prototype, and the screen says so.
  // =====================================================================
  const SOS_WHAT = [['follow', 'Someone is following me', 'walk'], ['assault', 'Assault or attack', 'alert'], ['medical', 'Medical emergency', 'health'], ['fire', 'Fire or smoke', 'flame'], ['suspicious', 'Suspicious person', 'eye'], ['other', 'Something else', 'chat']];

  // =====================================================================
  // PHOTOS ON THIS DEVICE (reports and SOS alerts). They live inside the account store (localStorage, about 5 MB for
  // everything), so each photo is shrunk to ≤ 800 px and about 150 KB, only the newest 10 photos are kept (an older
  // report or alert keeps a "photo removed to save space" note), and saves are checked, so the app never says
  // "saved" when the device's storage was full.
  // =====================================================================
  const PHOTO_SIDE = 800, PHOTO_CHARS = 150 * 1024, PHOTO_KEEP = 10;
  function shrinkPhoto(file) {
    return new Promise(res => {
      if (!file || (file.type && !/^image\//i.test(file.type))) return res(null);
      const fr = new FileReader(); fr.onerror = () => res(null);
      fr.onload = () => {
        const im = new Image(); im.onerror = () => res(null);
        im.onload = () => {
          const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; let side = PHOTO_SIDE, q = 0.7, out = null;
          try {
            for (let i = 0; i < 12 && W && H; i++) {
              const k = Math.min(1, side / Math.max(W, H)), c = document.createElement('canvas');
              c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
              const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
              out = c.toDataURL('image/jpeg', q);
              if (out.length <= PHOTO_CHARS) break;
              if (q > 0.55) q = Math.round((q - 0.1) * 100) / 100; else side = Math.round(side * 0.8);
            }
          } catch (e) { out = null; }
          res(out && out.length <= PHOTO_CHARS && /^data:image\/jpeg/.test(out) ? out : null);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  // keep the newest `keep` photos across reports and SOS alerts (newest record first); returns how many were removed
  function capPhotos(keep) {
    const x = X(); keep = keep == null ? PHOTO_KEEP : keep; let n = 0, removed = 0;
    [...(x.reports || []), ...(x.panic || [])].filter(r => r && Array.isArray(r.photos) && r.photos.length).sort((a, b) => (b.at || 0) - (a.at || 0))
      .forEach(r => { const room = Math.max(0, keep - n); if (r.photos.length > room) { const drop = r.photos.length - room; r.photos.length = room; r.photosRemoved = (r.photosRemoved || 0) + drop; removed += drop; } n += r.photos.length; });
    return removed;
  }
  // every write of the account store is checked. Flows that handle a full device themselves save through trySave();
  // anywhere else, a failed write first makes room (photos on older reports and alerts) and tries once more.
  let saveOk = true, quiet = 0, failToastAt = 0;
  (function watchSaves() {
    const st = window.TA && TA.store; if (!st || st._thWatch) return; st._thWatch = true;
    const set0 = st.set;
    st.set = function (k, v) {
      let ok = set0.apply(this, arguments) !== false;
      if (k !== 'state') return ok;
      if (!ok && !quiet) {
        let freed = 0; try { freed = capPhotos(3); } catch (e) { freed = 0; }
        if (freed) ok = set0.call(this, k, v) !== false;
        if (Date.now() - failToastAt > 30000) { failToastAt = Date.now(); const msg = ok ? 'This device’s storage was full, so photos on older reports were removed to make room.' : 'Couldn’t save on this device: its storage is full.'; setTimeout(() => { try { TH.toast(msg, 'alert'); } catch (e) { /* no toast host */ } }, 0); }
      }
      saveOk = ok; return ok;
    };
  })();
  function trySave() { quiet++; try { save(); } finally { quiet--; } return saveOk; }
  function commitChecked(msg) { quiet++; try { TH.commit(msg); } finally { quiet--; } return saveOk; }
  Object.assign(TH.x, { shrinkPhoto, capPhotos, trySave, commitChecked, PHOTO_KEEP });
  const removedNote = r => r && r.photosRemoved ? `${r.photosRemoved === 1 ? '1 photo' : r.photosRemoved + ' photos'} removed to save space on this device` : '';
  TH.x.photosRemovedNote = removedNote;

  let lastAlert = null;
  function alertDPS(how) {
    const p = nearestPlace(), loc = p ? p.name : 'your last known spot', x = X(), me = TH.ME || {}, t = Date.now();
    // Tommy can't transfer a call: an alert started from a call is recorded as simulated, and says DPS was not contacted
    const viaCall = /\bcall\b/i.test(String(how || ''));
    const rec = { id: 'SOS-' + (1000 + hash(String(t) + how) % 9000), at: t, time: TH.fmtTime(now()), loc, lat: me.lat || null, lon: me.lon || null, how: viaCall ? 'Call with Tommy (simulated: no transfer, DPS was not contacted)' : how, sim: true, status: 'sent', what: [], note: '', photos: [], live: false,
      updates: viaCall ? [{ at: t, time: TH.fmtTime(now()), text: 'Simulated alert: DPS was not contacted. Call 911 or DPS at 213-740-4321.' }] : [] };
    (x.panic || (x.panic = [])).unshift(rec); if (x.panic.length > 20) x.panic.length = 20; lastAlert = rec;
    TH.commit(`Emergency alert with location (${loc}) — simulated, nothing reached DPS`);
    return loc;
  }
  TH.x.alertDPS = alertDPS; TH.x.lastAlert = () => lastAlert; TH.x.SOS_WHAT = SOS_WHAT;
  // a write that fails makes room (photos on older reports and alerts) and tries once more
  function keepSaved() { return trySave() || (capPhotos(3) > 0 && trySave()); }
  // returns whether the alert (and everything on it) is saved on this device; `strict` skips making room
  const sosUpd = (rec, text, strict) => { rec.updates.push({ at: Date.now(), time: TH.fmtTime(now()), text }); return strict ? trySave() : keepSaved(); };
  TH.panic = function () {
    const dev = $('.device'); if (!dev || $('.x-panic', dev)) return; TH.closeSheet();
    dev.insertAdjacentHTML('beforeend', `<div class="x-panic" role="alertdialog" aria-modal="true" aria-label="Emergency alert" data-ph="count"><div class="x-panic-main"></div><div class="x-panic-btns"></div></div>`);
    const el = $('.x-panic', dev), main = $('.x-panic-main', el), btns = $('.x-panic-btns', el);
    let n = 3, t = null;
    const close = () => { clearInterval(t); el.remove(); if (TH.state.route === 'report') TH.render(true); };
    const callBar = `<div class="p6-sos-call"><a class="btn p6-911" href="tel:911">${icon('phone')} Call 911</a><a class="btn p6-dps" href="tel:+12137404321">${icon('phone')} DPS <span class="mono">213-740-4321</span></a></div>`;
    const sent = () => {
      clearInterval(t); alertDPS('Panic button'); const rec = lastAlert; el.dataset.ph = 'details';
      try { note('dps', 'SOS alert sent (simulated)', `Near ${rec.loc}. Tap to see what you added.`, 'report'); } catch (e) { /* notifications are optional */ }
      el.innerHTML = `<div class="p6-sos">
        <div class="p6-sos-head">${callBar}
          <div class="p6-sos-status"><span class="p6-pulse" aria-hidden="true"></span><span><b>Alert sent with your location</b><small>Simulated · nothing reaches DPS in this prototype. Call if you need help now.</small></span></div></div>
        <div class="p6-sos-body">
          <p class="p6-sos-loc">${icon('pin')}<span>Near <b>${esc(rec.loc)}</b>${rec.lat ? ` · ${rec.lat.toFixed ? rec.lat.toFixed(4) : rec.lat}, ${rec.lon.toFixed ? rec.lon.toFixed(4) : rec.lon}` : ''}<br><small>Sent ${TH.fmtTime(now())} · ${esc(rec.id)}</small></span></p>
          <h2 id="sos-q">What’s happening?</h2><p class="p6-sos-sub">Tap everything that fits. Each tap is added to your alert.</p>
          <div class="p6-sos-chips" role="group" aria-labelledby="sos-q">${SOS_WHAT.map(([k, l, ic]) => `<button type="button" data-sosw="${k}" aria-pressed="false">${icon(ic)}<span>${esc(l)}</span></button>`).join('')}</div>
          <div class="p6-sos-more">
            <label class="sr" for="sos-note">Add details</label><textarea id="sos-note" maxlength="400" rows="2" placeholder="Add details (optional): who, what they look like, which way they went" aria-describedby="sos-saved"></textarea>
            <p class="p6-sos-saved" id="sos-saved" aria-live="polite"></p>
            <div class="p6-sos-row"><button type="button" class="btn o" id="sos-send" disabled>${icon('send')} Add to alert</button><label class="btn o" for="sos-photo">${icon('camera')} Photo</label><input type="file" id="sos-photo" accept="image/*" capture="environment" hidden></div>
            <div class="p6-sos-photos" id="sos-photos"></div>
            <p class="p6-sos-warn" id="sos-ph-warn" role="status" hidden></p>
            <p class="p6-sos-ondevice">${icon('lock')}<span>Your photo and note stay on this device. This alert is simulated.</span></p>
            <button type="button" class="p6-sos-live" id="sos-live" aria-pressed="false"><span class="sw" aria-hidden="true"><i></i></span><span><b>Share live location</b><small id="sos-live-t">Off · tap to keep your position updating</small></span></button>
          </div>
          <ol class="p6-sos-log" id="sos-log" aria-live="polite"></ol>
        </div>
        <div class="p6-sos-end"><button class="btn p6-safe" id="pn-safe">${icon('check')} I’m safe now</button><button class="btn o" id="pn-cancel2">Cancel alert</button></div>
      </div>`;
      TH.bindCommon(el);
      const log = $('#sos-log', el), note2 = $('#sos-note', el), send = $('#sos-send', el), savedEl = $('#sos-saved', el), phWarn = $('#sos-ph-warn', el);
      const warn = t => { phWarn.textContent = t || ''; phWarn.hidden = !t; };
      const paintLog = () => { log.innerHTML = rec.updates.slice().reverse().map(u => `<li><span class="mono">${esc(u.time || '')}</span>${esc(u.text)}</li>`).join(''); };
      // What's typed in the box joins the alert as soon as the student pauses, leaves the box, or ends the alert in any way
      // ("I'm safe now", "Cancel alert", leaving the page). "Add to alert" keeps it and clears the box for another note.
      const kept = rec.note ? rec.note.split('\n').filter(Boolean) : []; let draftUpd = null, nt = null, said = '';
      // the status line and the log are live regions: only touch them when something actually changed
      const SAID = { adding: '<span>Adding to your alert…</span>', added: `${icon('check')}<span>Added to your alert</span>`, more: `${icon('check')}<span>Added. Type more anytime.</span>`, full: `${icon('alert')}<span>Couldn’t save on this device: its storage is full</span>`, '': '' };
      const setSaid = k => { if (said !== k) { said = k; savedEl.innerHTML = SAID[k]; } };
      const paintDraft = () => { const i = rec.updates.indexOf(draftUpd), li = i >= 0 ? log.children[rec.updates.length - 1 - i] : null; if (li && li.lastChild && li.lastChild.nodeType === 3) li.lastChild.textContent = draftUpd.text; else paintLog(); };
      const syncNote = () => {
        clearTimeout(nt); if (!note2.isConnected) return ''; const v = note2.value.trim();
        rec.note = [...kept, v].filter(Boolean).join('\n');
        if (v && !draftUpd) { draftUpd = { at: Date.now(), time: TH.fmtTime(now()), text: 'Note: ' + v }; rec.updates.push(draftUpd); paintLog(); }
        else if (v) { if (draftUpd.text !== 'Note: ' + v) { draftUpd.text = 'Note: ' + v; paintDraft(); } }
        else if (draftUpd) { const i = rec.updates.indexOf(draftUpd); if (i >= 0) rec.updates.splice(i, 1); draftUpd = null; paintLog(); }
        const ok = keepSaved(); setSaid(!ok ? 'full' : v ? 'added' : ''); return v;
      };
      const onHide = () => { if (el.isConnected && note2.isConnected && note2.value.trim()) syncNote(); };
      document.addEventListener('visibilitychange', onHide); window.addEventListener('pagehide', onHide);
      const unhook = () => { clearTimeout(nt); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
      const commitOk = msg => commitChecked(msg) || keepSaved();
      const paintPhotos = () => { $('#sos-photos', el).innerHTML = rec.photos.map((p, i) => `<img src="${p}" alt="Photo ${i + 1} added to the alert">`).join(''); };
      const joinAnd = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
      const addedBits = () => { const n = rec.note ? rec.note.split('\n').filter(Boolean).length : 0, w = rec.what.length, ph = rec.photos.length; return [w ? (w === 1 ? '1 detail' : w + ' details') : '', n ? (n === 1 ? 'your note' : n + ' notes') : '', ph ? (ph === 1 ? '1 photo' : ph + ' photos') : ''].filter(Boolean); };
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-sosw]'); if (!b) return; const k = b.dataset.sosw, on = b.getAttribute('aria-pressed') !== 'true', lab = (SOS_WHAT.find(w => w[0] === k) || [])[1];
        b.setAttribute('aria-pressed', String(on)); const ok = on ? (rec.what.includes(k) || rec.what.push(k), sosUpd(rec, 'Added: ' + lab)) : (rec.what = rec.what.filter(w => w !== k), sosUpd(rec, 'Removed: ' + lab)); if (!ok) setSaid('full');
        paintLog(); if (k === 'other' && on) note2.focus();
      });
      note2.addEventListener('input', () => { const v = note2.value.trim(); send.disabled = !v; clearTimeout(nt); if (v) { setSaid('adding'); nt = setTimeout(syncNote, 700); } else syncNote(); });
      note2.addEventListener('blur', () => { if (note2.value.trim() || draftUpd) syncNote(); });
      send.onclick = () => { const v = syncNote(); if (!v) return; kept.push(v); draftUpd = null; note2.value = ''; send.disabled = true; setSaid('more'); };
      $('#sos-photo', el).onchange = async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        const d = await shrinkPhoto(f); if (!el.isConnected) return; if (!d) return TH.toast('Couldn’t read that photo', 'alert');
        if (rec.photos.length >= 3) rec.photos.shift(); rec.photos.push(d); capPhotos(); warn('');
        if (!sosUpd(rec, 'Photo added', true)) {
          // the photo is what didn't fit: keep the alert and the note, drop the photo, and say so
          rec.photos.pop(); rec.updates[rec.updates.length - 1].text = 'Photo not kept: this device’s storage is full';
          warn(keepSaved() ? 'Couldn’t keep that photo: this device’s storage is full. Your alert and note are saved.' : 'Couldn’t save on this device: its storage is full. Call 911 or DPS if you need help.');
        }
        paintPhotos(); paintLog();
      };
      const live = $('#sos-live', el); let lt = null;
      live.onclick = () => { rec.live = !rec.live; live.setAttribute('aria-pressed', String(rec.live)); clearInterval(lt); sosUpd(rec, rec.live ? 'Live location on' : 'Live location off'); paintLog();
        const lbl = $('#sos-live-t', el), paint = () => { lbl.textContent = rec.live ? `On · updated ${TH.fmtTime(now())} near ${rec.loc} (simulated)` : 'Off · tap to keep your position updating'; }; paint(); if (rec.live) lt = setInterval(() => { if (!el.isConnected) return clearInterval(lt); paint(); }, 10000); };
      $('#pn-safe', el).onclick = () => { syncNote(); unhook(); clearInterval(lt); rec.status = 'safe'; rec.live = false; sosUpd(rec, 'Marked safe'); const ok = commitOk(`Marked safe after an SOS alert (${rec.id})`);
        const bits = addedBits(), last = rec.note ? rec.note.split('\n').filter(Boolean).pop() : '';
        el.dataset.ph = 'safe'; el.innerHTML = `<div class="x-panic-main"><div class="x-panic-n p6-ok">${icon('check')}</div><h2>Glad you’re safe</h2><p>${ok ? `Saved in My reports: your alert${bits.length ? ' with ' + esc(joinAnd(bits)) : ''}.` : 'This device’s storage is full, so this alert couldn’t be saved here.'}${last ? `</p><p class="p6-sos-kept">“${esc(last.length > 90 ? last.slice(0, 88) + '…' : last)}”` : ''}</p><p>If anything changes, call right away:</p>
          <div class="p6-safe-call" role="group" aria-label="Call for help"><a href="tel:911">${icon('phone')} 911</a><a href="tel:+12137404321">${icon('phone')} DPS 213-740-4321</a></div>
          <p style="opacity:.8;font-size:13px">Support after something scary: USC Counseling and Mental Health, <a href="tel:+12137409355">213-740-9355</a> (24/7).</p></div><div class="x-panic-btns"><button class="btn w" data-go="report">See my reports</button><button class="btn o" id="pn-close">Close</button></div>`;
        TH.bindCommon(el); $('#pn-close', el).onclick = close; $('[data-go="report"]', el).addEventListener('click', () => el.remove()); };
      $('#pn-cancel2', el).onclick = () => { syncNote(); unhook(); clearInterval(lt); rec.status = 'cancelled'; rec.live = false; sosUpd(rec, 'Alert cancelled'); const ok = commitOk(`Cancelled an SOS alert (${rec.id})`), kept2 = addedBits().length; close(); TH.toast(`Alert cancelled (simulated).${!ok ? ' Couldn’t save it on this device: storage is full.' : kept2 ? ' What you added is saved in My reports.' : ''} Call 213-740-4321 if you need DPS.`, 'shield'); };
      paintLog();
      setTimeout(() => { const f = $('[data-sosw]', el); f && f.focus({ preventScroll: true }); }, 60);
    };
    const paint = () => { main.innerHTML = `<div class="x-panic-n" aria-live="assertive">${n}</div><h2>Sending SOS</h2><p>Your location will be attached when the countdown ends.</p>`; };
    btns.innerHTML = `<button class="btn w" id="pn-now">Send now</button><button class="btn o" id="pn-cancel">Cancel</button><div class="p6-count-call" role="group" aria-label="Or call for help now"><span>Or call now</span><a href="tel:911">${icon('phone')} 911</a><a href="tel:+12137404321">${icon('phone')} DPS 213-740-4321</a></div>`;
    $('#pn-now', el).onclick = sent; $('#pn-cancel', el).onclick = close;
    paint(); t = setInterval(() => { n--; if (n <= 0) sent(); else paint(); }, 1000);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-xpanic]')) TH.panic(); });
  if (TH.screens.safety) { const s0 = TH.screens.safety.render; TH.screens.safety.render = function () { return s0.call(this).replace('<div class="sos">', m => `<button class="btn block" data-xpanic style="background:var(--bad);min-height:56px;font-size:16px">${icon('alert')} Panic: SOS with my location (simulated)</button>` + m); }; }

  // =====================================================================
  // EVENT CATEGORIES (shared by Home sections, the calendar screen and the Tommy finder)
  // =====================================================================
  // "For … majors" uses the same whole-word major matching as the picks (TH.x.majorFits in hub2a.js), so "Decoding" or
  // "La Mesa programming" never lands in a CS row and a school-wide listing isn't called major-specific
  const majorName = () => ((TH.prefs ? TH.prefs().major : '') || TH.student().major || 'your major').replace(/\s*\(.*\)$/, '');
  const H = e => hay('e' + e.id, [e.title, e.org, (e.cats || []).join(' '), e.desc]);
  const has = (e, re) => re.test(H(e)), cat = (e, re) => (e.cats || []).some(c => re.test(c));
  const CATS = [
    ['me', 'For me', 'sparkle', null],
    ['rec', 'Recommended', 'up', null],
    ['food', 'Free food', 'fork', e => !!e.food],
    ['gear', 'Free USC gear', 'shirt', e => has(e, /free [a-z ]{0,14}(t-?shirts?|shirts?|merch|swag|gear|stickers?|tote|hats?|hoodie)|giveaway|swag|free merch|raffle/)],
    ['career', 'Career', 'bag', e => cat(e, /career|pre-professional/i) || has(e, /career|recruit|resume|internship|networking|employer|info session|interview/)],
    ['major', 'My major', 'grad', e => TH.x.majorFits(e)],
    ['faith', 'Faith', 'star', e => cat(e, /spiritual/i) || has(e, /worship|bible|prayer|shabbat|\bmass\b|faith|fellowship|interfaith|meditation/)],
    ['social', 'Social', 'users', e => cat(e, /social/i) || has(e, /mixer|game night|movie night|party|hangout|social/)],
    ['arts', 'Arts and music', 'sparkle', e => cat(e, /arts/i) || has(e, /concert|music|dance|film|gallery|theat|performance|open mic/)],
    ['well', 'Wellness and sports', 'dumbbell', e => cat(e, /health|recreation|sport/i) || has(e, /yoga|wellness|fitness|workout|mindful|intramural|run club/)],
    ['service', 'Service', 'health', e => cat(e, /service|civic/i) || has(e, /volunteer|community service|cleanup|donation drive/)],
  ];
  const catDef = k => CATS.find(c => c[0] === k) || CATS[1];
  const catTitle = k => k === 'major' ? `For ${majorName()} majors` : k === 'me' ? 'Happening for me' : k === 'rec' ? 'Recommended for you' : k === 'career' ? 'Recommended career events' : k === 'faith' ? 'Faith and spiritual events' : catDef(k)[1];
  const live = () => { const nm = nowMin(); return TH.events().filter(e => e.off >= 0 && !(e.off === 0 && e.end <= nm) && !e.multiDay); };
  function pool(key) {
    const all = live();
    if (key === 'rec') { const r = recEvents(60); const ids = new Map(r.map((o, i) => [String(o.e.id), o])); return all.filter(e => ids.has(String(e.id))).map(e => Object.assign({ _why: ids.get(String(e.id)).why[0], _s: ids.get(String(e.id)).s }, e)); }
    if (key === 'me') { const mine = new Set(hub().calendar.map(c => String(c.ref))), joined = new Set(hub().clubs.map(c => String(c.id))), rec = new Map(recEvents(60).map(o => [String(o.e.id), o])); return all.filter(e => mine.has(String(e.id)) || joined.has(String(e.orgId)) || (rec.has(String(e.id)) && rec.get(String(e.id)).s >= 4)).map(e => Object.assign({ _why: mine.has(String(e.id)) ? 'On your My Day' : joined.has(String(e.orgId)) ? 'From a club you joined' : rec.get(String(e.id)).why[0] }, e)); }
    const f = catDef(key)[3]; return f ? all.filter(f) : all;
  }
  const whenLine = e => `${e.off ? TH.ui.dayLabel(e.date) + ' · ' : ''}${e.allDay ? 'All day' : fmtMin(e.start)}`;

  // =====================================================================
  // TOMMY FINDER: say what you want; Tommy turns it into a category + time + keyword filter
  // =====================================================================
  const FIND = [['food', /\b(food|pizza|boba|snacks?|eat|lunch|dinner|breakfast|hungry|tacos?|donuts?|coffee)\b/], ['gear', /\b(gear|shirts?|merch|swag|free stuff|giveaways?|stickers?)\b/], ['career', /\b(career|jobs?|intern\w*|recruit\w*|resume|network\w*|employers?)\b/], ['major', /\b(my major|major|my classes|department)\b/], ['faith', /\b(relig\w*|faith|church|bible|spiritual|prayer|worship|mass)\b/], ['arts', /\b(music|arts?|concerts?|dance|film|movies?|theat\w*|show)\b/], ['well', /\b(gym|yoga|wellness|sports?|fitness|workout|meditat\w*)\b/], ['service', /\b(volunteer\w*|service)\b/], ['social', /\b(social|party|mixer|hang ?out|meet people|friends)\b/], ['rec', /\b(recommend\w*|for me|suggest\w*|anything good|surprise me)\b/]];
  const STOP = new Set('a an the any some is are there events event free tonight today tomorrow this that week weekend month for me my i want to go find show what whats happening on at in of with and or please tommy something things near campus usc next now do have you can'.split(' '));
  function parseFind(text) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
    const f = { q: String(text || '').trim(), cat: 'all', view: 'week', day: 0, eve: false, wk: false, kw: [] };
    for (const [k, re] of FIND) if (re.test(t)) { f.cat = k; t = t.replace(new RegExp(re.source, 'g'), ' '); break; }
    if (/\btonight\b/.test(t)) { f.view = 'day'; f.eve = true; } else if (/\b(today|now)\b/.test(t)) f.view = 'day'; else if (/\btomorrow\b/.test(t)) { f.view = 'day'; f.day = 1; } else if (/\bweekend\b/.test(t)) f.wk = true; else if (/\bmonth\b/.test(t)) f.view = 'month';
    f.kw = t.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).slice(0, 3);
    return f;
  }
  const BR = { cat: 'rec', view: 'day', day: 0, q: '', eve: false, wk: false, kw: [] };
  function brList() {
    let l = BR.cat === 'all' ? live() : pool(BR.cat);
    if (BR.kw.length) l = l.filter(e => BR.kw.every(k => H(e).includes(k)));
    if (BR.eve) l = l.filter(e => e.start >= 17 * 60);
    if (BR.wk) l = l.filter(e => [0, 6].includes(e.date.getDay()));
    return l.sort((a, b) => a.s - b.s);
  }
  function tommySays(list) {
    const label = BR.cat === 'all' ? 'events' : catTitle(BR.cat).toLowerCase(), span = BR.view === 'day' ? (BR.day === 0 ? (BR.eve ? 'tonight' : 'today') : TH.ui.dayLabel(TH.ui.dayAt(BR.day)).toLowerCase()) : BR.view === 'week' && !BR.kw.length ? 'in the next 7 days' : 'in the next 5 weeks';
    const n = list.length, kw = BR.kw.length ? ` matching “${BR.kw.join(' ')}”` : '';
    if (!n) return `I didn’t find ${label}${kw} ${span}. Want me to ask clubs to host one?`;
    const f = list.filter(e => e.food).length;
    return `${n} ${label}${kw} ${span}${BR.wk ? ', weekends only' : ''}. ${f && BR.cat !== 'food' ? `${f} have free food. ` : ''}Next up: ${list[0].title}, ${whenLine(list[0]).toLowerCase()}.`;
  }
  const evRow = e => row(`data-event="${esc(e.id)}"`, e.food ? 'fork' : 'calendar', esc(e.title), `${e.allDay ? 'All day' : fmtMin(e.start) + (e.end > e.start && e.end < 1440 ? ' – ' + fmtMin(e.end) : '')} · ${esc(e.org || '')}${e._why ? ' · ' + esc(e._why) : ''}`, e.food ? 'var(--c-dining)' : 'var(--c-study)', e.food ? `<span class="pill gold">Free food</span>` : undefined);
  TH.screens.browse = {
    render() {
      const arg = TH.state.params && TH.state.params.arg;
      if (arg) { if (/^q:/.test(arg)) Object.assign(BR, parseFind(arg.slice(2))); else Object.assign(BR, { cat: catDef(arg)[0], q: '', kw: [], eve: false, wk: false, view: 'day', day: 0 }); TH.state.params = {}; }
      const all = brList(), byOff = {}; all.forEach(e => { (byOff[e.off] || (byOff[e.off] = [])).push(e); });
      const wide = BR.kw.length && BR.view === 'week', span = BR.view === 'day' ? [BR.day] : BR.view === 'week' ? Array.from({ length: wide ? 35 : 7 }, (_, i) => i) : null;
      const clubsHit = BR.kw.length ? (TH.CLUBS || []).filter(c => BR.kw.every(k => hay('c' + c.id, [c.name, (c.cats || []).join(' '), c.desc]).includes(k))).sort((a, b) => (b.registered === true) - (a.registered === true)).slice(0, 5) : [];
      const inSpan = BR.view === 'month' ? all.filter(e => e.off < 35) : all.filter(e => span.includes(e.off));
      const dayBlock = o => (byOff[o] || []).length ? `<div class="x-dayh">${esc(TH.ui.dayLabel(TH.ui.dayAt(o)))} · ${(byOff[o] || []).length}</div><div class="rows">${byOff[o].map(evRow).join('')}</div>` : '';
      const t0 = TH.ui.today(), startOff = -((t0.getDay() + 6) % 7);
      return `<div class="screen">${top(BR.cat === 'all' ? 'Events' : catTitle(BR.cat))}<div class="pad screen-body stack">
        <div class="x-find"><form id="br-find"><span class="x-tav" aria-hidden="true">T</span><label class="sr" for="br-q">Tell Tommy what you’re looking for</label><input id="br-q" maxlength="80" placeholder="Tell Tommy: free pizza tonight" value="${esc(BR.q)}" autocomplete="off"><button class="send" aria-label="Find">${icon('search')}</button></form>
          <span class="x-say">${esc(tommySays(inSpan))}</span>${inSpan.length ? '' : `<button class="btn sm gold" id="br-req" style="justify-self:start">${icon('megaphone')} Ask clubs for this</button>`}</div>
        <div class="x-chips scroll">${[['all', 'Everything', 'layers'], ...CATS].map(([k, l, ic]) => `<button class="chip" data-brc="${k}" aria-pressed="${BR.cat === k}">${icon(ic)}${esc(k === 'major' ? majorName() : l)}</button>`).join('')}</div>
        ${clubsHit.length ? `<div class="section"><div class="section-head"><h2>Clubs</h2><button data-go="clubs:${esc(BR.kw.join(' '))}">All</button></div><div class="rows">${clubsHit.map(c => row(`data-club="${esc(c.id)}"`, 'users', esc(c.name), esc(TH.clubCatLabel(c.cat)), 'var(--c-fitness)')).join('')}</div></div>` : ''}
        <div class="seg" role="group" aria-label="Calendar span">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<button data-brv="${k}" aria-pressed="${BR.view === k}">${l}</button>`).join('')}</div>
        ${BR.view === 'day' ? `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map(o => { const d = TH.ui.dayAt(o); return `<button data-brd="${o}" aria-pressed="${o === BR.day}"><span>${o === 0 ? 'Today' : TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b>${(byOff[o] || []).length ? '<i class="evdot"></i>' : '<i style="height:5px"></i>'}</button>`; }).join('')}</div>
          ${dayBlock(BR.day) || `<div class="empty">${icon('calendar')}<b>Nothing that day</b><span>Try the week or month view, or another category.</span></div>`}` : ''}
        ${BR.view === 'week' ? (span.map(dayBlock).join('') || `<div class="empty">${icon('calendar')}<b>Nothing this week</b><span>Try the month view or another category.</span></div>`) : ''}
        ${BR.view === 'month' ? `<div class="x-month">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="dow">${d}</span>`).join('')}${Array.from({ length: 35 }, (_, i) => { const o = startOff + i, d = TH.ui.dayAt(o), n = (byOff[o] || []).length; return `<button data-brd="${o}" class="${o < 0 ? 'past' : n ? '' : 'none'}" aria-pressed="${o === BR.day}" ${o < 0 ? 'disabled' : ''} aria-label="${esc(TH.fmtDate(d))}: ${n} events">${d.getDate()}${n ? `<small>${n}</small>` : ''}</button>`; }).join('')}</div>
          ${dayBlock(BR.day) || `<p class="muted" style="text-align:center">Nothing on ${esc(TH.fmtDate(TH.ui.dayAt(BR.day)))}. Days with a number have events.</p>`}` : ''}
        <span class="muted tiny">Public events from EngageSC, collected Nov 9, 2026. Categories are matched from each event’s title, tags and description on this device.</span>
      </div></div>`;
    },
    mount(host) {
      host.addEventListener('click', e => {
        const c = e.target.closest('[data-brc]'), v = e.target.closest('[data-brv]'), d = e.target.closest('[data-brd]');
        if (c) { Object.assign(BR, { cat: c.dataset.brc, kw: [], q: '', eve: false, wk: false }); TH.render(true); } else if (v) { BR.view = v.dataset.brv; TH.render(true); } else if (d) { BR.day = +d.dataset.brd; TH.render(true); }
      });
      $('#br-find', host).addEventListener('submit', e => { e.preventDefault(); const q = $('#br-q', host).value.trim(); if (!q) return; Object.assign(BR, parseFind(q)); TH.render(true); });
      const rq = $('#br-req', host); if (rq) rq.onclick = () => requestSheet(null, BR.q || (BR.cat === 'all' ? '' : catTitle(BR.cat)));
    },
  };

  // =====================================================================
  // REQUEST AN EVENT (a sheet, opened from Home, a club page, an event or an empty search)
  // =====================================================================
  const TYPECAT = { Social: /social/i, Career: /career|pre-professional/i, Workshop: /academic|career|pre-professional/i, Service: /service|civic/i, Speaker: /academic|career/i, Sports: /sport|recreation/i, Food: /social|cultural/i, Study: /academic/i };
  const RSTOP = new Set('with and the for night day event events free club clubs usc trojan students student some more about that this from want would like have into your our'.split(' '));
  function relevantClubs(title, type, fromId) {
    const words = String(title || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !RSTOP.has(w)), re = TYPECAT[type] || /social/i, joined = new Set(hub().clubs.map(c => String(c.id))), out = [];
    (TH.CLUBS || []).forEach(c => { const h = hay('c' + c.id, [c.name, (c.cats || []).join(' '), c.desc]), kw = words.filter(w => h.includes(w)).length, ct = (c.cats && c.cats.length ? c.cats : [c.cat]).some(k => re.test(k || '')); const sc = kw * 3 + (ct ? 1.5 : 0) + (joined.has(String(c.id)) && (kw || ct) ? 2 : 0) + (c.registered ? 0.5 : 0); if ((kw || ct) && c.registered) out.push([c, sc]); });
    const list = out.sort((a, b) => b[1] - a[1] || hash(a[0].id + title) - hash(b[0].id + title)).slice(0, 4).map(o => o[0]), from = fromId != null ? TH.clubById(fromId) : null;
    if (from && !list.some(c => String(c.id) === String(from.id))) { list.unshift(from); list.length = Math.min(list.length, 4); }
    return list;
  }
  function requestSheet(clubId, title) {
    let type = 'Social';
    const names = l => l.length ? l.map(c => c.name).join(', ') : 'USC Campus Activities, who pass it to a club that fits';
    TH.sheet(`<form class="stack" id="rq-form"><div class="sheet-head"><h2>Request an event</h2><button type="button" class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <p class="muted" style="font-size:13.5px">Say what you want. Tommy sends it to the clubs it fits, and if one schedules it, you get first RSVP.</p>
      <div class="field"><label for="rq-title">What event do you want?</label><input id="rq-title" maxlength="70" placeholder="e.g. Pickup volleyball and pizza" value="${esc(title || '')}"></div>
      <div class="field"><label>Type</label><div class="x-chips">${RTYPES.map(t => `<button type="button" class="chip" data-rqt="${t}" aria-pressed="${t === type}">${t}</button>`).join('')}</div></div>
      <div class="field"><label for="rq-when">Best time</label><select id="rq-when">${RWHEN.map(w => `<option>${w}</option>`).join('')}</select></div>
      <div class="x-route" id="rq-to" aria-live="polite"></div>
      <div class="err" hidden></div><button class="btn block">${icon('megaphone')} Send request</button></form>`, w => {
      const upd = () => { const l = relevantClubs($('#rq-title', w).value, type, clubId); $('#rq-to', w).innerHTML = `<span class="muted tiny">Goes automatically to</span><b style="font-size:14px">${esc(names(l))}</b>`; return l; };
      upd(); $('#rq-title', w).oninput = upd;
      w.addEventListener('click', e => { const t = e.target.closest('[data-rqt]'); if (t) { type = t.dataset.rqt; $$('[data-rqt]', w).forEach(b => b.setAttribute('aria-pressed', String(b === t))); upd(); } });
      $('#rq-form', w).addEventListener('submit', e => {
        e.preventDefault(); const v = $('#rq-title', w).value.trim(), er = $('.err', w); if (v.length < 4) { er.hidden = false; er.textContent = 'Give the event a short name.'; return; }
        const l = upd();
        X().evreqs.unshift({ id: 'rq' + uid(), title: v, type, votes: 1, clubIds: l.map(c => c.id), clubId: l[0] ? l[0].id : null, when: $('#rq-when', w).value, mine: true, status: 'open', at: Date.now() });
        TH.commit(`Requested an event: ${v}`); TH.closeSheet(); TH.toast(l.length ? `Sent to ${l[0].name}${l.length > 1 ? ` and ${l.length - 1} more club${l.length === 2 ? '' : 's'}` : ''}` : 'Sent to Campus Activities'); TH.render(true);
      });
    });
  }
  TH.x.requestSheet = requestSheet;

  // =====================================================================
  // HOME: discovery sections you can scroll, the Tommy finder, requests, what your clubs sent
  // =====================================================================
  const officerNews = () => { seedNews(); return Object.values(X().orgs).flatMap(o => o.sent || []).sort((a, b) => b.at - a.at); };
  const _unused = () => Object.values(X().orgs).flatMap(o => o.sent || []).sort((a, b) => b.at - a.at);
  function spot(e, kicker) {
    const tag = e.food ? 'Free food' : (e.cats || []).find(c => (TH.EV_COLORS || {})[c]), [a, b] = (TH.EV_COLORS || {})[tag] || ['#990000', '#4a0507'];
    return `<button class="x-spot" data-event="${esc(e.id)}" style="background:linear-gradient(135deg, ${a}, ${b})"><span class="k">${esc(kicker)}</span><h3>${esc(e.title)}</h3><span class="m">${esc(whenLine(e))} · ${esc(e.org || '')}</span>${e._why ? `<span class="w">${icon('sparkle')}${esc(e._why)}</span>` : ''}</button>`;
  }
  const colors = e => { const C = TH.EV_COLORS || {}, tag = (e.cats || []).find(c => C[c] && c !== 'Free food') || (e.food ? 'Free food' : null), hh = hash(String(e.orgId || e.id)) % 360; return [tag || (e.cats || [])[0] || 'Event', ...(C[tag] || [`hsl(${hh} 45% 38%)`, `hsl(${hh} 55% 16%)`])]; };
  const whenShort = e => `${e.off === 0 ? 'Today' : e.off === 1 ? 'Tomorrow' : TH.DAYS3[e.date.getDay()] + ' ' + e.date.getDate()}${e.allDay ? '' : ' · ' + fmtMin(e.start)}`;
  function poster(e) { const [tag, a, b] = colors(e); return `<button class="x-post" data-event="${esc(e.id)}" style="--a:${a};--b:${b}"><span class="pt">${e.food ? '★ Free food' : esc(tag)}</span><span class="pb"><span class="pw">${esc(whenShort(e))}</span><b>${esc(e.title)}</b><span class="po">${esc(e.org || '')}</span></span></button>`; }
  const clubPoster = c => `<button class="x-post club" data-club="${esc(c.id)}" style="--h:${hash(c.id) % 360}"><span class="pt">${esc(TH.clubCatLabel(c.cat))}</span><span class="big" aria-hidden="true">${esc(String(c.name).replace(/^(The|USC|Trojan)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</span><span class="pb"><b>${esc(c.name)}</b></span></button>`;
  const nrow = (title, go, items, label) => items.length ? `<section class="x-nrow"><div class="x-rowh"><h2>${title}</h2>${go ? `<button ${go}>${label || 'See all'}</button>` : ''}</div><div class="carousel">${items.join('')}</div></section>` : '';
  function section(key) {
    const all = pool(key); let list = all.filter(e => e.off === 0), label = 'today';
    if (!list.length) { list = all.filter(e => e.off === 1); label = 'tomorrow'; }
    if (list.length < 3) { list = all.filter(e => e.off <= 6); label = 'this week'; }
    if (key === 'rec') list.sort((a, b) => b._s - a._s);
    return nrow(`${esc(catTitle(key))} ${label}`, `data-go="browse:${key}"`, list.slice(0, 12).map(poster), 'Calendar');
  }
  const catsOf = c => (c.cats && c.cats.length ? c.cats : [c.cat]).filter(Boolean);
  const NSTOP = new Set('association society club student students trojan trojans usc university southern california organization group chapter council connections network alliance team and the for of at'.split(' '));
  function becauseClub(c) {
    const mine = new Set(catsOf(c)), like = (TH.CLUBS || []).filter(o => String(o.id) !== String(c.id) && catsOf(o).some(k => mine.has(k))), ids = new Set(like.map(o => String(o.id)));
    const words = c.name.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !NSTOP.has(w));
    const ev = live().filter(e => e.off <= 14 && (String(e.orgId) === String(c.id) || ids.has(String(e.orgId)) || words.some(w => H(e).includes(w)))).sort((a, b) => (String(b.orgId) === String(c.id)) - (String(a.orgId) === String(c.id)) || a.s - b.s).slice(0, 12);
    const clubs = like.filter(o => o.registered).sort((a, b) => words.filter(w => b.name.toLowerCase().includes(w)).length - words.filter(w => a.name.toLowerCase().includes(w)).length || hash(a.id) - hash(b.id)).slice(0, 10);
    return (ev.length >= 2 ? nrow(`Because you’re part of <em>${esc(c.name)}</em>`, '', ev.map(poster)) : '') + (clubs.length >= 3 ? nrow(`Clubs like <em>${esc(c.name)}</em>`, 'data-go="clubs"', clubs.map(clubPoster), 'All clubs') : '');
  }
  function becauseTaste() {
    const p = X().profile, rec = recEvents(80), out = [];
    [...p.goals.slice(0, 2).map(g => [g, `Because you want to work in <em>${esc(g.toLowerCase())}</em>`]), ...p.hobbies.slice(0, 2).map(g => [g, `Because you like <em>${esc(g.toLowerCase())}</em>`])].forEach(([v, title]) => { const l = rec.filter(o => o.hits && o.hits.has(v)).map(o => o.e); if (l.length >= 2) out.push(nrow(title, '', l.slice(0, 12).map(poster))); });
    return out.join('');
  }
  function billboard() {
    const e = pool('rec').sort((a, b) => b._s - a._s || a.s - b.s)[0] || pool('me')[0] || live()[0]; if (!e) return '';
    const [, a, b] = colors(e), on = hub().calendar.some(x => String(x.ref) === String(e.id));
    return `<div class="x-bill" style="--a:${a};--b:${b}"><span class="k">${e._why ? esc(e._why) : 'Top pick for ' + esc(TH.student().first)}</span><h3>${esc(e.title)}</h3><span class="m">${esc(whenShort(e))} · ${esc(e.org || '')}${e.food ? ' · free food' : ''}</span><span class="bb">${on ? `<button class="btn w" data-go="plans">${icon('check')} On My Day</button>` : `<button class="btn w" data-xadd="${esc(e.id)}">${icon('plus')} My Day</button>`}<button class="btn g" data-event="${esc(e.id)}">${icon('info')} Details</button></span></div>`;
  }
  const finder = () => `<div class="x-find"><form id="hm-find"><span class="x-tav" aria-hidden="true">T</span><label class="sr" for="hm-q">Search events and clubs, or tell Tommy what you want</label><input id="hm-q" type="search" maxlength="80" placeholder="Search, or tell Tommy what you want" autocomplete="off"><button class="send" aria-label="Search">${icon('search')}</button></form>
      <div class="x-chips scroll" style="margin-inline:-12px;padding-inline:12px">${CATS.map(([k, l, ic]) => `<button class="chip" data-go="browse:${k}">${icon(ic)}${esc(k === 'major' ? majorName() : l)}</button>`).join('')}</div></div>`;
  function requestRow() {
    const x = X(), reqs = x.evreqs.filter(r => r.status === 'open').sort((a, b) => b.votes - a.votes).slice(0, 8);
    return nrow('Don’t see what you want?', 'id="hm-req"', reqs.map(r => { const v = !!x.votes[r.id] || r.mine; return `<div class="card x-reqc"><span class="t"><button class="x-vote" data-vote="${esc(r.id)}" aria-pressed="${v}" ${r.mine ? 'disabled' : ''} aria-label="${v ? 'You want this' : 'I want this too'}: ${r.votes} votes">${r.votes}<small>${v ? 'voted' : 'vote'}</small></button><b>${esc(r.title)}</b></span><span class="muted" style="font-size:12px">${esc(r.type)} · ${esc(TH.x.reqTo(r))}${r.mine ? ' · you asked' : ''}</span></div>`; }), 'Request an event');
  }
  function clubCards() {
    const chats = hub().clubs.length;
    return officerNews().slice(0, 4).map(n => `<button class="card x-nlc" data-xnews="${esc(n.id)}"><span class="mono muted" style="font-size:11.5px">${esc(n.org)} officers · ${ago(n.at)}${n.sample ? ' · sample' : ''}</span><b>${esc(n.subject)}</b><span class="muted" style="font-size:12.5px">${esc(n.body.replace(/\s+/g, ' ').slice(0, 90))}…</span></button>`).join('') + `<button class="card x-nlc" data-go="chats" style="border-top-color:var(--c-study)"><span class="mono muted" style="font-size:11.5px">Group chats</span><b>${chats ? `${chats} club chat${chats === 1 ? '' : 's'}` : 'Join a club to get its chat'}</b><span class="muted" style="font-size:12.5px">Channels, announcements and everything clubs send you.</span></button>`;
  }
  function openNews(id) { const n = officerNews().find(q => q.id === id); if (!n) return; TH.sheet(`<div class="stack newsletter"><div class="sheet-head"><div><span class="eyebrow">${esc(n.org)} · newsletter${n.sample ? ' · sample' : ''}</span><h2>${esc(n.subject)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div><p style="white-space:pre-line">${esc(n.body)}</p><span class="muted tiny">Sent in Trojan Hub and by email ${ago(n.at)}.</span></div>`); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-xnews]'); if (b) openNews(b.dataset.xnews); });
  const home0 = TH.screens.home.render, homeM0 = TH.screens.home.mount;
  TH.screens.home.render = function () {
    let h = home0.call(this);
    h = h.replace('<button data-go="alerts" aria-label="Alerts">', m => `<button class="x-sos" data-xpanic aria-label="SOS panic button: simulated alert with my location">SOS</button>` + m);
    h = h.replace('data-go="pass:room"', () => 'data-go="book:room"');
    const t = document.createElement('template'); t.innerHTML = h;
    const body = t.content.querySelector('.screen-body'), quick = body && body.querySelector('.quick'); if (!body || !quick) return h;
    body.classList.add('x-nf');
    const kids = () => [...body.children], secH = txt => kids().find(n => n.classList.contains('section') && ((n.querySelector('h2') || {}).textContent || '').startsWith(txt));
    const feed = cls => kids().find(n => n.matches('section.feed-sec') && n.querySelector(cls));
    const wait = secH('Wait times'), plans = body.querySelector('.plans-now'), park = body.querySelector('.parkcard'), clubsWk = secH('Your clubs this week'), promo = kids().find(n => n.matches('.card.promo'));
    const study = feed('.feed-band.study'), gear = feed('.feed-band.gear'), perk = feed('.feed-band.perk'), news = feed('.feed-band.news'), watch = feed('.watchbox');
    [secH('Happening today'), secH('Coming up'), feed('.feed-band.food'), feed('.feed-band.major')].forEach(n => n && n.remove());
    if (news) { const b = news.querySelector('.feed-band button'); if (b) { b.dataset.go = 'chats'; b.textContent = 'Messages'; } const car = news.querySelector('.carousel'); if (car) car.insertAdjacentHTML('afterbegin', clubCards()); else news.insertAdjacentHTML('beforeend', `<div class="carousel">${clubCards()}</div>`); }
    let anchor = quick;
    const put = x => { if (!x) return; if (typeof x === 'string') { const f = document.createElement('template'); f.innerHTML = x; [...f.content.children].forEach(n => { anchor.after(n); anchor = n; }); } else { anchor.after(x); anchor = x; } };
    const mine = [...hub().clubs.map(m => TH.clubById(m.id)), primaryClub()].filter(Boolean).filter((c, i, a) => a.findIndex(o => String(o.id) === String(c.id)) === i).slice(0, 3);
    // the top of Home: buttons, wait times, your calendar. Then search and the rows.
    put(wait); put(plans); put(park); put(study);
    put(finder()); put(billboard());
    put(section('rec')); put(section('me'));
    mine.slice(0, 1).forEach(c => put(becauseClub(c)));
    put(section('food')); put(becauseTaste()); put(news); put(clubsWk);
    mine.slice(1).forEach(c => put(becauseClub(c)));
    put(section('career')); put(section('major')); put(gear); put(perk);
    put(requestRow());
    put(section('faith')); put(section('social')); put(section('arts')); put(section('well')); put(section('service'));
    put(watch); put(promo);
    put(`<span class="muted tiny">Public events from EngageSC (engage.usc.edu), collected Nov 9, 2026. Rows are built on this device from your clubs, your profile and each event’s listing.</span>`);
    return t.innerHTML;
  };
  TH.screens.home.mount = function (host) {
    homeM0 && homeM0.call(this, host);
    const f = $('#hm-find', host); if (f) f.addEventListener('submit', e => { e.preventDefault(); const q = $('#hm-q', host).value.trim(); if (q) TH.go('browse', { arg: 'q:' + q }); });
    const rq = $('#hm-req', host); if (rq) rq.onclick = () => requestSheet();
    host.addEventListener('click', e => { const b = e.target.closest('[data-xadd]'); if (!b) return; const ev = TH.eventById(b.dataset.xadd); if (ev) TH.confirmAct('saveEvent', [ev.id], { title: 'Add to My Day?', ok: 'Add', rows: [['Event', ev.title], ['When', TH.when(ev)]], toast: 'Added to My Day' }); });
    host.addEventListener('click', e => { const v = e.target.closest('[data-vote]'); if (!v) return; const x = X(), r = x.evreqs.find(q => q.id === v.dataset.vote); if (!r) return; if (x.votes[r.id]) { delete x.votes[r.id]; r.votes--; } else { x.votes[r.id] = true; r.votes++; TH.toast('Vote counted. Clubs see the total.', 'up'); } save(); TH.render(true); });
  };

  // =====================================================================
  // CLUB MESSAGES: Slack/GroupMe-style channels per club + everything clubs send out
  // =====================================================================
  const CHANS = [['general', 'Day-to-day chat'], ['events', 'Plans, carpools, photos'], ['announcements', 'Officers only']];
  const hue = s => hash(s) % 360, ini = n => String(n || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const SEEDS = { general: [['Welcome in! Say hi and tell us your year and major.', 3000], ['Anyone studying at Leavey tonight? We have a table on the 2nd floor.', 190], ['I’ll be there around 8.', 171], ['Reminder that dues unlock this chat for new members, so nudge your friends.', 44]], events: [['Who’s carpooling to the next event? I can drive 3.', 300], ['Me please! Meet at Tommy Trojan?', 280], ['Photos from last week are in the shared album.', 95]] };
  function chanMsgs(clubId, ch, clubNameStr) {
    const x = X(), id = `club:${clubId}#${ch}`, t = Date.now(), h = hash(id), out = [];
    if (ch === 'announcements') ((x.orgs[clubId] || {}).sent || []).forEach(n => out.push({ k: 'n' + n.id, who: `${clubNameStr} officers`, officer: true, text: `${n.subject}\n\n${n.body}`, at: n.at, likes: 3 + hash(n.id) % 9 }));
    else (SEEDS[ch] || []).forEach(([text, m], i) => out.push({ k: 's' + i, who: NAMES[(h + i * 7) % NAMES.length], text, at: t - m * 60000, likes: (h + i) % 4, sample: true }));
    (x.chats[id] || []).forEach(m => out.push(Object.assign({ k: 'u' + m.at, likes: 0 }, m)));
    return out.sort((a, b) => a.at - b.at);
  }
  const lastSeen = id => (X().seen || (X().seen = {}))[id] || 0;
  const tm = at => ago(at);
  function thread(club, ch, isOrg) {
    const id = `club:${club.id}#${ch}`, msgs = chanMsgs(club.id, ch, club.name), x = X(), likes = x.likes || (x.likes = {}), canPost = ch !== 'announcements' || isOrg;
    const paidN = TH.xo ? TH.xo.roster({ id: String(club.id), club, kind: 'club' }).filter(m => m.paid).length : 0;
    let lastDay = '';
    const body = msgs.map(m => { const dk = Date.now() - m.at < 864e5 ? 'a' : 'b', div = dk !== lastDay ? `<div class="x-div">${Date.now() - m.at < 864e5 ? 'Last 24 hours' : 'Earlier'}</div>` : ''; lastDay = dk; const lk = !!likes[id + m.k], n = (m.likes || 0) + (lk ? 1 : 0);
      return `${div}<div class="x-m"><span class="x-av" style="--h:${m.me ? 0 : hue(m.who)}">${esc(ini(m.who))}</span><div><div class="hd"><b>${esc(m.who)}</b>${m.officer ? `<span class="pill gold">Officer</span>` : ''}<span>${esc(tm(m.at))}${m.sample ? ' · sample' : ''}</span></div><div class="tx">${esc(m.text)}</div><button class="lk" data-like="${esc(m.k)}" aria-pressed="${lk}" aria-label="Like, ${n}">♥ ${n}</button></div></div>`; }).join('');
    return `<div class="screen">${top('#' + ch)}<div class="pad screen-body stack" style="gap:10px">
      <div style="display:flex;gap:10px;align-items:center"><span class="x-av" style="--h:${hue(club.id)}">${esc(ini(club.name))}</span><span style="flex:1;min-width:0"><b>${esc(club.name)}</b><br><span class="muted" style="font-size:12.5px">${paidN || 'All'} paid members · syncs with Slack and GroupMe when linked</span></span></div>
      <div class="x-chips scroll">${CHANS.map(([c]) => `<button class="chip" data-chan="${c}" aria-pressed="${c === ch}"># ${c}</button>`).join('')}</div>
      ${ch === 'announcements' ? `<div class="x-pin">${icon('megaphone')}<span>Newsletters and announcements from the officers land here and in your email, depending on your alert settings.</span></div>` : ch === 'general' ? `<div class="x-pin">${icon('lock')}<span>Members who paid dues are added automatically, whenever they pay.</span></div>` : ''}
      <div class="x-msgs">${body || `<div class="empty">${icon('chat')}<b>Nothing here yet</b><span>${ch === 'announcements' ? 'Officer newsletters will show up here.' : 'Start the conversation.'}</span></div>`}</div></div></div>
      <div class="composer pad">${canPost ? `<form id="ch-form"><label class="sr" for="ch-in">Message</label><input id="ch-in" maxlength="300" placeholder="Message #${ch}" autocomplete="off"><button class="send" aria-label="Send">${icon('send')}</button></form>` : `<span class="muted" style="font-size:13px;text-align:center">Only officers can post in #announcements. Reply in #general.</span>`}</div>`;
  }
  function threadMount(host, club, ch, isOrg, route) {
    const id = `club:${club.id}#${ch}`, x = X(); (x.seen || (x.seen = {}))[id] = Date.now(); save();
    host.scrollTop = host.scrollHeight;
    host.addEventListener('click', e => {
      const c = e.target.closest('[data-chan]'), l = e.target.closest('[data-like]');
      if (c) { if (route === 'orgchat') { TH.state.xchan = c.dataset.chan; TH.render(); } else TH.go('chats', { arg: `club:${club.id}#${c.dataset.chan}` }); }
      else if (l) { const lk = x.likes || (x.likes = {}), k = id + l.dataset.like; if (lk[k]) delete lk[k]; else lk[k] = 1; save(); TH.render(true); }
    });
    const f = $('#ch-form', host.parentNode); if (f) f.addEventListener('submit', e => { e.preventDefault(); const v = $('#ch-in').value.trim(); if (!v) return; (x.chats[id] || (x.chats[id] = [])).push({ me: true, who: TH.student().full, officer: isOrg && ch === 'announcements', text: v, at: Date.now() }); save(); if (route === 'orgchat') TH.render(); else { TH.state.params = { arg: id }; TH.render(); } });
  }
  let msgTab = 'chats';
  const parseChan = arg => { const m = /^club:([^#]+)(?:#(\w+))?$/.exec(arg || ''); return m ? { club: TH.clubById(m[1]), ch: CHANS.some(c => c[0] === m[2]) ? m[2] : 'general' } : null; };
  TH.screens.chats = {
    render() {
      const arg = TH.state.params && TH.state.params.arg, pc = parseChan(arg), x = X();
      if (pc && pc.club && chatOpen(pc.club)) { TH.state._chan = pc; return thread(pc.club, pc.ch, false); }
      TH.state._chan = null;
      const clubs = hub().clubs.map(m => TH.clubById(m.id)).filter(Boolean), news = officerNews(), digests = TH.news ? TH.news.issues() : [];
      const ext = [...(x.conn.slack ? [['Slack · sample workspace', '#611f69', ['general', 'events']]] : []), ...(x.conn.groupme ? [['GroupMe · Floor 4', '#00aff0', ['group chat']]] : [])];
      return `<div class="screen">${top('Club Messages')}<div class="pad screen-body stack">
        <div class="seg" role="group" aria-label="What to show"><button data-mt="chats" aria-pressed="${msgTab === 'chats'}">Group chats</button><button data-mt="sent" aria-pressed="${msgTab === 'sent'}">From clubs${news.length ? ` (${news.length})` : ''}</button></div>
        ${msgTab === 'chats' ? `${clubs.length ? clubs.map(c => { const open = chatOpen(c); return `<div class="x-ws"><div class="x-ws-h"><span class="x-av" style="--h:${hue(c.id)}">${esc(ini(c.name))}</span><b>${esc(c.name)}</b>${open ? '' : `<button class="btn sm gold" data-pay="${esc(c.id)}">Pay ${TH.money(duesOf(c))} dues</button>`}</div>
            ${open ? CHANS.map(([ch, sub]) => { const ms = chanMsgs(c.id, ch, c.name), last = ms[ms.length - 1], un = ms.filter(m => !m.me && m.at > lastSeen(`club:${c.id}#${ch}`) && m.at > Date.now() - 864e5).length; return `<button class="x-chan" data-go="chats:club:${esc(c.id)}#${ch}"><span class="hash">#</span><span class="cm"><b>${ch}</b><span>${last ? esc(last.who.split(' ')[0] + ': ' + last.text.replace(/\s+/g, ' ').slice(0, 60)) : esc(sub)}</span></span>${un ? `<span class="un">${un}</span>` : ''}</button>`; }).join('') : `<div class="x-chan"><span class="hash">${icon('lock')}</span><span class="cm"><b>Members-only channels</b><span>Pay dues in the app or on the club’s Venmo to get in</span></span></div>`}</div>`; }).join('')
          : `<div class="empty">${icon('chat')}<b>No club chats yet</b><span>Join a club and its channels show up here.</span><button class="btn sm" data-go="clubs">Find clubs</button></div>`}
          ${ext.map(([n, col, chs]) => `<div class="x-ws"><div class="x-ws-h"><span class="x-av" style="background:${col}">${esc(n[0])}</span><b>${esc(n)}</b><span class="pill mute">Linked</span></div>${chs.map(ch => `<div class="x-chan"><span class="hash">#</span><span class="cm"><b>${esc(ch)}</b><span>Mirrored here once the real account is linked</span></span></div>`).join('')}</div>`).join('')}
          <button class="btn ghost block" data-go="connect">${icon('link')} ${x.conn.slack || x.conn.groupme ? 'Manage Slack and GroupMe' : 'Link Slack or GroupMe'}</button>`
        : `${news.length ? `<div class="rows">${news.map(n => row(`data-xnews="${esc(n.id)}"`, 'megaphone', esc(n.subject), `${esc(n.org)} officers · ${ago(n.at)}${n.sample ? ' · sample' : ''}`, 'var(--cardinal)')).join('')}</div>` : ''}
          ${digests.length ? `<div class="section"><div class="section-head"><h2>Weekly digests</h2><button data-go="news">All</button></div><div class="rows">${digests.slice(0, 5).map(i => row(`data-digest="${esc(i.club.id)}"`, 'mail', esc(i.club.name), `${esc(i.headline)} · ${i.thisWk.length} this week`, 'var(--c-fitness)')).join('')}</div></div>` : ''}
          ${!news.length && !digests.length ? `<div class="empty">${icon('mail')}<b>Nothing yet</b><span>Newsletters and announcements from clubs you join or follow land here.</span></div>` : ''}`}
        ${sim('Chats are simulated. Other people’s messages are samples; yours stay on this device.')}
      </div></div>`;
    },
    mount(host) {
      const pc = TH.state._chan; if (pc) return threadMount(host, pc.club, pc.ch, false, 'chats');
      host.addEventListener('click', e => {
        const t = e.target.closest('[data-mt]'), p = e.target.closest('[data-pay]'), d = e.target.closest('[data-digest]');
        if (t) { msgTab = t.dataset.mt; TH.render(); } else if (p) payDues(TH.clubById(p.dataset.pay)); else if (d && TH.news) TH.news.open(d.dataset.digest);
      });
    },
  };
  TH.screens.orgchat = {
    render() { const org = TH.xo.cur(); if (!org.club) return `<div class="screen">${top('Members chat')}<div class="pad empty">${icon('chat')}<b>Pick a club</b></div></div>`; return thread(org.club, TH.state.xchan || 'general', true); },
    mount(host) { const org = TH.xo.cur(); if (org.club) threadMount(host, org.club, TH.state.xchan || 'general', true, 'orgchat'); },
  };
  // a sample officer newsletter so the inbox, #announcements and Home show what one looks like
  function seedNews() {
    const x = X(), p = primaryClub(); if (x.seed3 || !p) return; x.seed3 = true;
    const o = x.orgs[p.id] || (x.orgs[p.id] = {}); if (!Array.isArray(o.sent)) o.sent = [];
    const ev = (TH.CLUB_EVENTS || []).filter(e => String(e.orgId) === String(p.id) && e.start && TH.laDate(e.start) >= now()).slice(0, 3);
    o.sent.push({ id: 'nl-sample', sample: true, org: p.name, at: Date.now() - 26 * 36e5, count: 16, emailed: true, subject: `${p.name}: this week and what’s next`, body: `Hi everyone,\n\nThanks to all who came out last week. Here’s what’s coming up:\n${ev.map(e => `• ${e.title}, ${TH.when(e)}`).join('\n') || '• New events are being planned. Tell us what you want on the Home screen.'}\n\nYou asked for a late-night study break with boba, and it’s the most requested event right now. We’re booking a room and will post the date here first.\n\nDues are open in Trojan Hub or on our Venmo. Paying adds you to the members chat automatically.\n\nFight on,\nYour officers` });
    save();
  }

  // =====================================================================
  // SLOT BOOKING: shared pieces for students (Book a Room) and organizers (Book a Space)
  // =====================================================================
  const hr = h => { const m = h * 60; return fmtMin(m).replace(':00', '').replace(' ', '').toLowerCase(); };
  const dayStrip = (sel, n, attr) => `<div class="week" role="group" aria-label="Day">${Array.from({ length: n }, (_, o) => { const d = TH.ui.dayAt(o); return `<button type="button" ${attr}="${o}" aria-pressed="${o === sel}"><span>${o === 0 ? 'Today' : TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b><i style="height:5px"></i></button>`; }).join('')}</div>`;
  const legend = mine => `<div class="x-legend"><span><i style="background:var(--ok-bg);border:1px solid var(--ok)"></i>Open</span><span><i style="background:var(--surface-2)"></i>Taken</span>${mine ? `<span><i style="background:var(--warn-bg)"></i>Yours</span>` : ''}<span><i style="background:var(--cardinal)"></i>Your pick</span></div>`;

  // ---------- students: Book a Room ----------
  const RES = { room: [['Room L1-A', '6 seats · whiteboard, screen'], ['Room L1-B', '6 seats · whiteboard'], ['Room L1-D', '4 seats · screen'], ['Room L1-F', '14 seats · large screen, camera']], racquetball: [['Court 1', 'Lyon Center, lower level'], ['Court 2', 'Lyon Center, lower level']] };
  const BK = { id: 'room', day: 0, res: 0, t: null };
  const passDef = id => (TH.PASSES || []).find(p => p.id === id);
  TH.screens.book = {
    render() {
      const arg = TH.state.params && TH.state.params.arg; if (arg && passDef(arg)) { Object.assign(BK, { id: arg, day: 0, res: 0, t: null, fresh: true }); TH.state.params = {}; }
      const ps = passDef(BK.id) || (TH.PASSES || [])[0], p = TH.byId[ps.where], len = ps.len || 60, step = len >= 60 ? 60 : 30, res = RES[ps.id] || [[ps.name, p ? p.name : '']];
      const ahead = ps.id === 'racquetball' ? 3 : 7, nm = nowMin();
      const slotsOn = (day, ri) => { const out = [], dk = TH.dkey(TH.ui.dayAt(day)); for (let m = 7 * 60; m + len <= 23 * 60; m += step) { if (day === 0 && m < nm) continue; let rule = false; try { rule = !!TH.act.check.bookPass(ps.id, m, day).block.length; } catch (e) { rule = true; } const taken = hash(ps.id + ri + dk + m) % 100 < (m >= 600 && m < 1200 ? 55 : 25); out.push({ m, ok: !rule && !taken }); } return out; };
      if (BK.fresh) { BK.fresh = false; for (let d = 0; d < ahead; d++) if (res.some((_, i) => slotsOn(d, i).some(o => o.ok))) { BK.day = d; break; } }
      const all = res.map((_, i) => slotsOn(BK.day, i)), free = all.reduce((s, l) => s + l.filter(o => o.ok).length, 0);
      if (BK.t != null && !(all[BK.res] || []).some(o => o.m === BK.t && o.ok)) BK.t = null;
      const mine = hub().passes.filter(b => b.id === ps.id && b.day >= TH.dkey(TH.ui.today()));
      return `<div class="screen">${top('Book a Room')}<div class="pad screen-body stack">
        <div class="x-chips scroll">${(TH.PASSES || []).map(q => `<button class="chip" data-bkp="${esc(q.id)}" aria-pressed="${q.id === ps.id}">${icon(q.icon || 'ticket')}${esc(q.name.replace(/ \(.*\)/, ''))}</button>`).join('')}</div>
        <div class="x-bookhero"><span class="eyebrow" style="color:var(--gold)">${esc(p ? p.name : 'USC')} · ${len} min</span><h2>${esc(ps.name)}</h2><p>${esc(ps.desc || '')}</p></div>
        ${dayStrip(BK.day, ahead, 'data-bkd')}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>${free} open time${free === 1 ? '' : 's'} ${BK.day === 0 ? 'left today' : 'on ' + esc(TH.fmtDate(TH.ui.dayAt(BK.day)))}</b></div>${legend(false)}
        ${res.map(([n, sub], i) => `<div class="card x-room"><div class="x-room-h"><span><b>${esc(n)}</b><span class="muted" style="font-size:12.5px">${esc(sub)}</span></span><span class="pill ${all[i].some(o => o.ok) ? 'ok' : 'mute'}">${all[i].filter(o => o.ok).length} open</span></div>
          ${all[i].length ? `<div class="x-slots wide">${all[i].map(o => `<button class="x-slot" data-bks="${i}:${o.m}" ${o.ok ? '' : 'disabled'} aria-pressed="${BK.res === i && BK.t === o.m}" aria-label="${fmtMin(o.m)} ${o.ok ? 'open' : 'taken'}">${fmtMin(o.m)}</button>`).join('')}</div>` : `<span class="muted">No times left today.</span>`}</div>`).join('')}
        ${BK.t != null ? `<div class="x-bookbar"><span><b>${esc(res[BK.res][0])}</b>${esc(TH.ui.dayLabel(TH.ui.dayAt(BK.day)))} · ${fmtMin(BK.t)} – ${fmtMin(BK.t + len)}</span><button class="btn sm gold" id="bk-ok">Reserve</button></div>` : ''}
        ${mine.length ? `<button class="btn ghost block" data-go="pass">${icon('ticket')} My reservations (${mine.length})</button>` : ''}
        ${sim(`Practice booking on the demo account; which rooms are taken is sample data.${ps.url ? ` <a href="${esc(ps.url)}" target="_blank" rel="noopener">Book for real ↗</a>` : ''}`)}
      </div></div>`;
    },
    mount(host) {
      host.addEventListener('click', e => {
        const p = e.target.closest('[data-bkp]'), d = e.target.closest('[data-bkd]'), s = e.target.closest('[data-bks]');
        if (p) { Object.assign(BK, { id: p.dataset.bkp, day: 0, res: 0, t: null, fresh: true }); TH.render(true); } else if (d) { BK.day = +d.dataset.bkd; BK.t = null; TH.render(true); }
        else if (s && !s.disabled) { const [r, m] = s.dataset.bks.split(':'); BK.res = +r; BK.t = +m; TH.render(true); }
      });
      const ok = $('#bk-ok', host); if (ok) ok.onclick = () => {
        const ps = passDef(BK.id), res = RES[ps.id] || [[ps.name]];
        try { const r = TH.act.bookPass(ps.id, BK.t, BK.day); TH.commit(r.log); if (r.item) r.item.room = res[BK.res][0]; save(); TH.toast(`Booked ${res[BK.res][0]} for ${fmtMin(BK.t)}. It’s on My Day.`, 'ticket'); BK.t = null; TH.go('pass'); }
        catch (er) { TH.toast(er.message, 'alert'); }
      };
    },
  };
  if (TH.screens.pass) { const pm0 = TH.screens.pass.mount; TH.screens.pass.mount = function (host) { const a = TH.state.params && TH.state.params.arg; if (a && passDef(a)) { TH.state.params = {}; pm0.call(this, host); return TH.go('book', { arg: a }); } host.addEventListener('click', e => { const b = e.target.closest('[data-pass]'); if (b) { e.stopPropagation(); TH.go('book', { arg: b.dataset.pass }); } }, true); pm0.call(this, host); }; }

  // ---------- organizers: Book a Space ----------
  const ROOMS = {
    Classroom: [['THH 101', 120, 'Taper Hall · lecture hall, projector'], ['THH 208', 40, 'Taper Hall · movable desks'], ['VKC 100', 70, 'Von KleinSmid Center · projector'], ['GFS 106', 90, 'Grace Ford Salvatori · tiered seating'], ['KAP 144', 35, 'Kaprielian Hall · whiteboards'], ['SGM 123', 150, 'Seeley G. Mudd · auditorium']],
    'Library room': [['Leavey study room A', 6, 'Leavey Library · screen'], ['Leavey study room B', 8, 'Leavey Library · whiteboard'], ['Leavey collaboration room', 14, 'Leavey Library · large screen'], ['Doheny meeting room', 12, 'Doheny Library']],
    'Event space': [['TCC 227', 50, 'Tutor Campus Center'], ['TCC Ballroom', 300, 'Tutor Campus Center · stage, AV'], ['McCarthy Quad', 500, 'Outdoor lawn'], ['Trousdale table', 4, 'Outdoor tabling spot']],
  };
  const SP = { type: 'Classroom', day: 3, heads: 30, len: 2, room: null, h: null, req: '' };
  const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);
  function spTaken(type, room, o, h) {
    const d = TH.ui.dayAt(o), wk = d.getDay() === 0 || d.getDay() === 6, dk = TH.dkey(d);
    const base = type === 'Classroom' ? (wk ? 8 : h < 17 ? 72 : 22) : type === 'Library room' ? (h >= 11 && h < 21 ? 50 : 20) : (wk ? 45 : h >= 11 && h < 14 ? 55 : 28);
    return hash(room + dk + h) % 100 < base;
  }
  function spScreen() {
    const { cur, O, scr, priority, reqsFor } = TH.xo, org = cur(), o = O(org), rooms = ROOMS[SP.type], dk = TH.dkey(TH.ui.dayAt(SP.day));
    const mine = (room, h) => o.bookings.some(b => b.room === room && b.dk === dk && h >= b.h && h < b.h + b.len);
    const free = (room, h) => h <= 21 && !spTaken(SP.type, room, SP.day, h) && !mine(room, h);
    const fits = (room, h) => { for (let k = 0; k < SP.len; k++) if (!free(room, h + k)) return false; return true; };
    if (SP.room && !(rooms.some(r => r[0] === SP.room) && fits(SP.room, SP.h))) { SP.room = null; SP.h = null; }
    const rq = reqsFor(org).filter(r => r.status === 'open').slice(0, 6), pr = priority(org, SP.req, SP.heads);
    const sorted = rooms.slice().sort((a, b) => (a[1] < SP.heads) - (b[1] < SP.heads) || a[1] - b[1]);
    const openRooms = sorted.filter(r => r[1] >= SP.heads && HOURS.some(h => fits(r[0], h))).length;
    return scr('Book a Space', org, `
      <div class="seg" role="group" aria-label="Kind of space">${Object.keys(ROOMS).map(t => `<button type="button" data-spt="${t}" aria-pressed="${SP.type === t}">${t}</button>`).join('')}</div>
      ${dayStrip(SP.day, 7, 'data-spd')}
      <div class="grid2"><div class="field"><label for="sp-heads">People expected</label><input id="sp-heads" type="number" min="2" max="500" value="${SP.heads}"></div><div class="field"><label for="sp-len">Length</label><select id="sp-len">${[1, 2, 3].map(n => `<option value="${n}" ${n === SP.len ? 'selected' : ''}>${n} hour${n === 1 ? '' : 's'}</option>`).join('')}</select></div></div>
      <div style="display:grid;gap:6px"><b>${openRooms} of ${rooms.length} ${SP.type.toLowerCase()}s fit ${SP.heads} people and have a ${SP.len}-hour opening on ${esc(TH.fmtDate(TH.ui.dayAt(SP.day)))}</b>${legend(true)}<span class="muted tiny">Tap an open start time. Times that can’t fit ${SP.len} hour${SP.len === 1 ? '' : 's'} in a row won’t select.</span></div>
      ${sorted.map(([n, seats, sub]) => { const small = seats < SP.heads; return `<div class="card x-room ${small ? 'small' : ''}"><div class="x-room-h"><span><b>${esc(n)}</b><span class="muted" style="font-size:12.5px">${seats} seats · ${esc(sub)}</span></span>${small ? `<span class="pill bad">Too small</span>` : `<span class="pill ${HOURS.some(h => fits(n, h)) ? 'ok' : 'mute'}">${HOURS.filter(h => free(n, h)).length} h open</span>`}</div>
        <div class="x-slots">${HOURS.map(h => { const m = mine(n, h), f = free(n, h), sel = SP.room === n && h >= SP.h && h < SP.h + SP.len; return `<button class="x-slot ${m ? 'mine' : ''}" data-sps="${esc(n)}|${h}" ${f && !small ? '' : 'disabled'} aria-pressed="${sel}" aria-label="${hr(h)} ${m ? 'your booking' : f ? 'open' : 'taken'}">${hr(h)}</button>`; }).join('')}</div></div>`; }).join('')}
      ${SP.room ? `<div class="card stack" style="gap:10px;border:2px solid var(--cardinal)"><b>${esc(SP.room)} · ${esc(TH.ui.dayLabel(TH.ui.dayAt(SP.day)))} · ${fmtMin(SP.h * 60)} – ${fmtMin((SP.h + SP.len) * 60)}</b>
        <div class="field"><label for="sp-req">For a requested event (raises priority)</label><select id="sp-req"><option value="">Not tied to a request</option>${rq.map(r => `<option value="${esc(r.id)}" ${SP.req === r.id ? 'selected' : ''}>${esc(r.title)} · ${r.votes} votes</option>`).join('')}</select></div>
        <div class="x-route"><span class="muted tiny">Priority for this request</span><b>${pr.label} <span class="pill ${pr.tone}" style="vertical-align:2px">${pr.label === 'High' ? 'Reviewed first' : pr.label === 'Medium' ? 'Reviewed soon' : 'Standard queue'}</span></b><span style="font-size:13px">${esc(pr.why.join(' · '))}</span></div>
        <button class="btn block" id="sp-ok">${icon('building')} Request ${esc(SP.room)}</button></div>` : ''}
      ${o.bookings.length ? `<div class="section"><div class="section-head"><h2>Your space requests</h2></div><div class="rows">${o.bookings.map(b => `<div class="row" style="--rc:var(--c-study)"><span class="rico">${icon('building')}</span><span class="rmain"><span class="rtitle wrap">${esc(b.place)}</span><span class="rsub wrap">${esc(b.when)} · ${b.heads} people · ${esc(b.pri)} priority</span></span><span class="rside"><span class="pill ${b.status === 'approved' ? 'ok' : 'warn'}">${b.status === 'approved' ? 'Approved' : 'Pending'}</span></span></div>`).join('')}</div></div>` : ''}
      ${sim('Availability is sample data for this demo. In a real launch it would come from Classroom Scheduling, USC Libraries and Trojan Event Services, who would also approve the request. The priority rules are this prototype’s proposal.')}`, true);
  }
  TH.screens.orgspace = {
    render() { return spScreen(); },
    mount(host) {
      const { cur, O, bindHeader, priority } = TH.xo, org = cur(); bindHeader(host);
      host.addEventListener('click', e => {
        const t = e.target.closest('[data-spt]'), d = e.target.closest('[data-spd]'), s = e.target.closest('[data-sps]');
        if (t) { SP.type = t.dataset.spt; SP.room = null; TH.render(true); } else if (d) { SP.day = +d.dataset.spd; SP.room = null; TH.render(true); }
        else if (s && !s.disabled) { const [room, h] = s.dataset.sps.split('|'); SP.room = room; SP.h = +h; TH.render(true); if (!SP.room) TH.toast(`${room} isn’t open for ${SP.len} hours in a row from ${hr(+h)}. Try a shorter length or another start.`, 'alert'); }
      });
      $('#sp-heads', host).onchange = e => { SP.heads = Math.max(2, Math.min(500, +e.target.value || 2)); TH.render(true); };
      $('#sp-len', host).onchange = e => { SP.len = +e.target.value; TH.render(true); };
      const rq = $('#sp-req', host); if (rq) rq.onchange = () => { SP.req = rq.value; TH.render(true); };
      const ok = $('#sp-ok', host); if (ok) ok.onclick = () => {
        const d = TH.ui.dayAt(SP.day), p = priority(org, SP.req, SP.heads), room = SP.room;
        O(org).bookings.unshift({ id: uid(), type: SP.type, place: room, room, dk: TH.dkey(d), h: SP.h, len: SP.len, when: `${TH.fmtDate(d)} · ${fmtMin(SP.h * 60)} – ${fmtMin((SP.h + SP.len) * 60)}`, heads: SP.heads, pri: p.label, status: 'pending', at: Date.now(), org: org.name });
        TH.commit(`Requested ${room} for ${org.name}`); SP.room = null; SP.h = null; TH.toast(`${room} requested with ${p.label.toLowerCase()} priority. You’ll get a note when it’s approved.`); TH.render(true);
      };
    },
  };

  // =====================================================================
  // ORDER FOOD: show the wait before you order
  // =====================================================================
  if (TH.openOrder) {
    const oo0 = TH.openOrder;
    TH.openOrder = function (id) {
      oo0.apply(this, arguments);
      const p = TH.byId[id], sheet = $('.sheet'); if (!p || !sheet || $('.x-wait', sheet)) return;
      const st = TH.status(p), lv = TH.live(p), wait = st.open ? (lv && lv.kind === 'wait' ? lv.value : 6 + hash(id + Math.floor(Date.now() / 3e5)) % 9) : null;
      const ahead = wait == null ? 0 : Math.max(1, Math.round(wait / 1.8)), items = $('#ord-items', sheet); if (!items) return;
      const div = document.createElement('div'); div.className = 'x-wait';
      div.innerHTML = wait == null ? `${icon('clock')}<span><b>Closed right now</b><br><span class="muted" style="font-size:12.5px">${esc(st.detail || 'No wait time while it’s closed.')}</span></span>`
        : `<span class="n">${wait}<small> min</small></span><span style="flex:1"><b>Wait right now ${TH.ui.est()}</b><br><span class="muted" style="font-size:12.5px">About ${ahead} order${ahead === 1 ? '' : 's'} ahead of you. Order now and it’s ready around ${fmtMin(nowMin() + wait)}. ${wait >= 12 ? 'It’s busy; a later pickup time skips the line.' : 'Short line right now.'}</span></span>`;
      items.parentNode.insertBefore(div, items);
    };
  }

  let MCP;
  const getMcp = () => MCP !== undefined ? Promise.resolve(MCP) : (window.claude && window.claude.use ? window.claude.use('mcp').catch(() => null) : Promise.resolve(null)).then(m => (MCP = m || null));
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  async function syncPhone(id) {
    const e = TH.eventById(id), x = X(); if (!e) return; const done = x.gsync || (x.gsync = {}); if (done[id]) return;
    const fallback = why => { TH.exportCalendar([e], 'trojan-hub-event'); if (why) TH.toast(why, 'calendar'); };
    const mcp = await getMcp(); if (!mcp) return fallback('On My Day. One tap below puts it on your phone calendar.');
    const s0 = TH.laDate(e.start); let e0 = TH.laDate(e.end || e.start); if (!s0) return; if (!e0 || e0 <= s0) e0 = new Date(s0.getTime() + 3600000);
    try {
      await mcp.callTool('Google Calendar', 'create_event', { summary: e.title, startTime: localISO(s0), endTime: localISO(e0), timeZone: 'America/Los_Angeles', allDay: !!e.allDay, location: e.location || undefined, description: `${e.org ? 'Hosted by ' + e.org + '. ' : ''}${e.url ? 'Details and RSVP: ' + e.url + ' ' : ''}(Added from Trojan Hub.)` });
      done[id] = Date.now(); x.conn.gcal = true; save(); TH.toast('On My Day and in your Google Calendar', 'calendar');
    } catch (er) {
      const c = er && er.code;
      if (c === 'server_unavailable' || c === 'upstream_error' || c === 'tool_error') TH.toast('On My Day. Google Calendar didn’t confirm, so check it before adding again.', 'alert');
      else fallback(c === 'server_not_connected' ? 'On My Day. Connect Google Calendar in Claude to make this automatic.' : c === 'needs_reauth' ? 'On My Day. Reconnect Google Calendar in Claude, or add it below.' : 'On My Day. Add it to your phone calendar below.');
    }
  }
  const confirm0 = TH.confirmAct;
  TH.confirmAct = function (name, args, o) {
    if (name !== 'saveEvent') return confirm0.apply(this, arguments);
    const o2 = Object.assign({}, o || {}), d0 = o2.done; o2.rows = [...(o2.rows || []), ['Also goes on', 'Your phone / Google Calendar']];
    o2.done = res => { d0 && d0(res); setTimeout(() => syncPhone(args[0]), 60); };
    return confirm0.call(this, name, args, o2);
  };

  const boot0 = TH.boot;
  TH.boot = function () { boot0.apply(this, arguments); try { seedNews(); } catch (e) { console.error(e); } };
})(window.TH = window.TH || {});
