/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
/* Teams tab: follow favorite teams and players.
   Home: logo squares for everything you follow (teams, then players).
   Tap a team: Overview (live/next game, top players with stats, season numbers), Games, Injuries, News.
   Tap a player: status, injuries and season numbers.
   Add: pick a league, tap a team's logo, follow it or browse its players.
   Data is ESPN's public feed (unofficial) through the team-hub and athlete functions.
   Open to every signed-in player for now. To make it Marqit+ only: set TEAMS_PLUS_ONLY = true here and run the one line in
   supabase/migrations/20261105_teams_tab.sql. */
(function(){
  var TEAMS_PLUS_ONLY = false;
  var sb = window.mqSb;
  if(!sb) return;
  var root = document.getElementById('teams-root');
  if(!root) return;
  var BASE = (sb.supabaseUrl || window.SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/';
  // Pro sports first, then soccer, then college and the rest.
  var LEAGUES = [
    ['nfl', 'NFL'], ['nba', 'NBA'], ['mlb', 'MLB'], ['nhl', 'NHL'],
    ['mls', 'MLS'], ['epl', 'Premier League'], ['laliga', 'La Liga'], ['bundesliga', 'Bundesliga'], ['seriea', 'Serie A'], ['ligue1', 'Ligue 1'], ['nwsl', 'NWSL'],
    ['ncaaf', 'College football'], ['ncaam', 'College basketball (men)'], ['ncaaw', 'College basketball (women)'], ['wnba', 'WNBA']
  ];
  var LG_NAME = {}; LEAGUES.forEach(function(l){ LG_NAME[l[0]] = l[1]; });
  var STATS_LEAGUES = { nba: 1, nfl: 1, mlb: 1, nhl: 1 }; // the athlete function covers these four
  // ESPN headshot folders, so a followed player shows a face without an extra request.
  var HS_PATH = { nfl: 'nfl', nba: 'nba', mlb: 'mlb', nhl: 'nhl', wnba: 'wnba', ncaaf: 'college-football', ncaam: 'mens-college-basketball', ncaaw: 'womens-college-basketball' };
  var session = null, isPlus = false, prefs = { tab_name: 'Teams', make_default: false }, picks = [];
  var view = 'home';      // 'home' | 'add' | 'set' | 'detail'
  var openId = null;      // the followed team/player being viewed
  var sub = 'overview';   // team detail section
  var firstRun = true;
  var teamCache = {};     // 'nba:13' -> promise of the team summary

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
  function initials(name){
    var p = String(name || '').replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
    if(!p.length) return '?';
    return (p.length === 1 ? p[0].slice(0, 2) : p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
  }
  // A square or round picture slot. Shows the image when it loads, otherwise the initials, so a tile is never empty.
  function art(src, name, cls){
    var box = h('span', 'tm2-art ' + (cls || ''));
    var fb = h('i', null, initials(name)); box.appendChild(fb);
    if(/^https:\/\/a\.espncdn\.com\//.test(src || '')){
      var im = h('img'); im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
      im.onload = function(){ fb.style.display = 'none'; };
      im.onerror = function(){ im.remove(); };
      im.src = src; box.appendChild(im);
    }
    return box;
  }
  function setArt(box, src){
    if(!box || !/^https:\/\/a\.espncdn\.com\//.test(src || '')) return;
    var fb = box.querySelector('i'), im = h('img'); im.alt = ''; im.referrerPolicy = 'no-referrer';
    im.onload = function(){ if(fb) fb.style.display = 'none'; };
    im.onerror = function(){ im.remove(); };
    im.src = src; box.appendChild(im);
  }
  function playerHs(p){
    var folder = HS_PATH[p.league];
    return folder && /^\d{1,10}$/.test(p.espn_id || '') ? 'https://a.espncdn.com/i/headshots/' + folder + '/players/full/' + p.espn_id + '.png' : '';
  }
  function getTeam(p){
    var k = p.league + ':' + p.espn_id;
    if(!teamCache[k]) teamCache[k] = fetchJson('team-hub?action=team&league=' + p.league + '&id=' + p.espn_id).then(function(d){
      if(!d || d.error){ delete teamCache[k]; return null; }
      return d;
    });
    return teamCache[k];
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
      out.appendChild(h('p', 'es-sub', 'Pick your favorites and see their record, top players, schedule, injuries and headlines in one place.'));
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
    if(view === 'detail'){
      var pk = picks.filter(function(x){ return x.id === openId; })[0];
      if(pk){ renderDetail(pk); return; }
      view = 'home';
    }
    if(view === 'add'){ renderAdd(); return; }
    if(view === 'set'){ renderSettings(); return; }
    renderHome();
  }
  function go(v){ view = v; render(); window.scrollTo({ top: 0 }); }

  // ================= HOME: logo squares =================
  function renderHome(){
    var bar = h('div', 'tm2-bar');
    bar.appendChild(btn('+ Add teams or players', function(){ go('add'); }, 'tm-btn'));
    bar.appendChild(btn('Settings', function(){ go('set'); }, 'tm2-link'));
    root.appendChild(bar);

    if(!picks.length){
      var e = h('div', 'tm2-empty');
      e.appendChild(h('b', null, 'You are not following anyone yet'));
      e.appendChild(h('p', null, 'Add your favorite teams and players. Each one gets a square here with its logo, record and quick status. Tap a square for top players, schedule, injuries and news.'));
      e.appendChild(btn('Add your first team', function(){ go('add'); }, 'tm-btn'));
      root.appendChild(e);
    } else {
      var teams = picks.filter(function(p){ return p.kind === 'team'; }), players = picks.filter(function(p){ return p.kind !== 'team'; });
      if(teams.length) root.appendChild(tileSection('Teams', teams));
      if(players.length) root.appendChild(tileSection('Players', players));
    }
    root.appendChild(h('p', 'tm-foot', 'Source: ESPN public feed. Unofficial and may lag. Injury news is for information only.'));
  }
  function tileSection(title, list){
    var sec = h('section', 'tm2-sec');
    var hd = h('div', 'tm2-sh'); hd.appendChild(h('span', null, title)); hd.appendChild(h('em', null, String(list.length))); sec.appendChild(hd);
    var grid = h('div', 'tm2-grid');
    list.forEach(function(p){ grid.appendChild(tile(p)); });
    sec.appendChild(grid);
    return sec;
  }
  function tile(p){
    var t = h('button', 'tm2-tile ' + (p.kind === 'team' ? 'is-team' : 'is-player')); t.type = 'button';
    var a = art(p.kind === 'team' ? '' : playerHs(p), p.name, p.kind === 'team' ? 'sq' : 'rd'); t.appendChild(a);
    t.appendChild(h('b', 'tm2-name', p.name));
    var meta = h('span', 'tm2-meta', p.meta || LG_NAME[p.league] || ''); t.appendChild(meta);
    var badge = h('span', 'tm2-badge'); badge.hidden = true; t.appendChild(badge);
    t.addEventListener('click', function(){ openId = p.id; sub = 'overview'; go('detail'); });
    if(p.kind === 'team'){
      getTeam(p).then(function(d){
        if(!d || !t.isConnected) return;
        setArt(a, d.logo);
        meta.textContent = [d.record, LG_NAME[p.league]].filter(Boolean).join(' · ');
        var n = (d.injuries || []).length;
        if(n){ badge.hidden = false; badge.textContent = n + ' injur' + (n === 1 ? 'y' : 'ies'); }
        if(d.live){ badge.hidden = false; badge.textContent = 'Live'; badge.className = 'tm2-badge live'; }
      });
    }
    return t;
  }

  // ================= SETTINGS =================
  function renderSettings(){
    root.appendChild(backBar('Settings'));
    var box = h('div', 'tm2-card'), m = h('p', 'tm-msg');
    var f1 = h('div', 'tm2-field');
    var l1 = h('label', 'tm2-lab', 'Tab name'); l1.setAttribute('for', 'tm2-name-in'); f1.appendChild(l1);
    f1.appendChild(h('p', 'tm2-help', 'This is what the tab at the top of the site is called. For example: My Teams, Fantasy, Lakers.'));
    var inp = h('input', 'tm-in'); inp.id = 'tm2-name-in'; inp.type = 'text'; inp.maxLength = 20; inp.value = prefs.tab_name || 'Teams'; f1.appendChild(inp);
    box.appendChild(f1);
    var f2 = h('div', 'tm2-field');
    var lab = h('label', 'tm2-switch'); var cb = h('input'); cb.type = 'checkbox'; cb.checked = !!prefs.make_default;
    lab.appendChild(cb);
    var tx = h('span'); tx.appendChild(h('b', null, 'Open this tab first')); tx.appendChild(h('small', null, 'When you visit Marqit, start here instead of on Play.')); lab.appendChild(tx);
    f2.appendChild(lab); box.appendChild(f2);
    var act = h('div', 'tm2-actions');
    act.appendChild(btn('Save', async function(){
      var name = inp.value.replace(/[<>]/g, '').trim();
      if(!name){ say(m, 'Give the tab a name (up to 20 characters).', true); return; }
      var r = await sb.from('user_teams_prefs').upsert({ user_id: session.user.id, tab_name: name, make_default: cb.checked, updated_at: new Date().toISOString() });
      if(r.error){ say(m, friendly(r.error), true); return; }
      prefs = { tab_name: name, make_default: cb.checked }; applyName(); say(m, 'Saved.');
    }));
    box.appendChild(act); box.appendChild(m);
    root.appendChild(box);
  }
  function backBar(title, extra){
    var bar = h('div', 'tm2-back');
    bar.appendChild(btn('← My teams', function(){ go('home'); }, 'tm2-link'));
    if(title) bar.appendChild(h('b', null, title));
    if(extra) bar.appendChild(extra);
    return bar;
  }

  // ================= ADD: league chips, then logo squares =================
  var addLg = '', addTeams = [], addPicked = null, addFilter = '';
  function renderAdd(){
    root.appendChild(backBar('Add a team or player'));
    var box = h('div', 'tm2-card'), m = h('p', 'tm-msg');

    box.appendChild(h('div', 'tm2-step', '1. Choose a league'));
    var chips = h('div', 'tm2-chips');
    LEAGUES.forEach(function(l){
      var c = btn(l[1], function(){ addLg = l[0]; addPicked = null; addFilter = ''; loadAddTeams(); chips.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x === c); }); }, 'tm2-chip' + (addLg === l[0] ? ' on' : ''));
      chips.appendChild(c);
    });
    box.appendChild(chips);

    var teamsBox = h('div', 'tm2-addteams'); box.appendChild(teamsBox);
    var actBox = h('div', 'tm2-addact'); box.appendChild(actBox);
    var rosterBox = h('div', 'tm2-roster'); box.appendChild(rosterBox);
    box.appendChild(m);
    root.appendChild(box);

    function drawTeams(){
      teamsBox.textContent = '';
      if(!addLg) return;
      teamsBox.appendChild(h('div', 'tm2-step', '2. Tap a team'));
      if(addTeams.length > 14){
        var s = h('input', 'tm-in tm2-search'); s.type = 'search'; s.placeholder = 'Search teams'; s.value = addFilter; s.setAttribute('aria-label', 'Search teams');
        s.addEventListener('input', function(){ addFilter = s.value; drawGrid(); });
        teamsBox.appendChild(s);
      }
      var grid = h('div', 'tm2-grid tm2-pick'); teamsBox.appendChild(grid);
      function drawGrid(){
        grid.textContent = '';
        var q = addFilter.trim().toLowerCase();
        var list = addTeams.filter(function(t){ return !q || t.name.toLowerCase().indexOf(q) >= 0 || (t.abbr || '').toLowerCase() === q; });
        if(!list.length){ grid.appendChild(h('p', 'tm-note', addTeams.length ? 'No teams match that search.' : 'Loading teams…')); return; }
        list.forEach(function(t){
          var followed = picks.some(function(p){ return p.kind === 'team' && p.league === addLg && p.espn_id === t.id; });
          var tl = h('button', 'tm2-tile is-team' + (addPicked && addPicked.id === t.id ? ' sel' : '')); tl.type = 'button';
          tl.appendChild(art(t.logo, t.name, 'sq'));
          tl.appendChild(h('b', 'tm2-name', t.name));
          if(followed) tl.appendChild(h('span', 'tm2-badge ok', 'Following'));
          tl.addEventListener('click', function(){ addPicked = t; rosterBox.textContent = ''; drawGrid(); drawActions(); });
          grid.appendChild(tl);
        });
      }
      drawGrid();
    }
    function drawActions(){
      actBox.textContent = '';
      if(!addPicked) return;
      var t = addPicked, lgName = LG_NAME[addLg];
      actBox.appendChild(h('div', 'tm2-step', '3. ' + t.name));
      var row = h('div', 'tm2-actions');
      row.appendChild(btn('Follow this team', async function(){
        await addPick({ kind: 'team', league: addLg, espn_id: t.id, name: t.name, meta: lgName }, m);
        drawTeams();
      }));
      row.appendChild(btn('Browse its players', async function(){
        rosterBox.textContent = ''; rosterBox.appendChild(h('p', 'tm-note', 'Loading players…'));
        var d = await fetchJson('team-hub?action=roster&league=' + addLg + '&id=' + t.id);
        rosterBox.textContent = '';
        var ps = (d && d.players) || [];
        if(!ps.length){ rosterBox.appendChild(h('p', 'tm-note', 'No players found right now.')); return; }
        rosterBox.appendChild(h('div', 'tm2-step', 'Players · tap one to follow'));
        var grid = h('div', 'tm2-grid tm2-pick');
        ps.forEach(function(p){
          var tl = h('button', 'tm2-tile is-player'); tl.type = 'button';
          tl.appendChild(art(p.hs, p.name, 'rd'));
          tl.appendChild(h('b', 'tm2-name', p.name));
          tl.appendChild(h('span', 'tm2-meta', [p.pos, p.jersey ? '#' + p.jersey : ''].filter(Boolean).join(' · ')));
          tl.addEventListener('click', async function(){
            await addPick({ kind: 'player', league: addLg, espn_id: p.id, name: p.name, meta: [p.pos, t.abbr || t.name].filter(Boolean).join(' · ') }, m);
          });
          grid.appendChild(tl);
        });
        rosterBox.appendChild(grid);
      }, 'tm-btn ghost'));
      actBox.appendChild(row);
    }
    function loadAddTeams(){
      addTeams = []; teamsBox.textContent = ''; actBox.textContent = ''; rosterBox.textContent = '';
      teamsBox.appendChild(h('p', 'tm-note', 'Loading teams…'));
      var lg = addLg;
      fetchJson('team-hub?action=teams&league=' + lg).then(function(d){
        if(lg !== addLg) return;
        addTeams = (d && d.teams) || [];
        if(!addTeams.length){ teamsBox.textContent = ''; teamsBox.appendChild(h('p', 'tm-note', 'Could not load teams right now. Try again in a minute.')); return; }
        drawTeams();
      });
    }
    if(addLg) loadAddTeams();
  }
  async function addPick(row, m){
    if(picks.some(function(p){ return p.kind === row.kind && p.league === row.league && p.espn_id === row.espn_id; })){ say(m, 'You already follow that.', true); return; }
    row.user_id = session.user.id;
    var r = await sb.from('user_team_picks').insert(row).select('id, kind, league, espn_id, name, meta').single();
    if(r.error){ say(m, friendly(r.error), true); return; }
    picks.push(r.data); say(m, row.name + ' added. Find it under My teams.');
  }

  // ================= DETAIL =================
  function removeBtn(p){
    return sure('Stop following', async function(){
      var r = await sb.from('user_team_picks').delete().eq('id', p.id).eq('user_id', session.user.id);
      if(r.error) return;
      picks = picks.filter(function(x){ return x.id !== p.id; }); openId = null; go('home');
    }, 'tm-btn small danger');
  }
  function renderDetail(p){
    root.appendChild(backBar('', removeBtn(p)));
    var wrap = h('div', 'tm2-detail'); root.appendChild(wrap);
    if(p.kind === 'team') loadTeam(wrap, p); else loadPlayer(wrap, p);
  }

  function sect(title, nodes){
    var s = h('div', 'tm-sect'); s.appendChild(h('div', 'tm-sh', title));
    nodes.forEach(function(n){ s.appendChild(n); }); return s;
  }
  function gameLine(g, live){
    var l = h('div', 'tm-game');
    if(g.done){ l.appendChild(h('span', 'tm-res ' + (g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : ''), g.result || '–')); } else l.appendChild(h('span'));
    l.appendChild(h('span', 'tm-gname', (g.home ? 'vs ' : '@ ') + g.opp));
    l.appendChild(h('span', 'tm-gwhen', g.done ? (g.us + '–' + g.them + ' · ' + fmtDate(g.date)) : live ? ((g.us && g.them) ? g.us + '–' + g.them : 'In progress') : fmtWhen(g.date)));
    return l;
  }
  function statGrid(cells){
    var grid = h('div', 'tm-grid');
    cells.filter(function(c){ return c[1]; }).forEach(function(c){ var cell = h('div'); cell.appendChild(h('span', null, c[0])); cell.appendChild(h('b', null, String(c[1]))); grid.appendChild(cell); });
    return grid;
  }
  // Injuries: the most serious first, a handful shown, the rest behind one button, details tucked under each name.
  function injuryList(inj){
    var wrap = h('div', 'tm2-inj');
    if(!inj.length){ wrap.appendChild(h('p', 'tm-note', 'No injuries reported.')); return wrap; }
    var rank = function(s){ s = String(s || '').toLowerCase(); return /out|injured reserve|ir\b/.test(s) ? 0 : /doubtful/.test(s) ? 1 : /questionable|day-to-day/.test(s) ? 2 : 3; };
    var list = inj.slice().sort(function(a, b){ return rank(a.status) - rank(b.status); });
    function row(i){
      var d = h('details', 'tm2-injrow');
      var sm = h('summary');
      sm.appendChild(h('b', null, i.name + (i.pos ? ' (' + i.pos + ')' : '')));
      sm.appendChild(h('span', 'tm2-st st' + rank(i.status), i.status || 'Listed'));
      d.appendChild(sm);
      var body = h('div', 'tm2-injbody');
      var more = [i.detail, i.date ? 'Updated ' + fmtDate(i.date) : ''].filter(Boolean).join(' · ');
      if(more) body.appendChild(h('div', 'tm-note', more));
      if(i.comment && i.comment !== i.detail) body.appendChild(h('div', 'tm-note', i.comment));
      if(!body.childNodes.length) body.appendChild(h('div', 'tm-note', 'No more detail from the team.'));
      d.appendChild(body);
      return d;
    }
    var SHOW = 6;
    list.slice(0, SHOW).forEach(function(i){ wrap.appendChild(row(i)); });
    if(list.length > SHOW){
      var rest = h('div', 'tm2-injrest'); rest.hidden = true;
      list.slice(SHOW).forEach(function(i){ rest.appendChild(row(i)); });
      wrap.appendChild(rest);
      var more = btn('Show all ' + list.length, function(){ rest.hidden = !rest.hidden; more.textContent = rest.hidden ? 'Show all ' + list.length : 'Show fewer'; }, 'tm-btn ghost small');
      wrap.appendChild(more);
    }
    return wrap;
  }

  async function loadTeam(wrap, p){
    wrap.appendChild(h('p', 'tm-note', 'Loading…'));
    var d = await getTeam(p);
    wrap.textContent = '';
    if(!d){ wrap.appendChild(h('p', 'tm-note', 'Team details are not available right now.')); return; }

    var head = h('div', 'tm2-dhead');
    head.appendChild(art(d.logo, d.name || p.name, 'sq lg'));
    var ht = h('div', 'tm2-dtext');
    ht.appendChild(h('h3', null, d.name || p.name));
    ht.appendChild(h('div', 'tm2-dsub', [d.record, d.standing].filter(Boolean).join(' · ') || LG_NAME[p.league] || ''));
    if(d.lastSeason) ht.appendChild(h('div', 'tm-note', 'Last season (' + d.lastSeason.year + '): ' + d.lastSeason.record));
    head.appendChild(ht); wrap.appendChild(head);

    var injN = (d.injuries || []).length, newsN = (d.headlines || []).length;
    var tabs = [['overview', 'Overview'], ['games', 'Games'], ['injuries', 'Injuries' + (injN ? ' (' + injN + ')' : '')], ['news', 'News' + (newsN ? ' (' + newsN + ')' : '')]];
    var bar = h('div', 'tm2-tabs'); wrap.appendChild(bar);
    var body = h('div', 'tm2-dbody'); wrap.appendChild(body);
    function draw(){
      bar.textContent = '';
      tabs.forEach(function(t){ bar.appendChild(btn(t[1], function(){ sub = t[0]; draw(); }, 'tm2-tab' + (sub === t[0] ? ' on' : ''))); });
      body.textContent = '';
      if(sub === 'overview') overview(body, d, p);
      else if(sub === 'games') games(body, d);
      else if(sub === 'injuries') body.appendChild(injuryList(d.injuries || []));
      else news(body, d);
    }
    draw();
  }
  function overview(body, d, p){
    var game = d.live ? sect('Live now', [gameLine(d.live, true)]) : (d.upcoming && d.upcoming.length ? sect('Next game', [gameLine(d.upcoming[0])]) : null);
    if(game) body.appendChild(game);

    var ld = d.leaders || [];
    if(ld.length){
      var s = h('div', 'tm-sect'); s.appendChild(h('div', 'tm-sh', 'Top players'));
      var grid = h('div', 'tm2-grid tm2-lead');
      ld.forEach(function(l){
        var c = h('div', 'tm2-pl');
        c.appendChild(art(l.hs, l.name, 'rd'));
        c.appendChild(h('b', 'tm2-name', l.name));
        c.appendChild(h('span', 'tm2-meta', [l.pos, l.num ? '#' + l.num : ''].filter(Boolean).join(' · ')));
        c.appendChild(h('span', 'tm2-lstat', l.line));
        c.appendChild(h('span', 'tm2-llab', l.label));
        grid.appendChild(c);
      });
      s.appendChild(grid); body.appendChild(s);
    } else if(!STATS_LEAGUES[p.league] && p.league !== 'wnba' && p.league !== 'ncaaf'){
      body.appendChild(sect('Top players', [h('p', 'tm-note', 'Top players are not available for this league yet. Tap Browse its players under Add to follow individual players.')]));
    }

    var cells = [['Record', d.record], ['Standing', d.standing], ['Home', d.home], ['Road', d.road]];
    (d.seasonStats || []).forEach(function(x){ cells.push([x.label, x.value]); });
    var shown = cells.filter(function(c){ return c[1]; });
    if(shown.length) body.appendChild(sect('Season', [statGrid(shown)]));

    if(d.results && d.results.length) body.appendChild(sect('Last 3 results', d.results.slice(0, 3).map(function(g){ return gameLine(g); })));
  }
  function games(body, d){
    var any = false;
    if(d.live){ body.appendChild(sect('Live now', [gameLine(d.live, true)])); any = true; }
    if(d.upcoming && d.upcoming.length){ body.appendChild(sect('Next up', d.upcoming.map(function(g){ return gameLine(g); }))); any = true; }
    if(d.results && d.results.length){ body.appendChild(sect('Recent results', d.results.map(function(g){ return gameLine(g); }))); any = true; }
    if(!any) body.appendChild(h('p', 'tm-note', 'No games to show right now.'));
  }
  function news(body, d){
    if(!d.headlines || !d.headlines.length){ body.appendChild(h('p', 'tm-note', 'No headlines right now.')); return; }
    d.headlines.forEach(function(a){
      var l = h('a', 'tm-news'); l.href = a.url; l.target = '_blank'; l.rel = 'noopener noreferrer';
      l.appendChild(h('span', null, a.headline));
      if(a.date) l.appendChild(h('em', 'tm-note', fmtDate(a.date)));
      body.appendChild(l);
    });
  }

  // ---- player detail ----
  async function loadPlayer(wrap, p){
    var head = h('div', 'tm2-dhead');
    head.appendChild(art(playerHs(p), p.name, 'rd lg'));
    var ht = h('div', 'tm2-dtext'); ht.appendChild(h('h3', null, p.name)); ht.appendChild(h('div', 'tm2-dsub', p.meta || LG_NAME[p.league] || '')); head.appendChild(ht);
    wrap.appendChild(head);
    var body = h('div', 'tm2-dbody'); wrap.appendChild(body);
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
      body.appendChild(statGrid(d.stats.map(function(c){ return [c.label, c.value]; })));
    } else body.appendChild(h('p', 'tm-note', 'Season stats are not available yet.'));
  }

  sb.auth.onAuthStateChange(function(){ init(); });
  init();
})();
