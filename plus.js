/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
/* Marqit+ page: perks that run on the player's own data. Free for every signed-in player until PAID_LIVE is switched on.
   Nothing here touches entries, points, picks or prizes. */
(function(){
  var sb = window.mqSb;
  if(!sb) return;
  // LAUNCH SWITCH. false = the public page stays "free while we launch" with the waitlist (no checkout is shown).
  // true = the page shows the $9.99/month plan and a Subscribe button. Add ?plustest=1 to the address to preview the paid page any time.
  // Before flipping this to true: Stripe must be live, and is_marqit_plus() / morning-brief must be limited to paying members.
  var PAID_LIVE = false;
  function paidMode(){
    if(PAID_LIVE) return true;
    try{ return new URLSearchParams(location.search).get('plustest') === '1'; }catch(e){ return false; }
  }
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

  // ---------- perks: one tap-to-open row each. Body = [lead sentence, [bullet points], small note]; the 4th item opens a tool ----------
  var GROUPS = [
    ['Know more before you pick', [
      ['History & lean on daily questions', 'live', [
        'Every daily question has a Marqit+ panel right under it. Open it and you get:',
        ['Five short bullets of history: how the teams, people or companies involved have done in spots like this one.',
         'A lean shown as a percentage, with one plain line on what it is based on.',
         'The numbers behind each bullet, so you can judge them yourself.'],
        'It is built from past results, not betting lines or odds, and it is information, not advice. The call is still yours.']],
      ['History & lean on every game and event', 'live', [
        'The Schedule tab covers far more than the three daily questions. Tap any game, earnings report or event and the same history and lean sit inside it.',
        ['Look into the games you care about, not just the ones we pick for the day.',
         'Works across sports, earnings and the rest of the schedule.']], 'schedule'],
      ['Similar past questions', 'live', [
        'Under any daily question, Marqit+ lists the closest matches from our archive and how each one settled. We match on names, so a question about a team lines up with earlier questions about that same team.',
        ['Each match shows its date, the question and how it ended.',
         'A short tally of those matches sits at the bottom.']]],
      ['Results explained', 'live', [
        'Once a question settles, its Marqit+ panel adds a short note on why it went the way it did: what happened, and which fact decided it.',
        ['Handy for learning what to watch for the next time a similar call comes up.']]],
      ['Full game or event report', 'live', [
        'Want more than a few bullets? Ask for a full written report on any game or event, even one that is not a Marqit question. Try “Chiefs vs. Bills” or “Apple earnings.”',
        ['Up to 2 requests per week.',
         'Ready within 48 hours, and it shows up right here on this page.',
         'Historical data only: no betting lines or odds.']], 'report']
    ]],
    ['Your game', [
      ['My Stats Pro', 'live', [
        'Your accuracy across every settled question you have picked, broken down by category.',
        ['Overall percentage and record.',
         'Your best and toughest categories, once you have 3 or more settled picks in them.',
         'Your current and longest streaks.'],
        'Marqit also uses your best category to decide what leads on your Play tab.'], 'stats'],
      ['Head-to-head with buddies', 'live', [
        'Your record against each buddy, counting only questions you both picked that have settled.',
        ['A simple You vs. Buddy tally, with ties counted separately.',
         'No prizes involved. Just who has been calling it better.']], 'head'],
      ['My Teams and topics', 'live', [
        'Follow teams and topics, like the Lakers or Tesla. Any question or schedule item that mentions them gets a gold highlight.',
        ['Follow up to 30.',
         'Highlighting only. We do not send extra alerts for follows.']], 'follows'],
      ['Question archive', 'live', [
        'Search every question we have ever asked and see how each one settled.',
        ['Search by team, person or company, and filter by category.',
         'Players without Marqit+ see the last 7 days. Marqit+ sees all of it.']], 'archive']
    ]],
    ['Take it with you', [
      ['Morning brief email', 'live', [
        'A short email each morning with the history behind that day’s questions, so you can read it before you pick.',
        ['Off until you turn it on, and one switch turns it off again.',
         'Only sent on days that have history ready.']], 'brief'],
      ['Weekly recap email', 'live', [
        'Every Monday, an email with your week: picks, accuracy and streak.',
        ['Free for everyone, Marqit+ or not.',
         'Turn it off any time.']]],
      ['Calendar sync', 'live', [
        'Download the next 30 days of the Marqit schedule as a calendar file (.ics) that opens in Apple Calendar, Google Calendar or Outlook.',
        ['Option to include only your followed teams and topics.']], 'calendar'],
      ['Pick history export', 'live', [
        'Download every pick you have made as a spreadsheet (CSV): date, category, question, your pick, the answer and whether you got it right.',
        ['Yours to keep, sort or chart however you like.']], 'export']
    ]],
    ['Always', [
      ['Always ad-free', 'live', [
        'Marqit+ members never have to sit through ads.',
        ['If display or video ads come to Marqit, members skip all of them.',
         'No ad ever stands between you and your calls.']]]
    ]]
  ];
  var TOOLS = { stats: statsCard, head: headCard, follows: followsCard, archive: archiveCard, brief: briefCard, calendar: calendarCard, export: exportCard, report: reportCard };
  var NEEDS_SIGN_IN = { stats: 1, head: 1, follows: 1, brief: 1, calendar: 1, export: 1, report: 1 };
  function perkBody(body){
    if(typeof body === 'string'){ body = [body]; }
    var wrap = h('div', 'plus-perk-copy');
    if(body[0]) wrap.appendChild(h('p', 'plus-sub', body[0]));
    if(body[1] && body[1].length){ var ul = h('ul', 'plus-points'); body[1].forEach(function(t){ ul.appendChild(h('li', null, t)); }); wrap.appendChild(ul); }
    if(body[2]) wrap.appendChild(h('p', 'plus-fine', body[2]));
    return wrap;
  }
  function perkRow(p){
    var d = h('details', 'plus-perk');
    var sm = h('summary'); sm.appendChild(h('span', 'plus-perk-t', p[0]));
    d.appendChild(sm);
    var body = h('div', 'plus-perk-body'); body.appendChild(perkBody(p[2])); d.appendChild(body);
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
    var c = section('Request a full game or event report', 'Pick any game or event, even one that is not a Marqit question, and we will write you a report of the historical data. Up to 2 per week, delivered within 48 hours. Historical data only: no betting lines or odds.');
    var say = msg(c);
    var form = h('div', 'plus-form col');
    var subj = h('input', 'plus-in'); subj.placeholder = 'Which game or event? (e.g. Chiefs vs. Bills, Sunday)'; subj.maxLength = 140; subj.setAttribute('aria-label', 'Game or event');
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

  // ---------- "tell me when paid plans open": one clear button, plus a count of players who are waiting ----------
  async function waitlistRow(){
    var count = 0;
    try{ var c = await sb.rpc('marqit_plus_waitlist_public_count'); if(c && typeof c.data === 'number') count = c.data; }catch(e){}
    var joined = false;
    if(session){
      var mine = await sb.from('marqit_plus_waitlist').select('user_id').eq('user_id', session.user.id).maybeSingle();
      joined = !!(mine && mine.data);
    }
    var row = h('div', 'plus-wait');
    var copy = h('div', 'plus-wait-copy');
    var title = h('b', null, 'Marqit+ is free for every player right now');
    var line = h('span', 'plus-wait-line');
    var tally = h('span', 'plus-wait-count');
    copy.appendChild(title); copy.appendChild(line); copy.appendChild(tally);
    var action = h('div', 'plus-wait-action');
    var main = h('button', 'plus-wait-btn'); main.type = 'button';
    var undo = h('button', 'plus-wait-undo', 'Remove me'); undo.type = 'button';
    action.appendChild(main); action.appendChild(undo);
    function paint(){
      row.classList.toggle('joined', joined);
      if(!session){ line.textContent = 'When paid plans open, we will tell you first. Create a free account to get on the list.'; main.textContent = 'Sign up free'; undo.hidden = true; }
      else if(joined){ line.textContent = 'You are on the list. We will email you before paid plans open, and you will have time to decide.'; main.textContent = 'You’re on the list'; main.disabled = true; undo.hidden = false; }
      else { line.textContent = 'Paid plans are coming later. Get on the list and we will email you before they open.'; main.textContent = 'Keep me posted'; main.disabled = false; undo.hidden = true; }
      main.setAttribute('aria-pressed', joined ? 'true' : 'false');
      tally.textContent = count >= 25 ? count.toLocaleString() + ' players are on the list' : '';
      tally.hidden = !tally.textContent;
    }
    main.addEventListener('click', async function(){
      if(!session){ var s = document.getElementById('cta-open-signup'); if(s) s.click(); return; }
      if(joined) return;
      main.disabled = true;
      try{ var ins = await sb.from('marqit_plus_waitlist').insert({ user_id: session.user.id }); if(!ins.error){ joined = true; count++; } }catch(e){}
      paint();
    });
    undo.addEventListener('click', async function(){
      undo.disabled = true;
      try{ var del = await sb.from('marqit_plus_waitlist').delete().eq('user_id', session.user.id); if(!del.error){ joined = false; count = Math.max(0, count - 1); } }catch(e){}
      undo.disabled = false; paint();
    });
    paint(); row.appendChild(copy); row.appendChild(action);
    return row;
  }


  // ---------- starting a Stripe Checkout (the price is fixed on the server, never taken from the browser) ----------
  async function startCheckout(say, button){
    button.disabled = true; say('Opening checkout…');
    try{
      var r = await sb.functions.invoke('create-checkout-session', { body: {} });
      var url = r.data && r.data.url;
      if(url){ location.href = url; return; }
      var m = 'Could not start checkout. Please try again.';
      try{ if(r.error && r.error.context){ var j = await r.error.context.json(); if(j && j.error) m = j.error; } }catch(e){}
      say(m, true);
    }catch(e){ say('Could not start checkout. Please try again.', true); }
    button.disabled = false;
  }

  // ---------- opening Stripe's Customer Portal, where a member updates their card or cancels ----------
  async function openPortal(say, button){
    button.disabled = true; say('Opening your subscription settings\u2026');
    try{
      var r = await sb.functions.invoke('create-portal-session', { body: {} });
      var url = r.data && r.data.url;
      if(url){ location.href = url; return; }
      var m = 'Could not open subscription settings. Please try again, or email help@playmarqit.com.';
      try{ if(r.error && r.error.context){ var j = await r.error.context.json(); if(j && j.error) m = j.error; } }catch(e){}
      say(m, true);
    }catch(e){ say('Could not open subscription settings. Please try again, or email help@playmarqit.com.', true); }
    button.disabled = false;
  }

  // ---------- the paid plan card: price, what it is, one Subscribe button ----------
  async function pricingCard(){
    var member = null;
    if(session){
      try{
        var r = await sb.from('marqit_plus_subscriptions').select('status,current_period_end,cancel_at_period_end').eq('user_id', session.user.id).maybeSingle();
        if(r && r.error) r = await sb.from('marqit_plus_subscriptions').select('status,current_period_end').eq('user_id', session.user.id).maybeSingle(); // column not added yet
        if(r && r.data && ['active', 'trialing', 'past_due'].indexOf(r.data.status) >= 0) member = r.data;
      }catch(e){}
    }
    var box = h('div', 'plus-tool plus-price');
    box.appendChild(h('b', null, 'Marqit+ · $9.99 per month'));
    box.appendChild(h('p', 'plus-sub', 'A digital software subscription with extra tools for your own picks: history and lean on every game, My Stats Pro, calendar sync, pick history export, the full question archive, the morning brief and an ad-free experience.'));
    var say = msg(box);
    if(member){
      var endDate = member.current_period_end ? new Date(member.current_period_end).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      box.appendChild(h('p', 'plus-sub',
        member.status === 'past_due'
          ? 'You have Marqit+, but your last payment did not go through. Update your card or email help@playmarqit.com and we will help.'
        : member.cancel_at_period_end
          ? 'Your Marqit+ is cancelled and ends' + (endDate ? ' on ' + endDate : ' at the end of this billing period') + '. You keep everything until then, and you will not be charged again.'
          : 'You have Marqit+. Thank you!' + (endDate ? ' It renews on ' + endDate + '.' : '')));
      var manage = btn(member.cancel_at_period_end ? 'Manage subscription' : 'Manage or cancel subscription', function(){ openPortal(say, manage); });
      box.appendChild(manage);
    } else if(!session){
      var up = btn('Sign up free to subscribe', function(){ var s2 = document.getElementById('cta-open-signup'); if(s2) s2.click(); });
      box.appendChild(up);
    } else {
      var go = btn('Subscribe for $9.99/month', function(){ startCheckout(say, go); });
      box.appendChild(go);
    }
    box.appendChild(h('p', 'plus-fine', 'Billed monthly through Stripe and renews until you cancel. You can cancel any time from this page once you subscribe. Marqit itself is free to play and players never wager money. Marqit+ does not change entries, points, picks or prizes.'));
    return box;
  }


  // ---------- paid-plan TEST panel: only shows with ?plustest=1 in the address, and only while Stripe is in test mode ----------
  async function testPanel(){
    var wantsTest = false;
    try{ wantsTest = new URLSearchParams(location.search).get('plustest') === '1'; }catch(e){}
    if(!wantsTest || !session) return null;
    var box = h('div', 'plus-tool');
    box.appendChild(h('b', null, 'Paid plan test (Stripe test mode)'));
    var status = h('p', 'plus-msg', 'Checking your subscription…');
    var say = msg(box);
    box.appendChild(status);
    async function paint(){
      try{
        var r = await sb.from('marqit_plus_subscriptions').select('status,current_period_end').eq('user_id', session.user.id).maybeSingle();
        status.textContent = r.data ? 'Subscription status: ' + r.data.status : 'No subscription on this account yet.';
      }catch(e){ status.textContent = 'Could not read your subscription.'; }
    }
    var go = btn('Test subscribe $9.99/month', function(){ startCheckout(say, go); });
    box.appendChild(go);
    box.appendChild(btn('Refresh status', paint, 'plus-wait-undo'));
    paint();
    return box;
  }


  // ---------- coming back from Stripe: ?plus=success, ?plus=cancelled (Checkout) or ?plus=managed (subscription settings) ----------
  var returned = null, POLL_MS = 2000;
  try{
    var rp = new URLSearchParams(location.search).get('plus');
    if(rp === 'success' || rp === 'cancelled' || rp === 'managed') returned = rp;
  }catch(e){}
  function returnBanner(){
    if(!returned) return null;
    var state = returned; returned = null; // show once
    try{ var u = new URL(location.href); u.searchParams.delete('plus'); history.replaceState(null, '', u.pathname + u.search + u.hash); }catch(e){}
    var box = h('div', 'plus-tool plus-return');
    box.setAttribute('role', 'status');
    var title = h('b', null);
    var line = h('p', 'plus-msg');
    box.appendChild(title); box.appendChild(line);
    if(state === 'managed'){
      title.textContent = 'Welcome back';
      line.textContent = 'Any changes you made to your subscription are saved. If you cancelled, you keep Marqit+ until the end of the period you already paid for.';
      return box;
    }
    if(state === 'cancelled'){
      title.textContent = 'No charge was made';
      line.textContent = 'You left checkout before paying, so nothing was charged. You can try again any time.';
      return box;
    }
    title.textContent = 'Thanks! Finishing your Marqit+ setup…';
    line.textContent = 'Your payment went through. This usually takes a few seconds.';
    var tries = 0;
    (function tick(){
      var done = Promise.resolve(null);
      if(session){
        done = Promise.resolve(sb.from('marqit_plus_subscriptions').select('status').eq('user_id', session.user.id).maybeSingle())
          .then(function(r){ return r && r.data ? r.data.status : null; }, function(){ return null; });
      }
      done.then(function(st){
        if(st === 'active' || st === 'trialing'){
          title.textContent = 'Marqit+ is active';
          line.textContent = 'Thanks for subscribing. Everything on this page is yours to use.';
        } else if(++tries < 15){
          setTimeout(tick, POLL_MS);
        } else {
          title.textContent = 'Your payment went through';
          line.textContent = 'It is taking a little longer than usual to show up here. Refresh this page in a minute, or email help@playmarqit.com and we will sort it out.';
        }
      });
    })();
    return box;
  }
  if(returned){
    setTimeout(function(){ var tab = document.querySelector('.pagenav-tab[data-page="plus"]'); if(tab) tab.click(); }, 400);
  }

  // ---------- page ----------
  async function render(){
    root = document.getElementById('plus-root'); if(!root) return;
    var s = await sb.auth.getSession(); session = s.data.session;
    await loadFollows();
    root.textContent = '';
    var rb = returnBanner(); if(rb) root.appendChild(rb);
    var tp = await testPanel(); if(tp) root.appendChild(tp);
    var paid = paidMode();
    var lede = document.querySelector('#page-plus .plus-lede');
    if(lede) lede.textContent = paid ? 'History and tools to go with your picks. $9.99 per month.' : 'History and tools to go with your picks. Free for every signed-in player while we launch.';
    var wl = paid ? await pricingCard() : await waitlistRow(); if(wl) root.appendChild(wl);
    root.appendChild(perksList());
    root.appendChild(h('p', 'plus-note', 'Marqit+ never changes entries, points, picks or prizes. The weekly prize drawing is separate: playing earns no entries, and everyone has the same chance. Information only, not betting or financial advice.'));
    var help = h('p', 'plus-note', 'Questions? Email '); var a = h('a', null, 'help@playmarqit.com'); a.href = 'mailto:help@playmarqit.com'; help.appendChild(a); root.appendChild(help);
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
