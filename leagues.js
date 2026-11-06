/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
/* Leagues: private leagues you create or join with an invite code (up to 10 per player, 50 players each).
   Free for everyone. Marqit+ unlocks the commissioner tools and weekly/monthly standings. Score = correct calls. No prizes.
   All data goes through database functions (see supabase/migrations/20261105_leagues.sql); the page never touches the tables. */
(function(){
  var sb = window.mqSb;
  if(!sb) return;
  var root = document.getElementById('leagues-root');
  if(!root) return;
  var session = null, isPlus = false, openId = null, period = 'season', pendingCode = '';
  try{ pendingCode = (new URLSearchParams(location.search).get('league') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase(); }catch(e){}

  function h(tag, cls, text){ var el = document.createElement(tag); if(cls) el.className = cls; if(text != null) el.textContent = text; return el; }
  function btn(label, fn, cls){ var b = h('button', cls || 'lg-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function friendly(e){ var m = (e && e.message) || ''; return m && m.length < 140 ? m : 'Something went wrong. Please try again.'; }
  // Two-tap confirmation without a browser pop-up.
  function sure(label, fn, cls){
    var armed = false, t = null, b = btn(label, function(){
      if(!armed){ armed = true; b.textContent = 'Tap again to confirm'; t = setTimeout(function(){ armed = false; b.textContent = label; }, 4000); return; }
      clearTimeout(t); armed = false; b.textContent = label; fn();
    }, cls);
    return b;
  }
  function say(el, text, bad){ el.textContent = text || ''; el.className = 'lg-msg' + (bad ? ' bad' : text ? ' ok' : ''); }

  async function init(){
    var r = await sb.auth.getSession();
    session = r && r.data && r.data.session;
    isPlus = false;
    if(session){ try{ var p = await sb.rpc('is_marqit_plus'); isPlus = !!(p && p.data === true); }catch(e){} }
    render();
    if(pendingCode){ var tab = document.querySelector('.pagenav-tab[data-page="leaderboard"]'); if(tab) tab.click(); }
  }

  var gen = 0;
  async function render(){
    var my = ++gen;
    root.textContent = '';
    if(!session){
      var out = h('div', 'empty-state empty-inline');
      out.appendChild(h('div', 'es-title', 'Start a league with your people'));
      out.appendChild(h('p', 'es-sub', 'Create a league, share the code and see who calls it best. You can be in up to 10.'));
      var b = h('button', 'es-btn', 'Sign up free'); b.type = 'button'; b.setAttribute('data-open-signup', 'leagues'); out.appendChild(b);
      root.appendChild(out);
      return;
    }
    var list = h('div', 'lg-list'); root.appendChild(list);
    var r = await sb.rpc('my_leagues');
    if(my !== gen) return;
    var rows = (r && r.data) || [];
    if(r && r.error){ list.appendChild(h('p', 'lg-empty', 'Could not load your leagues right now.')); }
    else if(!rows.length){ list.appendChild(h('p', 'lg-empty', 'You are not in a league yet. Create one or enter a code below.')); }
    rows.forEach(function(l){
      var card = h('div', 'lg-card');
      var head = h('button', 'lg-head'); head.type = 'button';
      head.appendChild(h('b', null, l.name));
      head.appendChild(h('span', 'lg-meta', l.member_count + (l.member_count === 1 ? ' player' : ' players') + (l.is_commissioner ? ' · you run this one' : '')));
      head.addEventListener('click', function(){ openId = (openId === l.id) ? null : l.id; period = 'season'; render(); });
      card.appendChild(head);
      if(openId === l.id){ var body = h('div', 'lg-body'); card.appendChild(body); detail(body, l); }
      list.appendChild(card);
    });
    forms(root, rows.length);
  }

  function forms(parent, count){
    var box = h('div', 'lg-forms'), m = h('p', 'lg-msg');
    var c = h('div', 'lg-row');
    var ci = h('input', 'lg-in'); ci.type = 'text'; ci.placeholder = 'New league name'; ci.maxLength = 40; ci.setAttribute('aria-label', 'New league name');
    c.appendChild(ci);
    c.appendChild(btn('Create', async function(){
      say(m, '');
      var r = await sb.rpc('create_league', { p_name: ci.value });
      if(r.error){ say(m, friendly(r.error), true); return; }
      openId = r.data; ci.value = ''; render();
    }));
    var j = h('div', 'lg-row');
    var ji = h('input', 'lg-in'); ji.type = 'text'; ji.placeholder = 'Invite code'; ji.maxLength = 12; ji.setAttribute('aria-label', 'League invite code'); ji.value = pendingCode;
    j.appendChild(ji);
    j.appendChild(btn('Join', async function(){
      say(m, '');
      var r = await sb.rpc('join_league', { p_code: ji.value });
      if(r.error){ say(m, friendly(r.error), true); return; }
      pendingCode = ''; openId = r.data; render();
    }));
    box.appendChild(c); box.appendChild(j); box.appendChild(m);
    if(count >= 10) box.appendChild(h('p', 'lg-note', 'You are in 10 leagues, the most one player can be in.'));
    parent.appendChild(box);
  }

  async function detail(body, l){
    var msgEl = h('p', 'lg-msg');
    // Period tabs: season is free; week and month are part of Marqit+.
    var tabs = h('div', 'lg-tabs');
    [['season', 'Season'], ['week', 'Last 7 days'], ['month', 'This month']].forEach(function(t){
      var locked = t[0] !== 'season' && !isPlus;
      var b = btn(t[1] + (locked ? ' (Marqit+)' : ''), function(){
        if(locked){ say(msgEl, 'Weekly and monthly standings are part of Marqit+.', true); return; }
        period = t[0]; render();
      }, 'lg-tab' + (period === t[0] ? ' on' : '') + (locked ? ' locked' : ''));
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
    var table = h('div', 'lg-table'); body.appendChild(table);
    var r = await sb.rpc('league_standings', { p_league: l.id, p_period: period });
    if(r.error){ table.appendChild(h('p', 'lg-empty', friendly(r.error))); }
    else {
      var rows = r.data || [];
      rows.forEach(function(x, i){
        var row = h('div', 'lg-line');
        row.appendChild(h('span', 'lg-rank', String(i + 1)));
        row.appendChild(h('span', 'lg-name', (x.avatar_emoji ? x.avatar_emoji + ' ' : '') + x.username + (x.is_commissioner ? ' (commissioner)' : '')));
        row.appendChild(h('span', 'lg-score', x.right_calls + '/' + x.calls + ' · ' + x.pct + '%'));
        if(l.is_commissioner && isPlus && session && x.user_id !== session.user.id){
          row.appendChild(sure('Remove', async function(){
            var rr = await sb.rpc('league_remove_member', { p_league: l.id, p_user: x.user_id });
            if(rr.error){ say(msgEl, friendly(rr.error), true); return; } render();
          }, 'lg-btn small danger'));
        }
        table.appendChild(row);
      });
      if(rows.length && rows.every(function(x){ return !x.calls; })) table.appendChild(h('p', 'lg-note', 'No settled calls yet. Standings count correct calls on settled questions.'));
    }
    // Invite code
    var inv = h('div', 'lg-row');
    inv.appendChild(h('span', 'lg-note', 'Invite code: '));
    inv.appendChild(h('code', 'lg-code', l.invite_code));
    inv.appendChild(btn('Copy invite link', async function(){
      var link = location.origin + '/?league=' + l.invite_code;
      try{ await navigator.clipboard.writeText(link); say(msgEl, 'Invite link copied.'); }catch(e){ say(msgEl, 'Copy this link: ' + link); }
    }, 'lg-btn small'));
    body.appendChild(inv);
    // Past seasons
    var hist = await sb.rpc('league_history', { p_league: l.id });
    var hr = (hist && hist.data) || [];
    if(hr.length){
      var hb = h('div', 'lg-hist'); hb.appendChild(h('b', null, 'Past seasons'));
      hr.forEach(function(x){ hb.appendChild(h('p', 'lg-note', x.season_start + ' to ' + x.season_end + ': ' + (x.winner_name ? x.winner_name + ' won with ' + x.winner_right + '/' + x.winner_settled : 'no settled calls'))); });
      body.appendChild(hb);
    }
    // Commissioner tools
    if(l.is_commissioner){
      var tools = h('div', 'lg-tools'); tools.appendChild(h('b', null, 'Commissioner tools'));
      if(!isPlus){
        tools.appendChild(h('p', 'lg-note', 'Rename the league, remove players, reset the code and close a season. These are part of Marqit+.'));
        tools.appendChild(btn('See Marqit+', function(){ var t = document.querySelector('.pagenav-tab[data-page="plus"]'); if(t) t.click(); window.scrollTo(0, 0); }, 'lg-btn small'));
      } else {
        var rn = h('div', 'lg-row'); var ri = h('input', 'lg-in'); ri.type = 'text'; ri.value = l.name; ri.maxLength = 40; ri.setAttribute('aria-label', 'League name');
        rn.appendChild(ri);
        rn.appendChild(btn('Rename', async function(){ var rr = await sb.rpc('league_rename', { p_league: l.id, p_name: ri.value }); if(rr.error){ say(msgEl, friendly(rr.error), true); return; } render(); }, 'lg-btn small'));
        tools.appendChild(rn);
        var act = h('div', 'lg-row');
        act.appendChild(sure('Reset invite code', async function(){ var rr = await sb.rpc('league_reset_code', { p_league: l.id }); if(rr.error){ say(msgEl, friendly(rr.error), true); return; } say(msgEl, 'New code made. The old code and links stop working.'); render(); }, 'lg-btn small'));
        act.appendChild(sure('Close season', async function(){ var rr = await sb.rpc('league_close_season', { p_league: l.id }); if(rr.error){ say(msgEl, friendly(rr.error), true); return; } say(msgEl, 'Season closed. The winner is saved under Past seasons and a new season has started.'); render(); }, 'lg-btn small'));
        tools.appendChild(act);
        tools.appendChild(h('p', 'lg-note', 'Closing a season saves the current leader as the winner and starts the standings over from today.'));
      }
      body.appendChild(tools);
    }
    var leave = h('div', 'lg-row');
    leave.appendChild(sure('Leave league', async function(){ var rr = await sb.rpc('leave_league', { p_league: l.id }); if(rr.error){ say(msgEl, friendly(rr.error), true); return; } openId = null; render(); }, 'lg-btn small danger'));
    body.appendChild(leave);
    body.appendChild(msgEl);
  }

  sb.auth.onAuthStateChange(function(){ init(); });
  init();
})();
