/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
/* Teams tab: pick favorite teams and players, rename the tab, make it the tab that opens first.
   Per team: record, live game or next games, recent results, last season, injuries, headlines.
   Per player: status, injuries and season numbers. Data is ESPN's public feed (unofficial) through the team-hub and athlete functions.
   Open to every signed-in player for now. To make it Marqit+ only: set TEAMS_PLUS_ONLY = true here and run the one line in
   supabase/migrations/20261105_teams_tab.sql. */
(function(){
  var TEAMS_PLUS_ONLY = false;
  var sb = window.mqSb;
  if(!sb) return;
  var root = document.getElementById('teams-root');
  if(!root) return;
  var BASE = (sb.supabaseUrl || window.SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/';
  var LEAGUES = [['nba', 'NBA'], ['nfl', 'NFL'], ['mlb', 'MLB'], ['nhl', 'NHL'], ['wnba', 'WNBA'], ['mls', 'MLS'], ['epl', 'Premier League']];
  var STATS_LEAGUES = { nba: 1, nfl: 1, mlb: 1, nhl: 1 }; // the athlete function covers these four
  var session = null, isPlus = false, prefs = { tab_name: 'Teams', make_default: false }, picks = [];
  var openId = null, panel = '', firstRun = true;

  function h(tag, cls, text){ var el = document.createElement(tag); if(cls) el.className = cls; if(text != null) el.textContent = text; return el; }
  function btn(label, fn, cls){ var b = h('button', cls || 'tm-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function say(el, text, bad){ el.textContent = text || ''; el.className = 'tm-msg' + (bad ? ' bad' : text ? ' ok' : ''); }
  function friendly(e){ var m = (e && e.message) || ''; return m && m.length < 140 ? m : 'Something went wrong. Please try again.'; }
  function sure(label, fn, cls){
    var armed = false, t = null, b = btn(label, function(){
      if(!armed){ armed = true; b.textContent = 'Tap again to confirm'; t = setTimeout(function(){ armed = false; b.textContent = label; }, 4000); return; }
      clearTimeout(t); armed = false; b.textContent = label; fn();
    }, cls);
    return b;
  }
  function fetchJson(path){
    return fetch(BASE + path).then(function(r){ return r.json(); }).catch(function(){ return null; });
  }
  function fmtDate(iso){
    var d = new Date(iso); if(isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtWhen(iso){
    var d = new Date(iso); if(isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function img(src, cls){
    if(!/^https:\/\/a\.espncdn\.com\//.test(src || '')) return null;
    var i = h('img', cls); i.src = src; i.alt = ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; return i;
  }

  // ---- tab name and landing tab ----
  function applyName(){
    var name = (prefs.tab_name || 'Teams').trim() || 'Teams';
    var tab = document.getElementById('teams-tab'); if(tab) tab.textContent = name;
    var hd = document.getElementById('teams-h'); if(hd) hd.textContent = name;
  }

  async function init(){
    var r = await sb.auth.getSession();
    session = r && r.data && r.data.session;
    isPlus = false; picks = []; prefs = { tab_name: 'Teams', make_default: false };
    if(session){
      try{ var p = await sb.rpc('is_marqit_plus'); isPlus = !!(p && p.data === true); }catch(e){}
      try{
        var a = await sb.from('user_teams_prefs').select('tab_name, make_default').eq('user_id', session.user.id).maybeSingle();
        if(a && a.data) prefs = a.data;
        var b = await sb.from('user_team_picks').select('id, kind, league, espn_id, name, meta').eq('user_id', session.user.id).order('created_at');
        picks = (b && b.data) || [];
      }catch(e){}
    }
    applyName();
    render();
    // Open this tab first, once per page load, unless the visitor arrived through a link meant for something else.
    if(firstRun){
      firstRun = false;
      var special = /[?&](league|code|ref|invite)=/.test(location.search) || /access_token|type=recovery|error_description/.test(location.hash);
      if(session && prefs.make_default && !special){ var tab = document.getElementById('teams-tab'); if(tab) tab.click(); }
    }
  }

  function render(){
    root.textContent = '';
    if(!session){
      var out = h('div', 'empty-state empty-inline');
      out.appendChild(h('div', 'es-title', 'Follow your teams and players'));
      out.appendChild(h('p', 'es-sub', 'Pick your favorites and see their record, results, schedule, injuries and headlines in one place. Rename this tab and open it first if you like.'));
      var b = h('button', 'es-btn', 'Sign up free'); b.type = 'button'; b.setAttribute('data-open-signup', 'teams'); out.appendChild(b);
      root.appendChild(out);
      return;
    }
    if(TEAMS_PLUS_ONLY && !isPlus){
      var up = h('div', 'empty-state empty-inline');
      up.appendChild(h('div', 'es-title', 'Teams is part of Marqit+'));
      up.appendChild(h('p', 'es-sub', 'Follow your teams and players with results, schedules, injuries and headlines.'));
      var ub = h('button', 'es-btn', 'See Marqit+'); ub.type = 'button';
      ub.addEventListener('click', function(){ var t = document.querySelector('.pagenav-tab[data-page="plus"]'); if(t) t.click(); window.scrollTo(0, 0); });
      up.appendChild(ub); root.appendChild(up);
      return;
    }
    // Top bar: add and settings
    var bar = h('div', 'tm-bar');
    bar.appendChild(btn(panel === 'add' ? 'Close' : 'Add teams or players', function(){ panel = panel === 'add' ? '' : 'add'; render(); }));
    bar.appendChild(btn(panel === 'set' ? 'Close settings' : 'Tab settings', function(){ panel = panel === 'set' ? '' : 'set'; render(); }, 'tm-btn ghost'));
    root.appendChild(bar);
    if(panel === 'set') root.appendChild(settingsPanel());
    if(panel === 'add') root.appendChild(addPanel());
    var list = h('div', 'tm-list'); root.appendChild(list);
    drawList(list);
    root.appendChild(h('p', 'tm-foot', 'Source: ESPN public feed. Unofficial and may lag. Injury news is for information only.'));
  }

  function drawList(list){
    list.textContent = '';
    if(!picks.length){
      list.appendChild(h('p', 'tm-empty', 'Nothing here yet. Tap “Add teams or players” to pick your favorites.'));
    }
    picks.forEach(function(p){
      var card = h('div', 'tm-card');
      var head = h('button', 'tm-head'); head.type = 'button';
      head.appendChild(h('b', null, p.name));
      head.appendChild(h('span', 'tm-meta', (p.kind === 'team' ? 'Team' : 'Player') + (p.meta ? ' · ' + p.meta : '')));
      head.addEventListener('click', function(){ openId = openId === p.id ? null : p.id; render(); });
      card.appendChild(head);
      if(openId === p.id){
        var body = h('div', 'tm-body'); card.appendChild(body);
        if(p.kind === 'team') loadTeam(body, p); else loadPlayer(body, p);
        var rm = h('div', 'tm-row');
        rm.appendChild(sure('Remove', async function(){
          var r = await sb.from('user_team_picks').delete().eq('id', p.id).eq('user_id', session.user.id);
          if(r.error) return;
          picks = picks.filter(function(x){ return x.id !== p.id; }); openId = null; render();
        }, 'tm-btn small danger'));
        card.appendChild(rm);
      }
      list.appendChild(card);
    });
  }

  // ---- settings: rename the tab, open it first ----
  function settingsPanel(){
    var box = h('div', 'tm-panel'), m = h('p', 'tm-msg');
    box.appendChild(h('b', null, 'Tab settings'));
    var row = h('div', 'tm-row');
    var inp = h('input', 'tm-in'); inp.type = 'text'; inp.maxLength = 20; inp.value = prefs.tab_name || 'Teams'; inp.setAttribute('aria-label', 'Tab name');
    row.appendChild(inp); box.appendChild(row);
    var lab = h('label', 'tm-check'); var cb = h('input'); cb.type = 'checkbox'; cb.checked = !!prefs.make_default;
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' Open this tab first when I visit')); box.appendChild(lab);
    box.appendChild(btn('Save', async function(){
      var name = inp.value.replace(/[<>]/g, '').trim();
      if(!name){ say(m, 'Give the tab a name (up to 20 characters).', true); return; }
      var r = await sb.from('user_teams_prefs').upsert({ user_id: session.user.id, tab_name: name, make_default: cb.checked, updated_at: new Date().toISOString() });
      if(r.error){ say(m, friendly(r.error), true); return; }
      prefs = { tab_name: name, make_default: cb.checked }; applyName(); say(m, 'Saved.');
    }));
    box.appendChild(m);
    return box;
  }

  // ---- add: pick a team or browse a roster for players ----
  function addPanel(){
    var box = h('div', 'tm-panel'), m = h('p', 'tm-msg');
    box.appendChild(h('b', null, 'Add a team or player'));
    var row = h('div', 'tm-row');
    var lg = h('select', 'tm-in'); lg.setAttribute('aria-label', 'League');
    LEAGUES.forEach(function(l){ var o = h('option', null, l[1]); o.value = l[0]; lg.appendChild(o); });
    var tm = h('select', 'tm-in'); tm.setAttribute('aria-label', 'Team'); tm.disabled = true;
    row.appendChild(lg); row.appendChild(tm); box.appendChild(row);
    var teams = [], rosterBox = h('div', 'tm-roster');
    function pickedTeam(){ return teams.filter(function(t){ return t.id === tm.value; })[0]; }
    function loadTeams(){
      tm.disabled = true; tm.textContent = ''; var o = h('option', null, 'Loading teams…'); o.value = ''; tm.appendChild(o); rosterBox.textContent = '';
      fetchJson('team-hub?action=teams&league=' + lg.value).then(function(d){
        tm.textContent = '';
        teams = (d && d.teams) || [];
        if(!teams.length){ var e = h('option', null, 'Could not load teams'); e.value = ''; tm.appendChild(e); return; }
        teams.forEach(function(t){ var op = h('option', null, t.name); op.value = t.id; tm.appendChild(op); });
        tm.disabled = false;
      });
    }
    lg.addEventListener('change', loadTeams);
    var act = h('div', 'tm-row');
    act.appendChild(btn('Follow this team', async function(){
      var t = pickedTeam(); if(!t){ say(m, 'Pick a team first.', true); return; }
      await addPick({ kind: 'team', league: lg.value, espn_id: t.id, name: t.name, meta: lg.options[lg.selectedIndex].text }, m);
    }));
    act.appendChild(btn('Browse its players', async function(){
      var t = pickedTeam(); if(!t){ say(m, 'Pick a team first.', true); return; }
      rosterBox.textContent = ''; rosterBox.appendChild(h('p', 'tm-note', 'Loading players…'));
      var d = await fetchJson('team-hub?action=roster&league=' + lg.value + '&id=' + t.id);
      rosterBox.textContent = '';
      var ps = (d && d.players) || [];
      if(!ps.length){ rosterBox.appendChild(h('p', 'tm-note', 'No players found right now.')); return; }
      ps.forEach(function(p){
        var line = h('div', 'tm-line');
        var im = img(p.hs, 'tm-hs'); if(im) line.appendChild(im);
        line.appendChild(h('span', 'tm-pname', p.name + (p.jersey ? ' #' + p.jersey : '')));
        line.appendChild(h('span', 'tm-meta', p.pos));
        line.appendChild(btn('Follow', function(){ addPick({ kind: 'player', league: lg.value, espn_id: p.id, name: p.name, meta: [p.pos, t.abbr || t.name].filter(Boolean).join(' · ') }, m); }, 'tm-btn small'));
        rosterBox.appendChild(line);
      });
    }, 'tm-btn ghost'));
    box.appendChild(act); box.appendChild(m); box.appendChild(rosterBox);
    loadTeams();
    return box;
  }
  async function addPick(row, m){
    if(picks.some(function(p){ return p.kind === row.kind && p.league === row.league && p.espn_id === row.espn_id; })){ say(m, 'You already follow that.', true); return; }
    row.user_id = session.user.id;
    var r = await sb.from('user_team_picks').insert(row).select('id, kind, league, espn_id, name, meta').single();
    if(r.error){ say(m, friendly(r.error), true); return; }
    picks.push(r.data); say(m, row.name + ' added.');
    // Redraw the list below without closing the add panel.
    var list = root.querySelector('.tm-list'); if(list) drawList(list);
  }

  // ---- team card ----
  async function loadTeam(body, p){
    body.appendChild(h('p', 'tm-note', 'Loading…'));
    var d = await fetchJson('team-hub?action=team&league=' + p.league + '&id=' + p.espn_id);
    body.textContent = '';
    if(!d || d.error){ body.appendChild(h('p', 'tm-note', 'Team details are not available right now.')); return; }
    var top = h('div', 'tm-top');
    var lo = img(d.logo, 'tm-logo'); if(lo) top.appendChild(lo);
    var t = h('div'); t.appendChild(h('b', null, [d.record, d.standing].filter(Boolean).join(' · ') || d.name));
    if(d.lastSeason) t.appendChild(h('div', 'tm-note', 'Last season (' + d.lastSeason.year + '): ' + d.lastSeason.record));
    top.appendChild(t); body.appendChild(top);

    if(d.live) body.appendChild(sect('Live now', [gameLine(d.live, true)]));
    if(d.upcoming && d.upcoming.length) body.appendChild(sect('Next up', d.upcoming.map(function(g){ return gameLine(g); })));
    if(d.results && d.results.length) body.appendChild(sect('Recent results', d.results.map(function(g){ return gameLine(g); })));
    var inj = d.injuries || [];
    body.appendChild(sect('Injury report', inj.length ? inj.map(function(i){
      var l = h('div', 'tm-inj'); l.appendChild(h('b', null, i.name + (i.pos ? ' (' + i.pos + ')' : '') + ' · ' + (i.status || 'Listed')));
      var more = [i.detail, i.date ? 'Updated ' + fmtDate(i.date) : ''].filter(Boolean).join(' · ');
      if(more) l.appendChild(h('div', 'tm-note', more));
      if(i.comment && i.comment !== i.detail) l.appendChild(h('div', 'tm-note', i.comment));
      return l;
    }) : [h('p', 'tm-note', 'No injuries reported.')]));
    if(d.headlines && d.headlines.length) body.appendChild(sect('Latest headlines', d.headlines.map(function(a){
      var l = h('a', 'tm-news', a.headline); l.href = a.url; l.target = '_blank'; l.rel = 'noopener noreferrer'; return l;
    })));
  }
  function sect(title, nodes){
    var s = h('div', 'tm-sect'); s.appendChild(h('div', 'tm-sh', title));
    nodes.forEach(function(n){ s.appendChild(n); }); return s;
  }
  function gameLine(g, live){
    var l = h('div', 'tm-game');
    if(g.done){ l.appendChild(h('span', 'tm-res ' + (g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : ''), g.result || '–')); }
    l.appendChild(h('span', 'tm-gname', (g.home ? 'vs ' : '@ ') + g.opp));
    l.appendChild(h('span', 'tm-gwhen', g.done ? (g.us + '–' + g.them + ' · ' + fmtDate(g.date)) : live ? ((g.us && g.them) ? g.us + '–' + g.them : 'In progress') : fmtWhen(g.date)));
    return l;
  }

  // ---- player card ----
  async function loadPlayer(body, p){
    if(!STATS_LEAGUES[p.league]){ body.appendChild(h('p', 'tm-note', 'Detailed player stats are not available for this league yet.')); return; }
    body.appendChild(h('p', 'tm-note', 'Loading…'));
    var d = await fetchJson('athlete?league=' + p.league + '&id=' + p.espn_id);
    body.textContent = '';
    if(!d || d.error){ body.appendChild(h('p', 'tm-note', 'Player details are not available right now.')); return; }
    var inj = d.injuries || [];
    var st = h('div', 'tm-status ' + (inj.length ? 'inj' : 'ok'));
    st.appendChild(h('b', null, inj.length ? (inj[0].status || 'Injured') : (d.status || 'Active')));
    if(!inj.length) st.appendChild(h('span', null, ' No injuries reported'));
    body.appendChild(st);
    inj.forEach(function(i){
      var l = h('div', 'tm-inj'); l.appendChild(h('b', null, (i.status || 'Injury') + (i.detail ? ' · ' + i.detail : '')));
      if(i.comment) l.appendChild(h('div', 'tm-note', i.comment));
      l.appendChild(h('div', 'tm-note', i.returns ? 'Expected back ' + i.returns : i.date ? 'Updated ' + i.date : ''));
      body.appendChild(l);
    });
    var bio = [d.team, d.pos, d.jersey ? '#' + d.jersey : '', d.age ? d.age + ' yrs' : '', d.height, d.weight, d.exp ? d.exp + ' exp' : ''].filter(Boolean).join(' · ');
    if(bio) body.appendChild(h('p', 'tm-note', bio));
    if(d.stats && d.stats.length){
      body.appendChild(h('div', 'tm-sh', d.split || 'Season'));
      var grid = h('div', 'tm-grid');
      d.stats.forEach(function(c){ var cell = h('div'); cell.appendChild(h('span', null, c.label)); cell.appendChild(h('b', null, c.value)); grid.appendChild(cell); });
      body.appendChild(grid);
    } else body.appendChild(h('p', 'tm-note', 'Season stats are not available yet.'));
  }

  sb.auth.onAuthStateChange(function(){ init(); });
  init();
})();
