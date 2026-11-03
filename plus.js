/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
/* Marqit+ page: perks that run on the player's own data. Free for every signed-in player for now.
   Nothing here touches entries, points, picks or prizes. */
(function(){
  var sb = window.mqSb;
  if(!sb) return;
  var root = null, follows = [], session = null;

  function h(tag, cls, text){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    if(text != null) el.textContent = text;
    return el;
  }
  function section(){ return h('div', 'plus-tool'); }
  function msg(parent){ var m = h('p', 'plus-msg'); parent.appendChild(m); return function(t, bad){ m.textContent = t || ''; m.className = 'plus-msg' + (bad ? ' bad' : ''); }; }
  function btn(label, fn, cls){ var b = h('button', cls || 'plus-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function download(name, mime, text){
    var url = URL.createObjectURL(new Blob([text], { type: mime }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  var CAT = { sports: 'Sports', pop_culture: 'Pop culture', news: 'News' };
  function catName(c){ return CAT[c] || (c ? c.replace(/_/g, ' ') : 'Other'); }

  // ---------- perks: one tap-to-open row each, with a plain-English explanation and, where there is one, the tool ----------
  var GROUPS = [
    ['Know more before you pick', [
      ['History & lean on daily questions', 'live', 'Tap History & lean under any daily question to see 5 bullets of history and a percentage lean, with the data behind it. It is information from past results, not betting lines and not advice.'],
      ['History & lean on every game and event', 'live', 'Open any game, earnings report or event on the Schedule tab and you will see its history and lean too, not only the three daily questions.', 'schedule'],
      ['Similar past questions', 'live', 'Under History & lean, tap Similar past questions to see how the closest matching questions from our history ended up.'],
      ['Results explained', 'live', 'After a question settles, History & lean adds a short note on why it went that way.'],
      ['Full game or event report', 'live', 'Ask for a full written report on any game or event, even one that is not a Marqit question. Up to 2 per month, ready within 48 hours, historical data only (no betting lines or odds).', 'report']
    ]],
    ['Your game', [
      ['My Stats Pro', 'live', 'Your accuracy by category from every settled question you picked, plus your best and toughest categories and your streaks.', 'stats'],
      ['Head-to-head with buddies', 'live', 'Your record against a buddy on questions you both picked. No prizes, just bragging rights.', 'head'],
      ['My Teams and topics', 'live', 'Follow teams and topics. Questions and schedule items that mention them get a gold highlight. Highlighting only: no extra alerts.', 'follows'],
      ['Question archive', 'live', 'Search every past question and how it settled. Players without Marqit+ see the last 7 days.', 'archive']
    ]],
    ['Take it with you', [
      ['Morning brief email', 'live', 'A short email each morning with the history behind that day\u2019s questions. Off until you turn it on.', 'brief'],
      ['Weekly recap email', 'live', 'Every Monday, an email with your week: picks, accuracy and streak. This one is free for everyone and can be turned off any time.'],
      ['Calendar sync', 'live', 'Download the next 30 days of the Marqit schedule as a calendar file for your phone or computer.', 'calendar'],
      ['Pick history export', 'live', 'Download every pick you have made as a spreadsheet.', 'export']
    ]],
    ['Always', [
      ['Always ad-free', 'live', 'Marqit+ will never show you display or video ads. There are none today, and if we ever add them, Marqit+ members will not see them.']
    ]],
    ['Coming soon', [
      ['Bigger private groups', 'soon', 'Larger buddy groups with their own leaderboards. No prizes attached.'],
      ['Priority support', 'soon', 'Faster replies when you write to us.']
    ]]
  ];
  var TOOLS = { stats: statsCard, head: headCard, follows: followsCard, archive: archiveCard, brief: briefCard, calendar: calendarCard, export: exportCard, report: reportCard };
  var NEEDS_SIGN_IN = { stats: 1, head: 1, follows: 1, brief: 1, calendar: 1, export: 1, report: 1 };
  function perkRow(p){
    var d = h('details', 'plus-perk');
    var sm = h('summary'); sm.appendChild(h('span', 'plus-perk-t', p[0]));
    sm.appendChild(h('em', 'plus-pill ' + p[1], p[1] === 'live' ? 'Live' : 'Soon'));
    d.appendChild(sm);
    var body = h('div', 'plus-perk-body'); body.appendChild(h('p', 'plus-sub', p[2])); d.appendChild(body);
    var tool = p[3], loaded = false;
    d.addEventListener('toggle', async function(){
      if(!d.open || loaded) return;
      if(tool === 'schedule'){ loaded = true; body.appendChild(btn('Open the Schedule', function(){ var t = document.querySelector('.pagenav-tab[data-page="schedule"]'); if(t) t.click(); })); return; }
      if(!tool || !TOOLS[tool]) return;
      if(NEEDS_SIGN_IN[tool] && !session){ loaded = true; body.appendChild(h('p', 'plus-empty', 'Sign in on the Play tab to use this. It is free.')); return; }
      loaded = true;
      var holder = h('div', 'plus-loading', 'Loading\u2026'); body.appendChild(holder);
      try{ var el = await TOOLS[tool](); holder.replaceWith(el); highlight(); }
      catch(e){ holder.textContent = 'Could not load this right now. Try again in a minute.'; loaded = false; }
    });
    return d;
  }
  function perksList(){
    var wrap = h('div', 'plus-groups');
    GROUPS.forEach(function(g){
      wrap.appendChild(h('p', 'plus-group', g[0]));
      var box = h('div', 'plus-perklist');
      g[1].forEach(function(p){ box.appendChild(perkRow(p)); });
      wrap.appendChild(box);
    });
    return wrap;
  }

  // ---------- My Stats Pro ----------
  async function myPicks(){
    var r = await sb.from('predictions')
      .select('choice, created_at, daily_questions!inner(question_date, category, question_text, resolved, correct_answer, voided)')
      .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1000);
    return (r.data || []).map(function(x){ var q = x.daily_questions; return { choice: x.choice, date: q.question_date, cat: q.category, text: q.question_text, resolved: q.resolved, answer: q.correct_answer, voided: q.voided }; });
  }
  async function statsCard(){
    var c = section('My Stats Pro', 'Your accuracy by category, from every settled question you have picked.');
    var rows = (await myPicks()).filter(function(p){ return p.resolved && !p.voided && (p.answer === 'yes' || p.answer === 'no'); });
    if(!rows.length){ c.appendChild(h('p', 'plus-empty', 'Play a few questions and your stats will show up here once they settle.')); return c; }
    var by = {}, right = 0;
    rows.forEach(function(p){ var k = p.cat || 'other'; by[k] = by[k] || { n: 0, r: 0 }; by[k].n++; if(p.choice === p.answer){ by[k].r++; right++; } });
    var top = h('div', 'plus-big');
    top.appendChild(h('b', null, Math.round(100 * right / rows.length) + '%'));
    top.appendChild(h('span', null, right + ' right out of ' + rows.length + ' settled picks'));
    c.appendChild(top);
    Object.keys(by).sort(function(a, b){ return by[b].n - by[a].n; }).forEach(function(k){
      var row = h('div', 'plus-bar-row'), pct = Math.round(100 * by[k].r / by[k].n);
      row.appendChild(h('span', 'plus-bar-label', catName(k)));
      var bar = h('div', 'plus-bar'); var f = h('i'); f.style.width = pct + '%'; bar.appendChild(f); row.appendChild(bar);
      row.appendChild(h('span', 'plus-bar-val', pct + '% · ' + by[k].r + '/' + by[k].n));
      c.appendChild(row);
    });
    var ranked = Object.keys(by).filter(function(k){ return by[k].n >= 3; }).sort(function(a, b){ return by[b].r / by[b].n - by[a].r / by[a].n; });
    if(ranked.length > 1) c.appendChild(h('p', 'plus-note', 'Best category: ' + catName(ranked[0]) + '. Toughest: ' + catName(ranked[ranked.length - 1]) + '. (Categories with 3 or more settled picks.)'));
    var st = await sb.from('streaks').select('current_streak, longest_streak').eq('user_id', session.user.id).maybeSingle();
    if(st.data) c.appendChild(h('p', 'plus-note', 'Current streak: ' + st.data.current_streak + ' days. Longest: ' + st.data.longest_streak + ' days.'));
    return c;
  }

  // ---------- Question archive ----------
  function archiveCard(){
    var c = section('Question archive', 'Search every past question and how it settled. Players without Marqit+ see the last 7 days.');
    var form = h('div', 'plus-form');
    var q = h('input', 'plus-in'); q.type = 'search'; q.placeholder = 'Search (a team, a person, a company)'; q.maxLength = 60; q.setAttribute('aria-label', 'Search the archive');
    var sel = h('select', 'plus-in'); sel.setAttribute('aria-label', 'Category');
    [['', 'All categories'], ['sports', 'Sports'], ['pop_culture', 'Pop culture'], ['news', 'News']].forEach(function(o){ var op = h('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
    form.appendChild(q); form.appendChild(sel);
    var out = h('div', 'plus-list');
    var more = btn('Show more', function(){ run(true); }, 'plus-btn ghost'); more.hidden = true;
    var offset = 0;
    async function run(append){
      if(!append){ offset = 0; out.textContent = ''; }
      var r = await sb.rpc('mq_archive', { p_search: q.value.trim() || null, p_category: sel.value || null, p_limit: 30, p_offset: offset });
      var rows = (r && r.data) || [];
      if(!rows.length && !append) out.appendChild(h('p', 'plus-empty', 'Nothing matches that yet.'));
      rows.forEach(function(x){
        var li = h('div', 'plus-row');
        li.appendChild(h('span', 'plus-row-date', new Date(x.question_date + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' })));
        li.appendChild(h('span', 'plus-row-text', x.question_text));
        li.appendChild(h('b', 'plus-chip ' + (x.voided ? 'void' : x.correct_answer), x.voided ? 'VOID' : String(x.correct_answer || '').toUpperCase()));
        out.appendChild(li);
      });
      offset += rows.length; more.hidden = rows.length < 30;
    }
    var t = null;
    q.addEventListener('input', function(){ clearTimeout(t); t = setTimeout(function(){ run(false); }, 300); });
    sel.addEventListener('change', function(){ run(false); });
    c.appendChild(form); c.appendChild(out); c.appendChild(more);
    run(false);
    return c;
  }

  // ---------- Pick export ----------
  function csvCell(v){ v = String(v == null ? '' : v); if(/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function exportCard(){
    var c = section('Pick history export', 'Download every pick you have made as a spreadsheet (CSV).');
    var say = msg(c);
    c.appendChild(btn('Download my picks', async function(){
      say('Building your file…');
      var rows = await myPicks();
      var lines = ['Date,Category,Question,My pick,Answer,Result'];
      rows.forEach(function(p){
        var res = !p.resolved ? 'Pending' : (p.voided ? 'Void' : (p.choice === p.answer ? 'Right' : 'Wrong'));
        lines.push([p.date, catName(p.cat), p.text, String(p.choice).toUpperCase(), p.resolved && !p.voided ? String(p.answer).toUpperCase() : '', res].map(csvCell).join(','));
      });
      download('marqit-my-picks.csv', 'text/csv;charset=utf-8', lines.join('\r\n'));
      say(rows.length + ' picks saved to your downloads.');
    }));
    return c;
  }

  // ---------- Calendar sync ----------
  function icsEsc(t){ return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsUtc(d){ return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function matchesFollow(text){
    var t = String(text || '').toLowerCase();
    return follows.some(function(f){ return t.indexOf(f.name.toLowerCase()) !== -1; });
  }
  function calendarCard(){
    var c = section('Calendar sync', 'Add upcoming games and events to your phone or computer calendar (a .ics file). It covers the next 30 days of the Marqit schedule.');
    var say = msg(c);
    var only = h('label', 'plus-check'); var cb = h('input'); cb.type = 'checkbox'; only.appendChild(cb); only.appendChild(h('span', null, 'Only my teams and topics'));
    c.appendChild(only);
    c.appendChild(btn('Download calendar file', async function(){
      say('Loading the schedule…');
      var now = new Date(), end = new Date(now.getTime() + 30 * 86400000);
      var r = await sb.from('key_events').select('id, title, subtitle, league, starts_at, all_day').gte('starts_at', now.toISOString()).lte('starts_at', end.toISOString()).order('starts_at').limit(500);
      var evs = (r.data || []).filter(function(e){ return !cb.checked || matchesFollow(e.title + ' ' + (e.league || '')); });
      if(!evs.length){ say(cb.checked ? 'Nothing coming up for your teams and topics yet.' : 'No events found.', true); return; }
      var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Marqit//Schedule//EN', 'CALSCALE:GREGORIAN'];
      evs.forEach(function(e){
        var s = new Date(e.starts_at);
        L.push('BEGIN:VEVENT', 'UID:' + e.id + '@playmarqit.com', 'DTSTAMP:' + icsUtc(now));
        if(e.all_day){
          var d = String(e.starts_at).slice(0, 10).replace(/-/g, ''), n = new Date(String(e.starts_at).slice(0, 10) + 'T12:00:00Z'); n.setUTCDate(n.getUTCDate() + 1);
          L.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + n.toISOString().slice(0, 10).replace(/-/g, ''));
        }else{
          L.push('DTSTART:' + icsUtc(s), 'DTEND:' + icsUtc(new Date(s.getTime() + 3 * 3600000)));
        }
        L.push('SUMMARY:' + icsEsc(e.title), 'DESCRIPTION:' + icsEsc((e.subtitle ? e.subtitle + '. ' : '') + 'From the Marqit schedule: playmarqit.com'), 'END:VEVENT');
      });
      L.push('END:VCALENDAR');
      download('marqit-schedule.ics', 'text/calendar;charset=utf-8', L.join('\r\n'));
      say(evs.length + ' events saved. Open the file to add them to your calendar.');
    }));
    return c;
  }

  // ---------- My Teams and topics ----------
  async function loadFollows(){
    if(!session){ follows = []; return; }
    var r = await sb.from('user_follows').select('kind, name').eq('user_id', session.user.id).order('created_at');
    follows = r.data || [];
  }
  function followsCard(){
    var c = section('My Teams and topics', 'Follow teams and topics. Questions and schedule items that mention them get a gold highlight. Highlighting only: no extra alerts.');
    var say = msg(c);
    var chips = h('div', 'plus-chips');
    function drawChips(){
      chips.textContent = '';
      if(!follows.length) chips.appendChild(h('p', 'plus-empty', 'Nothing followed yet. Try a team like \u201cLakers\u201d or a topic like \u201cTesla\u201d.'));
      follows.forEach(function(f){
        var ch = h('span', 'plus-fchip', f.name);
        var x = h('button', 'plus-fx', '\u00d7'); x.type = 'button'; x.setAttribute('aria-label', 'Stop following ' + f.name);
        x.addEventListener('click', async function(){
          await sb.from('user_follows').delete().eq('user_id', session.user.id).eq('kind', f.kind).ilike('name', f.name);
          await loadFollows(); drawChips(); highlight();
        });
        ch.appendChild(x); chips.appendChild(ch);
      });
    }
    var form = h('div', 'plus-form');
    var inp = h('input', 'plus-in'); inp.placeholder = 'Team or topic'; inp.maxLength = 40; inp.setAttribute('aria-label', 'Team or topic to follow');
    var kind = h('select', 'plus-in'); [['team', 'Team'], ['topic', 'Topic']].forEach(function(o){ var op = h('option', null, o[1]); op.value = o[0]; kind.appendChild(op); });
    async function add(){
      var name = inp.value.trim(); if(name.length < 2){ say('Type at least 2 letters.', true); return; }
      var r = await sb.from('user_follows').insert({ user_id: session.user.id, kind: kind.value, name: name });
      if(r.error){ say(/duplicate|unique/i.test(r.error.message) ? 'You already follow that.' : r.error.message, true); return; }
      inp.value = ''; say(''); await loadFollows(); drawChips(); highlight();
    }
    inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') add(); });
    form.appendChild(inp); form.appendChild(kind); form.appendChild(btn('Follow', add));
    c.appendChild(form); c.appendChild(chips);
    drawChips();
    return c;
  }
  // Gold highlight on play cards and schedule items that mention something the player follows.
  function highlight(){
    document.querySelectorAll('.mq-followed').forEach(function(el){ el.classList.remove('mq-followed'); });
    if(!follows.length) return;
    document.querySelectorAll('.predict-card, #sched-list [data-ev], #sched-today-cards [data-ev]').forEach(function(el){
      if(matchesFollow(el.textContent)) el.classList.add('mq-followed');
    });
  }
  var hlTimer = null;
  function watchHighlights(){
    var obs = new MutationObserver(function(){ clearTimeout(hlTimer); hlTimer = setTimeout(highlight, 250); });
    ['daily-questions-container', 'sched-list', 'sched-today-cards'].forEach(function(id){
      var el = document.getElementById(id); if(el) obs.observe(el, { childList: true, subtree: true });
    });
  }

  // ---------- Head-to-head with buddies ----------
  async function headCard(){
    var c = section('Head-to-head with buddies', 'Your record against a buddy on every question you both picked and that has settled. No prizes.');
    var r = await sb.from('buddies').select('buddy_id, profiles!buddies_buddy_id_fkey(username)').eq('user_id', session.user.id);
    var list = r.data || [];
    if(!list.length){ c.appendChild(h('p', 'plus-empty', 'Add a buddy from your profile and your record against them will show up here.')); return c; }
    var out = h('div', 'plus-h2h');
    list.forEach(function(b){
      var name = (b.profiles && b.profiles.username) || 'Buddy';
      var row = h('div', 'plus-h2h-row'); row.appendChild(h('b', null, name));
      var res = h('span', 'plus-h2h-res', 'Loading…'); row.appendChild(res); out.appendChild(row);
      (async function(){
        var sel = 'question_id, choice, daily_questions!inner(resolved, correct_answer, voided)';
        var a = await sb.from('predictions').select(sel).eq('user_id', session.user.id).limit(1000);
        var o = await sb.from('predictions').select(sel).eq('user_id', b.buddy_id).limit(1000);
        var theirs = {}; (o.data || []).forEach(function(p){ theirs[p.question_id] = p; });
        var me = 0, them = 0, tie = 0;
        (a.data || []).forEach(function(p){
          var q = p.daily_questions, t = theirs[p.question_id];
          if(!t || !q.resolved || q.voided || (q.correct_answer !== 'yes' && q.correct_answer !== 'no')) return;
          var mr = p.choice === q.correct_answer, tr = t.choice === q.correct_answer;
          if(mr && !tr) me++; else if(tr && !mr) them++; else tie++;
        });
        res.textContent = (me + them + tie) ? 'You ' + me + ' · ' + name + ' ' + them + ' · tied ' + tie : 'No shared settled questions yet';
      })();
    });
    c.appendChild(out);
    c.appendChild(h('p', 'plus-note', 'Tied means you both got it right or both got it wrong.'));
    return c;
  }

  // ---------- Request a full report ----------
  async function reportCard(){
    var c = section('Request a full game or event report', 'Pick any game or event, even one that is not a Marqit question, and we will write you a report of the historical data. Up to 2 per month, delivered within 48 hours. Historical data only: no betting lines or odds.');
    var say = msg(c);
    var form = h('div', 'plus-form col');
    var subj = h('input', 'plus-in'); subj.placeholder = 'Which game or event? (e.g. Florida State vs. Clemson, Saturday)'; subj.maxLength = 140; subj.setAttribute('aria-label', 'Game or event');
    var det = h('textarea', 'plus-in'); det.placeholder = 'Anything specific you want covered? (optional)'; det.maxLength = 500; det.rows = 2; det.setAttribute('aria-label', 'Details');
    form.appendChild(subj); form.appendChild(det);
    var mine = h('div', 'plus-reqs');
    async function drawMine(){
      mine.textContent = '';
      var r = await sb.from('report_requests').select('subject, status, report_body, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10);
      (r.data || []).forEach(function(x){
        var box = h('div', 'plus-req'); box.appendChild(h('b', null, x.subject));
        box.appendChild(h('em', 'plus-pill ' + (x.status === 'delivered' ? 'live' : 'soon'), x.status === 'delivered' ? 'Ready' : (x.status === 'declined' ? 'Could not do' : 'In progress')));
        if(x.report_body){ var pre = h('div', 'plus-report'); x.report_body.split(/\n{2,}/).forEach(function(par){ pre.appendChild(h('p', null, par)); }); box.appendChild(pre); }
        mine.appendChild(box);
      });
    }
    form.appendChild(btn('Send request', async function(){
      say('Sending…');
      var r = await sb.rpc('request_game_report', { p_subject: subj.value, p_details: det.value || null });
      if(r.error){ say(r.error.message.replace(/^.*?:\s*/, ''), true); return; }
      subj.value = ''; det.value = ''; say('Request sent. We will have it ready within 48 hours; it will show up right here.'); drawMine();
    }));
    c.appendChild(form); c.appendChild(mine); drawMine();
    c.appendChild(h('p', 'plus-note', 'Reports are for information only, not betting or financial advice.'));
    return c;
  }

  // ---------- Morning brief toggle ----------
  async function briefCard(){
    var c = section('Morning brief email', 'A short email each morning with the history behind that day\u2019s questions. Off until you turn it on. Your weekly recap email is separate and free for everyone.');
    var say = msg(c);
    var r = await sb.from('profiles').select('notify_morning_brief').eq('id', session.user.id).maybeSingle();
    var on = !!(r.data && r.data.notify_morning_brief);
    var label = h('label', 'plus-check'); var cb = h('input'); cb.type = 'checkbox'; cb.checked = on;
    label.appendChild(cb); label.appendChild(h('span', null, 'Email me the morning brief'));
    cb.addEventListener('change', async function(){
      var u = await sb.from('profiles').update({ notify_morning_brief: cb.checked }).eq('id', session.user.id);
      if(u.error){ cb.checked = !cb.checked; say('Could not save that. Try again.', true); return; }
      say(cb.checked ? 'On. It will arrive in the morning on days that have history ready.' : 'Off.');
    });
    c.appendChild(label);
    return c;
  }

  // ---------- "tell me when it becomes a paid plan" ----------
  async function waitlistRow(){
    if(!session) return null;
    var mine = await sb.from('marqit_plus_waitlist').select('user_id').eq('user_id', session.user.id).maybeSingle();
    var joined = !!(mine && mine.data);
    var row = h('div', 'plus-wait');
    var copy = h('div', 'plus-wait-copy');
    copy.appendChild(h('b', null, 'Marqit+ is free right now'));
    var line = h('span', null); copy.appendChild(line);
    var sw = h('button', 'plus-switch'); sw.type = 'button'; sw.setAttribute('role', 'switch');
    sw.appendChild(h('i'));
    function paint(){ sw.setAttribute('aria-checked', joined ? 'true' : 'false'); sw.setAttribute('aria-label', 'Notify me when Marqit+ paid plans launch'); line.textContent = joined ? 'You\u2019re on the list. We\u2019ll let you know when paid plans launch.' : 'Switch this on and we\u2019ll let you know when paid plans launch.'; }
    sw.addEventListener('click', async function(){
      sw.disabled = true;
      try{
        if(joined){ await sb.from('marqit_plus_waitlist').delete().eq('user_id', session.user.id); joined = false; }
        else { var ins = await sb.from('marqit_plus_waitlist').insert({ user_id: session.user.id }); if(!ins.error) joined = true; }
      }catch(e){}
      sw.disabled = false; paint();
    });
    paint(); row.appendChild(copy); row.appendChild(sw);
    return row;
  }

  // ---------- page ----------
  async function render(){
    root = document.getElementById('plus-root'); if(!root) return;
    var s = await sb.auth.getSession(); session = s.data.session;
    await loadFollows();
    root.textContent = '';
    var wl = await waitlistRow(); if(wl) root.appendChild(wl);
    root.appendChild(perksList());
    root.appendChild(h('p', 'plus-note', 'Marqit+ never changes entries, points, picks or prizes. The weekly prize drawing is separate: playing earns no entries, and everyone has the same chance. Information only, not betting or financial advice.'));
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('.pagenav-tab[data-page="plus"], [data-open-plus]');
    if(t){ if(t.hasAttribute('data-open-plus')){ var tab = document.querySelector('.pagenav-tab[data-page="plus"]'); if(tab) tab.click(); } render(); }
  });
  sb.auth.onAuthStateChange(function(ev, s2){
    session = s2 ? s2.session || s2 : null;
    loadFollows().then(function(){ highlight(); });
  });
  watchHighlights();
  sb.auth.getSession().then(function(r){ session = r.data.session; return loadFollows(); }).then(function(){ highlight(); });
})();
