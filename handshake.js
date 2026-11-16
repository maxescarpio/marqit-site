/* Handshake bets: a private reminder between two players, with a countdown to the day it settles.
   Marqit never holds money, sets odds, checks results or settles anything. Stakes are plain text the two people write themselves.
   Lives in the Menu. Data goes through the hs_* functions (see supabase/migrations/20261116_handshake_bets.sql). */
(function(){
  var sb = window.mqSb;
  if(!sb) return;
  var about = document.getElementById('hamburger-about-btn');
  var menu = document.getElementById('hamburger-menu');
  if(!about || !menu) return;

  var back = null, panel = null, ticker = null, lastFocus = null, items = [];

  function h(tag, cls, text){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    if(text != null) el.textContent = text;
    return el;
  }
  function etToday(){ return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
  // The countdown runs to the last second of the settle day, New York time (daylight saving included).
  function etEnd(dateStr){
    var p = String(dateStr).split('-').map(Number);
    var want = Date.UTC(p[0], p[1] - 1, p[2], 23, 59, 59);
    var f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    function wall(ms){ var o = {}; f.formatToParts(new Date(ms)).forEach(function(x){ o[x.type] = +x.value; }); return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second); }
    var ms = want - (wall(want) - want);
    return ms - (wall(ms) - want);
  }
  function niceDate(dateStr){
    var p = String(dateStr).split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function pad(n){ return n < 10 ? '0' + n : String(n); }

  // ---------- menu entry ----------
  var entry = h('button', about.className, 'Handshake bets');
  entry.type = 'button'; entry.id = 'hamburger-handshake-btn';
  entry.style.cssText = about.style.cssText;
  menu.insertBefore(entry, about);
  entry.addEventListener('click', function(){ menu.style.display = 'none'; open(); });

  // ---------- dialog ----------
  function build(){
    back = h('div', 'hs-back');
    panel = h('div', 'hs-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'hs-title');
    back.appendChild(panel);
    back.addEventListener('mousedown', function(e){ if(e.target === back) close(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && back.parentNode) close(); });
    document.body.appendChild(back);
  }
  function open(){
    if(!back) build();
    lastFocus = document.activeElement;
    back.classList.add('on');
    document.documentElement.classList.add('hs-lock');
    render();
  }
  function close(){
    if(!back) return;
    back.classList.remove('on');
    document.documentElement.classList.remove('hs-lock');
    if(ticker){ clearInterval(ticker); ticker = null; }
    if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
  }
  function shell(){
    panel.innerHTML = '';
    var head = h('div', 'hs-head');
    var t = h('h3', null, 'Handshake bets'); t.id = 'hs-title';
    var x = h('button', 'hs-x', 'Close'); x.type = 'button'; x.addEventListener('click', close);
    head.appendChild(t); head.appendChild(x);
    panel.appendChild(head);
    panel.appendChild(h('p', 'hs-note', 'A reminder between you and one other player. Marqit never holds money, sets odds or settles bets. You two sort it out.'));
    x.focus();
    return panel;
  }

  function render(){
    shell();
    var body = h('div', 'hs-body', 'Loading…'); panel.appendChild(body);
    sb.auth.getSession().then(function(r){
      var s = r && r.data && r.data.session;
      if(!s){ body.textContent = 'Sign in to log a handshake bet.'; return; }
      return sb.rpc('hs_list').then(function(res){
        if(res.error){ body.textContent = 'Could not load your bets. Try again in a minute.'; return; }
        items = res.data || [];
        body.innerHTML = '';
        body.appendChild(formBlock());
        body.appendChild(listBlock());
        startTicker();
      });
    }).catch(function(){ body.textContent = 'Could not load your bets. Try again in a minute.'; });
  }

  // ---------- new bet form ----------
  function field(label, el, hint){
    var w = h('label', 'hs-f'); w.appendChild(h('span', null, label)); w.appendChild(el);
    if(hint) w.appendChild(h('small', null, hint));
    return w;
  }
  function formBlock(){
    var d = h('details', 'hs-new');
    d.appendChild(h('summary', null, 'Log a new bet'));
    var terms = h('textarea'); terms.rows = 2; terms.maxLength = 280; terms.placeholder = 'Miami wins the national championship';
    var stakes = h('input'); stakes.type = 'text'; stakes.maxLength = 120; stakes.placeholder = 'Loser buys dinner';
    var who = h('input'); who.type = 'text'; who.maxLength = 40; who.placeholder = 'their username'; who.autocapitalize = 'none'; who.autocomplete = 'off'; who.spellcheck = false;
    var day = h('input'); day.type = 'date'; day.min = etToday();
    var form = h('form', 'hs-form');
    form.appendChild(field('What is the bet?', terms));
    form.appendChild(field('What is on the line?', stakes, 'Plain words, like “loser buys dinner”.'));
    form.appendChild(field('Who is it with?', who, 'They need a Marqit account. They will see it and can accept or decline.'));
    form.appendChild(field('Settles on', day, 'The countdown runs to the end of this day, New York time.'));
    var err = h('p', 'hs-err'); err.setAttribute('role', 'alert');
    var go = h('button', 'hs-btn', 'Send handshake'); go.type = 'submit';
    form.appendChild(err); form.appendChild(go);
    form.addEventListener('submit', function(e){
      e.preventDefault(); err.textContent = '';
      go.disabled = true; go.textContent = 'Sending…';
      sb.rpc('hs_create', { p_opponent: who.value, p_terms: terms.value, p_stakes: stakes.value, p_settles_on: day.value || null }).then(function(res){
        if(res.error){ err.textContent = res.error.message || 'Could not send that. Check the fields and try again.'; go.disabled = false; go.textContent = 'Send handshake'; return; }
        render();
      }, function(){ err.textContent = 'Could not send that. Try again.'; go.disabled = false; go.textContent = 'Send handshake'; });
    });
    d.appendChild(form);
    return d;
  }

  // ---------- list ----------
  function act(label, cls, rpc, args, errEl){
    var b = h('button', cls, label); b.type = 'button';
    b.addEventListener('click', function(){
      b.disabled = true;
      sb.rpc(rpc, args).then(function(res){
        if(res.error){ errEl.textContent = res.error.message || 'That did not work. Try again.'; b.disabled = false; return; }
        render();
      }, function(){ errEl.textContent = 'That did not work. Try again.'; b.disabled = false; });
    });
    return b;
  }
  function card(it){
    var c = h('article', 'hs-card ' + it.status);
    c.appendChild(h('h4', null, it.terms));
    c.appendChild(h('p', 'hs-stakes', it.stakes));
    var who = h('p', 'hs-with');
    who.appendChild(document.createTextNode((it.other_avatar_emoji ? it.other_avatar_emoji + ' ' : '') + (it.i_created ? 'With ' : 'From ')));
    who.appendChild(h('b', null, '@' + it.other_username));
    c.appendChild(who);
    var err = h('p', 'hs-err'); err.setAttribute('role', 'alert');
    var row = h('div', 'hs-actions');
    if(it.status === 'active'){
      var cd = h('div', 'hs-cd'); cd.setAttribute('data-end', String(etEnd(it.settles_on))); cd.setAttribute('role', 'timer');
      c.appendChild(cd);
      c.appendChild(h('p', 'hs-when', 'Settles ' + niceDate(it.settles_on)));
      row.appendChild(act('Mark settled', 'hs-btn ghost', 'hs_settle', { p_id: it.id }, err));
    } else if(it.status === 'pending'){
      c.appendChild(h('p', 'hs-when', 'Settles ' + niceDate(it.settles_on)));
      if(it.i_created){
        c.appendChild(h('p', 'hs-state', 'Waiting for @' + it.other_username + ' to answer'));
        row.appendChild(act('Withdraw', 'hs-btn ghost', 'hs_cancel', { p_id: it.id }, err));
      } else {
        row.appendChild(act('Accept', 'hs-btn', 'hs_respond', { p_id: it.id, p_accept: true }, err));
        row.appendChild(act('Decline', 'hs-btn ghost', 'hs_respond', { p_id: it.id, p_accept: false }, err));
      }
    } else if(it.status === 'declined'){
      c.appendChild(h('p', 'hs-state', it.i_created ? '@' + it.other_username + ' declined' : 'You declined'));
    } else if(it.status === 'settled'){
      c.appendChild(h('p', 'hs-state', 'Settled · was due ' + niceDate(it.settles_on)));
    }
    if(row.childNodes.length) c.appendChild(row);
    c.appendChild(err);
    return c;
  }
  function group(title, list, startOpen){
    if(!list.length) return null;
    var g = h('section', 'hs-grp');
    g.appendChild(h('h4', 'hs-gh', title));
    list.forEach(function(it){ g.appendChild(card(it)); });
    return g;
  }
  function listBlock(){
    var wrap = h('div', 'hs-list');
    function by(fn){ return items.filter(fn); }
    var incoming = by(function(i){ return i.status === 'pending' && !i.i_created; });
    var active = by(function(i){ return i.status === 'active'; });
    var sent = by(function(i){ return i.status === 'pending' && i.i_created; });
    var done = by(function(i){ return i.status === 'settled' || i.status === 'declined'; });
    var any = false;
    [['Waiting on you', incoming], ['Active', active], ['Sent, waiting for an answer', sent], ['Settled and declined', done]].forEach(function(g){
      var el = group(g[0], g[1]); if(el){ wrap.appendChild(el); any = true; }
    });
    if(!any) wrap.appendChild(h('p', 'hs-empty', 'No handshake bets yet. Log one above and send it to a friend.'));
    return wrap;
  }

  // ---------- countdown ----------
  function tick(){
    var now = Date.now();
    var nodes = panel ? panel.querySelectorAll('.hs-cd') : [];
    for(var i = 0; i < nodes.length; i++){
      var left = Number(nodes[i].getAttribute('data-end')) - now;
      if(left <= 0){ nodes[i].className = 'hs-cd up'; nodes[i].textContent = 'Time is up. Settle it between you two.'; continue; }
      var s = Math.floor(left / 1000), d = Math.floor(s / 86400), hr = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      nodes[i].innerHTML = '';
      [[d, d === 1 ? 'day' : 'days'], [pad(hr), 'hr'], [pad(m), 'min'], [pad(sec), 'sec']].forEach(function(p){
        var u = h('span', 'hs-u'); u.appendChild(h('b', null, String(p[0]))); u.appendChild(h('em', null, p[1])); nodes[i].appendChild(u);
      });
    }
  }
  function startTicker(){ if(ticker) clearInterval(ticker); tick(); ticker = setInterval(tick, 1000); }
})();
