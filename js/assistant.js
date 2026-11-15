/* js/assistant.js */
/* Trojan Hub — "Ask Tommy" screen. The chat itself is the user's Trojan Assist engine (js/ta/*), mounted
 * full-screen here by TA.Embed (js/ta/embed.js). Deep link: TH.go('assistant', { arg: 'Any free food today?' })
 * opens the chat and asks. Safety, answers, actions (confirm cards, audit log, Undo) and Claude mode all
 * live in js/ta/*; this file only wires the screen and navigation.
 * Leaving the screen: app.js render() calls TH.onLeaveAssistant() (or TA.Embed.unmount()) when route !== 'assistant'. */
(function (TH) {
  TH.screens = TH.screens || {};

  // @go:<screen>[:<arg>] chips from Tommy (same semantics as v1's runAct)
  function onGo(screen, arg) {
    const S = TH.state || {};
    if (screen === 'walk' && arg) {
      if (arg === 'home' && TH.HOME) S.pendingRoute = { to: 'home', toPoint: Object.assign({ id: null, name: TH.HOME.label }, TH.HOME) };
      else S.pendingRoute = { to: arg };
      return TH.go('map');
    }
    // "@go:safewalk:<placeId|home>[@<hour>]" (Tommy's safe-walk answer): Safety screen with that destination and hour
    if (screen === 'safewalk') {
      const m = /^([\w-]+)(?:@(\d{1,2}))?$/.exec(arg || '') || [];
      S.safeFrom = 'me'; S.safeTo = m[1] && (m[1] === 'home' || (TH.byId && TH.byId[m[1]])) ? m[1] : 'home';
      if (m[2] != null) S.safeHour = Math.min(23, +m[2]);
      return TH.go('safety');
    }
    if (screen === 'place' && arg) { if (TH.openPlace) return TH.openPlace(arg); return TH.go('map'); }
    if (screen === 'club' && arg && TH.openClub) { TH.go('clubs'); return setTimeout(() => TH.openClub(+arg || arg), 0); }
    if (screen === 'event' && arg && TH.openEvent) { TH.go('events'); return setTimeout(() => TH.openEvent(+arg || arg), 0); }
    TH.go(TH.screens[screen] ? screen : 'home', arg ? { arg } : null);
  }

  TH.onLeaveAssistant = function () { if (window.TA && TA.Embed && TA.Embed.mounted) TA.Embed.unmount(); };

  TH.screens.assistant = {
    render() { return '<div class="screen ta-screen" id="ta-screen"></div>'; },
    mount(host) {
      const el = host.matches && host.matches('.screen') ? host : host.querySelector('.screen');
      if (!window.TA || !TA.Embed) { el.innerHTML = '<div class="pad"><p class="muted">Ask Tommy is still loading…</p></div>'; return; }
      TA.Embed.onBack = () => TH.back();
      TA.Embed.onGo = onGo;
      TA.Embed.onUnread = n => { TH.tommyUnread = n; };
      if (TH.loadTommyKB) TH.loadTommyKB(); // in case the idle-time load has not started yet
      const S = TH.state || {}, ask = S.params && S.params.arg;
      if (S.params) S.params = {};
      TA.Embed.mount(el, { ask });
    },
  };
})(window.TH = window.TH || {});

