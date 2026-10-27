/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
(function(){
  function isValidEmail(v){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function isValidUsername(v){
    return /^[a-zA-Z0-9_]{3,24}$/.test(v);
  }

  // Simple clean-language check. Not perfect (no filter is), but stops the obvious.
  // Stems that are safe to catch anywhere inside a username or comment word (checked inside each word, not across spaces):
  var MQ_BAD_STEMS = ['fuck','shit','bitch','nigg','fagg','whore','slut','asshole','pussy','bastard','motherf'];
  // Short words that must match as a whole word only (so "class" or "Dickson" are fine):
  var MQ_BAD_WORDS = ['cunt','cunts','ass','arse','dick','cock','piss','twat','tits','retard','retarded','fag','coon','spic','kike','chink','tranny','rape','rapist'];
  function mqHasProfanity(text){
    var t = String(text || '').toLowerCase();
    var map = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i'};
    t = t.replace(/[0134577@$!]/g, function(c){ return map[c] || c; });
    var words = t.split(/[^a-z]+/).filter(Boolean);
    var i;
    for(i = 0; i < words.length; i++){ for(var j = 0; j < MQ_BAD_STEMS.length; j++){ if(words[i].indexOf(MQ_BAD_STEMS[j]) !== -1) return true; } }
    for(i = 0; i < words.length; i++){ if(MQ_BAD_WORDS.indexOf(words[i]) !== -1) return true; }
    return false;
  }

  var SUPABASE_URL = 'https://ivapcztkasjfetntkzxy.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_S1DZQXDDpffETdJh2xJONQ_QSNjnunn';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---- Avatars: drawn glyphs, not emoji ----------------------------------
  // profiles.avatar_emoji is a free-text column. New picks store a short glyph
  // key ("target"); older rows still hold an emoji, which we map to the nearest
  // glyph. Anything unknown falls back to the person's initial.
  var MQ_AVATAR_GLYPHS = {
    target:  '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    flame:   '<path d="M12 3c.8 3.2 5 4.8 5 9.6A5 5 0 0 1 7 12.6c0-1.9.9-3.1 2-3.9.2 1.3.8 2 1.7 2.2C10.4 8.4 10.7 5.6 12 3z"/>',
    bolt:    '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z"/>',
    dice:    '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    brain:   '<path d="M9.5 5A3 3 0 0 0 6.6 8 3 3 0 0 0 5.5 13.4 3 3 0 0 0 8.5 18a3 3 0 0 0 3.5 1V6a2.4 2.4 0 0 0-2.5-1z"/><path d="M14.5 5a3 3 0 0 1 2.9 3 3 3 0 0 1 1.1 5.4 3 3 0 0 1-3 4.6 3 3 0 0 1-3.5 1"/>',
    film:    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4"/>',
    trophy:  '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5.2c0 2.6 1 3.9 3 4.3M16 6h2.8c0 2.6-1 3.9-3 4.3"/><path d="M12 13.5V17M10 17h4v3h-4zM8.5 20h7"/>',
    star:    '<path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17.4l-5.4 2.8 1.1-6.1L3.2 9.9l6.1-.8z"/>',
    rocket:  '<path d="M12 3c3 2 4.5 5 4.5 8.5L12 17l-4.5-5.5C7.5 8 9 5 12 3z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M8 15l-3 1 1.5-3M16 15l3 1-1.5-3M10.5 19l1.5 2 1.5-2"/>',
    phones:  '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    chart:   '<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>',
    pad:     '<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4"/><circle cx="15.5" cy="12" r=".9" fill="currentColor"/><circle cx="17.5" cy="14" r=".9" fill="currentColor"/>',
    owl:     '<path d="M6 8c0-2 1.5-4 3-4 1 0 2 .6 3 .6s2-.6 3-.6c1.5 0 3 2 3 4v6a6 6 0 0 1-12 0z"/><circle cx="9.5" cy="10" r="1.8"/><circle cx="14.5" cy="10" r="1.8"/><path d="M12 12.6l-.8 1.4h1.6z"/>',
    wolf:    '<path d="M4 4l4 3h8l4-3v8a8 8 0 0 1-16 0z"/><path d="M9 12h.01M15 12h.01M10 16l2 1.5 2-1.5"/>',
    wing:    '<path d="M19.5 4.5c-8 .3-13 4.7-13 11.5v3.5H10c6.8 0 9.200-5 9.500-15z"/><path d="M4 20.500l9-9"/>',
    turtle:  '<path d="M5 16a7 6 0 0 1 14 0z"/><path d="M9.500 16l1-5.500h3l1 5.500M12 10.500V16"/><path d="M19 13.500c1.500-.5 2.800 0 3 1.200-.2 1-1.600 1.300-3 .8M7 16v2.500M16 16v2.500"/>',
    clover:  '<circle cx="9" cy="9" r="3.2"/><circle cx="15" cy="9" r="3.2"/><circle cx="9" cy="15" r="3.2"/><circle cx="15" cy="15" r="3.2"/><path d="M12 12l5 8"/>',
    coffee:  '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 4v2M12 4v2"/>',
    moon:    '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    wave:    '<path d="M3 11c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2"/>'
  };
  var MQ_AVATAR_KEYS = Object.keys(MQ_AVATAR_GLYPHS);
  function mqAchIcon(name){
    var d = (typeof MQ_ICON_PATHS !== 'undefined' && MQ_ICON_PATHS[name]) || MQ_AVATAR_GLYPHS[name] || '';
    return '<svg class="mq-ach-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var MQ_AVATAR_LEGACY = {'🎯':'target','🔥':'flame','⚡':'bolt','🎲':'dice','🧠':'brain','🎬':'film','🏆':'trophy','⭐':'star','🚀':'rocket','🎧':'phones','📈':'chart','🎮':'pad','🦉':'owl','🐺':'wolf','🦅':'wing','🐢':'turtle','🍀':'clover','☕':'coffee','🌙':'moon','🌊':'wave'};
  function mqAvatarKey(raw){
    var v = String(raw == null ? '' : raw).replace(/️/g, '').trim();
    if(MQ_AVATAR_GLYPHS[v]) return v;
    return MQ_AVATAR_LEGACY[v] || null;
  }
  // Accent colour for each icon: used for the colourful tiles in the picker.
  var MQ_AVATAR_ACCENT = {
    target:'#FF5A5F', flame:'#FF8A1F', bolt:'#FFD21F', dice:'#B07CFF', brain:'#FF7EB6', film:'#FFA94D', trophy:'#F5C336',
    star:'#FFD84D', rocket:'#5AA0FF', phones:'#2EC4B6', chart:'#33D18B', pad:'#7C8CFF', owl:'#C99A6B', wolf:'#9AA7BD',
    wing:'#4CC9F0', turtle:'#5BD17F', clover:'#3DDC84', coffee:'#D9A066', moon:'#9FA8FF', wave:'#38BDF8'
  };
  // Photo avatars are stored in the same free-text column as "photo:<public url>".
  // Only images from this project's own storage are ever rendered.
  function mqAvatarPhoto(raw){
    var v = String(raw == null ? '' : raw);
    if(v.indexOf('photo:') !== 0) return null;
    var u = v.slice(6);
    if(u.indexOf(SUPABASE_URL + '/storage/v1/object/public/avatars/') !== 0) return null;
    return u;
  }
  function mqAvatarSvg(key){
    return '<svg class="av-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (MQ_AVATAR_GLYPHS[key] || '') + '</svg>';
  }
  // Inner HTML for any avatar circle: the glyph if there is one, else the initial.
  function mqAvatarInner(raw, username){
    var photo = mqAvatarPhoto(raw);
    if(photo) return '<img class="av-photo" src="' + escapeHtml(photo) + '" alt="" loading="lazy" decoding="async">';
    // Old icon avatars now show the initial too.
    var ch = String(username || '?').trim().charAt(0).toUpperCase() || '?';
    return '<span class="av-initial">' + escapeHtml(ch) + '</span>';
  }

  // Real Web Push (arrives even with the tab/browser closed). Public key is
  // safe to ship client-side -- that's the point of VAPID's public/private
  // split. If this key is ever rotated, every existing subscription breaks
  // and everyone has to re-enable push.
  var VAPID_PUBLIC_KEY = 'BO3kAAuk_eWzTv7g92RFPHHWjwHQAWe1vU1KtvCHJz53RQG6spHB7-6WxRctKr2cXEfDwIlt49Nv4cf3qjvXMyc';
  function urlBase64ToUint8Array(base64String){
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for(var i = 0; i < rawData.length; ++i){ outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  }
  // Pull down to refresh. The iPhone home-screen app has no browser chrome, so there is no built-in way to reload.
  (function(){
    if(window.navigator.standalone !== true) return; // Safari tabs and Android already have their own
    var bar = document.createElement('div');
    bar.className = 'mq-ptr';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var startY = 0, startX = 0, pull = 0, tracking = false, busy = false;
    var TRIGGER = 80;
    function blocked(el){
      // Never start a pull inside a sheet, popup or full-screen view, or inside something that is itself scrolled.
      if(el.closest('.thread-view,.welcome-sheet,.mq-sheet-bg,.mq-ss,.mq-crop,.mq-legal-overlay,.milestone-overlay,input,textarea,select')) return true;
      for(var n = el; n && n !== document.body; n = n.parentElement){
        var oy = getComputedStyle(n).overflowY;
        if((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return true;
      }
      return false;
    }
    function reset(){
      pull = 0; tracking = false;
      bar.classList.remove('ready', 'busy');
      bar.style.transform = ''; bar.style.opacity = '';
    }
    document.addEventListener('touchstart', function(e){
      if(busy || e.touches.length !== 1 || (window.scrollY || document.documentElement.scrollTop) > 0 || blocked(e.target)){ tracking = false; return; }
      startY = e.touches[0].clientY; startX = e.touches[0].clientX; pull = 0; tracking = true;
    }, { passive: true });
    document.addEventListener('touchmove', function(e){
      if(!tracking || busy) return;
      var dy = e.touches[0].clientY - startY, dx = e.touches[0].clientX - startX;
      if(dy <= 0 || Math.abs(dx) > dy){ reset(); return; }
      if((window.scrollY || document.documentElement.scrollTop) > 0){ reset(); return; }
      pull = Math.min(dy, 140);
      var shown = Math.min(pull / TRIGGER, 1);
      bar.textContent = pull >= TRIGGER ? 'Release to refresh' : 'Pull to refresh';
      bar.classList.toggle('ready', pull >= TRIGGER);
      bar.style.transform = 'translate(-50%,' + (-70 + 70 * shown) + 'px)';
      bar.style.opacity = String(shown);
    }, { passive: true });
    function end(){
      if(!tracking) return;
      if(pull >= TRIGGER){
        busy = true;
        bar.style.transform = ''; bar.style.opacity = '';
        bar.textContent = 'Refreshing…';
        bar.classList.add('busy');
        setTimeout(function(){ window.location.reload(); }, 150);
      } else reset();
      tracking = false;
    }
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', reset, { passive: true });
  })();

  var swRegistrationPromise = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.register('/sw.js').catch(function(){ return null; })
    : Promise.resolve(null);

  // Plain-language reason push can't be turned on here, so people on iPhones
  // (where web push only works from the Home Screen) know what to do.
  function mqPushUnsupportedMsg(){
    var ua = navigator.userAgent || '';
    var inApp = /FBAN|FBAV|Instagram|Snapchat|TikTok|musical_ly|Line\/|Twitter/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = (window.navigator.standalone === true) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if(inApp) return 'Open playmarqit.com in Safari or Chrome first, then try again.';
    if(isIOS && !standalone) return 'On iPhone, notifications need Marqit on your Home Screen. Tap Share, then Add to Home Screen, then open Marqit from there.';
    return 'Your browser doesn\u2019t support push notifications.';
  }

  function logClientError(payload){
    try {
      sb.from('client_errors').insert(payload).then(function(){}, function(){});
    } catch(_){}
  }
  window.addEventListener('error', function(e){
    logClientError({
      message: String(e.message || '').slice(0, 2000),
      source: String(e.filename || '').slice(0, 500),
      line_no: e.lineno || null,
      col_no: e.colno || null,
      stack: (e.error && e.error.stack) ? String(e.error.stack).slice(0, 4000) : null,
      user_agent: navigator.userAgent,
      page_url: location.href
    });
  });
  window.addEventListener('unhandledrejection', function(e){
    var reason = e.reason;
    logClientError({
      message: String((reason && reason.message) ? reason.message : reason).slice(0, 2000),
      source: 'unhandledrejection',
      stack: (reason && reason.stack) ? String(reason.stack).slice(0, 4000) : null,
      user_agent: navigator.userAgent,
      page_url: location.href
    });
  });

  function fireConfetti(anchorEl){
    var colors = ['#33D18B', '#F5644F', '#F6C430', '#4A6CFA', '#FFFFFF'];
    var rect = anchorEl.getBoundingClientRect();
    var count = 70;

    for(var i = 0; i < count; i++){
      var piece = document.createElement('div');
      var isCircle = Math.random() < 0.35;
      var w = isCircle ? (4 + Math.random() * 3) : (5 + Math.random() * 6);
      var h = isCircle ? w : w * (0.35 + Math.random() * 0.3);
      var color = colors[Math.floor(Math.random() * colors.length)];

      // spread the origin across the button's width, not a single point
      var originX = rect.left + Math.random() * rect.width;
      var originY = rect.top + window.scrollY + rect.height / 2;

      piece.style.position = 'absolute';
      piece.style.left = originX + 'px';
      piece.style.top = originY + 'px';
      piece.style.width = w + 'px';
      piece.style.height = h + 'px';
      piece.style.background = color;
      piece.style.borderRadius = isCircle ? '50%' : '1.5px';
      piece.style.pointerEvents = 'none';
      piece.style.zIndex = '999';
      piece.style.willChange = 'transform, opacity';
      document.body.appendChild(piece);

      var angle = Math.PI + Math.random() * Math.PI; // upward hemisphere
      var burstDistance = 40 + Math.random() * 70;
      var burstX = Math.cos(angle) * burstDistance;
      var burstY = Math.sin(angle) * burstDistance * 0.8;
      var fallDistance = 120 + Math.random() * 160;
      var drift = (Math.random() - 0.5) * 90;
      var spin = (Math.random() - 0.5) * 720;
      var duration = 1100 + Math.random() * 700;
      var delay = Math.random() * 90;

      piece.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: 'translate(' + burstX + 'px,' + burstY + 'px) rotate(' + (spin * 0.3) + 'deg) scale(1)', opacity: 1, offset: 0.28 },
        { transform: 'translate(' + (burstX + drift * 0.6) + 'px,' + (burstY + fallDistance * 0.55) + 'px) rotate(' + (spin * 0.7) + 'deg) scale(0.9)', opacity: 1, offset: 0.7 },
        { transform: 'translate(' + (burstX + drift) + 'px,' + (burstY + fallDistance) + 'px) rotate(' + spin + 'deg) scale(0.75)', opacity: 0, offset: 1 }
      ], { duration: duration, delay: delay, easing: 'cubic-bezier(.17,.67,.35,.99)', fill: 'forwards' });

      (function(el, dur, del){ setTimeout(function(){ el.remove(); }, dur + del + 60); })(piece, duration, delay);
    }
  }

  // After email signup, let the player type the code from the confirmation
  // email right here. On an iPhone home-screen app a link opens Safari, not the
  // app, so the login never reaches the app; typing the code keeps them in it.
  // (Needs the Supabase "Confirm signup" email template to include {{ .Token }};
  // if it only has the link, the link still works as before.)
  function mqShowCodeEntry(email, msgEl){
    var old = document.getElementById('mq-code-entry'); if(old) old.remove();
    var box = document.createElement('div');
    box.id = 'mq-code-entry';
    box.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:10px;';
    box.innerHTML =
      '<input type="text" id="mq-code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Code from the email" style="padding:11px 12px; border:1.5px solid var(--line); border-radius:8px; font-family:inherit; font-size:16px; letter-spacing:2px; background:var(--panel); color:var(--ink);">' +
      '<button type="button" id="mq-code-btn" style="padding:11px 16px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-weight:600; font-size:14.5px; cursor:pointer;">Confirm code</button>' +
      '<button type="button" id="mq-code-resend" style="background:none; border:none; color:var(--ink-soft); font-size:12.5px; font-weight:600; cursor:pointer; text-decoration:underline; padding:0; align-self:flex-start;">Send a new code</button>' +
      '<div id="mq-code-msg" class="form-msg" style="min-height:0;"></div>';
    msgEl.insertAdjacentElement('afterend', box);
    var codeMsg = box.querySelector('#mq-code-msg');
    box.querySelector('#mq-code-btn').addEventListener('click', async function(){
      var token = box.querySelector('#mq-code-input').value.replace(/\s+/g, '');
      if(!token){ codeMsg.className = 'form-msg err'; codeMsg.textContent = 'Enter the code from the email.'; return; }
      this.disabled = true;
      var res = await sb.auth.verifyOtp({ email: email, token: token, type: 'signup' });
      this.disabled = false;
      if(res.error){ codeMsg.className = 'form-msg err'; codeMsg.textContent = 'That code did not work. Check it or send a new one.'; return; }
      // Signed in -- onAuthStateChange takes it from here.
      box.remove();
    });
    box.querySelector('#mq-code-resend').addEventListener('click', async function(){
      this.disabled = true;
      var res = await sb.auth.resend({ type: 'signup', email: email });
      this.disabled = false;
      codeMsg.className = 'form-msg ' + (res.error ? 'err' : 'ok');
      codeMsg.textContent = res.error ? 'Could not resend. Try again in a minute.' : 'New email sent.';
    });
  }

  async function handleJoin(usernameInput, emailInput, ageCheckbox, btn, msgEl, stateInput, mode){
    const email = emailInput.value.trim();
    const password = document.getElementById('password-input').value;
    const isSignup = mode !== 'login';
    const username = isSignup ? usernameInput.value.trim() : '';
    const state = isSignup && stateInput && stateInput.value.trim() ? toTitleCase(stateInput.value) : '';
    msgEl.className = 'form-msg';
    msgEl.textContent = '';

    if(isSignup && !isValidUsername(username)){
      msgEl.classList.add('err');
      msgEl.textContent = 'Username: 3-24 characters, letters/numbers/underscores only.';
      return;
    }
    if(isSignup && mqHasProfanity(username)){
      msgEl.classList.add('err');
      msgEl.textContent = 'That username is not allowed. Please keep it clean and pick another.';
      return;
    }
    const loginByUsername = !isSignup && email.indexOf('@') === -1;
    if(loginByUsername){
      if(!isValidUsername(email)){
        msgEl.classList.add('err');
        msgEl.textContent = 'Enter your username or email.';
        return;
      }
    } else if(!isValidEmail(email)){
      msgEl.classList.add('err');
      msgEl.textContent = 'Enter a valid email first.';
      return;
    }
    if(password.length < 8){
      msgEl.classList.add('err');
      msgEl.textContent = 'Password needs to be at least 8 characters.';
      return;
    }
    if(isSignup && !ageCheckbox.checked){
      msgEl.classList.add('err');
      msgEl.textContent = 'You must confirm you\'re 18 or older.';
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;

    if(isSignup){
      btn.textContent = 'Checking…';
      const { data: existingUsername } = await sb.from('profiles').select('id').ilike('username', mqEscapeIlike(username)).maybeSingle();
      if(existingUsername){
        msgEl.classList.add('err');
        msgEl.textContent = 'That username is taken \u2014 try another.';
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }

      btn.textContent = 'Signing up…';
      const { data: signUpData, error } = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: username, age_confirmed: true, state: state || null, signup_source: mqSignupSource() }, emailRedirectTo: window.location.origin + window.location.pathname }
      });
      btn.disabled = false;
      btn.textContent = originalText;
      if(error){
        msgEl.classList.add('err');
        msgEl.textContent = error.message.indexOf('already registered') > -1
          ? 'That email already has an account \u2014 try logging in instead.'
          : 'Something went wrong. Try again.';
        return;
      }
      msgEl.classList.remove('err');
      fireConfetti(btn);
      if(signUpData && signUpData.session){
        // Confirmation isn't required on this project -- they're signed in already,
        // and onAuthStateChange's SIGNED_IN handler takes it from here.
        return;
      }
      // Confirmation is required -- no session yet. Tell them to check email.
      msgEl.classList.add('ok');
      msgEl.textContent = 'Check ' + email + ' to confirm your account. Tap the link, or type the code from the email below.';
      mqShowCodeEntry(email, msgEl);
      return;
    }

    btn.textContent = 'Logging in…';
    let error = null;
    if(loginByUsername){
      // The server looks up the email and signs in; the browser never sees the email.
      try {
        const resp = await fetch(SUPABASE_URL + '/functions/v1/username-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ username: email, password: password })
        });
        const out = await resp.json().catch(function(){ return {}; });
        if(resp.ok && out.access_token && out.refresh_token){
          const setRes = await sb.auth.setSession({ access_token: out.access_token, refresh_token: out.refresh_token });
          if(setRes.error) error = { message: 'Something went wrong.' };
        } else if(out.error === 'unconfirmed' && out.email){
          btn.disabled = false;
          btn.textContent = originalText;
          msgEl.classList.add('err');
          mqShowCodeEntry(out.email, msgEl);
          msgEl.textContent = 'Confirm your email first \u2014 tap the link in your inbox, or type the code below.';
          return;
        } else if(out.error === 'rate_limited'){
          error = { message: 'Too many tries. Wait a minute and try again.' };
        } else if(out.error === 'wrong_credentials'){
          error = { message: 'Invalid login' };
        } else {
          error = { message: 'Something went wrong.' };
        }
      } catch(e){
        error = { message: 'Something went wrong.' };
      }
    } else {
      const res = await sb.auth.signInWithPassword({ email: email, password: password });
      error = res.error;
    }
    btn.disabled = false;
    btn.textContent = originalText;
    if(error){
      msgEl.classList.add('err');
      msgEl.textContent = error.message.indexOf('Invalid login') > -1
        ? (loginByUsername ? 'Wrong username or password. Signed up with Google? Use Continue with Google.' : 'Wrong email or password.')
        : error.message.indexOf('Too many') > -1 ? error.message
        : (error.message.indexOf('not confirmed') > -1
          ? (mqShowCodeEntry(email, msgEl), 'Confirm your email first \u2014 tap the link in your inbox, or type the code below.')
          : 'Something went wrong. Try again.');
      return;
    }
    // Success -- onAuthStateChange picks this up and calls showSignedIn.
  }

  function setupAuthToggle(formId){
    const fieldsEl = document.getElementById(formId + '-signup-fields');
    const ageCheckEl = document.getElementById('join-age-check');
    const submitBtn = document.getElementById('join-btn');
    const buttons = document.querySelectorAll('.mode-btn[data-target="' + formId + '"]');
    const usernameEl = document.getElementById('username-input');
    const ageCheckboxEl = document.getElementById('age-checkbox');
    const passwordEl = document.getElementById('password-input');
    const forgotLinkEl = document.getElementById('forgot-password-link');
    let currentMode = 'signup';

    function applyMode(mode){
      currentMode = mode;
      buttons.forEach(function(b){
        const active = b.getAttribute('data-mode') === mode;
        b.style.color = active ? 'var(--ink)' : 'var(--ink-soft)';
        b.style.borderBottomColor = active ? 'var(--ink)' : 'transparent';
      });
      const isSignup = mode === 'signup';
      if(fieldsEl) fieldsEl.style.display = isSignup ? 'contents' : 'none';
      if(ageCheckEl) ageCheckEl.style.display = isSignup ? 'flex' : 'none';
      if(submitBtn) submitBtn.textContent = isSignup ? 'Sign up' : 'Log in';
      if(forgotLinkEl) forgotLinkEl.style.display = isSignup ? 'none' : 'block';
      if(passwordEl) passwordEl.autocomplete = isSignup ? 'new-password' : 'current-password';
      // Explicitly toggle 'required' too — some Safari versions still block submit
      // on a required field hidden only via CSS display:none, with no visible error.
      const idEl = document.getElementById('email-input');
      if(idEl){
        idEl.type = isSignup ? 'email' : 'text';
        idEl.placeholder = isSignup ? 'you@email.com' : 'username or email';
        idEl.autocomplete = isSignup ? 'email' : 'username';
        idEl.setAttribute('autocapitalize', 'none');
        idEl.setAttribute('autocorrect', 'off');
      }
      if(usernameEl) usernameEl.required = isSignup;
      if(ageCheckboxEl) ageCheckboxEl.required = isSignup;
    }

    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){ applyMode(btn.getAttribute('data-mode')); });
    });

    return { getMode: function(){ return currentMode; }, setMode: applyMode };
  }

  const joinToggle = setupAuthToggle('join');

  document.getElementById('join').addEventListener('submit', function(e){
    e.preventDefault();
    handleJoin(
      document.getElementById('username-input'),
      document.getElementById('email-input'),
      document.getElementById('age-checkbox'),
      document.getElementById('join-btn'),
      document.getElementById('form-msg'),
      document.getElementById('state-input'),
      joinToggle.getMode()
    );
  });

  // Panel open/close
  const authPanel = document.getElementById('auth-panel');
  function resetAuthPanelToForm(){
    document.getElementById('reset-password-step').style.display = 'none';
    document.getElementById('join').style.display = 'none';
    const codeStepEl = document.getElementById('email-code-step');
    if(codeStepEl) codeStepEl.style.display = 'none';
    document.getElementById('auth-choice').style.display = 'flex';
    document.getElementById('form-msg').textContent = '';
    document.getElementById('form-msg').className = 'form-msg';
  }
  // ---- Email sign-in code (no password) ----
  // signInWithOtp emails a 6-digit code (and a link, depending on the Supabase
  // email template). Existing accounts sign in; unknown emails get a new account
  // that goes through the same username prompt as Google sign-ups. The password
  // form stays available for people who already use one.
  let mqCodeEmail = '';
  let mqCodeBusy = false;
  let mqResendTimer = null;
  function mqCodeMsg(text, kind){
    const el = document.getElementById('form-msg');
    el.className = 'form-msg' + (kind ? ' ' + kind : '');
    el.textContent = text || '';
  }
  function mqShowCodeStage(stage){
    document.getElementById('code-stage-email').style.display = stage === 'email' ? 'flex' : 'none';
    document.getElementById('code-stage-verify').style.display = stage === 'verify' ? 'flex' : 'none';
  }
  function mqOpenCodeStep(){
    document.getElementById('auth-choice').style.display = 'none';
    document.getElementById('join').style.display = 'none';
    document.getElementById('reset-password-step').style.display = 'none';
    document.getElementById('email-code-step').style.display = 'flex';
    mqShowCodeStage('email');
    mqCodeMsg('');
    const input = document.getElementById('code-email-input');
    if(input) setTimeout(function(){ try{ input.focus(); }catch(e){} }, 50);
  }
  function mqStartResendCooldown(seconds){
    const btn = document.getElementById('resend-code-btn');
    if(mqResendTimer) clearInterval(mqResendTimer);
    let left = seconds;
    btn.disabled = true;
    btn.textContent = 'Resend code in ' + left + 's';
    mqResendTimer = setInterval(function(){
      left -= 1;
      if(left <= 0){
        clearInterval(mqResendTimer);
        mqResendTimer = null;
        btn.disabled = false;
        btn.textContent = 'Resend code';
      }else{
        btn.textContent = 'Resend code in ' + left + 's';
      }
    }, 1000);
  }
  async function mqSendCode(email, isResend){
    if(mqCodeBusy) return;
    if(!isValidEmail(email)){ mqCodeMsg('Enter a valid email first.', 'err'); return; }
    mqCodeBusy = true;
    const sendBtn = document.getElementById('send-code-btn');
    sendBtn.disabled = true;
    mqCodeMsg('');
    try{
      try{ sessionStorage.setItem('marqit_pending_signup_source', pendingSignupSource || 'organic'); }catch(e){}
      const { error } = await sb.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin + window.location.pathname,
          data: { signup_source: mqSignupSource(), signup_method: 'code' }
        }
      });
      if(error){
        const rateLimited = error.status === 429 || /rate|seconds|too many/i.test(error.message || '');
        mqCodeMsg(rateLimited ? 'Please wait a minute, then try again.' : 'Could not send the code \u2014 check the email and try again.', 'err');
        return;
      }
      mqCodeEmail = email;
      document.getElementById('code-sent-msg').textContent = 'We sent a code to ' + email + '. Enter it below, or tap the link in the email.';
      document.getElementById('code-input').value = '';
      mqShowCodeStage('verify');
      mqStartResendCooldown(60);
      mqTrack(isResend ? 'email_code_resend' : 'email_code_sent');
      setTimeout(function(){ try{ document.getElementById('code-input').focus(); }catch(e){} }, 50);
    }finally{
      mqCodeBusy = false;
      sendBtn.disabled = false;
    }
  }
  async function mqVerifyCode(){
    if(mqCodeBusy) return;
    const input = document.getElementById('code-input');
    const code = (input.value || '').replace(/\D/g, '');
    if(code.length < 6){ mqCodeMsg('Enter the code from your email.', 'err'); return; }
    mqCodeBusy = true;
    const btn = document.getElementById('verify-code-btn');
    btn.disabled = true;
    mqCodeMsg('');
    try{
      const { error } = await sb.auth.verifyOtp({ email: mqCodeEmail, token: code, type: 'email' });
      if(error){
        mqCodeMsg('That code didn\u2019t work. Check it and try again, or request a new one.', 'err');
        mqTrack('email_code_error');
        return;
      }
      mqTrack('email_code_signin');
      // Success: onAuthStateChange SIGNED_IN takes it from here (profile, username prompt, guest picks).
    }finally{
      mqCodeBusy = false;
      btn.disabled = false;
    }
  }
  document.getElementById('show-email-form-btn').addEventListener('click', mqOpenCodeStep);
  document.getElementById('join-use-code-btn').addEventListener('click', mqOpenCodeStep);
  document.getElementById('code-back-btn').addEventListener('click', resetAuthPanelToForm);
  document.getElementById('use-password-btn').addEventListener('click', function(){
    const typed = document.getElementById('code-email-input').value.trim();
    document.getElementById('email-code-step').style.display = 'none';
    document.getElementById('join').style.display = 'flex';
    joinToggle.setMode('login');
    if(typed) document.getElementById('email-input').value = typed;
    mqCodeMsg('');
  });
  document.getElementById('send-code-btn').addEventListener('click', function(){
    mqSendCode(document.getElementById('code-email-input').value.trim().toLowerCase(), false);
  });
  document.getElementById('code-email-input').addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); mqSendCode(this.value.trim().toLowerCase(), false); }
  });
  document.getElementById('verify-code-btn').addEventListener('click', mqVerifyCode);
  document.getElementById('code-input').addEventListener('input', function(){
    const digits = this.value.replace(/\D/g, '');
    if(digits.length === 6) mqVerifyCode();
  });
  document.getElementById('code-input').addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); mqVerifyCode(); }
  });
  document.getElementById('resend-code-btn').addEventListener('click', function(){ mqSendCode(mqCodeEmail, true); });
  document.getElementById('code-change-email-btn').addEventListener('click', function(){
    mqShowCodeStage('email');
    mqCodeMsg('');
  });
  document.getElementById('email-form-back-btn').addEventListener('click', resetAuthPanelToForm);
  document.getElementById('forgot-password-link').addEventListener('click', function(){
    const msgEl = document.getElementById('form-msg');
    msgEl.textContent = '';
    msgEl.className = 'form-msg';
    document.getElementById('reset-email-input').value = document.getElementById('email-input').value.trim();
    document.getElementById('join').style.display = 'none';
    document.getElementById('reset-password-step').style.display = 'flex';
  });
  document.getElementById('reset-back-btn').addEventListener('click', function(){
    document.getElementById('reset-password-step').style.display = 'none';
    document.getElementById('join').style.display = 'flex';
    joinToggle.setMode('login');
    document.getElementById('form-msg').textContent = '';
    document.getElementById('form-msg').className = 'form-msg';
  });
  document.getElementById('send-reset-btn').addEventListener('click', async function(){
    const msgEl = document.getElementById('form-msg');
    const email = document.getElementById('reset-email-input').value.trim();
    msgEl.className = 'form-msg';
    msgEl.textContent = '';
    if(!isValidEmail(email)){
      msgEl.classList.add('err');
      msgEl.textContent = 'Enter a valid email first.';
      return;
    }
    const btn = this;
    btn.disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    btn.disabled = false;
    if(error){
      msgEl.classList.add('err');
      msgEl.textContent = 'Something went wrong. Try again.';
      return;
    }
    msgEl.classList.add('ok');
    msgEl.textContent = 'Check ' + email + ' for a link to reset your password.';
  });
  // Google refuses OAuth inside embedded in-app browsers (Instagram, TikTok,
  // Snapchat, Facebook...) and shows a dead-end "disallowed_useragent" error.
  // Catch those here and tell people how to get out instead.
  function mqInAppBrowser(){
    try{ return /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|\bLine\//i.test(navigator.userAgent || ''); }
    catch(e){ return false; }
  }
  function mqInAppGoogleBlocked(msgEl){
    if(!mqInAppBrowser()) return false;
    if(msgEl){
      msgEl.className = 'form-msg err';
      msgEl.textContent = 'Google sign-in is blocked in this app\u2019s browser. Open the page in your browser, or continue with email.';
    }
    return true;
  }
  document.getElementById('google-auth-btn').addEventListener('click', async function(){
    const msg = document.getElementById('form-msg');
    msg.className = 'form-msg';
    msg.textContent = '';
    if(mqInAppGoogleBlocked(msg)) return;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if(error){
      msg.className = 'form-msg err';
      msg.textContent = 'Could not start Google sign-in \u2014 try again.';
    }
  });
  let pendingSignupSource = 'organic';

  // The database creates the profile the instant the account exists, using the
  // signup_source sent with signUp(). So a publisher-widget visitor must be
  // credited here ('widget:<siteKey>'), not afterwards in ensureProfileInner.
  function mqSignupSource(){
    try{
      var w = sessionStorage.getItem('marqit_widget_site');
      if(w && /^[A-Za-z0-9_-]{4,40}$/.test(w)) return 'widget:' + w;
    }catch(e){}
    return pendingSignupSource || 'organic';
  }

  // --- Referral tracking (Share Card Update spec, Change 7) ---------------
  // A shared card's link carries ?ref=<sharerUserId>~<cardType>~<trigger>.
  // Captured here on page load (works for a fresh visit or after the
  // Google OAuth round trip, same sessionStorage pattern as signup_source
  // above), then attached to the new account at signup time in
  // ensureProfileInner. Lets shares AND signups be reported by card type
  // and by trigger, per the spec's tracking requirement.
  (function captureReferral(){
    try{
      var params = new URLSearchParams(window.location.search);
      var ref = params.get('ref');
      if(!ref) return;
      var parts = ref.split('~');
      if(parts.length < 2) return; // malformed -- ignore rather than half-attribute
      // The referrer id lands in a uuid foreign-key column, so anything that
      // isn't a well-formed UUID must be dropped here -- a bad value would
      // otherwise make the new user's profile insert fail at signup.
      // Publisher widget link: ?ref=widget~<siteKey>. Remember which partner site
      // sent this visitor so their signup can be credited to it (see ensureProfileInner).
      if(parts[0] === 'widget'){
        if(/^[A-Za-z0-9_-]{4,40}$/.test(parts[1])) sessionStorage.setItem('marqit_widget_site', parts[1]);
        return;
      }
      var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(!UUID_RE.test(parts[0])) return;
      var TAG_RE = /^[a-z_]{1,32}$/;
      var cardTypeClean = TAG_RE.test(parts[1]) ? parts[1] : null;
      var triggerClean = (parts[2] && parts[2] !== 'none' && TAG_RE.test(parts[2])) ? parts[2] : null;
      sessionStorage.setItem('marqit_referral_info', JSON.stringify({
        referrerUserId: parts[0].toLowerCase(),
        cardType: cardTypeClean,
        trigger: triggerClean
      }));
    }catch(e){ /* referral is a nice-to-have, never block page load over it */ }
  })();

  // --- Group invite-link capture (chapter/org signup links) ---------------
  // A president DMs out https://playmarqit.com/?group=CODE. Most people who
  // click that link are NOT signed in yet, so the old code only auto-joined
  // when a session already existed and silently dropped the code otherwise --
  // meaning the exact people this link is for (brand-new signups) never
  // actually landed in the chapter's group. Stash the code in sessionStorage
  // on first load so it survives the sign-up/sign-in flow, then both
  // autoJoinFromUrl (page-load) and the SIGNED_IN handler (same-page
  // sign-up/login) can consume it whenever a session becomes available.
  (function captureGroupCode(){
    try{
      var params = new URLSearchParams(window.location.search);
      var code = params.get('group');
      if(code){
        var CODE_RE = /^[a-zA-Z0-9_-]{1,32}$/;
        if(CODE_RE.test(code)){
          sessionStorage.setItem('marqit_pending_group_code', code);
          // A chapter invite link IS the "certain link" that flags this visitor
          // as a Greek recruit -- persists across visits, not just this page load.
          localStorage.setItem('marqit_greek', '1');
        }
      }
      // A separate marketing link (no specific chapter yet) can also opt someone
      // into the Greek/chapter-competition UI: playmarqit.com/?greek=1
      if(params.get('greek') === '1'){
        localStorage.setItem('marqit_greek', '1');
      }
    }catch(e){ /* nice-to-have, never block page load over it */ }
  })();

  // ---- Greek/chapter mode gating: the whole Top Chapters / Top Orgs /
  // Head-to-Head / Fall Chapter Cup suite is hidden from the general
  // audience. It only shows for someone who arrived via a chapter invite
  // link or a ?greek=1 link (flag set above, persists in localStorage), or
  // who is already a member of a chapter that has a school/org set.
  function mqIsGreekModeFlagged(){
    try{ return localStorage.getItem('marqit_greek') === '1'; }catch(e){ return false; }
  }
  async function mqIsGreekMode(){
    if(mqIsGreekModeFlagged()) return true;
    try{
      const { data: sessionRes } = await sb.auth.getSession();
      const session = sessionRes && sessionRes.session;
      if(!session) return false;
      const { data: membership } = await sb.from('group_members').select('groups(school, org_name)').eq('user_id', session.user.id).maybeSingle();
      const g = membership && membership.groups;
      if(g && (g.school || g.org_name)){
        try{ localStorage.setItem('marqit_greek', '1'); }catch(e){}
        return true;
      }
      return false;
    }catch(e){ return false; }
  }
  async function mqApplyGreekVisibility(){
    const on = await mqIsGreekMode();
    const section = document.getElementById('greek-section');
    const createFields = document.getElementById('greek-create-fields');
    const optInBtn = document.getElementById('greek-opt-in-btn');
    const createBtn = document.getElementById('create-group-btn');
    const nameInput = document.getElementById('group-name-input');
    if(section) section.style.display = on ? 'block' : 'none';
    if(createFields) createFields.style.display = on ? 'block' : 'none';
    // Everyone else is just making a plain group -- only call it a "chapter"
    // and show the Greek-specific example once they've actually flagged
    // themselves as setting one up (or already belong to one).
    if(optInBtn) optInBtn.style.display = on ? 'none' : '';
    if(createBtn) createBtn.textContent = on ? 'Create chapter' : 'Create group';
    if(nameInput) nameInput.placeholder = on ? 'chapter name (e.g. Sigma Chi – UF)' : 'group name (e.g. Roommates, Class of 2027)';
  }

  function mqGetReferralInfo(){
    try{
      var raw = sessionStorage.getItem('marqit_referral_info');
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  // Builds the ?ref= tag to append to a shared link. userId is the person
  // doing the sharing (so anyone who signs up via this link gets attributed
  // back to them); cardType/trigger identify which card and which prompt
  // produced the share.
  function mqGetReferralTag(userId, cardType, trigger){
    return 'ref=' + encodeURIComponent(userId) + '~' + encodeURIComponent(cardType) + '~' + encodeURIComponent(trigger || 'none');
  }

  // Logs one row per share tap (regardless of whether it leads to a
  // signup) so "cards shared / days all 3 calls locked" and per-trigger
  // breakdowns from the spec's Overview are reportable straight from SQL.
  async function mqLogCardShare(userId, cardType, trigger){
    if(!userId) return;
    try{ await sb.from('card_shares').insert({ user_id: userId, card_type: cardType, trigger_name: trigger || null }); }
    catch(e){ /* logging failure shouldn't block the actual share */ }
  }

  function openAuthPanel(mode, source){
    pendingSignupSource = source || 'organic';
    window.__authOpenedAt = Date.now();
    // Also stash it in sessionStorage: Google sign-in does a full-page redirect
    // to accounts.google.com and back, which wipes the in-memory variable above.
    // sessionStorage survives that round trip (same tab), unlike a plain JS var.
    try{ sessionStorage.setItem('marqit_pending_signup_source', pendingSignupSource); }catch(e){}
    joinToggle.setMode(mode);
    resetAuthPanelToForm();
    const inAppNote = document.getElementById('inapp-note');
    if(inAppNote) inAppNote.style.display = mqInAppBrowser() ? 'block' : 'none';
    authPanel.style.display = 'block';
  }
  document.getElementById('nav-login-btn').addEventListener('click', function(){ openAuthPanel('login'); });
  document.getElementById('nav-signup-btn').addEventListener('click', function(){ openAuthPanel('signup'); });
  document.getElementById('auth-panel-close').addEventListener('click', function(){ authPanel.style.display = 'none'; resetAuthPanelToForm(); });
  const ctaOpenBtn = document.getElementById('cta-open-signup');
  if(ctaOpenBtn){
    ctaOpenBtn.addEventListener('click', function(){
      window.scrollTo({ top: 0, behavior: 'smooth' });
      openAuthPanel('signup');
    });
  }
  const ctaOpenBtnChallenge = document.getElementById('cta-open-signup-challenge');
  if(ctaOpenBtnChallenge){
    ctaOpenBtnChallenge.addEventListener('click', function(){
      window.scrollTo({ top: 0, behavior: 'smooth' });
      openAuthPanel('signup', 'challenge');
    });
  }
  document.addEventListener('click', function(e){
    if(authPanel.style.display !== 'block') return;
    if(Date.now() - (window.__authOpenedAt || 0) < 300) return; // the click that just opened it
    const clickedInsidePanel = authPanel.contains(e.target);
    const clickedNavButton = e.target.id === 'nav-login-btn' || e.target.id === 'nav-signup-btn' || e.target.id === 'cta-open-signup' || e.target.id === 'cta-open-signup-challenge';
    if(!clickedInsidePanel && !clickedNavButton){ authPanel.style.display = 'none'; }
  });


  // ---- Empty states: a real prompt instead of dashes and "sign in to see" ----
  function mqEmptyState(card, o){
    if(!card) return;
    card.classList.add('is-empty');
    var box = card.querySelector(':scope > .empty-state');
    if(!box){ box = document.createElement('div'); box.className = 'empty-state'; card.appendChild(box); }
    box.innerHTML = '<span class="es-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (MQ_AVATAR_GLYPHS[o.icon] || MQ_AVATAR_GLYPHS.target) + '</svg></span>' +
      '<div class="es-title">' + escapeHtml(o.title) + '</div><p class="es-sub">' + escapeHtml(o.sub) + '</p>' +
      '<button type="button" class="es-btn" data-open-signup="' + escapeHtml(o.source || 'empty_state') + '">Sign up free</button>';
  }
  function mqClearEmptyState(card){
    if(!card) return;
    card.classList.remove('is-empty');
    var box = card.querySelector(':scope > .empty-state');
    if(box) box.remove();
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-open-signup]');
    if(!t) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    openAuthPanel('signup', t.getAttribute('data-open-signup') || 'empty_state');
  });

  // Analytics helper: fire a GA4 event if gtag is there, never throw.
  // Set once a visitor's pre-signup picks have been saved, so the welcome note
  // survives the second render that sign-in triggers.
  var mqGuestWelcome = false;
  function mqTrack(name, params){ try{ if(typeof gtag === 'function') gtag('event', name, params || {}); }catch(e){} }

  // ---- Guest play: no account needed to play, submit and see the crowd. ----
  // A guest's picks live in localStorage (not the database). If they later
  // make an account, loadDailyQuestions submits them for real.
  function mqGetGuestPicks(date){
    try{
      const saved = JSON.parse(localStorage.getItem('mq_guest_picks') || 'null');
      if(saved && saved.date === date && saved.picks) return saved.picks;
    }catch(e){}
    return {};
  }
  function mqSetGuestPicks(date, picks){
    try{
      if(picks && Object.keys(picks).length) localStorage.setItem('mq_guest_picks', JSON.stringify({ date: date, picks: picks }));
      else localStorage.removeItem('mq_guest_picks');
    }catch(e){}
  }
  function mqGuestDeviceId(){
    try{
      let id = localStorage.getItem('mq_guest_device');
      if(!id){
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
        localStorage.setItem('mq_guest_device', id);
      }
      return id;
    }catch(e){ return null; }
  }
  async function mqGoogleSignIn(msgEl){
    if(mqInAppGoogleBlocked(msgEl)) return;
    pendingSignupSource = 'organic';
    try{ sessionStorage.setItem('marqit_pending_signup_source', pendingSignupSource); }catch(e){}
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    if(error && msgEl){ msgEl.className = 'form-msg err'; msgEl.textContent = 'Could not start Google sign-in \u2014 try again.'; }
  }
  // Share before signing up: plain text + link (the picture cards need an account).
  async function mqShareGuestPicks(summary, msgEl){
    const lines = summary.map(function(r){ return (r.choice === 'yes' ? 'YES' : 'NO') + ' \u2014 ' + r.text; }).join('\n');
    const url = 'https://playmarqit.com/';
    const text = 'My Marqit picks today:\n' + lines + '\nThink I\u2019m wrong? Pick yours.';
    mqTrack('guest_share_click');
    mqOpenShareSheet({ title: 'Share your picks', text: text, url: url });
  }

  // Runs when someone lands back on the site after clicking their magic link,
  // or if they already have a session from a previous visit.
  //
  // This gets called from two places on page load (the SIGNED_IN auth event and
  // the initial getSession() check), which can both fire at nearly the same moment
  // for a brand-new signee. ensureProfilePromise makes sure the actual work — and
  // any DB writes — only happen once; the second caller just waits on the same result
  // instead of racing it and potentially showing a fake, never-saved suffixed username.
  let ensureProfilePromise = null;
  function ensureProfile(user){
    if(ensureProfilePromise) return ensureProfilePromise;
    ensureProfilePromise = ensureProfileInner(user).catch(function(err){
      ensureProfilePromise = null; // allow a retry on genuine failure
      throw err;
    });
    return ensureProfilePromise;
  }

  async function ensureProfileInner(user){
    const { data: existing } = await sb.from('profiles').select('id, state, username, banned').eq('id', user.id).maybeSingle();
    if(existing){
      try{ sessionStorage.removeItem('marqit_pending_signup_source'); }catch(e){}
      if(existing.banned){
        await sb.auth.signOut();
        alert('This account has been suspended.');
        return 'BANNED';
      }
      // A profile from before this account finished picking a username still
      // carries the old placeholder value -- treat that the same as "never
      // set one" so returning users get sent back through the picker instead
      // of quietly keeping "user_xxxxxxxx" forever.
      const isPlaceholder = existing.username === ('user_' + user.id.slice(0, 8));
      return { username: existing.username, needsUsername: isPlaceholder };
    }

    const hadNoUsername = !(user.user_metadata && user.user_metadata.username);
    let username = (user.user_metadata && user.user_metadata.username) || ('user_' + user.id.slice(0, 8));
    const state = (user.user_metadata && user.user_metadata.state) || null;
    // Email/password signup already has signup_source in user_metadata (set at
    // signUp time, before any redirect). Google OAuth never gets a user_metadata
    // signup_source at all -- Supabase populates that from Google's own profile
    // data, not our signUp options -- so fall back to the sessionStorage value
    // openAuthPanel stashed right before the redirect to Google. Clear it after
    // reading so a later, unrelated sign-in in the same tab can't inherit it.
    let storedSignupSource = null;
    try{ storedSignupSource = sessionStorage.getItem('marqit_pending_signup_source'); sessionStorage.removeItem('marqit_pending_signup_source'); }catch(e){}
    let signupSource = (user.user_metadata && user.user_metadata.signup_source) || storedSignupSource || 'organic';
    // Came from a publisher widget? Credit that partner site (signup_source = 'widget:<siteKey>').
    try{
      const widgetSite = sessionStorage.getItem('marqit_widget_site');
      if(widgetSite && /^[A-Za-z0-9_-]{4,40}$/.test(widgetSite)) signupSource = 'widget:' + widgetSite;
      sessionStorage.removeItem('marqit_widget_site');
    }catch(e){}

    // Referral attribution (Share Card Update spec) -- captured earlier by
    // captureReferral() from a ?ref= link, if this signup arrived via one.
    let referralInfo = mqGetReferralInfo();
    try{ sessionStorage.removeItem('marqit_referral_info'); }catch(e){} // one-time use, same as signup_source above
    // Nobody gets credit for referring themselves.
    if(referralInfo && referralInfo.referrerUserId === user.id) referralInfo = null;

    function insertProfile(name, refInfo){
      return sb.from('profiles').insert({
        id: user.id,
        username: name,
        state: state,
        age_confirmed: true,
        signup_source: signupSource,
        referred_by_user_id: refInfo ? refInfo.referrerUserId : null,
        referred_by_card_type: refInfo ? refInfo.cardType : null,
        referred_by_trigger: refInfo ? refInfo.trigger : null
      });
    }

    let { error: insertErr } = await insertProfile(username, referralInfo);
    // Referral is a nice-to-have and must never cost someone their account:
    // if the referrer id doesn't exist (23503 foreign-key) or isn't a valid
    // uuid (22P02), drop the attribution and create the profile without it.
    if(insertErr && referralInfo && (insertErr.code === '23503' || insertErr.code === '22P02')){
      referralInfo = null;
      const noRef = await insertProfile(username, null);
      insertErr = noRef.error;
    }

    if(insertErr && insertErr.code === '23505'){
      // A 23505 here means EITHER someone else already has this username, OR this
      // exact profile (same id) was just created a split second ago by a parallel
      // call. Check which one actually happened before deciding what to do.
      const { data: raceCheck } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if(raceCheck){
        // It was us racing ourselves -- a profile now exists for this id, with the
        // real username. Use that instead of inventing a suffixed one.
        return raceCheck.username;
      }
      // Genuine username collision with a different user -- fall back to a
      // guaranteed-unique variant rather than leaving the account half-broken.
      username = username + '_' + user.id.slice(0, 4);
      const retry = await insertProfile(username, referralInfo);
      insertErr = retry.error;
      if(insertErr){
        // Still failing -- most likely a parallel call finished in between. Check once more.
        const { data: finalCheck } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
        if(finalCheck) return finalCheck.username;
      }
    }

    if(insertErr && insertErr.code !== '23505'){
      // Not a duplicate: try once more after a short wait (the session token
      // can lag a moment behind the sign-in event), then record the failure.
      await new Promise(function(r){ setTimeout(r, 800); });
      const again = await insertProfile(username, null);
      insertErr = again.error && again.error.code === '23505' ? null : again.error;
      if(insertErr){ try{ mqTrack('profile_insert_failed', { code: insertErr.code || 'unknown' }); }catch(e){} }
    }
    if(!insertErr){
      await sb.from('streaks').insert({ user_id: user.id });
    }
    // If there was no username to draw from (e.g. a fresh Google sign-in --
    // OAuth has no username concept), this row only carries the placeholder
    // "user_xxxxxxxx" because the database column can't be blank. It must
    // never be shown to the person or left in place -- the caller forces a
    // real pick via needsUsername/promptUsernameChoice() below.
    return { username: username, needsUsername: hadNoUsername };
  }

  function promptUsernameChoice(){
    const backdrop = document.getElementById('username-prompt-backdrop');
    const input = document.getElementById('username-prompt-input');
    const msg = document.getElementById('username-prompt-msg');
    input.value = '';
    msg.textContent = '';
    msg.className = 'form-msg';
    backdrop.style.display = 'flex';
    input.focus();
  }
  document.getElementById('username-prompt-save-btn').addEventListener('click', async function(){
    const input = document.getElementById('username-prompt-input');
    const msg = document.getElementById('username-prompt-msg');
    const newUsername = input.value.trim();
    msg.className = 'form-msg';
    msg.textContent = '';
    if(!newUsername){
      msg.className = 'form-msg err';
      msg.textContent = 'Enter a username.';
      return;
    }
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;
    const btn = this;
    btn.disabled = true;
    let { data: savedRows, error } = await sb.from('profiles').update({ username: newUsername }).eq('id', session.user.id).select('id');
    if(!error && (!savedRows || !savedRows.length)){
      // No profile row exists yet (account was created but the profile never
      // got written). An UPDATE on a missing row "succeeds" with zero rows, so
      // create the row here instead of pretending it saved.
      const ins = await sb.from('profiles').insert({ id: session.user.id, username: newUsername, age_confirmed: true, signup_source: 'organic' });
      error = ins.error;
      if(!error){ await sb.from('streaks').insert({ user_id: session.user.id }); }
    }
    btn.disabled = false;
    if(error){
      msg.className = 'form-msg err';
      msg.textContent = error.code === '23505' ? 'That username is taken.' : 'Could not save \u2014 try again.';
      return;
    }
    document.getElementById('username-prompt-backdrop').style.display = 'none';
    const navUsername = document.getElementById('nav-username');
    if(navUsername) navUsername.textContent = newUsername;
    // The Play page starts with the timer, so there is no "signed in as" line here any more.
    const heroMsg = document.getElementById('hero-status-msg');
    if(heroMsg){ heroMsg.className = 'form-msg'; heroMsg.textContent = ''; }
    mqMaybeAskPassword(session.user, false);
  });

  function showSignedIn(username, needsUsername){
    document.getElementById('nav-signed-out').style.display = 'none';
    document.getElementById('nav-signed-in').style.display = 'flex';
    const guestNote = document.getElementById('hero-guest-note'); if(guestNote) guestNote.style.display = 'none';
    document.getElementById('auth-panel').style.display = 'none';
    const navUsername = document.getElementById('nav-username');
    // Never surface the auto-generated "user_xxxxxxxx" placeholder -- if this
    // account hasn't picked a real username yet, show nothing until they do.
    if(navUsername) navUsername.textContent = needsUsername ? '' : (username || '');
    const heroMsg = document.getElementById('hero-status-msg');
    if(heroMsg){
      // Only speak up when something is needed from the player; a signed-in player sees the timer first.
      heroMsg.className = needsUsername ? 'form-msg ok' : 'form-msg';
      heroMsg.textContent = needsUsername ? 'Pick a username to finish setting up your account.' : '';
    }
    const playFriends = document.getElementById('play-friends'); if(playFriends) playFriends.style.display = 'flex';
    if(needsUsername) promptUsernameChoice();
    loadMyStats();
    loadShareCard(username);
    loadGroupSection();
    loadStateBoard();
    loadBuddySection();
    loadRivalSection();
    loadFriendsFeed();
    loadNotificationSettings();
    loadPendingRequests();
    loadDailyQuestions();
    checkDailyDrop();
    loadBigBoard();
    loadCategoryBoard('sports', 'board-sports');
    loadCategoryBoard('pop_culture', 'board-pop_culture');
    loadCategoryBoard('news', 'board-news');
    loadWeeklyRecap();
    loadMyCalls();
    loadRecord();
    loadTopPredictor();
  }

  document.getElementById('sign-out-btn').addEventListener('click', async function(){
    await sb.auth.signOut();
    window.location.reload();
  });

  const REACTION_EMOJIS = ['🔥', '😬', '💀', '😂'];
  // Extra emoji offered behind the "more reactions" dropdown. Anything picked
  // from here behaves exactly like the 4 quick ones (public, ungated, one per
  // user per emoji) -- it just isn't pinned to the row by default, and only
  // shows up as its own chip once at least one person has used it.
  const EXTRA_REACTION_EMOJIS = ['❤️', '👍', '👎', '😱', '🎯', '🍿', '😅', '🙄', '🤯', '🐐', '👀', '💯'];
  const TIERS = [
    { name: 'Legend', min: 50000 },
    { name: 'Expert', min: 15000 },
    { name: 'Pro', min: 5000 },
    { name: 'Analyst', min: 1000 },
    { name: 'Rookie', min: 0 }
  ];

  // Achievement badges -- a small, curated set beyond the streak milestones.
  // Each is detected live wherever the app already has the relevant data
  // (see mqAwardAchievement call sites), not backfilled from full history,
  // same philosophy as the existing streak-milestone celebration.
  const ACHIEVEMENTS = {
    perfect_day:   { icon: 'target', label: 'Perfect Day',   desc: 'Went 3-for-3 on a single day\u2019s calls.' },
    buddy_bonus:   { icon: 'link', label: 'Buddy Bonus',   desc: 'Matched a pick with a buddy.' },
    rival_win:     { icon: 'trophy', label: 'Showdown Winner', desc: 'Won a Rival Showdown.' },
    // Starter badges: quick wins in the first days, when people drop off.
    first_pick:    { icon: 'sprout', label: 'First Call',    desc: 'Locked in your first pick.' },
    first_correct: { icon: 'check', label: 'On the Board',  desc: 'Got your first call right.' },
    streak_3:      { icon: 'flame', label: 'Three in a Row', desc: 'Played 3 days in a row.' },
    // Tiered achievements: times_earned isn't a raw count of events, it's the
    // tier reached (RPC divides the underlying count by the tier size), so
    // "\u00d73" here really means "3rd tier" -- 30 correct calls, 300
    // predictions, a 42-day streak, etc. See award_achievement in Supabase.
    sharp_shooter: { icon: 'crosshair', label: 'Sharp Shooter', desc: 'Every 10 lifetime correct calls earns another tier.', tiered: true, tierSize: 10, tierUnit: 'correct calls' },
    century_club:  { icon: 'stack', label: 'Century Club',  desc: 'Every 100 lifetime predictions earns another tier.', tiered: true, tierSize: 100, tierUnit: 'predictions' },
    iron_streak:   { icon: 'link', label: 'Iron Streak',   desc: 'Every 14-day streak milestone your best-ever streak passes earns another tier.', tiered: true, tierSize: 14, tierUnit: 'day streak' },
    golden_touch:  { icon: 'star', label: 'Golden Touch',  desc: 'Every golden star you earn is its own tier.', tiered: true, tierSize: 1, tierUnit: 'golden star' },
    speed_demon:   { icon: 'bolt', label: 'Speed Demon',   desc: 'Every 5 correct calls made during a drop bonus window earns another tier.', tiered: true, tierSize: 5, tierUnit: 'drop-bonus calls' },
    point_baron:   { icon: 'crown', label: 'Point Baron',   desc: 'Every 1,000 lifetime points earns another tier.', tiered: true, tierSize: 1000, tierUnit: 'points' },
    regular:       { icon: 'calendar', label: 'Regular',       desc: 'Every 30 days you\u2019ve made a pick earns another tier.', tiered: true, tierSize: 30, tierUnit: 'days played' }
  };
  var TIERED_ACHIEVEMENT_KEYS = Object.keys(ACHIEVEMENTS).filter(function(k){ return ACHIEVEMENTS[k].tiered; });
  var __mqEarnedAchievementsCache = {}; // userId -> { key: times_earned }, avoids a re-check query per hook

  async function mqAwardAchievement(userId, key){
    if(!userId || !ACHIEVEMENTS[key]) return;
    if(!__mqEarnedAchievementsCache[userId]) __mqEarnedAchievementsCache[userId] = {};
    var known = __mqEarnedAchievementsCache[userId][key] || 0;

    // One-time achievements: once we know it's earned, never re-check.
    // Tiered achievements can always earn another tier, so they always
    // re-check -- award_achievement is cheap and only writes when the
    // tier has actually gone up.
    if(!ACHIEVEMENTS[key].tiered && known > 0) return;

    try{
      if(!ACHIEVEMENTS[key].tiered){
        const { data: existing } = await sb.from('user_achievements').select('id').eq('user_id', userId).eq('achievement_key', key).maybeSingle();
        if(existing){ __mqEarnedAchievementsCache[userId][key] = 1; return; }
      }

      // The database verifies the badge is genuinely earned (and computes
      // the tier, for tiered ones) before recording it; direct inserts from
      // the browser are disabled. Returns the new times_earned only when it
      // just went up; null if nothing changed.
      const { data: newTimesEarned, error } = await sb.rpc('award_achievement', { p_key: key });
      if(error) return; // function not created yet -- fail quietly, not user-facing
      if(!newTimesEarned || newTimesEarned <= known) return; // no change (or a race with another tab)
      __mqEarnedAchievementsCache[userId][key] = newTimesEarned;
      mqShowAchievementToast(key, newTimesEarned);
      // (Share prompts for Perfect Day / Rival Win are NOT fired from here:
      // a badge is earned once ever, but the prompt should fire on every
      // Perfect Day and every Showdown win. See loadShareCard and
      // renderRivalCard.)
    }catch(e){ /* decoration only -- never block the real action that triggered this */ }
  }

  // Lifetime/tiered achievements aren't tied to one specific action the way
  // Buddy Bonus or a Showdown win are -- they can tick up from something
  // that happened elsewhere (an admin resolving a day, a streak update), so
  // there's no single call site to hook. Call this wherever a good moment
  // naturally comes up (sign-in, opening the profile) to catch tier-ups.
  var STARTER_ACHIEVEMENT_KEYS = ['first_pick', 'first_correct', 'streak_3'];
  function mqCheckStarterBadges(userId){
    if(!userId) return;
    STARTER_ACHIEVEMENT_KEYS.forEach(function(key){ mqAwardAchievement(userId, key); });
  }
  function mqCheckTieredAchievements(userId){
    if(!userId) return;
    TIERED_ACHIEVEMENT_KEYS.forEach(function(key){ mqAwardAchievement(userId, key); });
    mqCheckStarterBadges(userId);
  }

  // Small non-blocking toast, distinct from the bigger streak-milestone
  // overlay since these are meant to feel frequent and light, not a huge
  // interruption every time.
  function mqShowAchievementToast(key, timesEarned){
    var meta = ACHIEVEMENTS[key];
    if(!meta) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var toast = document.createElement('div');
    toast.className = 'mq-achievement-toast';
    var titleText = (meta.tiered && timesEarned > 1) ? 'Achievement upgraded' : 'Achievement unlocked';
    toast.innerHTML =
      '<span class="mq-ach-icon">' + mqAchIcon(meta.icon) + '</span>' +
      '<div><div class="mq-ach-title"></div><div class="mq-ach-label"></div></div>';
    toast.querySelector('.mq-ach-title').textContent = titleText;
    toast.querySelector('.mq-ach-label').textContent = meta.label + (timesEarned > 1 ? ' ×' + timesEarned : '');
    document.body.appendChild(toast);
    requestAnimationFrame(function(){ toast.classList.add('on'); });
    var hide = function(){
      toast.classList.remove('on');
      setTimeout(function(){ toast.remove(); }, reduce ? 0 : 300);
    };
    setTimeout(hide, 4200);
  }

  function getTier(points){
    for(let i = 0; i < TIERS.length; i++){
      if(points >= TIERS[i].min) return TIERS[i].name;
    }
    return 'Rookie';
  }
  function getNextTier(points){
    // TIERS is ordered highest-to-lowest; find the lowest threshold still above points
    let next = null;
    for(let i = TIERS.length - 1; i >= 0; i--){
      if(TIERS[i].min > points){ next = TIERS[i]; break; }
    }
    return next;
  }
  // Count a percentage up from 0 (keeps the % sign); skips motion if the person asked for none.
  function mqPct(el, target){
    if(!el) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.innerHTML = (reduce ? target : 0) + '<span class="opt-pct">%</span>';
    if(reduce) return;
    var t0 = performance.now(), dur = 950;
    (function step(now){
      var t = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - t, 3);
      if(el.firstChild) el.firstChild.nodeValue = Math.round(e * target);
      if(t < 1) requestAnimationFrame(step);
    })(t0);
  }
  function animateNumber(el, target){
    if(!el) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce){ el.textContent = target.toLocaleString(); return; }
    const start = performance.now();
    const duration = 800 + Math.min(target, 400);
    function tick(now){
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if(t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  // Ticks a "N voted" footer count up from whatever number is currently
  // showing to the new total, instead of snapping straight to it. No-ops
  // (snaps) if the number didn't actually change or motion is reduced.
  function mqAnimateFootCount(el, newTotal){
    if(!el) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = parseInt((el.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
    if(reduce || newTotal <= current){ el.textContent = newTotal + ' voted'; return; }
    var start = performance.now(), dur = 700;
    (function step(now){
      var t = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(current + e * (newTotal - current)) + ' voted';
      if(t < 1) requestAnimationFrame(step);
    })(start);
  }

  async function loadMyStats(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;
    const { data } = await sb.from('streaks').select('*').eq('user_id', session.user.id).maybeSingle();

    const { data: profileRow } = await sb.from('profiles').select('username, avatar_emoji, avatar_color').eq('id', session.user.id).maybeSingle();
    if(profileRow){
      const circleBtn = document.getElementById('profile-circle-btn');
      const circleEmoji = document.getElementById('profile-circle-emoji');
      const usernameLabel = document.getElementById('nav-username');
      if(circleEmoji) circleEmoji.innerHTML = mqAvatarInner(profileRow.avatar_emoji || 'target', profileRow.username);
      if(circleBtn) circleBtn.style.background = profileRow.avatar_color || 'var(--panel)';
      if(usernameLabel) usernameLabel.textContent = profileRow.username || '';
      mqApplyFrame(circleBtn, session.user.id);
    }

    if(!data) return;

    const badge = document.getElementById('nav-badge');
    const myTier = getTier(data.total_points);
    if(badge){
      badge.style.display = 'flex';
      document.getElementById('nav-badge-label').textContent = myTier;
    }

    // Change 5 tier-up trigger: points only ever go up in this game, so a
    // changed tier from what was last seen is always a tier-UP, never down.
    // Stored per-user so a brand-new visitor's first-ever load (no prior
    // value) doesn't falsely fire as a "tier up".
    try{
      var tierKey = 'mq_last_tier_' + session.user.id;
      var lastTier = localStorage.getItem(tierKey);
      if(lastTier && lastTier !== myTier) mqMaybePromptShare(session.user.id, 'tier_up');
      localStorage.setItem(tierKey, myTier);
    }catch(e){ /* tier-up prompt is a nice-to-have, never block stats loading over it */ }

    const tierRow = document.getElementById('tier-row');
    if(tierRow){
      tierRow.querySelectorAll('[data-tier]').forEach(function(chip){
        chip.classList.toggle('active', chip.getAttribute('data-tier') === myTier);
      });
    }
  }

    // Named, curated palette. Order matters (first is the default for new profiles).
    const AVATAR_NAMES = {'#2B2E34':'Graphite','#4A5568':'Slate','#1E3A5F':'Midnight','#2F5D5A':'Spruce','#4A6B52':'Moss','#7A6E34':'Olive','#9A6B34':'Bronze','#A5513F':'Clay','#6E2F3F':'Burgundy','#5E4478':'Plum','#5B5F8A':'Dusk','#7A7E86':'Stone'};
    const AVATAR_COLORS = Object.keys(AVATAR_NAMES);
  let selectedAvatarEmoji = null;
  let selectedAvatarColor = null;

  function closeProfileModal(){
    document.getElementById('profile-modal-backdrop').style.display = 'none';
  }

  // MOVED: these buttons used to live inside the profile modal and only got
  // their on/off state set when that modal opened. Now they're in the
  // hamburger menu, which is present on every page load, so this runs
  // independently -- once at init, and again each time the menu opens so
  // it can't show stale state.
  //
  // REMOVED: the "turn off results emails" toggle used to live here too.
  // notify_on_resolve stays opt-out (on by default) exactly as before --
  // people who want off use the unsubscribe link in the email itself,
  // which already exists and works. This keeps the app's only ask focused
  // on push, since that's the one that actually needs a deliberate tap.
  async function loadNotificationSettings(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;

    const { data: profileRow } = await sb.from('profiles').select('notify_push').eq('id', session.user.id).maybeSingle();
    if(!profileRow) return;

    const pushOn = !!profileRow.notify_push;
    setNotifyPushBtn(pushOn);
    const msgEl = document.getElementById('notify-resolve-msg');
    if(msgEl) msgEl.textContent = '';
  }

  async function openProfileModal(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;

    const { data: profileRow } = await sb.from('profiles').select('username, created_at, avatar_emoji, avatar_color, notify_push, state, hide_from_leaderboard').eq('id', session.user.id).maybeSingle();
    const { data: streakRow } = await sb.from('streaks').select('*').eq('user_id', session.user.id).maybeSingle();
    if(!profileRow) return;

    selectedAvatarEmoji = mqAvatarPhoto(profileRow.avatar_emoji) ? profileRow.avatar_emoji : (mqAvatarKey(profileRow.avatar_emoji) || 'target');
    selectedAvatarColor = profileRow.avatar_color || '#2B2E34';

    const profileStateInput = document.getElementById('profile-state-input');
    if(profileStateInput) profileStateInput.value = profileRow.state || '';
    document.getElementById('profile-state-msg').textContent = '';

    const hideLeaderboardCheckbox = document.getElementById('profile-hide-leaderboard-checkbox');
    if(hideLeaderboardCheckbox) hideLeaderboardCheckbox.checked = !!profileRow.hide_from_leaderboard;
    const hideLeaderboardMsg = document.getElementById('profile-hide-leaderboard-msg');
    if(hideLeaderboardMsg) hideLeaderboardMsg.textContent = '';

    const achievementsGrid = document.getElementById('profile-achievements-grid');
    if(achievementsGrid){
      achievementsGrid.innerHTML = '';
      mqCheckTieredAchievements(session.user.id); // catch any tier-up since last visit before we render
      let earnedTimes = {};
      try{
        const { data: earnedRows } = await sb.from('user_achievements').select('achievement_key, times_earned').eq('user_id', session.user.id);
        (earnedRows || []).forEach(function(r){ earnedTimes[r.achievement_key] = r.times_earned || 1; });
      }catch(e){ /* table may not be migrated yet -- grid just shows everything as locked */ }
      Object.keys(ACHIEVEMENTS).forEach(function(key){
        const meta = ACHIEVEMENTS[key];
        const times = earnedTimes[key] || 0;
        const earned = times > 0;
        const badge = document.createElement('div');
        badge.className = 'mq-achievement-badge' + (earned ? ' earned' : '');
        badge.title = meta.desc + (earned ? (meta.tiered ? ' Tier ' + times + ' (' + (times * meta.tierSize) + '+ ' + meta.tierUnit + ').' : '') : ' (not yet earned)');
        badge.innerHTML = '<span class="mq-ach-badge-icon">' + mqAchIcon(meta.icon) + '</span><span class="mq-ach-badge-label"></span>' +
          (earned && times > 1 ? '<span class="mq-ach-badge-count">×' + times + '</span>' : '');
        badge.querySelector('.mq-ach-badge-label').textContent = meta.label;
        achievementsGrid.appendChild(badge);
      });
    }

    document.getElementById('profile-modal-avatar').innerHTML = mqAvatarInner(selectedAvatarEmoji, profileRow.username);
    document.getElementById('profile-modal-avatar').style.background = selectedAvatarColor;
    document.getElementById('profile-modal-username').textContent = profileRow.username;
    mqApplyFrame(document.getElementById('profile-modal-avatar'), session.user.id);
    if(profileRow.created_at){
      const since = new Date(profileRow.created_at);
      document.getElementById('profile-modal-since').textContent = 'Member since ' + since.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // All-time stats
    const statsEl = document.getElementById('profile-modal-stats');
    const myTier = streakRow ? getTier(streakRow.total_points) : 'Rookie';
    statsEl.innerHTML = '';
    [
      { label: 'Points', value: streakRow ? streakRow.total_points : 0, numeric: true },
      { label: 'Golden stars', value: streakRow ? streakRow.golden_stars : 5, star: true, numeric: true },
      { label: 'Tier', value: myTier, numeric: false },
      { label: 'Current streak', value: streakRow ? streakRow.current_streak : 0, numeric: true },
      { label: 'Longest streak', value: streakRow ? streakRow.longest_streak : 0, numeric: true }
    ].forEach(function(stat){
      const div = document.createElement('div');
      div.innerHTML = '<div style="font-size:20px; font-weight:700;"><span class="mq-stat-num"></span></div><div style="font-size:11.5px; color:var(--ink-soft);"></div>';
      const numWrap = div.firstChild;
      const numEl = numWrap.querySelector('.mq-stat-num');
      if(stat.numeric){
        animateNumber(numEl, Number(stat.value) || 0);
      }else{
        numEl.textContent = stat.value;
      }
      if(stat.star) numWrap.insertAdjacentHTML('beforeend', ' ' + mqStarGold(18));
      div.lastChild.textContent = stat.label;
      statsEl.appendChild(div);
    });

    const profileProgressWrap = document.getElementById('profile-tier-progress-wrap');
    const myPoints = streakRow ? streakRow.total_points : 0;
    const nextTier = getNextTier(myPoints);
    profileProgressWrap.style.display = 'block';
    if(nextTier){
      const currentTierMin = TIERS.find(function(t){ return t.name === myTier; }).min;
      const pct = Math.max(0, Math.min(100, ((myPoints - currentTierMin) / (nextTier.min - currentTierMin)) * 100));
      document.getElementById('profile-tier-progress-label').textContent = (nextTier.min - myPoints).toLocaleString() + ' pts to ' + nextTier.name;
      requestAnimationFrame(function(){
        document.getElementById('profile-tier-progress-bar').style.width = pct + '%';
      });
    }else{
      document.getElementById('profile-tier-progress-label').textContent = 'Top tier reached';
      requestAnimationFrame(function(){
        document.getElementById('profile-tier-progress-bar').style.width = '100%';
      });
    }

    // No icon picker any more: the avatar is your initial on a color, or an uploaded photo.
    function paintGlyphBorders(){}

    // Color picker
    const colorPicker = document.getElementById('avatar-color-picker');
    colorPicker.innerHTML = '';
    AVATAR_COLORS.forEach(function(color){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Color ' + (AVATAR_NAMES[color] || color));
      btn.title = AVATAR_NAMES[color] || color;
      btn.className = 'pc-swatch' + (color === selectedAvatarColor ? ' sel' : '');
      btn.style.background = color;
      btn.addEventListener('click', function(){
        selectedAvatarColor = color;
        document.getElementById('profile-modal-avatar').style.background = color;
        colorPicker.querySelectorAll('button').forEach(function(b){ b.classList.toggle('sel', b === btn); });
      });
      colorPicker.appendChild(btn);
    });
    document.getElementById('profile-customization-msg').textContent = '';

    // Photo upload: pick, crop to a square, shrink, upload to the avatars bucket.
    (function(){
      var fileInput = document.getElementById('avatar-photo-input');
      var upBtn = document.getElementById('avatar-photo-btn');
      var rmBtn = document.getElementById('avatar-photo-remove');
      var pmsg = document.getElementById('avatar-photo-msg');
      if(!fileInput || !upBtn) return;
      function syncRemove(){ if(rmBtn) rmBtn.style.display = mqAvatarPhoto(selectedAvatarEmoji) ? '' : 'none'; }
      syncRemove();
      upBtn.onclick = function(){ fileInput.click(); };
      if(rmBtn) rmBtn.onclick = function(){
        selectedAvatarEmoji = 'target';
        document.getElementById('profile-modal-avatar').innerHTML = mqAvatarInner('target', profileRow.username);
        paintGlyphBorders(); syncRemove(); pmsg.textContent = 'Photo removed. Press Save to keep it.'; pmsg.className = 'form-msg';
      };
      fileInput.onchange = async function(){
        var f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if(!f) return;
        pmsg.className = 'form-msg';
        if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) && f.type.indexOf('image/') !== 0){ pmsg.className = 'form-msg err'; pmsg.textContent = 'Pick an image file.'; return; }
        if(f.size > 12 * 1024 * 1024){ pmsg.className = 'form-msg err'; pmsg.textContent = 'That photo is too big. Try one under 12 MB.'; return; }
        upBtn.disabled = true;
        try{
          var blob = await mqCropPhoto(f);
          if(!blob){ pmsg.textContent = ''; upBtn.disabled = false; return; }
          pmsg.textContent = 'Uploading…';
          if(!blob) throw new Error('Could not read that photo.');
          var path = session.user.id + '/avatar-' + Date.now() + '.jpg';
          var up = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
          if(up.error) throw up.error;
          var pub = sb.storage.from('avatars').getPublicUrl(path);
          selectedAvatarEmoji = 'photo:' + pub.data.publicUrl;
          document.getElementById('profile-modal-avatar').innerHTML = mqAvatarInner(selectedAvatarEmoji, profileRow.username);
          paintGlyphBorders(); syncRemove();
          pmsg.className = 'form-msg ok'; pmsg.textContent = 'Looking good. Press Save to keep it.';
        }catch(err){
          pmsg.className = 'form-msg err';
          pmsg.textContent = (err && /bucket|not found/i.test(err.message || '')) ? 'Photo uploads are not switched on yet.' : ((err && err.message) || 'Could not upload that photo.');
        }
        upBtn.disabled = false;
      };
    })();

    // Picks history — all-time accuracy computed from the full set, most recent 30 shown
    const { data: picks } = await sb
      .from('predictions')
      .select('choice, created_at, daily_questions!inner(question_text, category, question_date, correct_answer, resolved, voided, void_reason)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    const picksList = document.getElementById('profile-picks-list');
    picksList.innerHTML = '';

    // Accuracy by category: a solo-friendly stat that needs no friends or
    // groups -- "you're 80% on sports" gives a player something to chase.
    var catAccEl = document.getElementById('profile-category-acc');
    if(!catAccEl){
      catAccEl = document.createElement('div');
      catAccEl.id = 'profile-category-acc';
      catAccEl.style.cssText = 'display:flex; gap:8px; margin:0 0 10px;';
      picksList.parentNode.insertBefore(catAccEl, picksList);
      catAccEl.insertAdjacentHTML('beforebegin', '<div class="pc-label" style="margin:0 0 8px;">Accuracy, last 5 weeks</div>');
    }
    catAccEl.innerHTML = '';
    var catTotals = {};
    // Same window and rules as "Your record": last 5 weeks (Monday-aligned), voided calls left out.
    var recStart = (function(){
      var t0 = new Date(getETDateInfo().dateStr + 'T12:00:00Z');
      var ix = (t0.getUTCDay() + 6) % 7;
      return new Date(t0.getTime() - (ix + 28) * 86400000).toISOString().slice(0, 10);
    })();
    (picks || []).forEach(function(p){
      var q = p.daily_questions;
      if(!q || !q.resolved || q.voided || !q.correct_answer) return;
      if(q.question_date < recStart) return;
      var t = catTotals[q.category] || (catTotals[q.category] = { right: 0, total: 0 });
      t.total++;
      if(p.choice === q.correct_answer) t.right++;
    });
    Object.keys(CATEGORY_LABELS).forEach(function(cat){
      var t = catTotals[cat];
      var tile = document.createElement('div');
      tile.style.cssText = 'flex:1; padding:10px 8px; background:var(--panel); border:1px solid var(--line); border-radius:10px; text-align:center;';
      var pct = t && t.total ? Math.round(100 * t.right / t.total) + '%' : '\u2014';
      tile.innerHTML = '<div style="font-size:18px; font-weight:700;">' + pct + '</div>' +
        '<div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">' + CATEGORY_LABELS[cat] + (t && t.total ? ' \u00b7 ' + t.right + '/' + t.total : '') + '</div>';
      catAccEl.appendChild(tile);
    });
    if(!picks || picks.length === 0){
      picksList.innerHTML = '<p class="ex-sub">No picks yet — head to Play to make your first call.</p>';
    }else{
      picks.slice(0, 30).forEach(function(p){
        const q = p.daily_questions;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--panel); border:1px solid var(--line); border-radius:10px;';
        let resultBadge = '<span style="font-size:11px; color:var(--ink-soft);">Pending</span>';
        if(q.voided){
          resultBadge = '<span style="font-size:11px; font-weight:700; color:var(--ink-soft);">Void</span>';
        }else if(q.resolved){
          const wasCorrect = p.choice === q.correct_answer;
          resultBadge = '<span style="font-size:11px; font-weight:700; color:' + (wasCorrect ? 'var(--yes)' : 'var(--no)') + ';">' + (wasCorrect ? 'Correct' : 'Missed') + '</span>';
        }
        const dateLabel = q.question_date;
        const catLabel = CATEGORY_LABELS[q.category] || q.category;
        row.innerHTML =
          '<div style="flex:1; min-width:0;">' +
            '<div class="q-text" style="font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>' +
            '<div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">' + dateLabel + ' · ' + catLabel + ' · Called ' + p.choice.toUpperCase() + '</div>' +
            (q.voided ? '<div class="void-why" style="font-size:11px; color:var(--ink-soft); margin-top:2px;"></div>' : '') +
          '</div>' + resultBadge;
        row.querySelector('.q-text').textContent = q.question_text;
        var voidWhy = row.querySelector('.void-why');
        if(voidWhy) voidWhy.textContent = 'Voided' + (q.void_reason ? ' — ' + q.void_reason : '') + '. No points either way.';
        picksList.appendChild(row);
      });
      // Your latest three stay in view; the rest sit behind a dropdown.
      mqFoldList(picksList, 3, { one: 'earlier pick', many: 'earlier picks' });
    }

    document.getElementById('profile-modal-backdrop').style.display = 'flex';
  }

  const profileCircleBtn = document.getElementById('profile-circle-btn');
  if(profileCircleBtn) profileCircleBtn.addEventListener('click', function(e){ e.stopPropagation(); openProfileModal(); });
  ['nav-profile-pill', 'nav-badge'].forEach(function(id){
    var el = document.getElementById(id); if(!el) return;
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('title', 'Your tier, points, picks and stars');
    el.addEventListener('click', openProfileModal);
    el.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openProfileModal(); } });
  });

  const profileModalCloseBtn = document.getElementById('profile-modal-close');
  if(profileModalCloseBtn) profileModalCloseBtn.addEventListener('click', closeProfileModal);

  const profileModalBackdrop = document.getElementById('profile-modal-backdrop');
  if(profileModalBackdrop){
    profileModalBackdrop.addEventListener('click', function(e){
      if(e.target === profileModalBackdrop) closeProfileModal();
    });
  }

  const saveProfileBtn = document.getElementById('save-profile-customization-btn');
  if(saveProfileBtn){
    saveProfileBtn.addEventListener('click', async function(){
      const { data: sessionRes } = await sb.auth.getSession();
      const session = sessionRes && sessionRes.session;
      const msg = document.getElementById('profile-customization-msg');
      if(!session) return;
      msg.className = 'form-msg';
      msg.textContent = 'Saving…';
      const { error } = await sb.from('profiles').update({
        avatar_emoji: selectedAvatarEmoji,
        avatar_color: selectedAvatarColor
      }).eq('id', session.user.id);
      if(error){
        msg.className = 'form-msg err';
        msg.textContent = 'Could not save — try again.';
        return;
      }
      msg.className = 'form-msg ok';
      msg.textContent = 'Saved!';
      const circleEmoji = document.getElementById('profile-circle-emoji');
      const circleBtn = document.getElementById('profile-circle-btn');
      if(circleEmoji) circleEmoji.innerHTML = mqAvatarInner(selectedAvatarEmoji, (document.getElementById('profile-modal-username') || {}).textContent || '');
      if(circleBtn) circleBtn.style.background = selectedAvatarColor;
    });
  }

  function setNotifyPushBtn(on){
    const btn = document.getElementById('notify-push-btn');
    if(!btn) return;
    btn.textContent = on ? 'Turn off push notifications' : 'Turn on push notifications';
    btn.dataset.on = on ? '1' : '0';
  }

  const saveProfileStateBtn = document.getElementById('save-profile-state-btn');
  if(saveProfileStateBtn){
    saveProfileStateBtn.addEventListener('click', async function(){
      const { data: sessionRes } = await sb.auth.getSession();
      const session = sessionRes && sessionRes.session;
      const msg = document.getElementById('profile-state-msg');
      const input = document.getElementById('profile-state-input');
      if(!session) return;
      const newState = toTitleCase(input.value);
      if(!newState){
        msg.className = 'form-msg err';
        msg.textContent = 'Enter a state first.';
        return;
      }
      const btn = this;
      btn.disabled = true;
      const { error } = await sb.from('profiles').update({ state: newState }).eq('id', session.user.id);
      btn.disabled = false;
      if(error){
        msg.className = 'form-msg err';
        msg.textContent = 'Could not save \u2014 try again.';
        return;
      }
      msg.className = 'form-msg ok';
      msg.textContent = 'Saved!';
    });
  }

  // Leaderboard privacy toggle: saves immediately on change, same pattern as
  // the push notification button -- no separate Save button needed since
  // it's a single checkbox, not a form with multiple fields.
  const hideLeaderboardCheckbox = document.getElementById('profile-hide-leaderboard-checkbox');
  if(hideLeaderboardCheckbox){
    hideLeaderboardCheckbox.addEventListener('change', async function(){
      const { data: sessionRes } = await sb.auth.getSession();
      const session = sessionRes && sessionRes.session;
      const msg = document.getElementById('profile-hide-leaderboard-msg');
      if(!session) return;
      const nextVal = this.checked;
      this.disabled = true;
      const { error } = await sb.from('profiles').update({ hide_from_leaderboard: nextVal }).eq('id', session.user.id);
      this.disabled = false;
      if(error){
        this.checked = !nextVal; // revert the visual state on failure
        if(msg){ msg.className = 'form-msg err'; msg.textContent = 'Could not save \u2014 try again.'; }
        return;
      }
      if(msg){
        msg.className = 'form-msg ok';
        msg.textContent = nextVal ? 'You\u2019re hidden from public leaderboards.' : 'You\u2019re visible on leaderboards again.';
      }
    });
  }

  const notifyPushBtn = document.getElementById('notify-push-btn');
  if(notifyPushBtn){
    notifyPushBtn.addEventListener('click', async function(){
      const { data: sessionRes } = await sb.auth.getSession();
      const session = sessionRes && sessionRes.session;
      const msg = document.getElementById('notify-resolve-msg');
      if(!session) return;
      const wasOn = this.dataset.on === '1';
      const nextOn = !wasOn;

      const registration = await swRegistrationPromise;
      if(!registration){
        msg.className = 'form-msg err';
        msg.textContent = mqPushUnsupportedMsg();
        return;
      }

      if(nextOn){
        // Turning on: ask the browser for notification permission first. If the
        // person denies it (or the browser doesn't support it), don't save it as on.
        if(typeof Notification === 'undefined' || !Notification.requestPermission){
          msg.className = 'form-msg err';
          msg.textContent = mqPushUnsupportedMsg();
          return;
        }
        try{
          const perm = await Notification.requestPermission();
          if(perm !== 'granted'){
            msg.className = 'form-msg err';
            msg.textContent = 'Notifications are blocked in your browser settings.';
            return;
          }
        }catch(e){
          msg.className = 'form-msg err';
          msg.textContent = mqPushUnsupportedMsg();
          return;
        }

        let subscription;
        try{
          subscription = await registration.pushManager.getSubscription();
          if(!subscription){
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
          }
        }catch(e){
          msg.className = 'form-msg err';
          msg.textContent = 'Could not turn on push notifications \u2014 try again.';
          return;
        }

        const subJson = subscription.toJSON();
        const { error: subError } = await sb.from('push_subscriptions').upsert({
          user_id: session.user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        }, { onConflict: 'endpoint' });
        if(subError){
          msg.className = 'form-msg err';
          msg.textContent = 'Could not save \u2014 try again.';
          return;
        }
      } else {
        // Turning off: unsubscribe this device and drop every saved
        // subscription for this account -- notify_push is one on/off switch
        // per account, not per device, so off means off everywhere.
        try{
          const subscription = await registration.pushManager.getSubscription();
          if(subscription) await subscription.unsubscribe();
        }catch(e){ /* best-effort -- still proceed to clear the DB rows below */ }
        await sb.from('push_subscriptions').delete().eq('user_id', session.user.id);
      }

      const { error } = await sb.from('profiles').update({ notify_push: nextOn }).eq('id', session.user.id);
      if(error){
        msg.className = 'form-msg err';
        msg.textContent = 'Could not save \u2014 try again.';
        return;
      }
      setNotifyPushBtn(nextOn);
      msg.className = 'form-msg ok';
      msg.textContent = nextOn ? 'Push notifications are on.' : 'Turned off.';
    });
  }

  // Buddies and rivals: Marqit supports any number of each, so these
  // sections always render a LIST rather than a single fixed slot. Adding
  // a buddy/rival never blocks on "you already have one" -- only a
  // duplicate relationship with that same specific person is blocked.

  document.getElementById('set-buddy-btn').addEventListener('click', async function(){
    const btn = this;
    const msg = document.getElementById('buddy-msg');
    const input = document.getElementById('buddy-username-input');
    const uname = input.value.trim();
    msg.className = 'form-msg';
    if(!uname){ msg.classList.add('err'); msg.textContent = 'Enter a username.'; return; }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){ msg.classList.add('err'); msg.textContent = 'Sign in above first.'; return; }

    btn.disabled = true;
    const { data: buddyProfile, error: lookupErr } = await sb.from('profiles').select('id').ilike('username', mqEscapeIlike(uname)).maybeSingle();
    if(lookupErr || !buddyProfile){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'No user found with that username.'; return; }
    if(buddyProfile.id === session.user.id){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'You can\'t buddy with yourself.'; return; }

    const { data: already } = await sb.from('buddies').select('buddy_id').eq('user_id', session.user.id).eq('buddy_id', buddyProfile.id).maybeSingle();
    if(already){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'You\'re already buddies with ' + uname + '.'; return; }

    const { error } = await sb.from('buddy_requests').insert({ from_user_id: session.user.id, to_user_id: buddyProfile.id });
    btn.disabled = false;
    if(error){
      msg.classList.add('err');
      msg.textContent = error.code === '23505' ? 'You already have a pending request to them.' : ('Error: ' + error.message);
      return;
    }
    msg.classList.add('ok');
    msg.textContent = 'Request sent to ' + uname + '.';
    input.value = '';
    loadBuddySection();
  });

  // Delegated (not addEventListener per-button) because these rows are
  // rendered dynamically -- one per pending request or accepted buddy.
  document.getElementById('buddy-pending-list').addEventListener('click', async function(e){
    const btn = e.target.closest('.cancel-buddy-request-btn');
    if(!btn) return;
    await sb.from('buddy_requests').delete().eq('id', btn.getAttribute('data-request-id'));
    loadBuddySection();
  });

  document.getElementById('buddy-active-list').addEventListener('click', async function(e){
    const remindBtn = e.target.closest('.remind-btn');
    if(remindBtn){ mqRemindFriend(remindBtn, document.getElementById('buddy-msg')); return; }
    const btn = e.target.closest('.remove-buddy-btn');
    if(!btn) return;
    await sb.rpc('remove_buddy', { p_buddy_id: btn.getAttribute('data-buddy-id') });
    loadBuddySection();
  });

  // Show the first few rows of a long list and tuck the rest behind a "Show N more" dropdown.
  // Safe to call again after the list changes: it unwraps any earlier dropdown first.
  function mqFoldList(listEl, keep, words){
    if(!listEl) return;
    var old = null;
    for(var i = 0; i < listEl.children.length; i++){
      if(listEl.children[i].classList && listEl.children[i].classList.contains('mq-list-more')){ old = listEl.children[i]; break; }
    }
    if(old){
      Array.prototype.slice.call(old.children).forEach(function(c){ if(c.tagName !== 'SUMMARY') listEl.insertBefore(c, old); });
      old.remove();
    }
    var rows = Array.prototype.slice.call(listEl.children);
    if(rows.length <= keep) return;
    var extra = rows.slice(keep), n = extra.length;
    var d = document.createElement('details');
    d.className = 'mycalls-more mq-list-more';
    d.innerHTML = '<summary><span class="mm-closed">Show ' + n + ' ' + (n === 1 ? words.one : words.many) + '</span><span class="mm-open">Show less</span>' +
      '<svg class="mm-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>';
    extra.forEach(function(c){ d.appendChild(c); });
    listEl.appendChild(d);
  }


  // Five-item rule for lists that are rebuilt by other code (leaderboards, group boards):
  // whenever one of them changes, show the first five rows and tuck the rest into a dropdown.
  function mqAutoFold(id, keep, words){
    var el = document.getElementById(id);
    if(!el || typeof MutationObserver === 'undefined') return;
    var obs;
    function run(){
      obs.disconnect();
      try{ mqFoldList(el, keep, words); }catch(e){}
      obs.observe(el, { childList: true });
    }
    obs = new MutationObserver(run);
    run();
  }
  mqAutoFold('big-board-rows', 5, { one: 'more player', many: 'more players' });
  mqAutoFold('board-state', 5, { one: 'more player', many: 'more players' });
  mqAutoFold('board-group', 5, { one: 'more member', many: 'more members' });
  mqAutoFold('board-group-participation', 5, { one: 'more member', many: 'more members' });

  // ===== Friends' results feed =====
  // One row per person per day for the people you follow plus your buddies. Comes from
  // get_friends_feed (see supabase/migrations/20261015_friends_feed.sql); if that function
  // isn't deployed yet the section simply stays hidden.
  function mqFeedDayLabel(ymd){
    try{
      var today = getETDateInfo().dateStr;
      if(ymd === today) return 'Today';
      var y = new Date(today + 'T12:00:00Z'); y.setUTCDate(y.getUTCDate() - 1);
      if(ymd === y.toISOString().slice(0, 10)) return 'Yesterday';
      return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    }catch(e){ return ymd; }
  }
  function mqFeedRowHtml(r){
    var color = /^#[0-9A-Fa-f]{6}$/.test(r.avatar_color || '') ? r.avatar_color : '#2C2F37';
    var calls = Number(r.calls) || 0, right = Number(r.correct) || 0;
    var perfect = calls >= 3 && right === calls;
    var pips = '';
    for(var i = 0; i < calls; i++) pips += '<i class="' + (i < right ? 'on' : 'off') + '"></i>';
    var streak = Number(r.streak) || 0;
    return '<div class="feed-item' + (perfect ? ' perfect' : '') + '">' +
      '<i class="lb-av" style="background:' + color + ';">' + mqAvatarInner(r.avatar_emoji, r.username) + '</i>' +
      '<div class="fi-main">' +
        '<div class="fi-top"><b>' + escapeHtml(r.username || 'player') + '</b>' + (r.is_buddy ? '<em class="fi-tag">Buddy</em>' : '') + '<span class="fi-day">' + escapeHtml(mqFeedDayLabel(r.qdate)) + '</span></div>' +
        '<div class="fi-line">' + (perfect ? '<span class="fi-perfect">' + mqIcon('star') + 'Perfect Day</span>' : '<span>' + right + ' of ' + calls + ' right</span>') +
          (streak >= 3 ? '<span class="fi-streak">' + mqIcon('flame') + streak + '</span>' : '') + '</div>' +
      '</div>' +
      '<span class="fi-pips" aria-hidden="true">' + pips + '</span>' +
    '</div>';
  }
  async function loadFriendsFeed(){
    var fold = document.getElementById('fold-feed'), list = document.getElementById('feed-list'), badge = document.getElementById('feed-fold-count');
    if(!fold || !list) return;
    try{
      var res = await sb.rpc('get_friends_feed', { p_limit: 30 });
      if(res.error){ fold.style.display = 'none'; return; }
      var rows = res.data || [];
      fold.style.display = '';
      if(!rows.length){
        list.innerHTML = '<div class="feed-empty"><b>Nobody to show yet</b><span>Follow strong callers or add a buddy and their scored days land here.</span><button type="button" id="feed-find-btn" class="es-btn">Find people to follow</button></div>';
        if(badge) badge.style.display = 'none';
        var fb = document.getElementById('feed-find-btn');
        if(fb) fb.addEventListener('click', function(){ var pc = document.getElementById('profile-circle-btn'); if(pc) pc.click(); });
        return;
      }
      list.innerHTML = rows.map(mqFeedRowHtml).join('');
      mqFoldList(list, 3, { one: 'more result', many: 'more results' });
      if(badge){ badge.textContent = String(rows.length); badge.style.display = ''; }
    }catch(e){ fold.style.display = 'none'; }
  }

  async function loadBuddySection(){
    const pendingListEl = document.getElementById('buddy-pending-list');
    const activeListEl = document.getElementById('buddy-active-list');
    if(!pendingListEl) return;

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){
      pendingListEl.innerHTML = '';
      activeListEl.innerHTML = '';
      return;
    }

    const [{ data: buddyRows }, { data: pendingRows }] = await Promise.all([
      sb.from('buddies').select('buddy_id, profiles!buddies_buddy_id_fkey(username)').eq('user_id', session.user.id),
      sb.from('buddy_requests').select('id, profiles!buddy_requests_to_user_id_fkey(username)').eq('from_user_id', session.user.id).eq('status', 'pending')
    ]);

    activeListEl.innerHTML = (buddyRows || []).map(function(r){
      const name = r.profiles ? escapeHtml(r.profiles.username) : 'them';
      return '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--yes-bg); border:1px solid var(--yes); border-radius:10px; padding:12px 14px;">' +
        '<span style="font-size:13.5px; color:var(--yes);">Buddy: <strong>' + name + '</strong></span>' +
        '<span style="display:flex; gap:6px; flex:none;">' +
          '<button type="button" class="remind-btn" data-user-id="' + r.buddy_id + '" data-username="' + name + '" style="padding:6px 12px; border:1px solid var(--yes); border-radius:8px; background:none; color:var(--yes); font-weight:600; font-size:12.5px; cursor:pointer; white-space:nowrap;">Remind</button>' +
          '<button type="button" class="remove-buddy-btn" data-buddy-id="' + r.buddy_id + '" style="padding:6px 12px; border:1px solid var(--line); border-radius:8px; background:none; color:var(--ink-soft); font-weight:600; font-size:12.5px; cursor:pointer; white-space:nowrap;">Remove</button>' +
        '</span>' +
      '</div>';
    }).join('');

    pendingListEl.innerHTML = (pendingRows || []).map(function(r){
      const name = r.profiles ? escapeHtml(r.profiles.username) : 'them';
      return '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px;">' +
        '<span style="font-size:13.5px;">Waiting on <strong>' + name + '</strong> to accept.</span>' +
        '<button type="button" class="cancel-buddy-request-btn" data-request-id="' + r.id + '" style="padding:6px 12px; border:1px solid var(--line); border-radius:8px; background:none; color:var(--ink-soft); font-weight:600; font-size:12.5px; cursor:pointer; white-space:nowrap;">Cancel</button>' +
      '</div>';
    }).join('');

    mqFoldList(pendingListEl, 3, { one: 'more request', many: 'more requests' });
    mqFoldList(activeListEl, 3, { one: 'more buddy', many: 'more buddies' });
  }

  document.getElementById('set-rival-btn').addEventListener('click', async function(){
    const btn = this;
    const msg = document.getElementById('rival-msg');
    const input = document.getElementById('rival-username-input');
    const uname = input.value.trim();
    msg.className = 'form-msg';
    if(!uname){ msg.classList.add('err'); msg.textContent = 'Enter a username.'; return; }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){ msg.classList.add('err'); msg.textContent = 'Sign in above first.'; return; }

    btn.disabled = true;
    const { data: rivalProfile, error: lookupErr } = await sb.from('profiles').select('id').ilike('username', mqEscapeIlike(uname)).maybeSingle();
    if(lookupErr || !rivalProfile){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'No user found with that username.'; return; }
    if(rivalProfile.id === session.user.id){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'You can\'t rival yourself.'; return; }

    const { data: already } = await sb.from('rivals').select('rival_id').eq('user_id', session.user.id).eq('rival_id', rivalProfile.id).maybeSingle();
    if(already){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'You\'re already rivals with ' + uname + '.'; return; }

    const { error } = await sb.from('rival_requests').insert({ from_user_id: session.user.id, to_user_id: rivalProfile.id });
    btn.disabled = false;
    if(error){
      msg.classList.add('err');
      msg.textContent = error.code === '23505' ? 'You already have a pending request to them.' : ('Error: ' + error.message);
      return;
    }
    msg.classList.add('ok');
    msg.textContent = 'Request sent to ' + uname + '.';
    input.value = '';
    loadRivalSection();
  });

  document.getElementById('rival-pending-list').addEventListener('click', async function(e){
    const btn = e.target.closest('.cancel-rival-request-btn');
    if(!btn) return;
    await sb.from('rival_requests').delete().eq('id', btn.getAttribute('data-request-id'));
    loadRivalSection();
  });

  // Remove + activate both live inside dynamically-rendered duel cards, so
  // one delegated listener on the list container handles every card.
  document.getElementById('rival-active-list').addEventListener('click', async function(e){
    const remindBtn = e.target.closest('.remind-btn');
    if(remindBtn){
      const rc = remindBtn.closest('.rival-duel-card');
      remindBtn.setAttribute('data-user-id', rc.getAttribute('data-rival-id'));
      remindBtn.setAttribute('data-username', rc.querySelector('.rival-active-name').textContent);
      mqRemindFriend(remindBtn, document.getElementById('rival-msg'));
      return;
    }
    const removeBtn = e.target.closest('.remove-rival-btn');
    if(removeBtn){
      const card = removeBtn.closest('.rival-duel-card');
      await sb.rpc('remove_rival', { p_rival_id: card.getAttribute('data-rival-id') });
      loadRivalSection();
      return;
    }
    const activateBtn = e.target.closest('.activate-duel-btn');
    if(activateBtn){
      const card = activateBtn.closest('.rival-duel-card');
      const msg = document.getElementById('rival-msg');
      msg.className = 'form-msg';
      activateBtn.disabled = true;
      const { error } = await sb.rpc('activate_rival_duel', { p_rival_id: card.getAttribute('data-rival-id') });
      activateBtn.disabled = false;
      if(error){
        msg.classList.add('err');
        msg.textContent = error.message || 'Could not start the Showdown \u2014 try again.';
        return;
      }
      loadRivalSection();
    }
  });

  function setShowdownResult(el, kind, text){
    el.className = 'rival-duel-last-result duel-last ' + kind;
    el.innerHTML = mqIcon(kind === 'win' ? 'trophy' : (kind === 'loss' ? 'arrowDown' : 'scale')) + '<span>' + escapeHtml(text) + '</span>';
  }

  // Builds one Showdown card for one specific rival. Each rival's duel
  // state (activated today? won yesterday?) is tracked independently --
  // you can be mid-Showdown with several rivals at once.
  async function renderRivalCard(session, rivalId, rivalName, myStars){
    const template = document.getElementById('rival-duel-card-template');
    const card = template.content.firstElementChild.cloneNode(true);
    card.setAttribute('data-rival-id', rivalId);
    card.querySelector('.rival-active-name').textContent = rivalName;
    card.querySelector('.rival-duel-waiting-name').textContent = rivalName;

    const notActivatedEl = card.querySelector('.rival-duel-not-activated');
    const noStarsEl = card.querySelector('.rival-duel-no-stars');
    const youActivatedEl = card.querySelector('.rival-duel-you-activated');
    const bothActivatedEl = card.querySelector('.rival-duel-both-activated');
    const lastResultEl = card.querySelector('.rival-duel-last-result');

    const todayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const [{ data: myAct }, { data: theirAct }] = await Promise.all([
      sb.from('rival_duel_activations').select('user_id').eq('duel_date', todayET).eq('user_id', session.user.id).eq('rival_user_id', rivalId).maybeSingle(),
      sb.from('rival_duel_activations').select('user_id').eq('duel_date', todayET).eq('user_id', rivalId).eq('rival_user_id', session.user.id).maybeSingle()
    ]);
    const youIn = !!myAct;
    const rivalIn = !!theirAct;

    // If you're out of stars and haven't already activated today, swap the
    // button out for an explanatory line instead of leaving a clickable
    // button that would just fail on tap.
    const canActivate = youIn || myStars > 0;
    notActivatedEl.style.display = (!youIn && canActivate) ? '' : 'none';
    noStarsEl.style.display = (!youIn && !canActivate) ? '' : 'none';
    youActivatedEl.style.display = (youIn && !rivalIn) ? '' : 'none';
    bothActivatedEl.style.display = (youIn && rivalIn) ? '' : 'none';

    // Show what happened in yesterday's duel with THIS rival specifically,
    // if one actually happened (both sides activated) and it's resolved.
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(yesterdayDate);
    const [{ data: myYAct }, { data: theirYAct }] = await Promise.all([
      sb.from('rival_duel_activations').select('user_id').eq('duel_date', yesterdayET).eq('user_id', session.user.id).eq('rival_user_id', rivalId).maybeSingle(),
      sb.from('rival_duel_activations').select('user_id').eq('duel_date', yesterdayET).eq('user_id', rivalId).eq('rival_user_id', session.user.id).maybeSingle()
    ]);
    const duelHappenedYesterday = !!myYAct && !!theirYAct;

    if(duelHappenedYesterday){
      const [{ data: myPreds }, { data: rivalPreds }] = await Promise.all([
        sb.from('predictions').select('choice, daily_questions!inner(question_date, resolved, correct_answer)').eq('user_id', session.user.id).eq('daily_questions.question_date', yesterdayET),
        sb.from('predictions').select('choice, daily_questions!inner(question_date, resolved, correct_answer)').eq('user_id', rivalId).eq('daily_questions.question_date', yesterdayET)
      ]);
      const countCorrect = function(rows){
        return (rows || []).filter(function(r){ return r.daily_questions.resolved && r.choice === r.daily_questions.correct_answer; }).length;
      };
      const allResolved = (myPreds || []).length > 0 && (myPreds || []).every(function(r){ return r.daily_questions.resolved; });
      if(allResolved){
        const myCorrect = countCorrect(myPreds);
        const rivalCorrect = countCorrect(rivalPreds);
        lastResultEl.style.display = '';
        if(myCorrect > rivalCorrect){
          setShowdownResult(lastResultEl, 'win', 'Yesterday\u2019s Showdown: you won ' + myCorrect + '-' + rivalCorrect + ' and took a star from ' + rivalName + '.');
          mqAwardAchievement(session.user.id, 'rival_win');
          mqMaybePromptShare(session.user.id, 'rival_win', yesterdayET + '_' + rivalId);
        }else if(rivalCorrect > myCorrect){
          setShowdownResult(lastResultEl, 'loss', 'Yesterday\u2019s Showdown: ' + rivalName + ' won ' + rivalCorrect + '-' + myCorrect + ' and took one of your stars.');
        }else{
          setShowdownResult(lastResultEl, 'tie', 'Yesterday\u2019s Showdown: tied ' + myCorrect + '-' + rivalCorrect + ' \u2014 no star changed hands.');
        }
      }else{
        lastResultEl.style.display = 'none';
      }
    }else{
      lastResultEl.style.display = 'none';
    }

    return card;
  }

  async function loadRivalSection(){
    const pendingListEl = document.getElementById('rival-pending-list');
    const activeListEl = document.getElementById('rival-active-list');
    if(!pendingListEl) return;

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){
      pendingListEl.innerHTML = '';
      activeListEl.innerHTML = '';
      return;
    }

    const [{ data: rivalRows }, { data: pendingRows }, { data: myStreak }] = await Promise.all([
      sb.from('rivals').select('rival_id, profiles!rivals_rival_id_fkey(username)').eq('user_id', session.user.id),
      sb.from('rival_requests').select('id, profiles!rival_requests_to_user_id_fkey(username)').eq('from_user_id', session.user.id).eq('status', 'pending'),
      sb.from('streaks').select('golden_stars').eq('user_id', session.user.id).maybeSingle()
    ]);
    const myStars = myStreak ? myStreak.golden_stars : 5;

    pendingListEl.innerHTML = (pendingRows || []).map(function(r){
      const name = r.profiles ? escapeHtml(r.profiles.username) : 'them';
      return '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px;">' +
        '<span style="font-size:13.5px;">Waiting on <strong>' + name + '</strong> to accept.</span>' +
        '<button type="button" class="cancel-rival-request-btn" data-request-id="' + r.id + '" style="padding:6px 12px; border:1px solid var(--line); border-radius:8px; background:none; color:var(--ink-soft); font-weight:600; font-size:12.5px; cursor:pointer; white-space:nowrap;">Cancel</button>' +
      '</div>';
    }).join('');

    mqFoldList(pendingListEl, 3, { one: 'more request', many: 'more requests' });
    activeListEl.innerHTML = '';
    for(const r of (rivalRows || [])){
      const name = r.profiles ? r.profiles.username : 'your rival';
      const card = await renderRivalCard(session, r.rival_id, name, myStars);
      activeListEl.appendChild(card);
    }
    // Nobody to duel yet? Everyone still gets a rival: the crowd.
    if(!(rivalRows || []).length){
      try{ const crowdCard = await mqRenderCrowdRivalCard(session); if(crowdCard) activeListEl.appendChild(crowdCard); }
      catch(e){ /* decoration only */ }
    }
    mqFoldList(activeListEl, 3, { one: 'more rival', many: 'more rivals' });
  }

  // "You vs The Crowd": on the player's most recent fully scored day, compare
  // their correct calls to how often the majority side was right. Needs no
  // friends, so a solo player always has someone to beat.
  async function mqRenderCrowdRivalCard(session){
    const { data: rows } = await sb.from('predictions')
      .select('choice, daily_questions!inner(id, question_date, resolved, correct_answer)')
      .eq('user_id', session.user.id)
      .eq('daily_questions.resolved', true)
      .order('created_at', { ascending: false })
      .limit(12);
    if(!rows || !rows.length) return null;
    const day = rows[0].daily_questions.question_date;
    const dayRows = rows.filter(function(r){ return r.daily_questions.question_date === day && r.daily_questions.correct_answer; });
    if(!dayRows.length) return null;
    let mine = 0, crowd = 0, counted = 0;
    for(const r of dayRows){
      const vd = await getVoteData(r.daily_questions.id);
      const yes = vd.counts.yes, no = vd.counts.no;
      if(yes + no < 3 || yes === no) continue; // too few votes (or a tie) to call a crowd side
      counted++;
      const crowdSide = yes > no ? 'yes' : 'no';
      if(r.choice === r.daily_questions.correct_answer) mine++;
      if(crowdSide === r.daily_questions.correct_answer) crowd++;
    }
    if(!counted) return null;
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px;';
    const verdict = mine > crowd ? 'You beat the crowd.' : (mine === crowd ? 'You matched the crowd.' : 'The crowd edged you out.');
    card.innerHTML = '<div style="font-size:12px; font-weight:700; letter-spacing:.04em; color:var(--ink-soft); text-transform:uppercase;">You vs The Crowd \u00b7 ' + escapeHtml(day) + '</div>' +
      '<div style="font-size:22px; font-weight:700; margin:6px 0 2px;">You ' + mine + ' \u2013 ' + crowd + ' Crowd</div>' +
      '<div style="font-size:13px; color:var(--ink-soft);">' + verdict + ' Add a friend as a rival to play head to head.</div>';
    return card;
  }

  document.getElementById('group-invite-username-btn').addEventListener('click', async function(){
    const btn = this;
    const msg = document.getElementById('group-invite-msg');
    const uname = document.getElementById('group-invite-username-input').value.trim();
    msg.className = 'form-msg';
    if(!uname){ msg.classList.add('err'); msg.textContent = 'Enter a username.'; return; }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;

    btn.disabled = true;
    const { data: membership } = await sb.from('group_members').select('group_id').eq('user_id', session.user.id).maybeSingle();
    if(!membership){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'Join or create a group first.'; return; }

    const { data: targetProfile, error: lookupErr } = await sb.from('profiles').select('id').ilike('username', mqEscapeIlike(uname)).maybeSingle();
    if(lookupErr || !targetProfile){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'No user found with that username.'; return; }
    if(targetProfile.id === session.user.id){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'That\'s you.'; return; }

    const { error } = await sb.from('group_invites').insert({ group_id: membership.group_id, from_user_id: session.user.id, to_user_id: targetProfile.id });
    btn.disabled = false;
    if(error){
      msg.classList.add('err');
      msg.textContent = error.code === '23505' ? 'They already have a pending invite to this group.' : ('Error: ' + error.message);
      return;
    }
    msg.classList.add('ok');
    msg.textContent = 'Invite sent to ' + uname + '.';
    document.getElementById('group-invite-username-input').value = '';
  });

  async function loadPendingRequests(){
    const card = document.getElementById('pending-requests-card');
    const list = document.getElementById('pending-requests-list');
    if(!card || !list) return;

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){ card.style.display = 'none'; return; }

    const [{ data: buddyReqs }, { data: rivalReqs }, { data: groupInvites }] = await Promise.all([
      sb.from('buddy_requests').select('id, profiles!buddy_requests_from_user_id_fkey(username)').eq('to_user_id', session.user.id).eq('status', 'pending'),
      sb.from('rival_requests').select('id, profiles!rival_requests_from_user_id_fkey(username)').eq('to_user_id', session.user.id).eq('status', 'pending'),
      sb.from('group_invites').select('id, groups(name), profiles!group_invites_from_user_id_fkey(username)').eq('to_user_id', session.user.id).eq('status', 'pending')
    ]);

    const items = [];
    (buddyReqs || []).forEach(function(r){
      items.push({ type: 'buddy', id: r.id, label: (r.profiles ? r.profiles.username : 'Someone') + ' wants to be your buddy' });
    });
    (rivalReqs || []).forEach(function(r){
      items.push({ type: 'rival', id: r.id, label: (r.profiles ? r.profiles.username : 'Someone') + ' wants to be your rival' });
    });
    (groupInvites || []).forEach(function(r){
      items.push({ type: 'group', id: r.id, label: (r.profiles ? r.profiles.username : 'Someone') + ' invited you to join "' + (r.groups ? r.groups.name : 'a group') + '"' });
    });

    const notifDot = document.getElementById('profile-notif-dot');
    if(notifDot) notifDot.style.display = items.length > 0 ? 'block' : 'none';

    if(items.length === 0){ card.style.display = 'none'; list.innerHTML = ''; return; }

    list.innerHTML = items.map(function(item){
      return '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">' +
        '<span style="font-size:13.5px;">' + item.label.replace(/</g,'&lt;') + '</span>' +
        '<span style="display:flex; gap:6px;">' +
          '<button class="req-approve-btn" data-type="' + item.type + '" data-id="' + item.id + '" style="padding:6px 12px; border:none; border-radius:8px; background:var(--yes); color:#fff; font-weight:600; font-size:12.5px; cursor:pointer;">Approve</button>' +
          '<button class="req-decline-btn" data-type="' + item.type + '" data-id="' + item.id + '" style="padding:6px 12px; border:1px solid var(--line); border-radius:8px; background:none; color:var(--ink-soft); font-weight:600; font-size:12.5px; cursor:pointer;">Decline</button>' +
        '</span>' +
      '</div>';
    }).join('');
    card.style.display = 'block';

    list.querySelectorAll('.req-approve-btn').forEach(function(btn){
      btn.addEventListener('click', async function(){
        btn.disabled = true;
        const reqType = btn.getAttribute('data-type');
        if(reqType === 'buddy'){
          await sb.rpc('accept_buddy_request', { p_request_id: btn.getAttribute('data-id') });
          loadBuddySection();
        }else if(reqType === 'rival'){
          await sb.rpc('accept_rival_request', { p_request_id: btn.getAttribute('data-id') });
          loadRivalSection();
        }else{
          await sb.rpc('accept_group_invite', { p_invite_id: btn.getAttribute('data-id') });
          loadGroupSection();
        }
        loadPendingRequests();
      });
    });
    list.querySelectorAll('.req-decline-btn').forEach(function(btn){
      btn.addEventListener('click', async function(){
        btn.disabled = true;
        const reqType = btn.getAttribute('data-type');
        const table = reqType === 'buddy' ? 'buddy_requests' : (reqType === 'rival' ? 'rival_requests' : 'group_invites');
        await sb.from(table).update({ status: 'declined' }).eq('id', btn.getAttribute('data-id'));
        loadPendingRequests();
      });
    });
  }

  // --- Share Card Update spec: standing (streak/tier/rank) + "Called it" ---

  // Change 1: headline stats. Returns { streakDays, tierName, rankLabel }.
  // rankLabel prefers group rank ("#4 in Sigma Chi League"); falls back to
  // state rank if the player isn't in a group; null if neither is available
  // (no state set, not in a group) -- the card just omits that line then.
  async function mqComputeStanding(session){
    const { data: myStreak } = await sb.from('streaks').select('current_streak, total_points').eq('user_id', session.user.id).maybeSingle();
    const streakDays = myStreak ? myStreak.current_streak : 0;
    const tierName = getTier(myStreak ? myStreak.total_points : 0);

    let rankLabel = null;

    const { data: membership } = await sb.from('group_members').select('group_id, groups(name)').eq('user_id', session.user.id).maybeSingle();
    if(membership && membership.groups){
      const { data: memberRows } = await sb.from('group_members').select('user_id').eq('group_id', membership.group_id);
      const memberIds = (memberRows || []).map(function(m){ return m.user_id; });
      if(memberIds.length){
        const { data: memberStreaks } = await sb.from('streaks').select('user_id, total_points').in('user_id', memberIds);
        const ranked = (memberStreaks || []).slice().sort(function(a, b){ return (b.total_points || 0) - (a.total_points || 0); });
        const myRank = ranked.findIndex(function(r){ return r.user_id === session.user.id; });
        if(myRank > -1) rankLabel = '#' + (myRank + 1) + ' in ' + membership.groups.name;
      }
    }

    if(!rankLabel){
      const { data: myProfile } = await sb.from('profiles').select('state').eq('id', session.user.id).maybeSingle();
      const myState = myProfile && myProfile.state;
      if(myState){
        // Ranked in the database (get_my_state_rank) rather than by downloading
        // every player in the state, which hits request-size and 1,000-row
        // limits as the site grows. Returns null if you aren't ranked
        // (hidden from leaderboard, or no streak row) -> the card omits the line.
        const { data: stateRank, error: stateRankErr } = await sb.rpc('get_my_state_rank');
        if(!stateRankErr && stateRank) rankLabel = '#' + stateRank + ' in ' + myState;
      }
    }

    return { streakDays: streakDays, tierName: tierName, rankLabel: rankLabel };
  }

  // Change 3: "Called it" badge. Given today's questions + the player's own
  // picks, finds the correct call with the lowest pick-percentage (i.e. the
  // one the fewest players got right), provided the player got it right,
  // at least 30% or fewer of all players picked that answer, and at least
  // 50 people answered it at all. Returns null if nothing qualifies.
  async function mqGetCalledItBadge(questions, predMap){
    const CALLED_IT_MAX_PCT = 30;
    const CALLED_IT_MIN_PLAYERS = 50;
    let best = null;

    for(const q of questions){
      if(!q.resolved || !q.correct_answer) continue;
      const myChoice = predMap[q.id];
      if(myChoice !== q.correct_answer) continue; // only counts if the player was actually right

      const voteData = await getVoteData(q.id);
      const total = voteData.counts.yes + voteData.counts.no;
      if(total < CALLED_IT_MIN_PLAYERS) continue;
      const correctCount = q.correct_answer === 'yes' ? voteData.counts.yes : voteData.counts.no;
      const correctPct = Math.round((correctCount / total) * 100);
      if(correctPct > CALLED_IT_MAX_PCT) continue;

      if(!best || correctPct < best.pct){
        best = { question: q, pct: correctPct };
      }
    }
    return best; // { question, pct } or null
  }

  // Cache of the most recently computed share-card data, keyed by nothing
  // fancy -- just the last load -- so the button handler doesn't have to
  // re-derive everything from DOM text (fragile with the new headline
  // design) or re-run every query a second time.
  var __mqShareCardData = null;

  async function loadShareCard(username){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;

    const { data: resolvedQ } = await sb
      .from('daily_questions')
      .select('question_date')
      .eq('resolved', true)
      .order('question_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if(!resolvedQ) return;
    const date = resolvedQ.question_date;

    const { data: questions } = await sb.from('daily_questions').select('*').eq('question_date', date).order('slot', { ascending: true });
    if(!questions || questions.length === 0) return;
    // Only this day's picks -- an unfiltered read of a player's whole history
    // would silently stop at 1,000 rows and could drop the picks we need.
    const { data: myPreds } = await sb.from('predictions').select('question_id, choice').eq('user_id', session.user.id).in('question_id', questions.map(function(q){ return q.id; }));
    const predMap = {};
    (myPreds || []).forEach(function(p){ predMap[p.question_id] = p.choice; });

    const standing = await mqComputeStanding(session);
    const calledIt = await mqGetCalledItBadge(questions, predMap);
    // Perfect Day: every question that day resolved and the player got all
    // of them right. Fires for every Perfect Day (not just the first ever),
    // once per result date so revisiting the page doesn't re-prompt.
    const perfectDay = questions.length >= 3 && questions.every(function(q){
      // A voided question can't cost anyone a Perfect Day.
      return q.resolved && predMap[q.id] && (q.voided || predMap[q.id] === q.correct_answer);
    });
    if(perfectDay) mqMaybePromptShare(session.user.id, 'perfect_day', date);
    if(calledIt) mqMaybePromptShare(session.user.id, 'called_it', date);

    __mqShareCardData = { session: session, date: date, questions: questions, predMap: predMap, standing: standing, calledIt: calledIt };

    // Change 1: headline leads with standing, not the date/score.
    const titleEl = document.getElementById('share-card-title');
    if(titleEl) titleEl.textContent = standing.tierName + (standing.rankLabel ? ' \u00b7 ' + standing.rankLabel : '');
    const dateEl = document.getElementById('share-card-date');
    if(dateEl){
      try{ dateEl.textContent = 'Results for ' + new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }catch(e){ dateEl.textContent = ''; }
    }
    // The share section lives on the Play tab and stays hidden until there is a card to show.
    const shareSec = document.getElementById('share-section');
    if(shareSec) shareSec.style.display = 'flex';
    document.getElementById('share-card-streak').textContent = standing.streakDays + '-day streak';

    const calledItEl = document.getElementById('share-card-calledit');
    if(calledItEl){
      if(calledIt){
        calledItEl.style.display = '';
        calledItEl.textContent = 'Called it: only ' + calledIt.pct + '% saw this one coming.';
      }else{
        calledItEl.style.display = 'none';
      }
    }

    const row = document.getElementById('share-card-row');
    row.innerHTML = '';
    questions.forEach(function(q){
      const myChoice = predMap[q.id];
      // Change 2: no red anywhere. Correct = filled accent marker;
      // incorrect OR unresolved (can't tell them apart without a
      // separate "wrong" signal, which the spec explicitly forbids)
      // both render as the same neutral gray outline marker.
      const correct = !!myChoice && q.resolved && myChoice === q.correct_answer;
      const cell = document.createElement('div');
      cell.className = 'share-cell';
      const iconClass = correct ? 'correct' : 'neutral';
      const iconPath = correct ? '<path d="M5 13l4 4L19 7"/>' : '<circle cx="12" cy="12" r="7"/>';
      cell.innerHTML =
        '<div class="share-icon ' + iconClass + '"><svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg></div>' +
        '<div class="share-cell-label"></div>';
      cell.querySelector('.share-cell-label').textContent = CATEGORY_LABELS[q.category] || q.category;
      row.appendChild(cell);
    });

    document.getElementById('share-results-btn').style.display = 'inline-flex';
    const squareBtn = document.getElementById('share-results-square-btn');
    if(squareBtn) squareBtn.style.display = 'inline-flex';
  }


  // Signed-out players get the results card too (their picks come from the
  // server by device, no streak or rank on it).
  async function mqLoadGuestShareCard(){
    try{
      const dev = mqGuestDeviceId();
      if(!dev) return;
      const { data: resolvedQ } = await sb.from('daily_questions').select('question_date').eq('resolved', true).order('question_date', { ascending: false }).limit(1).maybeSingle();
      if(!resolvedQ) return;
      const date = resolvedQ.question_date;
      const { data: questions } = await sb.from('daily_questions').select('*').eq('question_date', date).order('slot', { ascending: true });
      if(!questions || !questions.length) return;
      const { data: picks } = await sb.rpc('get_guest_picks', { p_device_id: dev, p_question_ids: questions.map(function(q){ return q.id; }) });
      const predMap = {};
      (picks || []).forEach(function(p){ predMap[p.question_id] = p.choice; });
      if(!Object.keys(predMap).length) return;
      const correct = questions.filter(function(q){ return predMap[q.id] && q.resolved && predMap[q.id] === q.correct_answer; }).length;
      __mqShareCardData = { session: null, guest: true, guestCorrect: correct, date: date, questions: questions, predMap: predMap, standing: { streakDays: 0, tierName: 'Marqit', rankLabel: null }, calledIt: null };
      const titleEl = document.getElementById('share-card-title'); if(titleEl) titleEl.textContent = 'Marqit';
      const dateEl = document.getElementById('share-card-date');
      if(dateEl){ try{ dateEl.textContent = 'Results for ' + new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }catch(e){ dateEl.textContent = ''; } }
      const shareSec = document.getElementById('share-section'); if(shareSec) shareSec.style.display = 'flex';
      document.getElementById('share-card-streak').textContent = correct + '/' + questions.filter(function(q){ return !q.voided; }).length + ' correct';
      const calledItEl = document.getElementById('share-card-calledit'); if(calledItEl) calledItEl.style.display = 'none';
      const row = document.getElementById('share-card-row');
      row.innerHTML = '';
      questions.forEach(function(q){
        const ok = !!predMap[q.id] && q.resolved && predMap[q.id] === q.correct_answer;
        const cell = document.createElement('div');
        cell.className = 'share-cell';
        cell.innerHTML = '<div class="share-icon ' + (ok ? 'correct' : 'neutral') + '"><svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + (ok ? '<path d="M5 13l4 4L19 7"/>' : '<circle cx="12" cy="12" r="7"/>') + '</svg></div><div class="share-cell-label"></div>';
        cell.querySelector('.share-cell-label').textContent = CATEGORY_LABELS[q.category] || q.category;
        row.appendChild(cell);
      });
      document.getElementById('share-results-btn').style.display = 'inline-flex';
      const sq = document.getElementById('share-results-square-btn'); if(sq) sq.style.display = 'inline-flex';
    }catch(e){}
  }

  // --- Shared share-card visual system -------------------------------------
  // One consistent look across every card type (personal results, pre-result
  // picks, group weekly recap, champion): dark ground + faint dot grid +
  // an accent-colored glow, the same Marqit logo, and the same url footer used on the site's own
  // link-preview image (og-image.png) -- so every card, screenshot or link
  // reads as unmistakably Marqit rather than a plain text card.
  function mqRoundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Same two faces as the site: Barlow for labels, Big Shoulders Display for
  // the hero number and wordmark. Loaded via a <link>
  // in index.html's <head>; canvas won't pick up a webfont until the
  // browser has actually fetched it, so every share handler awaits this
  // before drawing (falls back to Arial if blocked).
  const MQ_HEAD_FONT = "'Barlow', Arial, sans-serif";
  const MQ_DISPLAY_FONT = "'Big Shoulders Display', 'Barlow', Arial, sans-serif";
  let __mqCardFontsReady = null;
  function mqEnsureCardFonts(){
    if(__mqCardFontsReady) return __mqCardFontsReady;
    __mqCardFontsReady = (async function(){
      try{
        if(document.fonts && document.fonts.load){
          await Promise.all([
            document.fonts.load("700 100px " + MQ_HEAD_FONT),
            document.fonts.load("600 100px " + MQ_HEAD_FONT),
            document.fonts.load("800 100px " + MQ_DISPLAY_FONT),
            document.fonts.load("700 100px " + MQ_DISPLAY_FONT)
          ]);
        }
      }catch(e){ /* card still renders, just with the fallback font */ }
    })();
    return __mqCardFontsReady;
  }

  // Draws uppercase label text with manual letter-tracking -- canvas has no
  // letter-spacing property, and tight-set caps are what make a stat label
  // (DAY STREAK, WEEK 3) read as designed rather than default.
  function mqTrackedText(ctx, text, cx, y, trackingPx){
    const widths = text.split('').map(function(ch){ return ctx.measureText(ch).width; });
    const total = widths.reduce(function(a, b){ return a + b; }, 0) + trackingPx * (text.length - 1);
    let x = cx - total / 2;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    text.split('').forEach(function(ch, i){
      ctx.fillText(ch, x, y);
      x += widths[i] + trackingPx;
    });
    ctx.textAlign = prevAlign;
  }

  // Ground: the same deep charcoal gradient the site itself uses (see
  // refresh.css, "Background"), and the site's own panel/line colors and
  // YES/NO greens and reds, so a card reads as a screenshot of the product.
  const MQ_CARD_BG = '#111318';
  const MQ_PANEL = '#1B1E24';
  const MQ_LINE = '#2C2F37';
  const MQ_YES = '#2DBE7E';
  const MQ_NO = '#E5533F';
  const MQ_PENDING = '#A8ABB3';
  const MQ_INK = '#F4F4F1';
  const MQ_INK_SOFT = 'rgba(244,244,241,0.82)';
  const MQ_INK_MUTED = 'rgba(244,244,241,0.6)';
  const MQ_INK_FAINT = 'rgba(244,244,241,0.55)';
  function mqCardBackground(ctx, width, height){
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#191C23');
    g.addColorStop(0.5, '#101218');
    g.addColorStop(1, '#0B0D11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // Instagram (and TikTok/Snap) lay their own UI over a 1080x1920 story: the
  // profile row + progress bar over roughly the top 250px and the reply bar
  // over roughly the bottom 340px. Anything of ours in those bands gets
  // covered or cropped, so every card keeps ALL of its content inside this
  // safe box. `u` is a size unit: 1 on a story, smaller on the 1:1 square, so
  // the same layout numbers work for both.
  function mqCardLayout(width, height){
    const story = height > width * 1.4;
    const top = story ? height * (250 / 1920) : height * 0.07;
    const bottom = story ? height * (1 - 340 / 1920) : height * 0.93;
    const H = bottom - top;
    return { story: story, top: top, bottom: bottom, H: H, u: H / 1330 };
  }

  function mqAlpha(hex, a){
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function mqTrackedWidth(ctx, text, trackingPx){
    let w = 0;
    text.split('').forEach(function(ch){ w += ctx.measureText(ch).width; });
    return w + trackingPx * (text.length - 1);
  }

  // Left-aligned tracked text (mqTrackedText centers on a point).
  function mqTrackedLeft(ctx, text, x, y, trackingPx){
    mqTrackedText(ctx, text, x + mqTrackedWidth(ctx, text, trackingPx) / 2, y, trackingPx);
  }

  // Word-wraps to maxLines, ending the last line with an ellipsis if cut off.
  function mqWrapLines(ctx, text, maxW, maxLines){
    const words = String(text || '').split(' ');
    let line = '', out = [];
    words.forEach(function(w){
      const test = line ? line + ' ' + w : w;
      if(ctx.measureText(test).width > maxW && line){ out.push(line); line = w; }
      else line = test;
    });
    if(line) out.push(line);
    if(out.length > maxLines){
      out = out.slice(0, maxLines);
      let last = out[maxLines - 1];
      while(last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      out[maxLines - 1] = last.replace(/\s+$/, '') + '…';
    }
    return out;
  }

  // Soft rounded panel behind a row of content. `accent` (a hex) tints it.
  function mqCardPanel(ctx, x, y, w, h, r, accent){
    mqRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = MQ_PANEL;
    ctx.fill();
    if(accent){ ctx.fillStyle = mqAlpha(accent, 0.10); ctx.fill(); }
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent ? mqAlpha(accent, 0.55) : MQ_LINE;
    ctx.stroke();
  }

  // Tinted pill with centered text; returns the pill width.
  function mqCardChip(ctx, text, rightX, cy, h, color, fontPx){
    ctx.font = "800 " + Math.round(fontPx) + "px " + MQ_HEAD_FONT;
    const w = ctx.measureText(text).width + h * 0.9;
    mqRoundRect(ctx, rightX - w, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = mqAlpha(color, 0.16);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, rightX - w / 2, cy + fontPx * 0.35);
    return w;
  }

  // Round status mark for a call: check (correct), cross (incorrect), ring
  // (pending) or dash (void).
  function mqStatusDot(ctx, cx, cy, r, kind, color){
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if(kind === 'pending' || kind === 'void'){
      ctx.lineWidth = r * 0.2;
      ctx.strokeStyle = color;
      ctx.stroke();
      if(kind === 'void'){
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.45, cy);
        ctx.lineTo(cx + r * 0.45, cy);
        ctx.stroke();
      }
    }else{
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = MQ_CARD_BG;
      ctx.lineWidth = r * 0.24;
      ctx.beginPath();
      if(kind === 'correct'){
        ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
        ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
        ctx.lineTo(cx + r * 0.46, cy - r * 0.3);
      }else{
        ctx.moveTo(cx - r * 0.34, cy - r * 0.34);
        ctx.lineTo(cx + r * 0.34, cy + r * 0.34);
        ctx.moveTo(cx + r * 0.34, cy - r * 0.34);
        ctx.lineTo(cx - r * 0.34, cy + r * 0.34);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // A thin 1px rule -- the divider language this whole redesign leans on
  // instead of filled rounded panels, which read as app-icon tiles.
  function mqHairline(ctx, x1, x2, y, alpha){
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y + 0.5);
    ctx.lineTo(x2, y + 0.5);
    ctx.stroke();
  }

  // The Marqit logo (the MARQIT lettering with the M's down arrow and the T's
  // up arrow), drawn from the same outline as marqit-logo-white.svg so it is
  // identical on every share card. Path2D keeps it crisp at any export size and
  // needs no extra image request before the card can be drawn.
  const MQ_LOGO_VB = { x: 29.42, y: -167.8, w: 842.01, h: 581.46 };
  const MQ_LOGO_D = "M103.96 254.66L72.82 254.66Q69.77 254.66 69.77 251.30L72.21 58.35Q72.21 54.69 75.57 54.69L113.73 54.69Q116.79 54.69 117.40 57.44L144.57 158.49L171.74 57.44Q172.35 54.69 175.40 54.69L213.57 54.69Q216.31 54.69 216.31 58.35L219.06 251.30Q219.06 254.66 216.01 254.66L184.87 254.66Q181.81 254.66 181.81 251L181.20 166.43Q180.90 150.86 181.51 138.19Q182.12 125.52 183.04 114.83L182.73 114.83Q180.29 124.30 177.39 134.22Q174.49 144.14 171.43 153.61L147.93 227.79Q147.32 230.24 145.18 230.24L143.65 230.24Q141.82 230.24 140.90 227.79L117.40 153.61Q114.34 143.84 111.60 134.07Q108.85 124.30 106.41 114.83L105.80 114.83Q106.71 125.52 107.32 138.19Q107.93 150.86 107.63 166.43L107.02 251Q107.02 254.66 103.96 254.66M274.94 248.08L240.75 248.08Q239.53 248.08 238.92 247.46Q238 246.55 238.31 244.11L279.52 50.85Q280.13 48.10 282.88 48.10L323.79 48.10Q326.84 48.10 327.45 50.85L368.36 244.11Q368.97 246.55 368.06 247.46Q367.45 248.08 366.23 248.08L331.12 248.08Q328.37 248.08 327.76 245.33L321.65 206.55L284.41 206.55L278.30 245.33Q277.99 248.08 274.94 248.08M289.29 175.72L317.07 175.72L309.44 126.57Q307.91 116.19 306.39 105.65Q304.86 95.12 303.64 84.74L303.03 84.74Q301.50 95.12 300.28 105.65Q299.06 116.19 297.23 126.87M424.61 246.01L392.86 246.01Q389.81 246.01 389.81 242.35L389.81 49.71Q389.81 46.04 392.86 46.04L438.04 46.04Q468.88 46.04 483.08 60.24Q497.27 74.44 497.27 105.27Q497.27 127.25 491.32 140.53Q485.37 153.81 473.46 159.61L473.15 160.22L504.90 241.74Q505.52 244.18 504.60 245.10Q503.99 246.01 502.46 246.01L467.96 246.01Q465.22 246.01 464.30 243.57L438.04 167.25L427.66 167.25L427.66 242.35Q427.66 246.01 424.61 246.01M427.66 79.93L427.66 135.50L438.35 135.50Q449.65 135.50 454.53 128.47Q459.42 121.45 459.42 107.10Q459.42 92.75 454.22 86.34Q449.03 79.93 438.04 79.93M614.47 303.10Q602.57 303.10 594.63 296.54Q586.69 289.97 583.03 275.32Q579.98 264.63 579.37 249.06Q555.86 247.23 542.73 232.58Q527.46 215.78 527.46 183.12L527.46 112.59Q527.46 79.32 542.58 62.52Q557.69 45.73 586.69 45.73Q615.70 45.73 630.96 62.52Q646.23 79.32 646.23 112.59L646.23 183.12Q646.23 215.78 630.96 232.58Q623.02 241.43 610.81 245.70Q611.12 254.56 612.03 260.05Q613.25 267.99 615.70 270.89Q618.14 273.79 621.80 273.79Q624.55 273.79 626.38 273.33Q628.21 272.88 630.05 272.26Q631.27 271.96 632.18 272.26Q633.10 272.88 633.10 275.32L633.10 295.47Q633.10 299.13 630.66 300.05Q628.52 301.27 624.40 302.18Q620.28 303.10 614.47 303.10M586.69 215.17Q597.99 215.17 603.18 207.39Q608.37 199.60 608.37 181.59L608.37 113.81Q608.37 95.50 603.18 87.71Q597.99 79.93 586.69 79.93Q575.70 79.93 570.36 87.71Q565.02 95.50 565.02 113.81L565.02 181.59Q565.02 199.60 570.36 207.39Q575.70 215.17 586.69 215.17M711.61 251.14L679.86 251.14Q676.81 251.14 676.81 247.48L676.81 54.84Q676.81 51.17 679.86 51.17L711.61 51.17Q714.66 51.17 714.66 54.84L714.66 247.48Q714.66 251.14 711.61 251.14M809.58 256.20L778.14 256.20Q775.08 256.20 775.08 252.53L775.08 90.11L743.03 90.11Q739.97 90.11 739.97 86.45L739.97 59.89Q739.97 56.23 743.03 56.23L844.39 56.23Q847.44 56.23 847.44 59.89L847.44 86.45Q847.44 90.11 844.39 90.11L812.64 90.11L812.64 252.53Q812.64 256.20 809.58 256.20M70.6 244.66H107.5V325.66H124.68L89.05 389.66L53.43 325.66H70.6ZM775.1 66.2V-79.8H758.23L793.85 -143.8L829.48 -79.8H812.6V66.2Z";
  let __mqLogoPath = null;
  function mqCardLogoRow(ctx, width, top, scale){
    if(!__mqLogoPath){
      try{ __mqLogoPath = new Path2D(MQ_LOGO_D); }catch(e){ __mqLogoPath = null; }
    }
    const logoW = width * 0.17 * (scale || 1);
    const k = logoW / MQ_LOGO_VB.w;
    const logoH = MQ_LOGO_VB.h * k;
    const left = (width - logoW) / 2;
    if(!__mqLogoPath){
      // Path2D unavailable (very old browser): fall back to plain type.
      ctx.textAlign = 'center';
      ctx.fillStyle = MQ_INK;
      ctx.font = "800 " + Math.round(logoH * 0.5) + "px " + MQ_DISPLAY_FONT;
      ctx.fillText('MARQIT', width / 2, top + logoH * 0.6);
      return top + logoH;
    }
    ctx.save();
    ctx.translate(left - MQ_LOGO_VB.x * k, top - MQ_LOGO_VB.y * k);
    ctx.scale(k, k);
    ctx.fillStyle = MQ_INK;
    ctx.fill(__mqLogoPath);
    ctx.restore();
    return top + logoH;
  }

  // Footer lives INSIDE the story-safe box (above Instagram's reply bar): a
  // bold one-line challenge, then the url as a solid light pill -- it reads as
  // a button, which is what people expect to tap. (A flat image can't be a
  // link itself; the share flow copies the link so it pastes into a link
  // sticker.) Returns the y of the top of the footer.
  function mqCardFooterBand(ctx, width, height, line1, line2, pillBottomY){
    const L = mqCardLayout(width, height);
    const u = L.u;
    const urlText = (line2 || 'playmarqit.com').toUpperCase();
    const track = 3 * u;
    ctx.font = "800 " + Math.round(26 * u) + "px " + MQ_HEAD_FONT;
    const pillH = 62 * u;
    const pillW = mqTrackedWidth(ctx, urlText, track) + 80 * u;
    const pillX = (width - pillW) / 2;
    const pillY = (pillBottomY || L.bottom) - pillH;
    mqRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = MQ_INK;
    ctx.fill();
    ctx.fillStyle = MQ_CARD_BG;
    mqTrackedText(ctx, urlText, width / 2, pillY + pillH / 2 + 9 * u, track);

    let fs = Math.round(38 * u);
    ctx.font = "800 " + fs + "px " + MQ_HEAD_FONT;
    while(fs > 20 && ctx.measureText(line1).width > width * 0.88){ fs -= 2; ctx.font = "800 " + fs + "px " + MQ_HEAD_FONT; }
    const baseline = pillY - 28 * u;
    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.fillText(line1, width / 2, baseline);
    return baseline - fs;
  }

  // Draws the daily-results card onto a canvas at the given size (used for
  // both the 9:16 story export and the 1:1 square export -- same layout,
  // scaled by the layout unit). Returns the canvas.
  // Big glowing streak number, then today's calls as clean rows with a status
  // mark and a verdict chip. Everything sits inside the story-safe box.
  function mqDrawResultsCard(width, height, data){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const L = mqCardLayout(width, height), u = L.u;

    // Vertical plan, in story pixels (times u), measured from the top of the
    // stack so the whole stack can be centered in the safe area as one block.
    const n = data.questions.length;
    const hasCalled = !!data.calledIt;
    const calledBottom = hasCalled ? 593 : 520;
    const labelY = calledBottom + 55;
    const rowsTop = labelY + 32;
    const gap = 12;
    let rowH = 100;
    const footerH = 28 + 38 + 62;          // line gap + line + pill
    const footerGap = 44;                  // space between the last row and the footer
    const stackH = function(rh){ return rowsTop + n * rh + Math.max(n - 1, 0) * gap + footerGap + footerH; };
    while(rowH > 50 && stackH(rowH) * u > L.H) rowH -= 4;
    const fs = Math.min(1, rowH / 100);
    const T = L.top + Math.max(0, (L.H - stackH(rowH) * u) / 2);

    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, T, Math.max(0.85, u));

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK_MUTED;
    ctx.font = "700 " + Math.round(30 * u) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, data.guest ? 'CORRECT CALLS' : 'DAY STREAK', cx, T + 205 * u, 9 * u);

    // Hero number: the same display face as the wordmark, flat white.
    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(270 * u) + "px " + MQ_DISPLAY_FONT;
    ctx.fillText(data.guest ? (data.guestCorrect + '/' + data.questions.length) : String(data.standing.streakDays), cx, T + 435 * u);

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK_SOFT;
    ctx.font = "700 " + Math.round(36 * u) + "px " + MQ_HEAD_FONT;
    const tierLine = data.standing.tierName + (data.standing.rankLabel ? '  ·  ' + data.standing.rankLabel : '');
    ctx.fillText(tierLine, cx, T + 500 * u);

    // "Called it" -- a green chip under the tier line, if this card earned one.
    if(hasCalled){
      const txt = 'Called it — only ' + data.calledIt.pct + '% saw this coming';
      ctx.font = "700 " + Math.round(28 * u) + "px " + MQ_HEAD_FONT;
      const cw = ctx.measureText(txt).width + 56 * u, ch = 56 * u, cy = T + 565 * u;
      mqRoundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, ch / 2);
      ctx.fillStyle = mqAlpha(MQ_YES, 0.14);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = MQ_YES;
      ctx.fillText(txt, cx, cy + 10 * u);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK_FAINT;
    ctx.font = "700 " + Math.round(24 * u) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, "TODAY'S CALLS", cx, T + labelY * u, 8 * u);

    const rowX = width * 0.075, rowW = width * 0.85;
    data.questions.forEach(function(q, i){
      const myChoice = data.predMap[q.id];
      const isVoid = !!q.voided;
      const correct = !isVoid && !!myChoice && q.resolved && myChoice === q.correct_answer;
      const incorrect = !isVoid && !!myChoice && q.resolved && myChoice !== q.correct_answer;
      const kind = isVoid ? 'void' : (correct ? 'correct' : (incorrect ? 'incorrect' : 'pending'));
      const color = correct ? MQ_YES : (incorrect ? MQ_NO : MQ_PENDING);
      const word = isVoid ? 'Void' : (correct ? 'Correct' : (incorrect ? 'Incorrect' : 'Pending'));
      const rawLabel = CATEGORY_LABELS[q.category] || q.category;
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase();
      const ry = T + (rowsTop + i * (rowH + gap)) * u, rh = rowH * u, mid = ry + rh / 2;

      mqCardPanel(ctx, rowX, ry, rowW, rh, 22 * u, null);
      mqStatusDot(ctx, rowX + 56 * u, mid, 22 * u * fs, kind, color);
      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK;
      ctx.font = "700 " + Math.round(38 * u * fs) + "px " + MQ_HEAD_FONT;
      ctx.fillText(label, rowX + 100 * u, mid + 13 * u * fs);
      mqCardChip(ctx, word, rowX + rowW - 26 * u, mid, 54 * u * fs, color, 28 * u * fs);
    });

    const rowsBottom = T + (rowsTop + n * rowH + Math.max(n - 1, 0) * gap) * u;
    mqCardFooterBand(ctx, width, height, data.guest ? 'Think you can beat my calls?' : 'Beat my ' + data.standing.streakDays + '-day streak', 'playmarqit.com', rowsBottom + (footerGap + footerH) * u);

    return canvas;
  }



  // Crop dialog for profile photos: drag to move, slider to zoom. Resolves with a 256px square JPEG blob (or null if cancelled).
  function mqCropPhoto(file){
    return new Promise(function(resolve){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onerror = function(){ URL.revokeObjectURL(url); resolve(null); };
      img.onload = function(){
        var wrap = document.createElement('div');
        wrap.className = 'mq-crop';
        wrap.innerHTML = '<div class="mq-crop-card" role="dialog" aria-modal="true" aria-label="Adjust photo">' +
          '<h4>Adjust your photo</h4><p>Drag to move it. Use the slider to zoom.</p>' +
          '<div class="mq-crop-view"></div>' +
          '<div class="mq-crop-zoom"><span aria-hidden="true">&minus;</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></div>' +
          '<div class="mq-crop-btns"><button type="button" class="mq-crop-cancel">Cancel</button><button type="button" class="mq-crop-ok">Use photo</button></div></div>';
        document.body.appendChild(wrap);
        var view = wrap.querySelector('.mq-crop-view'), slider = wrap.querySelector('input');
        view.appendChild(img);
        var V = view.clientWidth || 280, w = img.naturalWidth, h = img.naturalHeight;
        var base = V / Math.min(w, h), zoom = 1, x = 0, y = 0;
        function clamp(){ var sc = base * zoom; x = Math.min(0, Math.max(V - w * sc, x)); y = Math.min(0, Math.max(V - h * sc, y)); }
        function paint(){ clamp(); var sc = base * zoom; img.style.width = (w * sc) + 'px'; img.style.height = (h * sc) + 'px'; img.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
        x = (V - w * base) / 2; y = (V - h * base) / 2; paint();
        var drag = null;
        view.addEventListener('pointerdown', function(e){ drag = { px: e.clientX, py: e.clientY, x: x, y: y }; try{ view.setPointerCapture(e.pointerId); }catch(err){} });
        view.addEventListener('pointermove', function(e){ if(!drag) return; x = drag.x + (e.clientX - drag.px); y = drag.y + (e.clientY - drag.py); paint(); });
        function end(){ drag = null; }
        view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
        view.addEventListener('wheel', function(e){ e.preventDefault(); slider.value = String(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002))); slider.dispatchEvent(new Event('input')); }, { passive: false });
        slider.addEventListener('input', function(){
          var old = base * zoom, cx = (V / 2 - x) / old, cy = (V / 2 - y) / old; // keep the centre point steady
          zoom = parseFloat(slider.value) || 1;
          var sc = base * zoom; x = V / 2 - cx * sc; y = V / 2 - cy * sc; paint();
        });
        function close(val){ document.removeEventListener('keydown', onKey); wrap.remove(); URL.revokeObjectURL(url); resolve(val); }
        function onKey(e){ if(e.key === 'Escape') close(null); }
        document.addEventListener('keydown', onKey);
        wrap.querySelector('.mq-crop-cancel').addEventListener('click', function(){ close(null); });
        wrap.addEventListener('click', function(e){ if(e.target === wrap) close(null); });
        wrap.querySelector('.mq-crop-ok').addEventListener('click', function(){
          var sc = base * zoom, SZ = 256, cv = document.createElement('canvas'); cv.width = SZ; cv.height = SZ;
          cv.getContext('2d').drawImage(img, -x / sc, -y / sc, V / sc, V / sc, 0, 0, SZ, SZ);
          cv.toBlob(function(b){ close(b); }, 'image/jpeg', 0.86);
        });
      };
      img.src = url;
    });
  }

  // ===== One share sheet for everything =====
  // opts: { title, text, url, packaged?: {file, blob}, filename? }
  // Big, friendly tiles: Messages, WhatsApp, X, Email, Copy link, Save image, plus the device's own share sheet.
  function mqOpenShareSheet(opts){
    var old = document.getElementById('mq-share-sheet'); if(old) old.remove();
    var url = opts.url || 'https://playmarqit.com/';
    var text = opts.text || '';
    var full = (text + ' ' + url).trim();
    var packaged = opts.packaged || null;

    // Fast path on phones: skip our own sheet and open the phone's share sheet
    // with just the story-size image. Instagram (Stories / Feed / DM), Snapchat,
    // Messages etc. are all listed there, so it's one tap on Share, one tap on
    // Instagram. If the browser refuses (it wants the tap to be very recent), we
    // fall through to our sheet, whose big Instagram button is a fresh tap.
    var isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    if(packaged && !opts.noDirect && isPhone && navigator.share && navigator.canShare && navigator.canShare({ files: [packaged.file] })){
      // Put the link on the clipboard too, ready to paste into an Instagram link sticker.
      try{ navigator.clipboard.writeText(url).catch(function(){}); }catch(e){}
      navigator.share({ files: [packaged.file] }).catch(function(e){
        if(e && e.name === 'AbortError') return; // they closed it on purpose
        mqOpenShareSheet(Object.assign({}, opts, { noDirect: true }));
      });
      return;
    }

    var previewUrl = packaged ? URL.createObjectURL(packaged.blob) : null;
    function done(){ if(previewUrl) setTimeout(function(){ URL.revokeObjectURL(previewUrl); }, 500); wrap.classList.remove('open'); setTimeout(function(){ wrap.remove(); }, 220); document.removeEventListener('keydown', onKey); }
    function onKey(e){ if(e.key === 'Escape') done(); }
    var ico = {
      sms:'<path d="M4 5h16v11H9l-5 4z"/>',
      wa:'<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.5 20.5l4.2-1.1A8.5 8.5 0 1 0 12 3.5z"/><path d="M9 8.5c.3 2.700 2.800 5.200 5.700 5.900l1.100-1.400-2-1-.9.9c-.9-.4-1.800-1.300-2.200-2.200l.9-.9-1-2z"/>',
      x:'<path d="M5 5l14 14M19 5L5 19"/>',
      mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
      copy:'<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.500 8.500v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
      save:'<path d="M12 4v11M7.500 10.500L12 15l4.500-4.500M5 19.500h14"/>',
      more:'<circle cx="6" cy="12" r="1.400" fill="currentColor"/><circle cx="12" cy="12" r="1.400" fill="currentColor"/><circle cx="18" cy="12" r="1.400" fill="currentColor"/>'
    };
    function svg(k){ return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ico[k] + '</svg>'; }
    var tiles = [
      { k:'sms',  label:'Messages',  c:'#34C759', href:'sms:?&body=' + encodeURIComponent(full) },
      { k:'wa',   label:'WhatsApp',  c:'#25D366', href:'https://wa.me/?text=' + encodeURIComponent(full) },
      { k:'x',    label:'X',         c:'#9AA3B2', href:'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url) },
      { k:'mail', label:'Email',     c:'#4C8DFF', href:'mailto:?subject=' + encodeURIComponent(opts.title || 'Marqit') + '&body=' + encodeURIComponent(full) },
      { k:'copy', label:'Copy link', c:'#B07CFF', act:'copy' }
    ];
    if(packaged) tiles.push({ k:'save', label:'Save image', c:'#FFB020', act:'save' });
    var canNative = !!navigator.share;
    if(canNative) tiles.push({ k:'more', label:'More', c:'#8A93A6', act:'native' });

    var wrap = document.createElement('div');
    wrap.id = 'mq-share-sheet'; wrap.className = 'mq-ss';
    wrap.innerHTML = '<div class="mq-ss-bg"></div><div class="mq-ss-card" role="dialog" aria-modal="true" aria-label="Share">' +
      '<button type="button" class="mq-ss-x" aria-label="Close">&times;</button>' +
      '<div class="mq-ss-head">' + (previewUrl ? '<img class="mq-ss-prev" alt="" src="' + previewUrl + '">' : '') +
        '<div class="mq-ss-ht"><b>' + escapeHtml(opts.title || 'Share') + '</b><span>' + escapeHtml(url.replace(/^https?:\/\//, '').slice(0, 44)) + '</span></div></div>' +
      (packaged ? '<button type="button" class="mq-ss-ig">Share to Instagram Story</button>' : '') +
      '<div class="mq-ss-grid"></div><div class="mq-ss-msg" role="status"></div></div>';
    var grid = wrap.querySelector('.mq-ss-grid'), msg = wrap.querySelector('.mq-ss-msg');
    function say(t){ msg.textContent = t; }
    var igBtn = wrap.querySelector('.mq-ss-ig');
    if(igBtn) igBtn.addEventListener('click', async function(){
      // Best: the phone's share sheet with the image -- pick Instagram > Story.
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [packaged.file] })){
        try{ await navigator.share({ files: [packaged.file] }); done(); return; }
        catch(e){ if(e && e.name === 'AbortError') return; }
      }
      // Otherwise save the image and open Instagram's story camera: they pick
      // the picture we just saved from the camera roll.
      var a = document.createElement('a'); a.href = URL.createObjectURL(packaged.blob); a.download = opts.filename || 'marqit.png';
      document.body.appendChild(a); a.click(); a.remove();
      try{ navigator.clipboard.writeText(url); }catch(e){}
      say('Image saved. Opening Instagram — pick it from your photos. Your link is copied for a link sticker.');
      if(isPhone) setTimeout(function(){ window.location.href = 'instagram://story-camera'; }, 900);
    });
    tiles.forEach(function(t){
      var b = document.createElement(t.href ? 'a' : 'button');
      b.className = 'mq-ss-tile'; b.style.setProperty('--tc', t.c);
      b.innerHTML = '<span class="mq-ss-ic">' + svg(t.k) + '</span><span class="mq-ss-lb">' + t.label + '</span>';
      if(t.href){ b.href = t.href; if(t.href.indexOf('http') === 0){ b.target = '_blank'; b.rel = 'noopener'; } b.addEventListener('click', function(){ setTimeout(done, 150); }); }
      else{
        b.type = 'button';
        b.addEventListener('click', async function(){
          if(t.act === 'copy'){
            try{ await navigator.clipboard.writeText(full); say('Link copied. Paste it anywhere.'); }catch(e){ say('Could not copy. Long-press the link to copy it.'); }
          }else if(t.act === 'save' && packaged){
            var a = document.createElement('a'); a.href = URL.createObjectURL(packaged.blob); a.download = opts.filename || 'marqit.png';
            document.body.appendChild(a); a.click(); a.remove(); say('Image saved.');
          }else if(t.act === 'native'){
            try{
              if(packaged && navigator.canShare && navigator.canShare({ files: [packaged.file] })) await navigator.share({ files: [packaged.file], text: text, url: url });
              else await navigator.share({ title: opts.title || 'Marqit', text: text, url: url });
              done();
            }catch(e){ /* canceled */ }
          }
        });
      }
      grid.appendChild(b);
    });
    document.body.appendChild(wrap);
    requestAnimationFrame(function(){ wrap.classList.add('open'); });
    wrap.querySelector('.mq-ss-bg').addEventListener('click', done);
    wrap.querySelector('.mq-ss-x').addEventListener('click', done);
    document.addEventListener('keydown', onKey);
    var first = grid.querySelector('.mq-ss-tile'); if(first) first.focus();
  }

  function mqShareCanvasToFileAndCaption(canvas, filename){
    return new Promise(function(resolve){
      canvas.toBlob(function(blob){
        resolve(blob ? { file: new File([blob], filename, { type: 'image/png' }), blob: blob } : null);
      }, 'image/png');
    });
  }

  // The one function behind BOTH the always-available "Share your results"
  // button and any Change-5 auto-prompt banner -- triggerName is null for a
  // plain manual tap, or one of 'perfect_day'/'streak_milestone'/'tier_up'/
  // 'rival_win'/'called_it' when a prompt's own Share button called this.
  async function mqShareResultsCard(triggerName){
    const msgEl = document.getElementById('share-results-msg');
    if(!__mqShareCardData){ if(msgEl){ msgEl.className = 'form-msg err'; msgEl.textContent = 'Nothing to share yet.'; } return; }
    const data = __mqShareCardData;
    const session = data.session;

    const correctCount = data.questions.filter(function(q){ return data.predMap[q.id] && q.resolved && data.predMap[q.id] === q.correct_answer; }).length;
    const refTag = mqGetReferralTag(session ? session.user.id : 'guest', 'daily_results', triggerName);
    const shareUrl = 'https://playmarqit.com/?' + refTag;
    const shareText = (data.guest ? 'Think you can beat me? ' : 'Beat my ' + data.standing.streakDays + '-day streak. ') + correctCount + '/' + data.questions.filter(function(q){ return !q.voided; }).length + ' correct. ' + shareUrl;

    await mqEnsureCardFonts();
    const canvas = mqDrawResultsCard(1080, 1920, data); // story ratio is the default share
    const packaged = await mqShareCanvasToFileAndCaption(canvas, 'marqit-results.png');
    if(!packaged){ if(msgEl){ msgEl.className = 'form-msg err'; msgEl.textContent = 'Could not generate the image \u2014 try again.'; } return; }

    if(session) mqLogCardShare(session.user.id, 'daily_results', triggerName);

    mqOpenShareSheet({ title: data.guest ? 'Share your picks' : 'Share your results', text: shareText.replace(' ' + shareUrl, ''), url: shareUrl, packaged: packaged, filename: 'marqit-results.png' });
  }

  document.getElementById('share-results-btn').addEventListener('click', function(){ mqShareResultsCard(null); });

  // Acceptance criteria requires both a 9:16 story export (the default,
  // above) and a 1:1 square export -- this is the square one, downloaded
  // directly rather than run through the native share sheet (most share
  // sheets are built around one image at a time; the story version is the
  // one meant for that).
  const shareSquareBtn = document.getElementById('share-results-square-btn');
  if(shareSquareBtn){
    shareSquareBtn.addEventListener('click', async function(){
      const msgEl = document.getElementById('share-results-msg');
      if(!__mqShareCardData){ if(msgEl){ msgEl.className = 'form-msg err'; msgEl.textContent = 'Nothing to share yet.'; } return; }
      const data = __mqShareCardData;
      await mqEnsureCardFonts();
      const canvas = mqDrawResultsCard(1080, 1080, data);
      const packaged = await mqShareCanvasToFileAndCaption(canvas, 'marqit-results-square.png');
      if(!packaged) return;
      if(data.session) mqLogCardShare(data.session.user.id, 'daily_results', null);
      const blobUrl = URL.createObjectURL(packaged.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'marqit-results-square.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 1000);
      if(msgEl){ msgEl.className = 'form-msg ok'; msgEl.textContent = 'Square image downloaded.'; setTimeout(function(){ msgEl.textContent = ''; }, 3000); }
    });
  }

  // --- Change 4: pre-result picks card ------------------------------------
  // A card for LOCKED-but-not-yet-resolved picks -- no correct/incorrect
  // state at all, since the outcome isn't known yet. Built from `prepared`
  // (set by loadDailyQuestionsInner), so it only ever includes picks that
  // have actually locked, matching the spec's availability rule exactly.
  var __mqPreResultData = null;

  // Each locked pick is its own panel: category label, the question, and the
  // YES/NO call as a colored chip -- all inside the story-safe box.
  function mqDrawPreResultCard(width, height, data){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const L = mqCardLayout(width, height), u = L.u, T = L.top;

    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, T, Math.max(0.85, u));
    const footerTop = mqCardFooterBand(ctx, width, height, 'Think I’m wrong? Pick yours.', 'playmarqit.com');

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(76 * u) + "px " + MQ_HEAD_FONT;
    ctx.fillText('My picks today', cx, T + 245 * u);
    ctx.fillStyle = MQ_INK_MUTED;
    ctx.font = "700 " + Math.round(26 * u) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, 'LOCKED IN', cx, T + 305 * u, 8 * u);

    const n = data.picks.length;
    const rowX = width * 0.075, rowW = width * 0.85, padX = 36 * u;
    const rs = T + 360 * u;
    const avail = footerTop - 30 * u - rs;
    const gap = 22 * u;
    const rowH = Math.min(250 * u, (avail - gap * (n - 1)) / Math.max(n, 1));
    const fs = Math.min(1, rowH / (250 * u));
    data.picks.forEach(function(p, i){
      const ry = rs + i * (rowH + gap);
      const choiceColor = p.choice === 'yes' ? MQ_YES : MQ_NO;
      mqCardPanel(ctx, rowX, ry, rowW, rowH, 26 * u, null);

      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK_MUTED;
      ctx.font = "700 " + Math.round(24 * u * fs) + "px " + MQ_HEAD_FONT;
      mqTrackedLeft(ctx, (CATEGORY_LABELS[p.category] || p.category).toUpperCase(), rowX + padX, ry + 58 * u * fs, 4 * u);

      mqCardChip(ctx, p.choice.toUpperCase(), rowX + rowW - padX, ry + 46 * u * fs, 54 * u * fs, choiceColor, 28 * u * fs);

      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK;
      ctx.font = "700 " + Math.round(40 * u * fs) + "px " + MQ_HEAD_FONT;
      mqWrapLines(ctx, p.questionText, rowW - padX * 2, 2).forEach(function(l, li){
        ctx.fillText(l, rowX + padX, ry + 128 * u * fs + li * 52 * u * fs);
      });
    });

    return canvas;
  }

  async function mqSharePreResultCard(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session || !__mqPreResultData || !__mqPreResultData.length) return;

    const data = { picks: __mqPreResultData };
    // Change 4 link rule: sign-up/play page for people without an account,
    // today's calls for people who have one -- since app.js can't tell
    // which the viewer is ahead of time, the homepage itself already
    // branches on session state and shows the right thing either way.
    const refTag = mqGetReferralTag(session.user.id, 'pre_result', null);
    const shareUrl = 'https://playmarqit.com/?' + refTag;
    const shareText = 'My picks today. Think I\u2019m wrong? Pick yours. ' + shareUrl;

    await mqEnsureCardFonts();
    const canvas = mqDrawPreResultCard(1080, 1920, data);
    const packaged = await mqShareCanvasToFileAndCaption(canvas, 'marqit-picks.png');
    if(!packaged) return;

    mqLogCardShare(session.user.id, 'pre_result', null);

    mqOpenShareSheet({ title: 'Share your picks', text: shareText.replace(' ' + shareUrl, ''), url: shareUrl, packaged: packaged, filename: 'marqit-picks.png' });
  }

  // --- Change 5: when to prompt sharing (post-result) ---------------------
  // Separate from the Change 4 pre-result banner above. Only ever fires for
  // the 5 allowed reasons the spec lists, at most once per calendar day,
  // and never for a miss or a broken streak -- the actual "always
  // available" Share button on the results screen is unaffected either way.
  const SHARE_PROMPT_TRIGGER_LABELS = {
    perfect_day: 'You went 3-for-3.',
    streak_milestone: 'Streak milestone unlocked.',
    tier_up: 'You just moved up a tier.',
    rival_win: 'You won your Rival Showdown.',
    called_it: 'You called one nobody saw coming.'
  };
  // Prompt state lives here (not only in the DOM) because the Play tab's
  // questions render wipes #daily-questions-container -- a banner inserted
  // before that render finishes would be erased. loadDailyQuestions() calls
  // mqRenderSharePrompt() again once it's done, so the banner always lands.
  let __mqPendingSharePrompt = null;
  // eventKey (optional) identifies the specific result that caused the
  // prompt (e.g. the result date), so the same result never prompts twice,
  // while a NEW Perfect Day / Showdown win prompts again.
  function mqMaybePromptShare(userId, triggerName, eventKey){
    if(!userId || !SHARE_PROMPT_TRIGGER_LABELS[triggerName]) return;
    if(__mqPendingSharePrompt) return; // at most one prompt per day
    const today = getETDateInfo().dateStr;
    const dayKey = 'mq_post_result_share_prompt_' + userId + '_' + today;
    const eventStorageKey = eventKey ? ('mq_share_prompt_event_' + userId + '_' + triggerName + '_' + eventKey) : null;
    try{
      if(localStorage.getItem(dayKey)) return;
      if(eventStorageKey && localStorage.getItem(eventStorageKey)) return;
    }catch(e){ return; }
    __mqPendingSharePrompt = { triggerName: triggerName, dayKey: dayKey, eventStorageKey: eventStorageKey };
    mqRenderSharePrompt();
  }
  function mqRenderSharePrompt(){
    const pending = __mqPendingSharePrompt;
    if(!pending) return;
    const container = document.getElementById('daily-questions-container');
    if(!container) return;
    const old = document.getElementById('mq-share-prompt-banner');
    if(old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'mq-share-prompt-banner';
    banner.className = 'trending-strip';
    banner.style.cursor = 'pointer';
    banner.innerHTML = mqIcon('flame') + '<span><strong>' + SHARE_PROMPT_TRIGGER_LABELS[pending.triggerName] + '</strong> Tap to share.</span>';
    banner.addEventListener('click', function(){
      __mqPendingSharePrompt = null;
      banner.remove();
      mqShareResultsCard(pending.triggerName);
    });
    container.insertBefore(banner, container.firstChild);
    // Only spend the once-a-day / once-per-result flags after the banner is
    // actually on the page.
    try{
      localStorage.setItem(pending.dayKey, '1');
      if(pending.eventStorageKey) localStorage.setItem(pending.eventStorageKey, '1');
    }catch(e){}
  }

  // --- Native app push notifications ---------------------------------
  // This site is loaded as-is inside the Marqit native app shell
  // (Capacitor, remote-loaded -- see the marqit-app project). Capacitor
  // injects window.Capacitor into the page automatically in that context,
  // so the exact same app.js served on the plain website can tell whether
  // it's running inside the app and skip all of this when it's just a
  // normal browser tab. No bundler, no separate file needed.
  function mqIsNativeApp(){
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  async function mqRegisterPushToken(userId){
    if(!mqIsNativeApp()) return;
    const Push = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if(!Push) return; // plugin not installed in this build yet

    try{
      let perm = await Push.checkPermissions();
      if(perm.receive !== 'granted'){
        perm = await Push.requestPermissions();
      }
      if(perm.receive !== 'granted') return; // user declined -- respect it, no nagging

      // 'registration' fires async once the OS hands back a device token.
      Push.addListener('registration', async function(tokenResult){
        const platform = window.Capacitor.getPlatform(); // 'ios' | 'android'
        try{
          await sb.from('push_tokens').upsert({
            user_id: userId,
            platform: platform,
            token: tokenResult.value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,platform' });
        }catch(e){ /* non-fatal -- next app open retries registration */ }
      });

      Push.addListener('registrationError', function(){
        // Non-fatal: notifications just won't arrive for this device.
        // Nothing actionable to show the user here.
      });

      await Push.register();
    }catch(e){ /* native push not available on this build/device -- ignore */ }
  }

  // ---- Remind a friend to place their predictions -------------------------
  // Sender taps "Remind" on a buddy, rival or Friends-board row. The send_nudge
  // RPC does every check server-side (must be buddy/rival, one per friend per
  // day, friend hasn't already picked, calls not locked). On "sent" we also ask
  // the push-nudge function to push it to the friend's devices if they have push
  // on. Friends without push see an in-app banner next time they open Marqit.
  async function mqRemindFriend(btn, msgEl){
    if(btn.disabled) return;
    var toId = btn.getAttribute('data-user-id');
    var name = btn.getAttribute('data-username') || 'your friend';
    var orig = btn.textContent;
    function say(text, ok){
      if(!msgEl) return;
      msgEl.className = 'form-msg ' + (ok ? 'ok' : 'err');
      msgEl.textContent = text;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    var res = await sb.rpc('send_nudge', { p_to_user_id: toId });
    if(res.error){
      btn.disabled = false;
      btn.textContent = orig;
      say('Could not send the reminder — try again.', false);
      return;
    }
    var d = res.data || {};
    if(d.status === 'sent'){
      btn.textContent = 'Sent';
      say('Reminder sent to ' + name + '.', true);
      mqTrack('friend_remind_sent');
      try{
        var p = sb.functions.invoke('push-nudge', { body: { nudge_id: d.nudge_id } });
        if(p && p.catch) p.catch(function(){});
      }catch(e){ /* push is best-effort; the in-app banner still works */ }
    }else if(d.status === 'already_sent'){
      btn.textContent = 'Reminded today';
      say('You already reminded ' + name + ' today.', false);
    }else if(d.status === 'already_picked'){
      btn.textContent = 'Already picked';
      say(name + ' already made their picks today.', true);
    }else if(d.status === 'limit'){
      btn.textContent = 'Reminded today';
      say(name + ' has had plenty of reminders today.', false);
    }else{
      btn.disabled = false;
      btn.textContent = orig;
      say('Today’s calls are locked. Try again tomorrow.', false);
    }
  }

  // Banner shown to the friend: "<username> is reminding you to place your
  // predictions on Marqit." Server hides it once they've picked everything.
  async function mqLoadNudgeBanner(){
    try{
      var s = await sb.auth.getSession();
      if(!(s.data && s.data.session)) return;
      var res = await sb.rpc('get_my_nudges');
      var old = document.getElementById('mq-nudge-banner');
      if(old) old.remove();
      var rows = res.data || [];
      if(!rows.length) return;
      var names = [];
      rows.forEach(function(r){ if(r.from_username && names.indexOf(r.from_username) < 0) names.push(r.from_username); });
      if(!names.length) return;
      var who = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      var el = document.createElement('div');
      el.id = 'mq-nudge-banner';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="mq-nudge-text"><strong>' + escapeHtml(who) + '</strong> ' + (names.length === 1 ? 'is' : 'are') + ' reminding you to place your predictions on Marqit.</span>' +
        '<button type="button" class="mq-nudge-go">Make my picks</button>' +
        '<button type="button" class="mq-nudge-x" aria-label="Dismiss">×</button>';
      document.body.appendChild(el);
      var dismiss = function(){ el.remove(); sb.rpc('mark_nudges_seen'); };
      el.querySelector('.mq-nudge-go').addEventListener('click', function(){ dismiss(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      el.querySelector('.mq-nudge-x').addEventListener('click', dismiss);
      mqTrack('friend_remind_banner_shown');
    }catch(e){ /* never break the page over a banner */ }
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) mqLoadNudgeBanner(); });

  // ---- Ask for push notifications right after sign-in ----------------------
  // Browsers never allow a site to switch push on silently: the person has to
  // tap Allow on the browser's own popup, and that popup only works from a tap.
  // So "on by default" = we ask once, up front, with a single big "Turn on"
  // button. They can turn it off any time in settings. Asked once per person per
  // device (flag in localStorage); "Not now" is respected.
  async function mqTurnOnPush(userId){
    const registration = await swRegistrationPromise;
    if(!registration || typeof Notification === 'undefined' || !Notification.requestPermission) return 'unsupported';
    let perm;
    try{ perm = await Notification.requestPermission(); }catch(e){ return 'unsupported'; }
    if(perm !== 'granted') return 'blocked';
    let subscription;
    try{
      subscription = await registration.pushManager.getSubscription();
      if(!subscription){
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      }
    }catch(e){ return 'error'; }
    const subJson = subscription.toJSON();
    const { error: subError } = await sb.from('push_subscriptions').upsert({
      user_id: userId, endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth
    }, { onConflict: 'endpoint' });
    if(subError) return 'error';
    const { error } = await sb.from('profiles').update({ notify_push: true }).eq('id', userId);
    if(error) return 'error';
    if(typeof setNotifyPushBtn === 'function') setNotifyPushBtn(true);
    return 'ok';
  }

  // Ask schedule: the first ask comes at sign-in; every later ask comes right
  // after they submit their picks (the moment they care most). A "Not now" is
  // not final -- we ask again on a later day, up to 4 asks total, never twice in
  // one day. Turning it on (or the browser blocking it) ends the asking.
  function mqPushAskState(uid){
    try{ return JSON.parse(localStorage.getItem('mq_push_ask_' + uid) || '{}') || {}; }catch(e){ return {}; }
  }
  function mqPushAskSave(uid, st){ try{ localStorage.setItem('mq_push_ask_' + uid, JSON.stringify(st)); }catch(e){} }

  async function mqMaybeAskPush(moment){
    try{
      moment = moment || 'signin';
      if(typeof Notification === 'undefined' || Notification.permission === 'denied') return;
      var s = await sb.auth.getSession();
      var session = s.data && s.data.session;
      if(!session) return;
      var uid = session.user.id;
      var st = mqPushAskState(uid);
      var count = st.count || 0;
      var todayKey = new Date().toISOString().slice(0, 10);
      if(count >= 4 || st.done || st.day === todayKey) return;
      if(moment === 'signin' && count > 0) return; // repeat asks only come after submitting picks
      if(document.getElementById('mq-push-ask')) return;
      var prof = await sb.from('profiles').select('notify_push').eq('id', uid).maybeSingle();
      if(!prof.data || prof.data.notify_push) return;
      st.count = count + 1; st.day = todayKey;
      mqPushAskSave(uid, st);

      var afterSubmit = moment === 'after_submit';
      var el = document.createElement('div');
      el.id = 'mq-push-ask';
      el.setAttribute('role', 'dialog');
      el.innerHTML = '<div class="mq-push-text"><strong>' + (afterSubmit ? 'Get your results the minute they’re in' : 'Turn on notifications?') + '</strong>' +
        '<span>' + (afterSubmit ? 'We’ll let you know when today’s calls are scored, and when a friend reminds you to play.' : 'Get notified once today’s calls are available. Stay in touch with buddies and rivals.') + ' You can turn it off any time in settings.</span></div>' +
        '<button type="button" class="mq-push-yes">Turn on notifications</button>' +
        '<button type="button" class="mq-push-no">Not now</button>';
      document.body.appendChild(el);
      mqTrack('push_ask_shown', { moment: moment, n: st.count });
      el.querySelector('.mq-push-no').addEventListener('click', function(){ mqTrack('push_ask_declined', { moment: moment }); el.remove(); });
      el.querySelector('.mq-push-yes').addEventListener('click', async function(){
        this.disabled = true;
        this.textContent = 'One sec…';
        var r = await mqTurnOnPush(uid);
        mqTrack('push_ask_result', { result: r, moment: moment });
        st.done = true; mqPushAskSave(uid, st);
        var msg = r === 'ok'
          ? '<strong>Notifications are on.</strong><span>You can turn them off any time in settings.</span>'
          : '<strong>Couldn’t turn them on.</strong><span>' + (r === 'blocked' ? 'Notifications are blocked in your browser settings.' : 'Your browser may not support it. You can try again in settings.') + '</span>';
        el.querySelector('.mq-push-text').innerHTML = msg;
        el.querySelector('.mq-push-yes').remove();
        el.querySelector('.mq-push-no').remove();
        setTimeout(function(){ el.remove(); }, r === 'ok' ? 2500 : 4500);
      });
    }catch(e){ /* never break the page over a prompt */ }
  }

  // Google and email-code sign-ins have no Marqit password. Offer one so they can also log in with
  // their username and password. Skipped for accounts that already have one, and
  // snoozed for 3 days if they tap "Not now".
  function mqMaybeAskPassword(user, needsUsername){
    try {
      if(!user || needsUsername) return;
      const providers = (user.app_metadata && user.app_metadata.providers) || [];
      const meta = user.user_metadata || {};
      // Eligible: Google-only accounts, and accounts created through an email code.
      // Anyone who already picked a password (or signed up with one) is skipped.
      const googleOnly = providers.indexOf('google') > -1 && providers.indexOf('email') === -1;
      const codeSignup = meta.signup_method === 'code';
      if((!googleOnly && !codeSignup) || meta.password_set) return;
      const key = 'mq-pw-snooze-' + user.id;
      try { const until = parseInt(localStorage.getItem(key) || '0', 10); if(until > Date.now()) return; } catch(e){}
      const backdrop = document.getElementById('google-password-backdrop');
      if(!backdrop) return;
      const input = document.getElementById('google-password-input');
      const msg = document.getElementById('google-password-msg');
      input.value = '';
      msg.textContent = '';
      msg.className = 'form-msg';
      backdrop.style.display = 'flex';
      backdrop.setAttribute('data-user', user.id);
    } catch(e){ /* never break the page over a prompt */ }
  }
  document.getElementById('google-password-skip-btn').addEventListener('click', function(){
    const backdrop = document.getElementById('google-password-backdrop');
    try { localStorage.setItem('mq-pw-snooze-' + backdrop.getAttribute('data-user'), String(Date.now() + 3 * 86400000)); } catch(e){}
    backdrop.style.display = 'none';
  });
  document.getElementById('google-password-save-btn').addEventListener('click', async function(){
    const input = document.getElementById('google-password-input');
    const msg = document.getElementById('google-password-msg');
    const pw = input.value;
    msg.className = 'form-msg';
    msg.textContent = '';
    if(pw.length < 8){
      msg.classList.add('err');
      msg.textContent = 'Password needs to be at least 8 characters.';
      return;
    }
    const btn = this;
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: pw, data: { password_set: true } });
    btn.disabled = false;
    if(error){
      msg.classList.add('err');
      msg.textContent = 'Could not save \u2014 try again.';
      return;
    }
    msg.classList.add('ok');
    msg.textContent = 'Saved. You can now log in with your username and password.';
    setTimeout(function(){ document.getElementById('google-password-backdrop').style.display = 'none'; }, 1800);
  });

  sb.auth.onAuthStateChange(function(event, session){
    // supabase-js holds its auth lock while this callback runs, so any
    // query made from inside it can stall or go out without the user's token
    // (which makes the profile insert fail RLS). Hand the work to the next
    // tick so the session is fully settled first.
    setTimeout(function(){ mqHandleAuthEvent(event, session); }, 0);
  });
  async function mqHandleAuthEvent(event, session){
    if(event === 'SIGNED_IN' && session && session.user){
      const profileResult = await ensureProfile(session.user);
      if(profileResult === 'BANNED') return;
      showSignedIn(profileResult.username || 'you', profileResult.needsUsername);
      mqMaybeAskPassword(session.user, profileResult.needsUsername);
      mqLoadNudgeBanner();
      setTimeout(function(){ mqMaybeAskPush('signin'); }, 2500);
      mqRegisterPushToken(session.user.id);
      if(typeof mqApplyGreekVisibility === 'function') mqApplyGreekVisibility();
      if(typeof autoJoinFromUrl === 'function') autoJoinFromUrl(); // picks up a stashed ?group= invite code now that we have a session
    }
    if(event === 'PASSWORD_RECOVERY'){
      // They clicked the reset-password link in their email and landed back
      // here with a temporary recovery session. Let them set a new password.
      const backdrop = document.getElementById('new-password-backdrop');
      const input = document.getElementById('new-password-input');
      const msg = document.getElementById('new-password-msg');
      input.value = '';
      msg.textContent = '';
      msg.className = 'form-msg';
      backdrop.style.display = 'flex';
      input.focus();
    }
  }

  document.getElementById('new-password-save-btn').addEventListener('click', async function(){
    const input = document.getElementById('new-password-input');
    const msg = document.getElementById('new-password-msg');
    const newPassword = input.value;
    msg.className = 'form-msg';
    msg.textContent = '';
    if(newPassword.length < 8){
      msg.classList.add('err');
      msg.textContent = 'Password needs to be at least 8 characters.';
      return;
    }
    const btn = this;
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: newPassword });
    btn.disabled = false;
    if(error){
      msg.classList.add('err');
      msg.textContent = 'Could not save \u2014 try again.';
      return;
    }
    document.getElementById('new-password-backdrop').style.display = 'none';
  });

  sb.auth.getSession().then(function(res){
    const session = res.data.session;
    if(session && session.user){
      ensureProfile(session.user).then(function(profileResult){
        if(profileResult === 'BANNED') return;
        showSignedIn(profileResult.username || 'you', profileResult.needsUsername);
        mqMaybeAskPassword(session.user, profileResult.needsUsername);
        mqLoadNudgeBanner();
        setTimeout(function(){ mqMaybeAskPush('signin'); }, 2500);
      });
    }else{
      mqInitOneTap();
    }
  });

  // ---- Google One Tap: signed-out visitors who are already logged in to Google
  // get a small "continue as <name>" card, one tap and they're in (no redirect,
  // no password). Sign-in goes through the same Supabase session as the normal
  // Google button, so SIGNED_IN / ensureProfile / guest-picks sync all run as usual.
  // Everything here is best-effort: any failure just means no One Tap card.
  var MQ_GOOGLE_CLIENT_ID = '59467705788-nh1ugvbj4cdu3019v3op9075vvfjk4kk.apps.googleusercontent.com';
  function mqRandomNonce(){
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  async function mqSha256Hex(text){
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function mqInitOneTap(){
    try{
      // Google only authorizes One Tap on the production origin; on preview or
      // local hosts it would just log errors.
      if(location.hostname !== 'playmarqit.com' && location.hostname !== 'www.playmarqit.com') return;
      if(mqInAppBrowser()) return; // Google blocks it in embedded in-app browsers anyway
      if(!window.crypto || !crypto.subtle || !window.TextEncoder) return;
      // Don't compete with the OAuth return trip or a password-reset link.
      if(/access_token|type=recovery|error_description/.test(location.hash) || /[?&]code=/.test(location.search)) return;
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = async function(){
        try{
          if(!(window.google && google.accounts && google.accounts.id)) return;
          var rawNonce = mqRandomNonce();
          var hashedNonce = await mqSha256Hex(rawNonce);
          google.accounts.id.initialize({
            client_id: MQ_GOOGLE_CLIENT_ID,
            nonce: hashedNonce,
            use_fedcm_for_prompt: true,
            cancel_on_tap_outside: false,
            itp_support: true,
            auto_select: false,
            callback: async function(resp){
              try{
                if(!resp || !resp.credential) return;
                try{
                  if(!sessionStorage.getItem('marqit_pending_signup_source')) sessionStorage.setItem('marqit_pending_signup_source', pendingSignupSource || 'organic');
                }catch(e){}
                const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: rawNonce });
                if(error){ mqTrack('one_tap_error'); }
                else{ mqTrack('one_tap_signin'); }
              }catch(e){}
            }
          });
          google.accounts.id.prompt();
        }catch(e){}
      };
      document.head.appendChild(s);
    }catch(e){}
  }

  var CATEGORY_LABELS = { sports: 'Sports', pop_culture: 'Pop culture', news: 'News' };
  var CATEGORY_ICONS = {
    sports: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.5 5.5c3 3 3 10 0 13M18.5 5.5c-3 3-3 10 0 13"/></svg>',
    pop_culture: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l1.5-4h4L7 8M9 8l1.5-4h4L13 8M15 8l1.5-4h3.5L19 8"/><rect x="3" y="8" width="18" height="12" rx="1.5"/></svg>',
    news: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a2 2 0 0 1 2 2v13a1 1 0 0 1-1.7.7L4 19V4z"/><path d="M8 8h7M8 12h7M8 16h4"/></svg>'
  };

  // Leaderboards insert usernames into innerHTML for performance/simplicity. The signup
  // form only allows letters/numbers/underscore in usernames, but that's a client-side
  // check only — since the Supabase key is public, someone could write a malicious
  // username straight to the database and bypass it. Escaping here means that even if
  // that ever happens, it renders as inert text instead of executing as HTML/script.
  // Turns leftover HTML codes (&#x2019;, &#39;, &amp;, &rsquo;) from news feeds back into real
  // characters. Run it on text BEFORE escapeHtml, so headlines never show raw codes.
  function mqDecodeEntities(str){
    var NAMED = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', rsquo:'’', lsquo:'‘', rdquo:'”', ldquo:'“', ndash:'–', mdash:'—', hellip:'…' };
    var out = String(str == null ? '' : str);
    for(var i = 0; i < 3; i++){
      var next = out.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, function(m, hex, dec, name){
        try {
          if(hex) return String.fromCodePoint(parseInt(hex, 16));
          if(dec) return String.fromCodePoint(parseInt(dec, 10));
        } catch(e){ return m; }
        var v = NAMED[String(name).toLowerCase()];
        return v === undefined ? m : v;
      });
      if(next === out) break;
      out = next;
    }
    return out;
  }
  function escapeHtml(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toTitleCase(str){
    return String(str).trim().toLowerCase().replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  }

  // Username lookups (buddy/rival/group-invite adds, signup uniqueness) are
  // case-insensitive -- someone typing "Jsmith" should find "jsmith" and
  // vice versa. Supabase's .ilike() does case-insensitive matching, but it
  // also treats % and _ as SQL wildcards, and usernames are allowed to
  // contain underscores. Escaping those (plus a literal backslash) before
  // the ilike call keeps it an exact, case-insensitive match instead of an
  // accidental pattern search.
  function mqEscapeIlike(str){
    return String(str).replace(/[\\%_]/g, '\\$&');
  }

  // Marqit's daily cycle (question_date, lock times) runs on Eastern Time.
  // new Date().toISOString() gives the UTC date, which rolls over to "tomorrow"
  // around 7-8pm ET every day (right around the 8:30pm lock), causing
  // "today's calls aren't posted yet" for real ET users during peak hours.
  // This computes the actual ET calendar date instead, regardless of the visitor's own timezone.
  function getETDateInfo(){
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
    }).formatToParts(new Date());
    var map = {};
    parts.forEach(function(p){ map[p.type] = p.value; });
    return { dateStr: map.year + '-' + map.month + '-' + map.day, weekday: map.weekday };
  }

  // A plain single-color line showing how the Yes% has moved as votes came in,
  // built from real vote timestamps already stored in the database. Deliberately
  // not color-coded to yes/no (uses the page's ink color) so it just reads as
  // "how sentiment has moved," not another yes/no signal.
  // A step chart showing how the Yes% has actually moved over time, built from
  // real vote timestamps. Deliberately single-color (uses the page's ink color,
  // not yes/no colors) so it reads as "how sentiment moved," not another signal.
  function buildTrendSVG(points){
    if(!points || points.length < 2) return '<div class="ticket-meta">Not enough calls yet for a trend line.</div>';

    var W = 320, H = 150;
    var padL = 34, padR = 10, padT = 10, padB = 22;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var gradId = 'trendFill' + Math.random().toString(36).slice(2, 9);

    var startT = points[0].time.getTime();
    var endT = Math.max(points[points.length - 1].time.getTime(), Date.now());
    var span = endT - startT || 1;

    function xPos(t){ return padL + ((t - startT) / span) * plotW; }
    function yPos(pct){ return padT + (1 - pct / 100) * plotH; }

    // Step path: the percentage only actually changes the instant a new vote
    // lands, so it should stay flat in between rather than sloping smoothly.
    var d = 'M ' + xPos(startT).toFixed(1) + ' ' + yPos(points[0].pct).toFixed(1);
    for(var i = 1; i < points.length; i++){
      var xi = xPos(points[i].time.getTime());
      d += ' L ' + xi.toFixed(1) + ' ' + yPos(points[i - 1].pct).toFixed(1);
      d += ' L ' + xi.toFixed(1) + ' ' + yPos(points[i].pct).toFixed(1);
    }
    var lastPct = points[points.length - 1].pct;
    var endX = xPos(endT).toFixed(1);
    d += ' L ' + endX + ' ' + yPos(lastPct).toFixed(1);

    var baseline = (H - padB).toFixed(1);
    var areaD = d + ' L ' + endX + ' ' + baseline + ' L ' + xPos(startT).toFixed(1) + ' ' + baseline + ' Z';

    var gridLines = [0, 25, 50, 75, 100].map(function(pct){
      var y = yPos(pct).toFixed(1);
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="2,3"/>' +
        '<text x="' + (padL - 6) + '" y="' + (parseFloat(y) + 3) + '" text-anchor="end" font-size="9" fill="var(--ink-soft)" font-family="Barlow,sans-serif">' + pct + '%</text>';
    }).join('');

    function fmtTime(t){
      return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    var xLabels =
      '<text x="' + padL + '" y="' + (H - 6) + '" text-anchor="start" font-size="9" fill="var(--ink-soft)" font-family="Barlow,sans-serif">' + fmtTime(startT) + '</text>' +
      '<text x="' + (W - padR) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="var(--ink-soft)" font-family="Barlow,sans-serif">' + fmtTime(endT) + '</text>';

    // Dots at the first call, at every point the percentage changed, and at the
    // newest call. Each has a big invisible tap target; tapping (or clicking, or
    // pressing Enter on) a dot pops up the time that call was submitted.
    var moveMarkers = '', hitTargets = '';
    function addDot(pt, x, y){
      var xs = x.toFixed(1), ys = y.toFixed(1);
      moveMarkers += '<circle cx="' + xs + '" cy="' + ys + '" r="2.4" fill="var(--ink)" pointer-events="none"/>';
      hitTargets += '<circle class="trend-hit" cx="' + xs + '" cy="' + ys + '" r="13" fill="transparent" tabindex="0" role="button" ' +
        'aria-label="Call submitted at ' + fmtTime(pt.time.getTime()) + ', Yes ' + pt.pct + ' percent" ' +
        'data-x="' + xs + '" data-y="' + ys + '" data-t="' + fmtTime(pt.time.getTime()) + '" data-p="' + pt.pct + '"/>';
    }
    addDot(points[0], xPos(points[0].time.getTime()), yPos(points[0].pct));
    for(var m = 1; m < points.length - 1; m++){
      if(points[m].pct === points[m - 1].pct) continue;
      addDot(points[m], xPos(points[m].time.getTime()), yPos(points[m].pct));
    }
    var lastPt = points[points.length - 1];
    hitTargets += '<circle class="trend-hit" cx="' + endX + '" cy="' + yPos(lastPct).toFixed(1) + '" r="13" fill="transparent" tabindex="0" role="button" ' +
      'aria-label="Latest call submitted at ' + fmtTime(lastPt.time.getTime()) + ', Yes ' + lastPct + ' percent" ' +
      'data-x="' + endX + '" data-y="' + yPos(lastPct).toFixed(1) + '" data-t="' + fmtTime(lastPt.time.getTime()) + '" data-p="' + lastPct + '"/>';

    // Small "Yes 62%" bubble on the newest point (flips below the line near the top edge)
    var dotX = parseFloat(endX), dotY = parseFloat(yPos(lastPct).toFixed(1));
    var bw = 58, bh = 19;
    var bx = Math.max(padL, Math.min(dotX - bw + 6, W - padR - bw));
    var by = dotY - bh - 9 < padT ? dotY + 10 : dotY - bh - 9;
    var bubble = '<g class="trend-bubble"><rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + bh + '" rx="9.5" style="fill:rgb(var(--tint))"/>' +
      '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by + 13).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0E1014" font-family="Barlow,sans-serif">Yes ' + lastPct + '%</text></g>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-svg">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" style="stop-color:rgb(var(--tint));stop-opacity:.42"/>' +
        '<stop offset="100%" style="stop-color:rgb(var(--tint));stop-opacity:0"/>' +
      '</linearGradient></defs>' +
      gridLines +
      '<path class="trend-area" d="' + areaD + '" fill="url(#' + gradId + ')" stroke="none"/>' +
      '<path class="trend-line" d="' + d + '" fill="none" style="stroke:rgb(var(--tint))" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      moveMarkers +
      '<circle class="trend-pulse" cx="' + endX + '" cy="' + yPos(lastPct).toFixed(1) + '" r="4" style="fill:rgb(var(--tint))"/>' +
      '<circle class="trend-dot" cx="' + endX + '" cy="' + yPos(lastPct).toFixed(1) + '" r="4.2" style="fill:rgb(var(--tint));stroke:var(--panel)" stroke-width="2"/>' +
      bubble +
      xLabels +
      hitTargets +
      '</svg>';
  }

  // Tap/click/Enter on a chart dot: show a small tag with the time that call was
  // submitted. Tap the same dot again, tap elsewhere, or press Escape to close it.
  (function(){
    var NS = 'http://www.w3.org/2000/svg';
    function closePop(svg){ var old = svg && svg.querySelector('.trend-pop'); if(old) old.remove(); }
    function openPop(hit){
      var svg = hit.ownerSVGElement; if(!svg) return;
      var wasSame = svg.__popFor === hit;
      closePop(svg); svg.__popFor = null;
      if(wasSame) return;
      var x = parseFloat(hit.getAttribute('data-x')), y = parseFloat(hit.getAttribute('data-y'));
      var vb = svg.viewBox.baseVal, W = vb.width;
      var g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'trend-pop'); g.setAttribute('pointer-events', 'none');
      var rect = document.createElementNS(NS, 'rect');
      var t1 = document.createElementNS(NS, 'text'), t2 = document.createElementNS(NS, 'text');
      t1.textContent = 'Submitted ' + hit.getAttribute('data-t');
      t2.textContent = 'Yes ' + hit.getAttribute('data-p') + '% at that point';
      [t1, t2].forEach(function(t, i){ t.setAttribute('font-family', 'Barlow,sans-serif'); t.setAttribute('font-size', i ? '9' : '10.5'); t.setAttribute('font-weight', i ? '500' : '700'); t.setAttribute('fill', i ? '#4B515C' : '#0E1014'); });
      g.appendChild(rect); g.appendChild(t1); g.appendChild(t2); svg.appendChild(g);
      var w = Math.max(t1.getComputedTextLength(), t2.getComputedTextLength()) + 16, h = 34;
      var bx = Math.max(2, Math.min(x - w / 2, W - w - 2));
      var by = y - h - 10 < 0 ? y + 10 : y - h - 10;
      rect.setAttribute('x', bx); rect.setAttribute('y', by); rect.setAttribute('width', w); rect.setAttribute('height', h); rect.setAttribute('rx', 7); rect.setAttribute('fill', '#F4F4F1');
      t1.setAttribute('x', bx + 8); t1.setAttribute('y', by + 14); t2.setAttribute('x', bx + 8); t2.setAttribute('y', by + 26);
      svg.__popFor = hit;
    }
    document.addEventListener('click', function(e){
      var hit = e.target.closest && e.target.closest('.trend-hit');
      if(hit){ openPop(hit); return; }
      document.querySelectorAll('.trend-svg').forEach(function(sv){ closePop(sv); sv.__popFor = null; });
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ document.querySelectorAll('.trend-svg').forEach(function(sv){ closePop(sv); sv.__popFor = null; }); return; }
      if((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('trend-hit')){ e.preventDefault(); openPop(e.target); }
    });
  })();

  // Makes a freshly-inserted trend line draw itself in instead of just
  // appearing instantly. Call this right after any trend-svg HTML is
  // inserted into the DOM (getTotalLength only works on a rendered element).
  function animateTrendLine(root){
    var path = root.querySelector('.trend-line');
    if(!path) return;
    try{
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect(); // force layout so the transition actually animates
      path.style.transition = 'stroke-dashoffset 900ms ease';
      requestAnimationFrame(function(){
        path.style.strokeDashoffset = '0';
      });
    }catch(e){ /* SVG not measurable yet — skip the animation, chart still shows fine */ }
  }

  /* ===== Card visuals: specific icons, made-up team badges, crowd tags. No emoji. ===== */
  var MQ_ICON_PATHS = {
    helmet: '<path d="M3.5 15C3.5 9.2 7.6 5 13 5c3.9 0 6.8 2.4 7.4 6v1.4"/><path d="M3.5 15c0 2.4 1.9 4 4.4 4h3.6l1.7-1.5"/><path d="M20.4 12.4h-6.9l-.3 5.1"/><path d="M13.2 17.5h6l1.2-5.1M17 12.4v5.1"/><circle cx="9" cy="13" r="1.3"/><path d="M6.6 7.7c2.7 1.6 6.4 2.1 9.9.9"/>',
    jerseyTank: '<path d="M8 3v2.5C8 8 4.5 8.5 4.5 12.5V21h15v-8.5C19.5 8.5 16 8 16 5.5V3"/><path d="M8 3c.4 2.3 2 3.8 4 3.8s3.6-1.5 4-3.8"/><path d="M10 12.5h4M12 12.5V17"/>',
    jersey: '<path d="M8.6 3.6L3 6.2l2 4.4 2.6-1.1v11h8.8v-11l2.6 1.1 2-4.4-5.6-2.6C15.2 5.3 13.8 6.4 12 6.4S8.8 5.3 8.6 3.6z"/><path d="M10 12.5h4"/>',
    baseball: '<circle cx="12" cy="12" r="9"/><path d="M6.2 5.2c2.6 2.9 2.6 10.7 0 13.6M17.8 5.2c-2.6 2.9-2.6 10.7 0 13.6"/><path d="M7.8 9l1.5-.4M8.2 12l1.6 0M7.8 15l1.5.4M16.2 9l-1.5-.4M15.8 12l-1.6 0M16.2 15l-1.5.4"/>',
    hockey: '<path d="M6 3l7 13h5.5"/><path d="M6 3l1.8-.6"/><ellipse cx="9" cy="20" rx="3.2" ry="1.3"/><path d="M5.8 20v-1.3M12.2 20v-1.3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/>',
    tv: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 3.5l4 3.5 4-3.5"/>',
    chart: '<path d="M3 17l5.5-5.5 4 3.5L21 6.5"/><path d="M15.5 6.5H21V12"/>',
    ballot: '<path d="M4 13h16v7H4z"/><path d="M9 16.5h6"/><path d="M8 13V4.5h8V13"/><path d="M10.4 8.6l1.3 1.3 2.2-2.6"/>',
    capitol: '<path d="M3 9.5L12 4l9 5.5z"/><path d="M6 12v6M10 12v6M14 12v6M18 12v6M3 20.5h18"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z"/>',
    flame: '<path d="M12 3c.8 3.2 5 4.8 5 9.6A5 5 0 0 1 7 12.6c0-1.9.9-3.1 2-3.9.2 1.3.8 2 1.7 2.2C10.4 8.4 10.7 5.6 12 3z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.6 0 4.5 2 4.5 5"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    scale: '<path d="M12 4v16M7 20h10M5 7.5h14"/><path d="M5 7.5L2.8 13a2.9 2.9 0 0 0 5.4 0zM19 7.5L16.8 13a2.9 2.9 0 0 0 5.4 0z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    swap: '<path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    xmark: '<path d="M6 6l12 12M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    star: '<path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17.4l-5.4 2.8 1.1-6.1L3.2 9.9l6.1-.8z"/>',
    arrowUp: '<path d="M12 19V6M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v13M6 13l6 6 6-6"/>',
    trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5.2c0 2.6 1 3.9 3 4.3M16 6h2.8c0 2.6-1 3.9-3 4.3"/><path d="M12 13.5V17M10 17h4v3h-4zM8.5 20h7"/>',
    note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4c-.5-.9-1.5-1.5-2.7-1.5-1.5 0-2.6.8-2.6 1.9 0 2.8 5.5 1.2 5.5 4 0 1.2-1.1 2-2.7 2-1.3 0-2.4-.6-2.9-1.6M12 6v1.8M12 16.2V18"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5z"/><path d="M9 21l1-2M13 21l1-2"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    gavel: '<path d="M13.5 4.5l6 6-3 3-6-6z"/><path d="M11.5 11.5L5 18M4 21h9"/>',
    briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17"/>',
    rocket: '<path d="M12 3c3 2 4.5 5 4.5 8.5L12 17l-4.5-5.5C7.5 8 9 5 12 3z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M8 15l-3 1 1.5-3M16 15l3 1-1.5-3M10.5 19l1.5 2 1.5-2"/>',
    golf: '<path d="M8 21V4l9 4-9 4"/><path d="M5 21h6"/>',
    tennis: '<circle cx="12" cy="12" r="9"/><path d="M5.2 5.6c3.2 2.6 3.2 10.2 0 12.8M18.8 5.6c-3.2 2.6-3.2 10.2 0 12.8"/>',
    flag: '<path d="M6 21V4M6 5h12l-2 4 2 4H6"/>',
    sprout: '<path d="M12 20v-8"/><path d="M12 12c0-3.5-2.5-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5z"/><path d="M12 14c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5z"/>',
    crown: '<path d="M3.5 8l4.3 4L12 5.5 16.2 12l4.3-4-1.8 11H5.3z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    crosshair: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
    stack: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>'
  };
  // Filled gold star for golden-star counts (drawn, not an emoji).
  function mqStarGold(px){
    return '<svg class="mq-star" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true"><path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17.4l-5.4 2.8 1.1-6.1L3.2 9.9l6.1-.8z" fill="#ECB82C" stroke="#ECB82C" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }
  function mqIcon(name){
    return '<svg class="mq-ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (MQ_ICON_PATHS[name] || '') + '</svg>';
  }

  // Team nicknames -> short codes. Only used to draw made-up badges (never real logos).
  var MQ_TEAM_SRC = {
    nfl: 'Cardinals:ARI|Falcons:ATL|Ravens:BAL|Bills:BUF|Panthers:CAR|Bears:CHI|Bengals:CIN|Browns:CLE|Cowboys:DAL|Broncos:DEN|Lions:DET|Packers:GB|Texans:HOU|Colts:IND|Jaguars:JAX|Chiefs:KC|Raiders:LV|Chargers:LAC|Rams:LAR|Dolphins:MIA|Vikings:MIN|Patriots:NE|Saints:NO|Giants:NYG|Jets:NYJ|Eagles:PHI|Steelers:PIT|49ers:SF|Seahawks:SEA|Buccaneers:TB|Titans:TEN|Commanders:WAS',
    nba: 'Hawks:ATL|Celtics:BOS|Nets:BKN|Hornets:CHA|Bulls:CHI|Cavaliers:CLE|Mavericks:DAL|Nuggets:DEN|Pistons:DET|Warriors:GSW|Rockets:HOU|Pacers:IND|Clippers:LAC|Lakers:LAL|Grizzlies:MEM|Heat:MIA|Bucks:MIL|Timberwolves:MIN|Pelicans:NOP|Knicks:NYK|Thunder:OKC|Magic:ORL|76ers:PHI|Suns:PHX|Trail Blazers:POR|Kings:SAC|Spurs:SAS|Raptors:TOR|Jazz:UTA|Wizards:WAS',
    mlb: 'Diamondbacks:ARI|Braves:ATL|Orioles:BAL|Red Sox:BOS|Cubs:CHC|White Sox:CWS|Reds:CIN|Guardians:CLE|Rockies:COL|Tigers:DET|Astros:HOU|Royals:KC|Angels:LAA|Dodgers:LAD|Marlins:MIA|Brewers:MIL|Twins:MIN|Mets:NYM|Yankees:NYY|Athletics:ATH|Phillies:PHI|Pirates:PIT|Padres:SD|Giants:SF|Mariners:SEA|Cardinals:STL|Rays:TB|Rangers:TEX|Blue Jays:TOR|Nationals:WSH',
    nhl: 'Ducks:ANA|Bruins:BOS|Sabres:BUF|Flames:CGY|Hurricanes:CAR|Blackhawks:CHI|Avalanche:COL|Blue Jackets:CBJ|Stars:DAL|Red Wings:DET|Oilers:EDM|Panthers:FLA|Kings:LAK|Wild:MIN|Canadiens:MTL|Predators:NSH|Devils:NJD|Islanders:NYI|Rangers:NYR|Senators:OTT|Flyers:PHI|Penguins:PIT|Sharks:SJS|Kraken:SEA|Blues:STL|Lightning:TBL|Maple Leafs:TOR|Canucks:VAN|Golden Knights:VGK|Capitals:WSH|Jets:WPG|Mammoth:UTA',
    soccer: 'Inter Miami:MIA|LAFC:LAFC|LA Galaxy:LAG|Seattle Sounders:SEA|Atlanta United:ATL|NYCFC:NYC|Manchester United:MUN|Manchester City:MCI|Liverpool:LIV|Arsenal:ARS|Chelsea:CHE|Tottenham:TOT|Real Madrid:RMA|Barcelona:BAR|Bayern Munich:BAY|PSG:PSG|Paris Saint-Germain:PSG|Juventus:JUV|AC Milan:ACM|Inter Milan:INT|Borussia Dortmund:BVB|Atletico Madrid:ATM|Newcastle:NEW|Aston Villa:AVL',
    ncaaf: 'LSU:LSU|Ole Miss:MISS|Alabama:BAMA|Auburn:AUB|Georgia:UGA|Clemson:CLEM|Notre Dame:ND|Ohio State:OSU|Michigan:MICH|Penn State:PSU|Oklahoma:OU|Texas A&M:TAMU|Oregon:ORE|Tennessee:TENN|Florida State:FSU|Texas:TEX|USC:USC'
  };
  var MQ_LEAGUE_ORDER = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'ncaaf'];
  var MQ_LEAGUE_ICON = { nfl:'helmet', ncaaf:'helmet', nba:'jerseyTank', soccer:'jersey', mlb:'baseball', nhl:'hockey' };
  var MQ_LEAGUE_LABEL = { nfl:'NFL', ncaaf:'NCAA', nba:'NBA', soccer:'Soccer', mlb:'MLB', nhl:'NHL' };
  var MQ_LEAGUE_CTX = {
    nfl: /\b(NFL|football|touchdown|quarterback|Super Bowl|Monday Night Football|Sunday Night Football)\b/i,
    nba: /\b(NBA|basketball|three-pointer|rebounds)\b/i,
    mlb: /\b(MLB|baseball|innings?|pitcher|home run|World Series)\b/i,
    nhl: /\b(NHL|hockey|Stanley Cup)\b/i,
    soccer: /\b(soccer|MLS|Premier League|La Liga|Champions League|World Cup|UEFA|Bundesliga|Serie A)\b/i,
    ncaaf: /\b(NCAA|college football|SEC|Big Ten|Big 12|ACC)\b/i
  };
  var MQ_TEAMS = null;
  function mqTeamTable(){
    if(MQ_TEAMS) return MQ_TEAMS;
    MQ_TEAMS = [];
    MQ_LEAGUE_ORDER.forEach(function(lg){
      MQ_TEAM_SRC[lg].split('|').forEach(function(pair){
        var i = pair.lastIndexOf(':');
        var name = pair.slice(0, i);
        MQ_TEAMS.push({ league: lg, name: name, abbr: pair.slice(i + 1), re: new RegExp('(^|[^A-Za-z0-9])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])', 'g') });
      });
    });
    // Longest names first so "Texas A&M" wins over "Texas".
    MQ_TEAMS.sort(function(a, b){ return b.name.length - a.name.length; });
    return MQ_TEAMS;
  }
  function mqFindTeams(text){
    var hits = [], taken = [];
    mqTeamTable().forEach(function(t){
      var m;
      t.re.lastIndex = 0;
      while((m = t.re.exec(text))){
        var start = m.index + m[1].length, end = start + t.name.length;
        // Same nickname in two leagues (Giants, Kings...) may share a spot; different names may not.
        var overlaps = taken.some(function(r){ return r[2] !== t.name && start < r[1] && end > r[0]; });
        if(overlaps){ t.re.lastIndex = m.index + 1; continue; }
        taken.push([start, end, t.name]);
        hits.push({ league: t.league, name: t.name, abbr: t.abbr, idx: start });
        break;
      }
    });
    return hits;
  }
  function mqGenericAbbr(name){
    if(/^[A-Z&]{2,5}$/.test(name)) return name;
    var words = name.replace(/^(the|los angeles|new york)\s+/i, '').split(/\s+/).filter(Boolean);
    if(words.length <= 1) return (words[0] || name).slice(0, 3).toUpperCase();
    return words.map(function(w){ return w.charAt(0); }).join('').slice(0, 3).toUpperCase();
  }
  function mqDetectVisual(q){
    var text = q.question_text || '';
    var ctx = text + ' ' + (q.resolution_criteria || '');
    var out = { kind: 'tile', icon: null, league: null, teams: null };

    if(q.category === 'sports'){
      var hits = mqFindTeams(text);
      var counts = {};
      hits.forEach(function(h){ counts[h.league] = (counts[h.league] || 0) + 1; });
      var best = null;
      MQ_LEAGUE_ORDER.forEach(function(lg){
        var score = (counts[lg] || 0) * 10 + (MQ_LEAGUE_CTX[lg].test(ctx) ? 5 : 0);
        if(score > 0 && (!best || score > best.score)) best = { lg: lg, score: score };
      });
      var lg = best ? best.lg : null;
      if(lg){
        out.icon = mqIcon(MQ_LEAGUE_ICON[lg]);
        out.league = MQ_LEAGUE_LABEL[lg];
      }
      var mine = hits.filter(function(h){ return h.league === lg; }).sort(function(a, b){ return a.idx - b.idx; });
      var teams = [];
      mine.forEach(function(h){ if(!teams.some(function(t){ return t.name === h.name; })) teams.push({ name: h.name, abbr: h.abbr }); });
      if(teams.length < 2){
        // Unknown teams (colleges, minor leagues...): try "Will X beat Y ..."
        var m = /^Will (?:the )?(.+?)\s+(?:beat|defeat|top|edge|upset)\s+(?:the )?(.+?)(?=\s+(?:by|on|in|at|tonight|today|this|for|to|when)\b|[?.,]|$)/i.exec(text);
        if(m) teams = [{ name: m[1].trim(), abbr: mqGenericAbbr(m[1].trim()) }, { name: m[2].trim(), abbr: mqGenericAbbr(m[2].trim()) }];
      }
      if(teams.length >= 2){ out.kind = 'matchup'; out.teams = teams.slice(0, 2); }
      if(!lg){
        var other = [
          ['tennis', 'TENNIS', /\b(tennis|wimbledon|us open|french open|australian open|grand slam|atp|wta)\b/i],
          ['golf', 'GOLF', /\b(golf|pga|masters|birdie|ryder cup|major championship)\b/i],
          ['flag', 'RACING', /\b(f1|formula 1|nascar|grand prix|indycar|daytona)\b/i]
        ];
        for(var oi = 0; oi < other.length; oi++){
          if(other[oi][2].test(ctx)){ out.icon = mqIcon(other[oi][0]); out.league = other[oi][1]; break; }
        }
      }
      return out;
    }

    var rules = { pop_culture: [
      ['trophy', /\b(oscars?|emmys?|grammys?|golden globes?|vmas?|awards?|best (?:actor|actress|picture|album|song)|nominee|nominated|nomination)\b/i],
      ['note', /\b(album|song|single|tour|concert|billboard|hot 100|streams?|spotify)\b/i],
      ['mic', /\b(singer|the voice|idol|got talent|rapper|coachella|music|chair turn)\b/i],
      ['film', /\b(box office|movie|film|opening weekend|this weekend|grosses|gross|trailer|sequel|blockbuster)\b/i],
      ['tv', /\b(episode|season|finale|premiere|reality|big brother|bachelor|dancing with|survivor|series|eliminated|elimination)\b/i]
    ], news: [
      ['coin', /\b(earnings|eps|revenue|profit|dividend|quarterly|ipo)\b/i],
      ['briefcase', /\b(jobs report|unemployment|payrolls?|layoffs?|hiring)\b/i],
      ['chart', /\b(s&p|stocks?|market|dow|nasdaq|yield|treasury|fed|federal reserve|rate cut|inflation|gas prices?|dollar|bitcoin|crypto|gdp)\b/i],
      ['gavel', /\b(court|judge|ruling|trial|verdict|indict\w*|lawsuit|sentenc\w*|appeal)\b/i],
      ['ballot', /\b(elections?|votes?|voters?|turnout|ballot|primary|polls?|approval)\b/i],
      ['capitol', /\b(congress|senate|house|bill|shutdown|white house|governor|legislature|tariffs?)\b/i],
      ['globe', /\b(un|nato|war|ceasefire|summit|treaty|sanctions?|russia|china|ukraine|israel|iran|gaza|europe|india|mexico|canada)\b/i],
      ['cloud', /\b(hurricane|storm|tornado|snow|rain|temperature|heat wave|weather|flood|wildfire)\b/i],
      ['rocket', /\b(spacex|nasa|rocket|starship|orbit)\b/i],
      ['chip', /\b(ai|openai|nvidia|apple|iphone|google|microsoft|meta|tesla|chip|software|tech)\b/i]
    ] };
    (rules[q.category] || []).some(function(r){
      if(!r[1].test(ctx)) return false;
      out.icon = (r[0] === 'film') ? CATEGORY_ICONS.pop_culture : mqIcon(r[0]);
      return true;
    });
    var subj = mqDetectSubject(q);
    if(subj){ out.kind = 'subject'; out.subject = subj; }
    return out;
  }

  // Made-up badges: a monogram in a circle, shield or hexagon. The color and shape
  // come from the team name, so the same team always looks the same.
  var MQ_BADGE_COLORS = ['224,112,95','217,164,65','51,209,139','63,167,160','78,130,224','110,118,232','170,112,255','217,107,160','124,135,152','141,184,74'];
  var MQ_BADGE_SHAPES = [
    '<circle cx="20" cy="20" r="17.5"/>',
    '<path d="M20 3.5l13 4.2v9.6c0 9-5.6 14.4-13 19.2C12.6 31.7 7 26.3 7 17.3V7.7z"/>',
    '<path d="M20 3l14.5 8.4v17.2L20 37 5.5 28.6V11.4z"/>'
  ];
  function mqHash(str){ var h = 7; for(var i = 0; i < str.length; i++){ h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h; }
  function mqTeamBadge(team){
    var h = mqHash(team.name);
    var c = MQ_BADGE_COLORS[h % MQ_BADGE_COLORS.length];
    var shape = MQ_BADGE_SHAPES[(h >>> 4) % MQ_BADGE_SHAPES.length];
    var abbr = escapeHtml(String(team.abbr || '').slice(0, 5));
    var fs = abbr.length <= 3 ? 12.5 : (abbr.length === 4 ? 10.5 : 9);
    return '<svg class="mq-badge" viewBox="0 0 40 40" aria-hidden="true">' +
      '<g fill="rgba(' + c + ',.2)" stroke="rgb(' + c + ')" stroke-width="1.7" stroke-linejoin="round">' + shape + '</g>' +
      '<text x="20" y="' + (fs > 11 ? 23.6 : 23) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" letter-spacing=".4" fill="rgb(' + c + ')" style="font-family:\'Big Shoulders Display\',Barlow,sans-serif">' + abbr + '</text>' +
      '<path d="M14 28.2h12" stroke="rgba(' + c + ',.55)" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>';
  }

  // ---- Subject badges for Pop culture and News cards (made-up monogram badges, never real logos) ----
  var MQ_SUBJECTS = [
    [/\bthe voice\b/i, 'The Voice', 'VOICE', 'Reality TV'],
    [/\bdancing with the stars\b|\bDWTS\b/i, 'Dancing with the Stars', 'DWTS', 'Reality TV'],
    [/\bamerican idol\b/i, 'American Idol', 'IDOL', 'Reality TV'],
    [/\bsurvivor\b/i, 'Survivor', 'SURV', 'Reality TV'],
    [/\bbig brother\b/i, 'Big Brother', 'BB', 'Reality TV'],
    [/\bbachelor(?:ette)?\b/i, 'The Bachelor', 'BACH', 'Reality TV'],
    [/\blove island\b/i, 'Love Island', 'LOVE', 'Reality TV'],
    [/\bsaturday night live\b|\bSNL\b/, 'Saturday Night Live', 'SNL', 'Late night'],
    [/\boscars?\b|\bacademy awards?\b/i, 'The Oscars', 'OSC', 'Awards'],
    [/\bemmys?\b/i, 'The Emmys', 'EMMY', 'Awards'],
    [/\bgrammys?\b/i, 'The Grammys', 'GRAM', 'Awards'],
    [/\bgolden globes?\b/i, 'Golden Globes', 'GG', 'Awards'],
    [/\bvmas?\b|\bvideo music awards?\b/i, 'The VMAs', 'VMA', 'Awards'],
    [/\bmet gala\b/i, 'Met Gala', 'MET', 'Fashion'],
    [/\bcoachella\b/i, 'Coachella', 'COAC', 'Festival'],
    [/\bs&p 500\b|\bs&p\b/i, 'S&P 500', 'SPX', 'Markets'],
    [/\bdow jones\b|\bdjia\b|\bthe dow\b/i, 'Dow Jones', 'DOW', 'Markets'],
    [/\bnasdaq\b/i, 'Nasdaq', 'NDQ', 'Markets'],
    [/\bbitcoin\b|\bbtc\b/i, 'Bitcoin', 'BTC', 'Crypto'],
    [/\bethereum\b/i, 'Ethereum', 'ETH', 'Crypto'],
    [/\bfederal reserve\b|\bthe fed\b|\bfomc\b|\brate cut\b/i, 'Federal Reserve', 'FED', 'Economy'],
    [/\binflation\b|\bcpi\b/i, 'Inflation', 'CPI', 'Economy'],
    [/\bjobs report\b|\bunemployment\b|\bpayrolls?\b/i, 'Jobs report', 'JOBS', 'Economy'],
    [/\bgas prices?\b/i, 'Gas prices', 'GAS', 'Economy'],
    [/\bsupreme court\b|\bscotus\b/i, 'Supreme Court', 'COURT', 'Courts'],
    [/\bu\.?s\.? senate\b|\bthe senate\b|\bsenate\b/i, 'U.S. Senate', 'SEN', 'Congress'],
    [/\bu\.?s\.? house\b|\bhouse of representatives\b/i, 'U.S. House', 'HOUSE', 'Congress'],
    [/\bwhite house\b/i, 'White House', 'WH', 'Politics'],
    [/\bnato\b/i, 'NATO', 'NATO', 'World'],
    [/\bunited nations\b|\bthe UN\b/, 'United Nations', 'UN', 'World']
  ];
  function mqDetectSubject(q){
    var text = q.question_text || '';
    if(q.category !== 'pop_culture' && q.category !== 'news') return null;
    // company earnings: "Will KB Home report ..." / "Will Nike beat ..."
    if(q.category === 'news' && /\b(earnings|EPS|quarterly|revenue|profit)\b/i.test(text + ' ' + (q.resolution_criteria || ''))){
      var em = /Will\s+(?:the\s+)?([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,2})\s+(?:report|post|beat|miss|earn|announce|exceed|top|raise|cut|guide)/.exec(text);
      if(em){
        var nm = em[1].trim();
        var parts = nm.split(/\s+/);
        var ab = /^[A-Z&]{2,4}$/.test(nm) ? nm : (parts.length === 1 ? nm.slice(0, 4).toUpperCase() : (/^[A-Z&]{2,3}$/.test(parts[0]) ? (parts[0] + parts.slice(1).map(function(w){ return w.charAt(0).toUpperCase(); }).join('')).slice(0, 4) : mqGenericAbbr(nm)));
        return { name: nm, abbr: ab, label: 'Earnings' };
      }
    }
    for(var i = 0; i < MQ_SUBJECTS.length; i++){
      if(MQ_SUBJECTS[i][0].test(text)) return { name: MQ_SUBJECTS[i][1], abbr: MQ_SUBJECTS[i][2], label: MQ_SUBJECTS[i][3] };
    }
    return null;
  }
  function mqSubjectHtml(sub, iconHtml){
    return '<div class="mq-subject">' + mqTeamBadge({ name: sub.name, abbr: sub.abbr }) +
      '<div class="mq-subject-text"><span class="mq-subject-label">' + escapeHtml(sub.label) + '</span><b>' + escapeHtml(sub.name) + '</b></div>' +
      (iconHtml ? '<span class="mq-vs-ico mq-subject-ico">' + iconHtml + '</span>' : '') + '</div>';
  }
  function mqMatchupHtml(teams, iconHtml){
    function side(t, cls){ return '<div class="mq-team ' + cls + '">' + mqTeamBadge(t) + '<span>' + escapeHtml(t.name) + '</span></div>'; }
    var mid = '<span class="mq-vs">' + (iconHtml ? '<span class="mq-vs-ico">' + iconHtml + '</span>' : '') + '<b>VS</b></span>';
    return '<div class="mq-matchup">' + side(teams[0], 'left') + mid + side(teams[1], 'right') + '</div>';
  }

  // Shown only to people who have already called it, so it can never leak the crowd
  // split before someone commits. Skipped until a few people have played.
  function mqCrowdTagHtml(myVote, yesPct, noPct, total){
    if(!myVote || total < 3) return '';
    var mine = myVote === 'yes' ? yesPct : noPct;
    if(Math.abs(yesPct - 50) <= 5) return '<div class="crowd-tag split">' + mqIcon('scale') + '<span>Too close to call</span></div>';
    if(mine >= 50) return '<div class="crowd-tag with">' + mqIcon('users') + '<span>You\u2019re with ' + mine + '% of players</span></div>';
    return '<div class="crowd-tag bold">' + mqIcon('bolt') + '<span>Bold call \u2014 only ' + mine + '% agree</span></div>';
  }

  // ----- life for cards that haven't been called yet -----
  function mqAgo(ms){
    var m = Math.floor(ms / 60000);
    if(m < 1) return 'just now';
    if(m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    return h < 24 ? h + 'h ago' : null;
  }
  function mqLockText(ms){
    if(ms <= 0) return 'Locked';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if(d > 0) return 'Locks in ' + d + 'd ' + h + 'h';
    if(h > 0) return 'Locks in ' + h + 'h ' + m + 'm';
    return 'Locks in ' + m + 'm ' + String(s % 60).padStart(2, '0') + 's';
  }
  var mqLockTimer = null;
  function mqTickLocks(){
    var now = Date.now();
    document.querySelectorAll('.lock-chip[data-lock]').forEach(function(el){
      var ms = new Date(el.getAttribute('data-lock')).getTime() - now;
      var label = el.querySelector('.lock-chip-text');
      var txt = mqLockText(ms);
      if(label && label.textContent !== txt) label.textContent = txt;
      el.classList.toggle('soon', ms > 0 && ms < 3600000);
      el.classList.toggle('done', ms <= 0);
    });
  }
  function mqStartLockTicker(){ if(!mqLockTimer) mqLockTimer = setInterval(mqTickLocks, 1000); }

  // How the player's own side moved in the last hour (like the little up/down arrows on prediction sites).
  // Worded from the player's side: green/up when more players moved to their pick, red/down when fewer did.
  function mqMoveHtml(trend, total, myVote){
    if(!trend || trend.length < 3 || total < 3) return '';
    var cutoff = Date.now() - 3600000, base = null;
    for(var i = trend.length - 1; i >= 0; i--){ if(trend[i].time.getTime() <= cutoff){ base = trend[i]; break; } }
    if(!base) return '';
    var d = trend[trend.length - 1].pct - base.pct;   // change in the Yes share
    if(myVote === 'no') d = -d;                        // flip it if the player picked No
    if(Math.abs(d) < 3) return '';
    return '<div class="crowd-tag move ' + (d > 0 ? 'up' : 'down') + '">' + mqIcon(d > 0 ? 'arrowUp' : 'arrowDown') + '<span>Your side is ' + (d > 0 ? 'up ' : 'down ') + Math.abs(d) + '% in the last hour</span></div>';
  }
  function mqCrowdTagsHtml(myVote, yesPct, noPct, total, trend, showPct){
    var html = mqCrowdTagHtml(myVote, yesPct, noPct, total) + (showPct ? mqMoveHtml(trend, total, myVote) : '');
    return html ? '<div class="crowd-tags">' + html + '</div>' : '';
  }

  // "Today's slate" strip: what's on offer today, plus the player's streak.
  // buddyNames: array of buddy usernames (may be empty) -- you can have any
  // number of buddies, and the Buddy Bonus stacks +25 per matching buddy.
  function mqSlateEl(count, buddyNames, boostedCount, buddyObjs){
    var names = buddyNames || [];
    // 100 per call (200 for a boosted one), +100 for a perfect day, and +25 per call per Buddy.
    var total = count * 100 + (count === 3 ? 100 : 0) + (count * 25 * names.length) + (boostedCount || 0) * 100;
    var el = document.createElement('div');
    el.className = 'mq-slate';
    var buddyLabel = names.slice(0, 2).map(function(n){ return escapeHtml(n); }).join(', ') + (names.length > 2 ? ' and ' + (names.length - 2) + ' more buddies' : '');
    el.innerHTML =
      '<div class="slate-top"><div class="slate-pts"><span class="slate-pre">Earn up to</span><b>' + total + '</b><span>points today</span></div>' +
      '<div class="slate-meta"><span>' + count + (count === 1 ? ' call' : ' calls') + '</span>' + (count === 3 ? '<span>3 for 3 adds +100</span>' : '') + '</div></div>' +
      '<div class="slate-mid"><div class="slate-streak"></div><div class="slate-tier"></div></div>' +
      (boostedCount ? '<div class="slate-buddy boost"><b class="boost-2x">2X</b><span>One call today is worth double</span></div>' : '') +
      (names.length ? '<button type="button" class="slate-buddy slate-buddy-btn" aria-haspopup="dialog">' + mqIcon('link') + '<span>Buddy Bonus: +25 on any call where you match ' + buddyLabel + '</span>' + mqIcon('chevronRight') + '</button>' : '');
    el._buddies = buddyObjs || [];
    return el;
  }

  // Tap the Buddy Bonus line on the slate to see who your buddies are.
  document.addEventListener('click', function(e){
    var t = e.target;
    var open = document.getElementById('buddy-sheet');
    if(open && (t === open || t.closest('.buddy-sheet-x') || t.closest('.buddy-sheet-done'))){ open.remove(); return; }
    var btn = t.closest && t.closest('.slate-buddy-btn'); if(!btn) return;
    var slate = btn.closest('.mq-slate'); if(!slate) return;
    var buddies = slate._buddies || [];
    if(open) open.remove();
    var bg = document.createElement('div');
    bg.id = 'buddy-sheet'; bg.className = 'mq-sheet-bg';
    bg.innerHTML = '<div class="mq-sheet buddy-sheet" role="dialog" aria-label="Your buddies">' +
      '<button type="button" class="mq-sheet-x buddy-sheet-x" aria-label="Close">&times;</button>' +
      '<div class="bs-eyebrow">Buddy Bonus</div>' +
      '<h3 class="bs-title">Your buddies</h3>' +
      '<p class="bs-sub">Pick the same side as a buddy on any call and you each earn +25.</p>' +
      '<div class="bs-list">' + buddies.map(function(b){
        return '<div class="bs-row" data-uid="' + escapeHtml(String(b.id)) + '"><i class="bs-av vtr-av">' + escapeHtml((b.username || '?').charAt(0).toUpperCase()) + '</i><span class="bs-name">' + escapeHtml(b.username || 'your buddy') + '</span></div>';
      }).join('') + '</div>' +
      '<button type="button" class="buddy-sheet-done">Done</button></div>';
    document.body.appendChild(bg);
    // Fill in each buddy's avatar once their profiles load; the initials above stand in until then.
    var ids = buddies.map(function(b){ return b.id; }).filter(Boolean);
    if(ids.length){
      sb.from('profiles').select('id, username, avatar_emoji, avatar_color').in('id', ids).then(function(res){
        (res && res.data || []).forEach(function(u){
          var row = bg.querySelector('.bs-row[data-uid="' + u.id + '"]'); if(!row) return;
          var av = row.querySelector('.bs-av'); if(!av) return;
          av.style.background = /^#[0-9A-Fa-f]{6}$/.test(u.avatar_color || '') ? u.avatar_color : '#2B2E34';
          av.innerHTML = mqAvatarInner(u.avatar_emoji, u.username);
        });
      }, function(){ /* initials stay */ });
    }
  });
  function mqFillSlate(slate, session, answeredAll){
    var el = slate.querySelector('.slate-streak');
    if(!el) return;
    if(!session){ el.innerHTML = mqIcon('flame') + '<span>Playing as a guest. Sign up free to keep your streak.</span>'; return; }
    sb.from('streaks').select('current_streak, total_points').eq('user_id', session.user.id).maybeSingle().then(function(res){
      var n = (res && res.data && res.data.current_streak) || 0;
      var pts = (res && res.data && res.data.total_points) || 0;
      var tierEl = slate.querySelector('.slate-tier');
      if(tierEl){
        var cur = null;
        for(var ti = 0; ti < TIERS.length; ti++){ if(pts >= TIERS[ti].min){ cur = TIERS[ti]; break; } }
        var nxt = getNextTier(pts);
        if(cur && nxt){
          var frac = Math.max(0, Math.min(1, (pts - cur.min) / (nxt.min - cur.min)));
          tierEl.innerHTML = '<div class="tier-row"><span class="tier-name">' + cur.name + '</span><span class="tier-next">' + (nxt.min - pts).toLocaleString() + ' points to ' + nxt.name + '</span></div>' +
            '<div class="tier-bar"><i style="width:0"></i></div>';
          var barI = tierEl.querySelector('.tier-bar i');
          requestAnimationFrame(function(){ requestAnimationFrame(function(){ barI.style.width = (frac * 100).toFixed(1) + '%'; }); });
        }else if(cur){
          tierEl.innerHTML = '<div class="tier-row"><span class="tier-name">' + cur.name + '</span><span class="tier-next">Top tier reached</span></div>';
        }
      }
      var msg = answeredAll
        ? (n > 0 ? 'Calls are in. Your ' + n + '-day streak is safe.' : 'Calls are in. Streak starts once they score.')
        : (n > 0 ? 'Your ' + n + '-day streak is on the line' : 'Make your calls to start a streak');
      el.className = 'slate-streak fl-' + mqStreakFlameTier(n);
      el.innerHTML = mqIcon('flame') + '<span>' + msg + '</span>';
      mqCheckMilestone(session.user.id, n);
    }, function(){});
  }
  // Milestone celebration: fires once, the first time we notice a streak has
  // reached 7/30/100 (tracked in localStorage per user so it doesn't refire
  // on every page load or repeat for a streak that later resets and regrows
  // past a milestone it already celebrated in a prior cycle... actually it
  // SHOULD refire if they lose the streak and earn it again, so we key on
  // the exact streak number, not just "has ever hit 7".
  function mqCheckMilestone(userId, streakN){
    var MILESTONES = [7, 30, 100];
    if(MILESTONES.indexOf(streakN) === -1) return;
    var key = 'mq_milestone_' + userId + '_' + streakN;
    if(localStorage.getItem(key)) return;
    try{ localStorage.setItem(key, '1'); }catch(e){}
    mqShowMilestoneCelebration(streakN);
    mqMaybePromptShare(userId, 'streak_milestone');
  }
  function mqShowMilestoneCelebration(streakN){
    var overlay = document.createElement('div');
    overlay.className = 'milestone-overlay';
    overlay.innerHTML =
      '<div class="milestone-card">' +
        '<div class="milestone-confetti"></div>' +
        mqIcon('flame') +
        '<div class="milestone-num">' + streakN + '</div>' +
        '<div class="milestone-label">day streak</div>' +
        '<button class="milestone-close">Nice</button>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){ overlay.classList.add('on'); });
    var close = function(){ overlay.classList.remove('on'); setTimeout(function(){ overlay.remove(); }, 250); };
    overlay.querySelector('.milestone-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    setTimeout(close, 6000);
  }
  // Ambient "someone just picked" ticker: a small rotating line of recent,
  // anonymized activity across today's 3 questions. Deliberately never shows
  // which side anyone picked -- same reveal gating as everything else, this
  // is just proof of life ("someone in Texas just made a call"), not a peek.
  async function mqStartActivityTicker(container, prepared, insertBeforeEl){
    try{
      var ids = prepared.map(function(p){ return p.q.id; });
      var res = await sb.from('predictions').select('user_id, created_at').in('question_id', ids).order('created_at', { ascending: false }).limit(25);
      var rows = res.data || [];
      if(!rows.length) return;
      var uids = Array.from(new Set(rows.map(function(r){ return r.user_id; })));
      var pr = await sb.from('profiles').select('id, state').in('id', uids);
      var stateById = {};
      (pr.data || []).forEach(function(p){ stateById[p.id] = p.state; });
      var messages = rows.map(function(r){
        var state = stateById[r.user_id];
        return state ? ('Someone in ' + state + ' just made a call') : 'Someone just made a call';
      });
      if(!messages.length) return;

      var tickerEl = document.createElement('div');
      tickerEl.className = 'activity-ticker';
      tickerEl.innerHTML = '<span class="live-dot"></span><span class="activity-ticker-text"></span>';
      container.insertBefore(tickerEl, insertBeforeEl || container.firstChild);

      var textEl = tickerEl.querySelector('.activity-ticker-text');
      var idx = 0;
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function paint(){
        textEl.textContent = messages[idx % messages.length];
        idx++;
      }
      paint();
      if(!reduceMotion){
        dailyActivityTickerInterval = setInterval(function(){
          textEl.classList.add('out');
          setTimeout(function(){ paint(); textEl.classList.remove('out'); }, 260);
        }, 4200);
      }
    }catch(e){ /* decoration only */ }
  }
  // Who has already called each question (never which side), as a little avatar stack.
  async function mqFillPlayers(container, prepared){
    try{
      var ids = prepared.map(function(p){ return p.q.id; });
      var res = await sb.from('predictions').select('question_id, user_id, created_at').in('question_id', ids).order('created_at', { ascending: false }).limit(80);
      var rows = res.data || [];
      var byQ = {}, need = {};
      rows.forEach(function(r){
        var list = byQ[r.question_id] = byQ[r.question_id] || [];
        if(list.length < 4 && list.indexOf(r.user_id) < 0){ list.push(r.user_id); need[r.user_id] = true; }
      });
      var uids = Object.keys(need);
      if(!uids.length) return;
      var pr = await sb.from('profiles').select('id, username, avatar_emoji, avatar_color').in('id', uids);
      var prof = {};
      (pr.data || []).forEach(function(x){ prof[x.id] = x; });
      prepared.forEach(function(p){
        var card = container.querySelector('[data-question-id="' + p.q.id + '"]');
        var slot = card && card.querySelector('.foot-players');
        if(!slot) return;
        var html = (byQ[p.q.id] || []).map(function(uid){
          var u = prof[uid]; if(!u) return '';
          var color = /^#[0-9A-Fa-f]{6}$/.test(u.avatar_color || '') ? u.avatar_color : '#2C2F37';
          return '<i class="av" title="' + escapeHtml(u.username || '') + '" style="background:' + color + ';">' + mqAvatarInner(u.avatar_emoji, u.username) + '</i>';
        }).join('');
        var extra = p.total - (byQ[p.q.id] || []).length;
        if(html && extra > 0) html += '<i class="av av-more">+' + extra + '</i>';
        slot.innerHTML = html;
      });
    }catch(e){ /* decoration only */ }
  }
  // Tap "N voted" on a prediction card to see who has called it (usernames only, never which side).
  document.addEventListener('click', async function(e){
    var fl = e.target.closest && e.target.closest('.foot-left'); if(!fl) return;
    var card = fl.closest('[data-question-id]'); if(!card) return;
    var qid = card.getAttribute('data-question-id'), foot = fl.closest('.ticket-foot');
    var box = card.querySelector('.pvoters');
    if(box){ box.remove(); fl.classList.remove('open'); return; }
    fl.classList.add('open');
    box = document.createElement('div'); box.className = 'pvoters'; box.innerHTML = '<p class="voters-msg">Loading…</p>';
    foot.insertAdjacentElement('afterend', box);
    try{
      var pr = await sb.from('predictions').select('user_id, created_at').eq('question_id', qid).order('created_at', { ascending: true }).limit(300);
      var uids = []; (pr.data || []).forEach(function(r){ if(uids.indexOf(r.user_id) < 0) uids.push(r.user_id); });
      var profs = [];
      if(uids.length){
        var q = await sb.from('profiles').select('id, username, avatar_emoji, avatar_color, hide_from_leaderboard').in('id', uids);
        profs = (q.data || []).filter(function(x){ return !x.hide_from_leaderboard && x.username; });
      }
      var total = (card.querySelector('.foot-count') || {}).textContent || '', n = parseInt(total, 10) || uids.length;
      var rest = Math.max(0, n - profs.length);
      if(!box.isConnected) return;
      box.innerHTML = profs.length
        ? '<div class="pv-grid">' + profs.map(function(u){
            var color = /^#[0-9A-Fa-f]{6}$/.test(u.avatar_color || '') ? u.avatar_color : '#2B2E34';
            return '<span class="pv-u"><i class="vtr-av" style="background:' + color + '">' + mqAvatarInner(u.avatar_emoji, u.username) + '</i>' + escapeHtml(u.username) + '</span>';
          }).join('') + '</div>' + (rest ? '<p class="voters-msg">+ ' + rest + ' guest' + (rest === 1 ? '' : 's') + ' or private player' + (rest === 1 ? '' : 's') + '</p>' : '')
        : '<p class="voters-msg">' + (n ? n + ' voted, all guests or private players.' : 'No one yet. Be the first.') + '</p>';
    }catch(err){ if(box.isConnected) box.innerHTML = '<p class="voters-msg">Couldn’t load who voted. Try again.</p>'; }
  });
  // Emoji reactions: one fetch for every reaction on today's questions,
  // counts painted per-button, tap toggles your own (insert/delete). Anyone
  // can react, even before voting -- these aren't gated like crowd % since
  // a reaction doesn't reveal which side someone picked.
  // ===== Comments (replaces the emoji reaction row) =====
  // Reads/writes go through RPCs from supabase/migrations/20261012_question_comments.sql.
  // If that migration isn't applied yet the dropdowns simply say comments are coming soon.
  var MQ_ADMIN_EMAIL = 'maxescarpio3@gmail.com';

  // ---- @mentions ----
  // Writes comment text into `node`, turning @username into a highlighted span. Text goes in as text
  // nodes (never as HTML), so a comment can't inject markup. A tag only counts when the @ starts a
  // word, so an email address like me@site.com is left alone.
  function mqAppendMentionText(node, text){
    var s = String(text == null ? '' : text), re = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,24})/g, last = 0, m;
    while((m = re.exec(s))){
      var start = m.index + m[1].length;
      if(start > last) node.appendChild(document.createTextNode(s.slice(last, start)));
      var tag = document.createElement('span');
      tag.className = 'cmt-mention';
      tag.textContent = '@' + m[2];
      node.appendChild(tag);
      last = start + 1 + m[2].length;
    }
    if(last < s.length) node.appendChild(document.createTextNode(s.slice(last)));
  }

  // Username suggestions under a comment box: type "@ja" and people whose names start with "ja" appear.
  // Uses search_usernames() from supabase/migrations/20261019_comment_mentions.sql; if that is not
  // applied yet, nothing shows and the box works exactly as before.
  function mqAttachMentionSuggest(form, input){
    var box = document.createElement('div');
    box.className = 'cmt-suggest'; box.hidden = true; box.setAttribute('role', 'listbox');
    form.appendChild(box);
    var list = [], sel = 0, timer = null, seq = 0;
    function close(){ box.hidden = true; box.textContent = ''; list = []; sel = 0; }
    function paint(){
      box.textContent = '';
      list.forEach(function(u, i){
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cmt-suggest-item' + (i === sel ? ' on' : ''); b.setAttribute('role', 'option');
        var av = document.createElement('span'); av.className = 'cmt-suggest-av'; av.innerHTML = mqAvatarInner(u.avatar_emoji, u.username);
        if(u.avatar_color) av.style.background = u.avatar_color;
        var nm = document.createElement('span'); nm.textContent = '@' + u.username;
        b.appendChild(av); b.appendChild(nm);
        b.addEventListener('mousedown', function(e){ e.preventDefault(); }); // keep focus in the box
        b.addEventListener('click', function(){ pick(u); });
        box.appendChild(b);
      });
    }
    // The "@something" being typed right at the cursor, if any.
    function query(){
      var pos = input.selectionStart == null ? input.value.length : input.selectionStart;
      var m = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,24})$/.exec(input.value.slice(0, pos));
      return m ? { prefix: m[2], start: pos - m[2].length - 1, end: pos } : null;
    }
    function pick(u){
      var q = query(); if(!q) return;
      input.value = input.value.slice(0, q.start) + '@' + u.username + ' ' + input.value.slice(q.end);
      var np = q.start + u.username.length + 2;
      try{ input.setSelectionRange(np, np); }catch(e){}
      close(); input.focus();
    }
    input.addEventListener('input', function(){
      clearTimeout(timer);
      var q = query();
      if(!q){ close(); return; }
      timer = setTimeout(async function(){
        var mine = ++seq;
        try{
          var r = await sb.rpc('search_usernames', { p_prefix: q.prefix });
          if(mine !== seq) return;
          if(r.error || !r.data || !r.data.length){ close(); return; }
          list = r.data; sel = 0; paint(); box.hidden = false;
        }catch(e){ close(); }
      }, 160);
    });
    input.addEventListener('keydown', function(e){
      if(box.hidden || !list.length) return;
      if(e.key === 'ArrowDown'){ e.preventDefault(); sel = (sel + 1) % list.length; paint(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); sel = (sel - 1 + list.length) % list.length; paint(); }
      else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); pick(list[sel]); }
      else if(e.key === 'Escape'){ close(); }
    });
    input.addEventListener('blur', function(){ setTimeout(close, 150); });
  }

  async function mqFillComments(container, prepared, session, api){
    api = api || { get:'get_question_comments', getArg:'p_question_ids', post:'post_question_comment', postArg:'p_question_id', like:'toggle_comment_like', del:'delete_my_comment', report:'report_question_comment', pin:'admin_pin_comment', idKey:'question_id' };
    var boxes = container.querySelectorAll('.cmt');
    if(!boxes.length) return;
    var ids = prepared.map(function(p){ return p.q.id; });
    var all = [], ok = true;
    async function load(){
      try{
        var res = await sb.rpc(api.get, (function(){ var o = {}; o[api.getArg] = ids; return o; })());
        if(res.error) throw res.error;
        all = (res.data || []).map(function(c){ if(api.idKey !== 'question_id') c.question_id = c[api.idKey]; return c; }); ok = true;
      }catch(e){ ok = false; all = []; }
    }
    function ago(t){
      var m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
      if(m < 1) return 'now';
      if(m < 60) return m + 'm';
      if(m < 1440) return Math.round(m / 60) + 'h';
      return Math.round(m / 1440) + 'd';
    }
    function el(tag, cls, text){ var n = document.createElement(tag); if(cls) n.className = cls; if(text != null) n.textContent = text; return n; }
    function oneComment(c, qid, isReply){
      var row = el('div', 'cmt-item' + (isReply ? ' is-reply' : ''));
      var av = el('div', 'cmt-av'); av.innerHTML = mqAvatarInner(c.avatar_emoji, c.username);
      if(c.avatar_color) av.style.background = c.avatar_color;
      var main = el('div', 'cmt-main');
      var who = el('div', 'cmt-who');
      who.appendChild(el('b', null, c.username || 'player'));
      who.appendChild(el('span', 'cmt-ago', ' · ' + ago(c.created_at)));
      if(c.held) who.appendChild(el('span', 'cmt-held', ' · Waiting for review'));
      if(c.pinned){ var pb = el('span', 'cmt-pinned'); pb.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>Pinned'; who.appendChild(pb); }
      main.appendChild(who);
      var txt = el('div', 'cmt-text'); mqAppendMentionText(txt, c.body); main.appendChild(txt);
      var acts = el('div', 'cmt-acts');
      var like = el('button', 'cmt-heart' + (c.mine ? ' on' : ''));
      like.type = 'button';
      like.setAttribute('aria-label', c.mine ? 'Unlike' : 'Like');
      like.setAttribute('aria-pressed', c.mine ? 'true' : 'false');
      like.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 20.5S3 15 3 8.8C3 6.2 5 4.3 7.4 4.3c1.8 0 3.4 1 4.6 2.8 1.2-1.8 2.8-2.8 4.6-2.8C19 4.3 21 6.2 21 8.8 21 15 12 20.5 12 20.5z"/></svg><span class="cmt-heart-n">' + (Number(c.likes) > 0 ? Number(c.likes) : '') + '</span>';
      like.addEventListener('click', async function(){
        if(!session){ mqCommentNote(main, 'Sign in to like.'); return; }
        // Instant feedback first, then sync with the server.
        var was = like.classList.contains('on'), n = Math.max(0, (Number(c.likes) || 0) + (was ? -1 : 1));
        c.likes = n; c.mine = !was;
        like.classList.toggle('on', !was);
        like.setAttribute('aria-pressed', !was ? 'true' : 'false');
        like.querySelector('.cmt-heart-n').textContent = n > 0 ? String(n) : '';
        if(!was){ like.classList.remove('pop'); void like.offsetWidth; like.classList.add('pop'); try{ mqHaptic('tap'); }catch(e){} }
        like.disabled = true;
        await sb.rpc(api.like, { p_comment_id: c.id });
        like.disabled = false;
        await load(); renderAll();
      });
      acts.appendChild(like);
      if(!isReply){
        var rep = el('button', 'cmt-act', 'Reply'); rep.type = 'button';
        rep.addEventListener('click', function(){
          if(!session){ mqCommentNote(main, 'Sign in to reply.'); return; }
          var ex = main.querySelector('.cmt-reply-box');
          if(ex){ ex.remove(); return; }
          var box = composer(qid, c.id, 'Reply to ' + (c.username || 'player'));
          box.classList.add('cmt-reply-box');
          main.appendChild(box);
          box.querySelector('input').focus();
        });
        acts.appendChild(rep);
      }
      if(session){
        if(c.is_me){
          var del = el('button', 'cmt-act', 'Delete'); del.type = 'button';
          del.addEventListener('click', async function(){ await sb.rpc(api.del, { p_comment_id: c.id }); await load(); renderAll(); });
          acts.appendChild(del);
        }else{
          var rp = el('button', 'cmt-act', 'Report'); rp.type = 'button';
          rp.addEventListener('click', async function(){ await sb.rpc(api.report, { p_comment_id: c.id }); rp.textContent = 'Reported'; rp.disabled = true; });
          acts.appendChild(rp);
        }
      }
      if(api.pin && !isReply && session && session.user && session.user.email === MQ_ADMIN_EMAIL){
        var pin = el('button', 'cmt-act cmt-pin-btn' + (c.pinned ? ' on' : ''), c.pinned ? 'Unpin' : 'Pin'); pin.type = 'button';
        pin.addEventListener('click', async function(){
          pin.disabled = true;
          var pr = await sb.rpc(api.pin, { p_comment_id: c.id });
          if(pr.error){ pin.disabled = false; mqCommentNote(main, pr.error.message || 'Could not pin'); return; }
          await load(); renderAll();
        });
        acts.appendChild(pin);
      }
      main.appendChild(acts);
      row.appendChild(av); row.appendChild(main);
      return row;
    }
    function composer(qid, parentId, placeholder){
      var f = el('form', 'cmt-form');
      var inp = el('input'); inp.type = 'text'; inp.maxLength = 280; inp.placeholder = placeholder || 'Add a comment'; inp.setAttribute('aria-label', placeholder || 'Add a comment');
      var btn = el('button', 'cmt-post', 'Post'); btn.type = 'submit';
      var msg = el('div', 'cmt-msg');
      f.appendChild(inp); f.appendChild(btn); f.appendChild(msg);
      mqAttachMentionSuggest(f, inp);
      f.addEventListener('submit', async function(ev){
        ev.preventDefault();
        var v = inp.value.trim(); if(!v) return;
        btn.disabled = true;
        var args = { p_body: v, p_parent_id: parentId || null }; args[api.postArg] = qid;
        var r = await sb.rpc(api.post, args);
        btn.disabled = false;
        if(r.error){ msg.textContent = r.error.message || 'Could not post'; return; }
        inp.value = ''; msg.textContent = '';
        await load(); renderAll();
      });
      return f;
    }
    function renderAll(){
      boxes.forEach(function(box){
        var qid = box.getAttribute('data-question-id');
        var list = box.querySelector('.cmt-list'), comp = box.querySelector('.cmt-compose'), cnt = box.querySelector('.cmt-count');
        var mineOpen = box.querySelector('.cmt-reply-box');
        var wasMoreOpen = !!list.querySelector('.mq-list-more[open]');
        list.textContent = ''; comp.textContent = '';
        if(!ok){ cnt.textContent = ''; list.appendChild(el('div', 'cmt-empty', 'Comments are coming soon.')); return; }
        var mine = all.filter(function(c){ return c.question_id === qid; });
        cnt.textContent = mine.length ? '· ' + mine.length : '';
        var tops = mine.filter(function(c){ return !c.parent_id; });
        if(box.getAttribute('data-sort') === 'top') tops.sort(function(a, b){ return (Number(b.likes) || 0) - (Number(a.likes) || 0) || new Date(a.created_at) - new Date(b.created_at); });
        else if(box.getAttribute('data-sort') === 'new') tops.sort(function(a, b){ return new Date(b.created_at) - new Date(a.created_at); });
        tops.sort(function(a, b){ return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); }); // stable: pinned comment first, rest keep their order
        if(!tops.length) list.appendChild(el('div', 'cmt-empty', 'No comments yet. Say what you think.'));
        tops.forEach(function(c){
          var wrap = el('div', 'cmt-thread' + (c.pinned ? ' is-pinned' : ''));
          wrap.appendChild(oneComment(c, qid, false));
          var kids = mine.filter(function(k){ return k.parent_id === c.id; });
          if(kids.length){ var rl = el('div', 'cmt-replies'); kids.forEach(function(k){ rl.appendChild(oneComment(k, qid, true)); }); wrap.appendChild(rl); }
          list.appendChild(wrap);
        });
        mqFoldList(list, 5, { one: 'more comment', many: 'more comments' });
        if(wasMoreOpen){ var mo = list.querySelector('.mq-list-more'); if(mo) mo.open = true; }
        if(session) comp.appendChild(composer(qid, null, 'Add a comment'));
        else{ var si = el('button', 'cmt-signin-btn', 'Sign in to join the conversation'); si.type = 'button'; si.addEventListener('click', mqSignInPrompt); comp.appendChild(si); }
      });
    }
    await load(); renderAll();
    return { rerender: renderAll, reload: async function(){ await load(); renderAll(); } };
  }

  // ===== Hearts on the question card (next to Comments) =====
  // Uses get_question_likes / toggle_question_like from supabase/migrations/20261016_question_likes.sql.
  // If that migration isn't applied yet the hearts simply stay hidden.
  async function mqFillQuestionLikes(container, prepared, session){
    var btns = container.querySelectorAll('.q-heart');
    if(!btns.length) return;
    var ids = prepared.map(function(p){ return p.q.id; });
    var state = {};
    try{
      var res = await sb.rpc('get_question_likes', { p_question_ids: ids });
      if(res.error) throw res.error;
      (res.data || []).forEach(function(r){ state[r.question_id] = { n: Number(r.likes) || 0, mine: !!r.mine }; });
    }catch(e){ return; }
    btns.forEach(function(btn){
      var qid = btn.getAttribute('data-q');
      var st = state[qid] || { n: 0, mine: false };
      function paint(){
        btn.classList.toggle('on', st.mine);
        btn.setAttribute('aria-pressed', st.mine ? 'true' : 'false');
        btn.setAttribute('aria-label', st.mine ? 'Unlike this question' : 'Like this question');
        btn.querySelector('.q-heart-n').textContent = st.n > 0 ? String(st.n) : '';
      }
      paint();
      btn.style.display = 'inline-flex';
      btn.addEventListener('click', async function(ev){
        ev.preventDefault(); ev.stopPropagation(); // don't open/close the comments dropdown
        if(!session){ mqSignInPrompt(); return; }
        var was = st.mine;
        st.mine = !was; st.n = Math.max(0, st.n + (was ? -1 : 1)); paint();
        if(!was){ btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); try{ mqHaptic('tap'); }catch(e){} }
        var r = await sb.rpc('toggle_question_like', { p_question_id: qid });
        if(r.error){ st.mine = was; st.n = Math.max(0, st.n + (was ? 1 : -1)); paint(); }
      });
    });
  }

  function mqSignInPrompt(){
    try{ if(window.__mqCloseThread) window.__mqCloseThread(); }catch(e){}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    openAuthPanel('signup', 'comment');
  }
  var MQ_NEWS_COMMENT_API = { get:'get_news_comments', getArg:'p_news_ids', post:'post_news_comment', postArg:'p_news_id', like:'toggle_news_comment_like', del:'delete_my_news_comment', report:'report_news_comment', idKey:'news_id' };
  function mqCommentNote(parent, text){
    var old = parent.querySelector('.cmt-note'); if(old) old.remove();
    var n = document.createElement('div'); n.className = 'cmt-note'; n.textContent = text; parent.appendChild(n);
    setTimeout(function(){ if(n.parentNode) n.remove(); }, 2500);
  }

  // ===== "Someone mentioned you" notices =====
  // When a signed-in player is tagged (@theirname) in a Play, News or Trending comment, a small notice
  // appears at the bottom of the screen: "@jazcuy mentioned you in Play". Tapping View jumps to that
  // conversation; the X dismisses it. Either way it is marked seen and won't come back.
  // Uses get_my_mentions / mark_mentions_seen from supabase/migrations/20261019_comment_mentions.sql;
  // if that is not applied yet the lookup just fails quietly and nothing shows.
  (function(){
    var shown = {}, host = null;
    function getHost(){
      if(host && host.parentNode) return host;
      host = document.createElement('div');
      host.className = 'mq-mention-host';
      host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
      return host;
    }
    function whenFound(sel, cb){
      var tries = 0;
      (function look(){
        var n = document.querySelector(sel);
        if(n){ cb(n); return; }
        if(++tries < 20) setTimeout(look, 200);
      })();
    }
    function openMention(m){
      var page = m.kind === 'question' ? 'home' : 'news';
      var tab = document.querySelector('.pagenav-tab[data-page="' + page + '"]');
      if(tab) tab.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if(m.kind === 'question'){
        whenFound('.predict-card[data-question-id="' + m.target_id + '"] details.cmt', function(d){
          d.open = true;
          d.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }else{
        whenFound('.news-card[data-news-id="' + m.target_id + '"]', function(card){ card.click(); });
      }
    }
    function seen(ids){
      try{ sb.rpc('mark_mentions_seen', { p_ids: ids }).then(function(){}, function(){}); }catch(e){}
    }
    function show(m){
      var row = document.createElement('div');
      row.className = 'mq-mention';
      var av = document.createElement('span'); av.className = 'mq-mention-av'; av.innerHTML = mqAvatarInner(m.avatar_emoji, m.by_username);
      if(m.avatar_color) av.style.background = m.avatar_color;
      var txt = document.createElement('span'); txt.className = 'mq-mention-text';
      var line = document.createElement('b'); line.textContent = '@' + m.by_username;
      txt.appendChild(line);
      txt.appendChild(document.createTextNode(' mentioned you in ' + (m.where_label || 'a comment')));
      var view = document.createElement('button'); view.type = 'button'; view.className = 'mq-mention-view'; view.textContent = 'View';
      var x = document.createElement('button'); x.type = 'button'; x.className = 'mq-mention-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
      view.addEventListener('click', function(){ seen([m.id]); row.remove(); openMention(m); });
      x.addEventListener('click', function(){ seen([m.id]); row.remove(); });
      row.appendChild(av); row.appendChild(txt); row.appendChild(view); row.appendChild(x);
      var h = getHost();
      h.appendChild(row);
      while(h.children.length > 3) h.removeChild(h.firstChild); // never stack more than three
    }
    async function check(){
      if(document.hidden) return;
      try{
        var s = await sb.auth.getSession();
        if(!s || !s.data || !s.data.session){ if(host) host.textContent = ''; shown = {}; return; }
        var r = await sb.rpc('get_my_mentions');
        if(r.error || !r.data) return;
        r.data.slice(0, 3).forEach(function(m){
          if(shown[m.id]) return;
          shown[m.id] = true;
          show(m);
        });
      }catch(e){}
    }
    setTimeout(check, 3500);
    setInterval(check, 90000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(check, 500); });
    try{ sb.auth.onAuthStateChange(function(ev){ if(ev === 'SIGNED_IN') setTimeout(check, 2500); }); }catch(e){}
  })();

  // ===== Haptics =====
  // Tiny, optional feedback on the moments that matter. Silent where the
  // browser has no vibration support (iOS Safari) or motion is reduced.
  var MQ_HAPTIC = { tap: 8, lock: [10, 30, 16], win: [14, 40, 14, 40, 26], miss: 28 };
  function mqHaptic(kind){
    try{
      if(!navigator.vibrate) return;
      if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      navigator.vibrate(MQ_HAPTIC[kind] || MQ_HAPTIC.tap);
    }catch(e){}
  }
  document.addEventListener('click', function(ev){
    var t = ev.target;
    if(!t || !t.closest) return;
    if(t.closest('.predict-card .opt')) mqHaptic('tap');
    else if(t.closest('#guest-submit-btn, #submit-all-btn')) mqHaptic('lock');
  }, true);

  // Counts a number up (or down) to a target and lets CSS flag it as "ticking".
  function mqTickTo(el, from, to, ms){
    if(!el) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce || from === to){ el.textContent = String(to); return; }
    var start = performance.now();
    el.classList.add('ticking');
    (function step(now){
      var t = Math.min((now - start) / (ms || 900), 1), e = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * e));
      if(t < 1) requestAnimationFrame(step); else el.classList.remove('ticking');
    })(start);
  }

  // ===== Today strip: the date, what's on the slate, and how many people have called =====
  // The player count is the highest vote total on any of today's questions, so it is
  // a floor on real people (nobody is counted twice), never an estimate. It only shows
  // once it is big enough to be a draw rather than a sign of an empty room.
  var MQ_SHOW_PLAYERS_MIN = 10;
  function mqUpdateTodayStrip(maxTotal){
    var live = document.getElementById('ts-live');
    var n = document.getElementById('ts-players');
    if(!live || !n) return;
    if(maxTotal >= MQ_SHOW_PLAYERS_MIN){
      var prev = parseInt(n.getAttribute('data-n') || '0', 10) || 0;
      n.setAttribute('data-n', String(maxTotal));
      live.hidden = false;
      mqTickTo(n, prev, maxTotal, 700);
    }else{
      live.hidden = true;
    }
  }
  (function(){
    mqUpdateTodayStrip(0);
  })();

  // ===== First-pick coach mark =====
  // New visitors learn by doing: no modal, no numbered steps. One small callout
  // sits on the first open call and points at Yes / No, then follows them to the
  // submit button. It never blocks the game and goes away for good after the first submit.
  (function(){
    var KEY = 'mq_coach_done';
    var done = false;
    try{ done = localStorage.getItem(KEY) === '1'; }catch(e){}
    if(done) return;
    var tip = null, step = 0, dismissed = false;
    function finish(){
      dismissed = true;
      try{ localStorage.setItem(KEY, '1'); }catch(e){}
      if(tip){ tip.remove(); tip = null; }
      if(mo) mo.disconnect();
    }
    function make(title, body, where){
      if(tip) tip.remove();
      tip = document.createElement('div');
      tip.className = 'coach';
      tip.setAttribute('role', 'status');
      tip.innerHTML = '<div class="coach-text"><b>' + title + '</b><span>' + body + '</span></div><button type="button" class="coach-x" aria-label="Dismiss tip"><svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15"/></svg></button>';
      tip.querySelector('.coach-x').addEventListener('click', finish);
      where(tip);
    }
    function place(){
      if(dismissed) return;
      var container = document.getElementById('daily-questions-container');
      if(!container) return;
      var home = document.getElementById('page-home');
      if(home && home.offsetParent === null) return;
      var picked = container.querySelectorAll('.predict-card .opt.picked').length;
      var open = container.querySelectorAll('.predict-card.awaiting, .predict-card .opt.picked');
      var dock = container.querySelector('.pick-dock');
      if(!open.length || !dock){ return; }          // nothing to play (locked / signed in with calls made)
      if(step === 0 && picked === 0){
        var first = container.querySelector('.predict-card.awaiting .ticket-row');
        if(first && !(tip && tip.parentNode)){
          make('Make your call', 'Tap Yes or No. Each call locks when its event starts.', function(t){ t.classList.add('coach-down'); first.parentNode.insertBefore(t, first); });
        }
      }else if(picked > 0 && picked < 3 && step < 2){
        if(step === 0 || !(tip && tip.parentNode)){
          step = 1;
          make('Nice. Keep going', 'Pick all three, then submit. Every correct call is worth 100 points.', function(t){ t.classList.add('coach-down'); dock.parentNode.insertBefore(t, dock); });
        }
      }else if(picked >= 3){
        if(tip){ tip.remove(); tip = null; }
        step = 2;
      }
    }
    var mo = new MutationObserver(function(){ clearTimeout(place._t); place._t = setTimeout(place, 120); });
    var cont = document.getElementById('daily-questions-container');
    if(cont) mo.observe(cont, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', function(ev){
      if(ev.target.closest && ev.target.closest('#guest-submit-btn, #submit-all-btn')) finish();
    }, true);
    setTimeout(place, 600);
  })();

  // ===== Yesterday's results sheet =====
  // Opens once a day, on the first visit after you made picks the day before and at least one has been scored.
  // Signed-in players are read by account; guests by the device id the site already uses for guest picks.
  (function(){
    var sheet = document.getElementById('results-sheet');
    if(!sheet) return;
    var KEY = 'mq_results_seen';
    var yDate = '';
    var DOT = { sports: '#FF9426', pop_culture: '#AA70FF', news: '#468CFF' };
    var bodyEl = document.getElementById('results-body');
    function yesterdayET(){
      var d = new Date(getETDateInfo().dateStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    function close(){
      sheet.hidden = true;
      document.body.style.overflow = '';
      try{ if(yDate) localStorage.setItem(KEY, yDate); }catch(e){}
    }
    sheet.addEventListener('click', function(ev){ if(ev.target === sheet) close(); });
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && !sheet.hidden) close(); });
    var closeBtn = document.getElementById('results-close'); if(closeBtn) closeBtn.addEventListener('click', close);
    var goBtn = document.getElementById('results-go'); if(goBtn) goBtn.addEventListener('click', close);
    bodyEl.addEventListener('click', function(ev){
      if(ev.target.closest && ev.target.closest('#results-signup')){
        close();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        openAuthPanel('signup');
      }
    });

    async function run(){
      try{
        yDate = yesterdayET();
        var seen = ''; try{ seen = localStorage.getItem(KEY) || ''; }catch(e){}
        if(seen === yDate) return;
        var home = document.getElementById('page-home');
        if(home && home.offsetParent === null) return;
        var welcome = document.getElementById('welcome-sheet');
        if(welcome && !welcome.hidden) return;

        var qres = await sb.from('daily_questions').select('id, question_text, category, correct_answer, resolved, voided, void_reason').eq('question_date', yDate).order('slot', { ascending: true });
        var questions = qres.data || [];
        if(!questions.length) return;
        var ids = questions.map(function(q){ return q.id; });

        var sr = await sb.auth.getSession();
        var session = sr && sr.data && sr.data.session;
        var picks = {}, streak = 0;
        if(session){
          var pr = await sb.from('predictions').select('question_id, choice').eq('user_id', session.user.id).in('question_id', ids);
          (pr.data || []).forEach(function(p){ picks[p.question_id] = p.choice; });
          var st = await sb.from('streaks').select('current_streak').eq('user_id', session.user.id).maybeSingle();
          streak = (st && st.data && st.data.current_streak) || 0;
        }else{
          var dev = mqGuestDeviceId(); if(!dev) return;
          var gr = await sb.rpc('get_guest_picks', { p_device_id: dev, p_question_ids: ids });
          (gr.data || []).forEach(function(p){ picks[p.question_id] = p.choice; });
        }
        var mine = questions.filter(function(q){ return picks[q.id]; });
        var scored = mine.filter(function(q){ return q.resolved && q.correct_answer; });
        if(!scored.length) return;

        var right = scored.filter(function(q){ return String(picks[q.id]).toLowerCase() === q.correct_answer; }).length;
        // A voided call isn't "pending" -- it just doesn't count either way.
        var partial = scored.length < mine.filter(function(q){ return !q.voided; }).length;
        var html = '<div class="rs-tiles"><div class="rs-tile"><b>' + right + ' of ' + scored.length + '</b><span>right' + (partial ? ' so far' : '') + '</span></div>';
        if(session) html += '<div class="rs-tile"><b data-tick="' + streak + '" data-from="' + Math.max(0, streak - 1) + '">' + streak + '</b><span>day streak</span></div>';
        html += '</div>';
        html += '<div class="rs-list">';
        mine.forEach(function(q){
          var pick = String(picks[q.id]).toLowerCase();
          var status = '<span class="rs-st">' + mqIcon('clock') + 'Pending</span>';
          var answerNote = '';
          var voidNote = '';
          if(q.voided){
            status = '<span class="rs-st">Void</span>';
            voidNote = '<div class="rs-void">' + escapeHtml(q.void_reason || 'This question was voided.') + ' No points either way.</div>';
          }else if(q.resolved && q.correct_answer){
            if(pick === q.correct_answer){
              status = '<span class="rs-st win">' + mqIcon('check') + 'Correct</span>';
            }else{
              status = '<span class="rs-st loss">' + mqIcon('xmark') + 'Missed</span>';
              answerNote = '<span class="rs-ans">Answer <b>' + (q.correct_answer === 'yes' ? 'Yes' : 'No') + '</b></span>';
            }
          }
          html += '<div class="rs-row">' +
            '<div class="rs-top"><span class="rs-cat">' + escapeHtml(CATEGORY_LABELS[q.category] || q.category || '') + '</span>' + status + '</div>' +
            '<div class="rs-q">' + escapeHtml(q.question_text || '') + '</div>' +
            '<div class="rs-pickline"><span>Your pick <b class="' + (pick === 'yes' ? 'yes' : 'no') + '">' + (pick === 'yes' ? 'Yes' : 'No') + '</b></span>' + answerNote + '</div>' +
            voidNote +
          '</div>';
        });
        html += '</div>';
        if(partial) html += '<p class="rs-note">Pending calls get scored once they settle.</p>';
        if(!session) html += '<div class="rs-signup"><b>Sign up free to keep your points and build a streak.</b><button type="button" id="results-signup">Sign up free</button></div>';

        var kick = document.getElementById('results-kicker');
        if(kick){
          try{ kick.textContent = 'Yesterday · ' + new Date(yDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
          catch(e){ kick.textContent = 'Yesterday'; }
        }
        bodyEl.innerHTML = html;
        if(welcome && !welcome.hidden) return;
        sheet.hidden = false;
        document.body.style.overflow = 'hidden';
        try{
          bodyEl.querySelectorAll('[data-tick]').forEach(function(b){
            var to = parseInt(b.getAttribute('data-tick'), 10) || 0, from = parseInt(b.getAttribute('data-from'), 10) || 0;
            b.textContent = String(from);
            setTimeout(function(){ mqTickTo(b, from, to, 900); }, 450);
          });
          mqHaptic(right === scored.length ? 'win' : (right ? 'tap' : 'miss'));
        }catch(e){}
      }catch(e){ /* results sheet is a nicety: never get in the way of the page */ }
    }
    setTimeout(run, 1800);
  })();

  async function mqFillReactions(container, prepared, session){
    try{
      var ids = prepared.map(function(p){ return p.q.id; });
      var res = await sb.from('question_reactions').select('question_id, user_id, emoji').in('question_id', ids);
      var rows = res.data || [];
      var counts = {}; // question_id -> emoji -> count
      var mine = {};   // question_id -> Set of my emojis
      rows.forEach(function(r){
        counts[r.question_id] = counts[r.question_id] || {};
        counts[r.question_id][r.emoji] = (counts[r.question_id][r.emoji] || 0) + 1;
        if(session && r.user_id === session.user.id){
          mine[r.question_id] = mine[r.question_id] || {};
          mine[r.question_id][r.emoji] = true;
        }
      });
      // Signed-out players' reactions live in their own table, keyed by device.
      try{
        var gdev = mqGuestDeviceId();
        var gres = await sb.rpc('get_guest_reactions', { p_question_ids: ids, p_device_id: gdev });
        (gres.data || []).forEach(function(g){
          counts[g.question_id] = counts[g.question_id] || {};
          counts[g.question_id][g.emoji] = (counts[g.question_id][g.emoji] || 0) + Number(g.n);
          if(!session && g.mine){
            mine[g.question_id] = mine[g.question_id] || {};
            mine[g.question_id][g.emoji] = true;
          }
        });
      }catch(e){}
      container.querySelectorAll('.reaction-row').forEach(function(row){
        var qid = row.getAttribute('data-question-id');
        row.querySelectorAll('.reaction-btn').forEach(function(btn){
          var emoji = btn.getAttribute('data-emoji');
          var n = (counts[qid] && counts[qid][emoji]) || 0;
          btn.querySelector('.reaction-count').textContent = n > 0 ? n : '';
          btn.classList.toggle('mine', !!(mine[qid] && mine[qid][emoji]));
        });
        // Any non-default emoji that already has at least one reaction gets
        // its own chip pinned to the visible row, next to the fixed 4, so
        // it isn't buried in the dropdown once people are actually using it.
        var extraContainer = row.querySelector('.reaction-extra');
        if(extraContainer){
          var used = Object.keys(counts[qid] || {}).filter(function(em){ return REACTION_EMOJIS.indexOf(em) === -1 && counts[qid][em] > 0; });
          extraContainer.innerHTML = used.map(function(em){
            var n = counts[qid][em];
            var mineClass = (mine[qid] && mine[qid][em]) ? ' mine' : '';
            return '<button type="button" class="reaction-btn' + mineClass + '" data-emoji="' + em + '"><span class="reaction-emoji">' + em + '</span><span class="reaction-count">' + n + '</span></button>';
          }).join('');
        }
      });
    }catch(e){ /* decoration only */ }
  }
  // Keeps every copy of one emoji in a question's reaction row in sync
  // (the quick buttons, the pinned chip, and the cell in the picker), and
  // adds/removes the pinned chip for non-default emoji. When the count hits
  // zero the pinned chip disappears, so someone who added an emoji nobody
  // else used can take it back out cleanly.
  function mqApplyReaction(row, emoji, n, mine){
    if(!row) return;
    var extraContainer = row.querySelector('.reaction-extra');
    var chip = null;
    row.querySelectorAll('.reaction-btn').forEach(function(b){
      if(b.getAttribute('data-emoji') !== emoji) return;
      if(extraContainer && b.parentNode === extraContainer){ chip = b; return; }
      var c = b.querySelector('.reaction-count');
      if(c) c.textContent = n > 0 ? n : '';
      b.classList.toggle('mine', !!mine);
    });
    if(REACTION_EMOJIS.indexOf(emoji) !== -1 || !extraContainer) return;
    if(n > 0){
      if(!chip){
        chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'reaction-btn';
        chip.setAttribute('data-emoji', emoji);
        chip.innerHTML = '<span class="reaction-emoji">' + emoji + '</span><span class="reaction-count"></span>';
        extraContainer.appendChild(chip);
      }
      chip.classList.toggle('mine', !!mine);
      chip.querySelector('.reaction-count').textContent = n;
    }else if(chip){
      chip.remove();
    }
  }
  // Mirrors a dropdown-menu emoji's current count/mine state onto a pinned
  // chip in the visible row (creating or removing the chip as needed), so a
  // reaction picked from the "more" menu shows up immediately without
  // waiting for the next full reload.
  function mqSyncExtraChip(row, menuBtn){
    var extraContainer = row.querySelector('.reaction-extra');
    if(!extraContainer) return;
    var emoji = menuBtn.getAttribute('data-emoji');
    var n = parseInt(menuBtn.querySelector('.reaction-count').textContent || '0', 10) || 0;
    var chip = null;
    extraContainer.querySelectorAll('.reaction-btn').forEach(function(c){ if(c.getAttribute('data-emoji') === emoji) chip = c; });
    if(n > 0){
      if(!chip){
        chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'reaction-btn';
        chip.setAttribute('data-emoji', emoji);
        chip.innerHTML = '<span class="reaction-emoji">' + emoji + '</span><span class="reaction-count"></span>';
        extraContainer.appendChild(chip);
      }
      chip.classList.toggle('mine', menuBtn.classList.contains('mine'));
      chip.querySelector('.reaction-count').textContent = n;
    }else if(chip){
      chip.remove();
    }
  }
  // Opens/closes the "more reactions" dropdown. Delegated so it works for
  // cards re-rendered after the fact; closes any other open menu first, and
  // closes on an outside click.
  //
  // The menu lives inside a question card, and cards use overflow:hidden
  // for their rounded corners/tint background -- so a plain absolutely-
  // positioned dropdown gets visually clipped ("buried in the box") any
  // time it would extend past the card's own edge, which happens a lot on
  // narrower/edge cards. To fix that for good rather than chasing edge
  // cases, the menu is detached to <body> and positioned with `fixed`
  // coordinates (computed from the button's real position) while open, so
  // it always renders on top of everything and is never clipped by an
  // ancestor. mqCloseReactionMenu puts it back where it came from.
  function mqCloseReactionMenu(wrap){
    if(!wrap) return;
    wrap.classList.remove('open');
    var moreBtn = wrap.querySelector('.reaction-more-btn');
    if(moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
    var menu = wrap._detachedMenu;
    if(menu){
      menu.style.position = '';
      menu.style.top = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.bottom = '';
      menu.style.display = '';
      wrap.appendChild(menu);
      wrap._detachedMenu = null;
    }
  }
  function mqOpenReactionMenu(wrap){
    var menu = wrap.querySelector('.reaction-menu');
    if(!menu) return;
    wrap.classList.add('open');
    var moreBtn = wrap.querySelector('.reaction-more-btn');
    if(moreBtn) moreBtn.setAttribute('aria-expanded', 'true');
    document.body.appendChild(menu);
    wrap._detachedMenu = menu;
    // .closest('.reaction-more-wrap') / .closest('.reaction-row') can't find
    // their ancestors once detached to <body>, so stash direct references.
    menu._wrap = wrap;
    menu._row = wrap.closest('.reaction-row');
    // The CSS that shows the menu (.reaction-more-wrap.open .reaction-menu)
    // only matches while it's nested inside the wrap, so set display directly
    // now that it lives under <body> instead.
    menu.style.display = 'grid';
    menu.style.position = 'fixed';
    // The stylesheet anchors the in-card version with bottom/right. Left in
    // place on a fixed menu that also gets an explicit top, they squash the
    // panel to a thin bar with the emojis spilling out of it, so clear them.
    menu.style.bottom = 'auto';
    menu.style.right = 'auto';
    menu.style.height = 'auto';
    // Pin the width up front from the stylesheet's own value instead of
    // trusting whatever size the browser reports below -- right after
    // reparenting into <body> and flipping display:none -> grid, a single
    // requestAnimationFrame isn't always enough for layout to have fully
    // settled, so getBoundingClientRect() can occasionally hand back a
    // stale/undersized rect. That made the anchor math below place the menu
    // as if it were much narrower than it actually renders, so most of the
    // grid ended up off to the side, overlapping whatever was there.
    var cssWidth = parseFloat(getComputedStyle(menu).width);
    if(cssWidth) menu.style.width = cssWidth + 'px';
    function placeMenu(){
      var margin = 6;
      var btnRect = moreBtn.getBoundingClientRect();
      var menuRect = menu.getBoundingClientRect();
      // Anchor above the button by default; flip below if there's not
      // enough room above. Anchor right-aligned to the button by default;
      // flip left-aligned if that would run off either edge.
      var top = btnRect.top - menuRect.height - 8;
      if(top < margin) top = Math.min(btnRect.bottom + 8, window.innerHeight - menuRect.height - margin);
      var left = btnRect.right - menuRect.width;
      if(left < margin) left = btnRect.left;
      if(left + menuRect.width > window.innerWidth - margin) left = window.innerWidth - menuRect.width - margin;
      if(left < margin) left = margin;
      menu.style.top = Math.max(margin, top) + 'px';
      menu.style.left = left + 'px';
    }
    // Two nested frames: the first lets the browser finish laying out the
    // just-reparented, just-shown grid; only the second is guaranteed to
    // read that settled size back.
    requestAnimationFrame(function(){ requestAnimationFrame(placeMenu); });
  }
  document.addEventListener('click', function(e){
    var moreBtn = e.target.closest('.reaction-more-btn');
    if(moreBtn){
      var wrap = moreBtn.closest('.reaction-more-wrap');
      var wasOpen = wrap.classList.contains('open');
      document.querySelectorAll('.reaction-more-wrap.open').forEach(function(w){ mqCloseReactionMenu(w); });
      if(!wasOpen) mqOpenReactionMenu(wrap);
      return;
    }
    if(!e.target.closest('.reaction-menu')){
      document.querySelectorAll('.reaction-more-wrap.open').forEach(function(w){ mqCloseReactionMenu(w); });
    }
  });
  function mqCloseAllReactionMenus(){
    document.querySelectorAll('.reaction-more-wrap.open').forEach(function(w){ mqCloseReactionMenu(w); });
  }
  window.addEventListener('resize', mqCloseAllReactionMenus);
  window.addEventListener('scroll', mqCloseAllReactionMenus, { passive: true });
  // One delegated listener handles every reaction button on the page,
  // present or future (cards get re-rendered each load) -- both the 4 quick
  // buttons and anything tapped from the "more" dropdown.
  document.addEventListener('click', async function(e){
    var btn = e.target.closest('.reaction-btn');
    if(!btn) return;
    var menuAncestor = btn.closest('.reaction-menu');
    var row = btn.closest('.reaction-row') || (menuAncestor && menuAncestor._row);
    var qid = row && row.getAttribute('data-question-id');
    if(!qid) return;
    var { data: sessionRes } = await sb.auth.getSession();
    var session = sessionRes && sessionRes.session;
    var emoji = btn.getAttribute('data-emoji');
    var countEl = btn.querySelector('.reaction-count');
    var wasMine = btn.classList.contains('mine');
    var isMenuBtn = btn.classList.contains('reaction-menu-btn');
    var n = parseInt(countEl.textContent || '0', 10) || 0;
    var newN = wasMine ? Math.max(0, n - 1) : n + 1;
    // Ignore a second tap on the same emoji while the first is still saving.
    row._rxBusy = row._rxBusy || {};
    if(row._rxBusy[emoji]) return;
    row._rxBusy[emoji] = true;
    // Close the picker first (it re-attaches itself to the row), then
    // optimistically update every copy of this emoji at once.
    if(isMenuBtn){
      var menuEl = btn.closest('.reaction-menu');
      var wrap = (menuEl && menuEl._wrap) || btn.closest('.reaction-more-wrap');
      mqCloseReactionMenu(wrap);
    }
    mqApplyReaction(row, emoji, newN, !wasMine);
    try{
      var res;
      if(!session){
        res = await sb.rpc('toggle_guest_reaction', { p_device_id: mqGuestDeviceId(), p_question_id: qid, p_emoji: emoji, p_on: !wasMine });
      }else if(wasMine){
        res = await sb.from('question_reactions').delete().eq('question_id', qid).eq('user_id', session.user.id).eq('emoji', emoji);
      }else{
        res = await sb.from('question_reactions').insert({ question_id: qid, user_id: session.user.id, emoji: emoji });
      }
      if(res && res.error) mqApplyReaction(row, emoji, n, wasMine); // failed: put it back
    }catch(err){
      mqApplyReaction(row, emoji, n, wasMine);
    }finally{
      row._rxBusy[emoji] = false;
    }
  });

  // percentages and buddy lines on the cards themselves -- a person's pick
  // on question q only appears here once the signed-in user has voted on
  // q themselves (or q is locked), so this can't be used to peek ahead.
  // Buddy lines for one question: de-duplicated, first two shown, the rest behind a "more" toggle.
  function mqBuddyBlockHtml(buddyList, qid, myVote){
    var seen = {}, lines = [];
    (buddyList || []).forEach(function(b){
      if(!b || seen[b.id] || !b.picks || !b.picks[qid]) return;
      seen[b.id] = 1;
      var pick = b.picks[qid], same = !!myVote && pick === myVote;
      lines.push('<div class="ticket-meta buddy-line" data-buddy-id="' + b.id + '" style="color:var(' + (same ? '--yes' : '--no') + ');">' + mqBuddyInner(b.username, pick, same) + '</div>');
    });
    if(!lines.length) return '';
    var head = lines.slice(0, 2).join(''), rest = lines.slice(2);
    return '<div class="buddy-wrap">' + head + (rest.length ? '<details class="buddy-more"><summary>+ ' + rest.length + ' more buddies</summary>' + rest.join('') + '</details>' : '') + '</div>';
  }
  function mqBuddyInner(name, pick, sameSide){
    var who = escapeHtml(name);
    return sameSide
      ? (mqIcon('link') + '<span>' + who + ' also picked ' + pick.toUpperCase() + ' \u2014 Buddy Bonus</span>')
      : (mqIcon('swap') + '<span>' + who + ' picked ' + pick.toUpperCase() + ' \u2014 opposite call, no Buddy Bonus this time</span>');
  }

  // Subject photos and face-offs: loaded after the cards are drawn, so a missing
  // photo (or no visuals set up yet) never blocks the questions.
  async function mqApplyVisuals(container){
    try{
      var cards = Array.prototype.slice.call(container.querySelectorAll('.predict-card[data-question-id]'));
      if(!cards.length) return;
      var res = await sb.rpc('get_question_visuals', { p_ids: cards.map(function(c){ return c.getAttribute('data-question-id'); }) });
      if(res.error || !res.data) return;
      var by = {}; res.data.forEach(function(v){ by[v.question_id] = v; });
      function photo(url, side){
        // A small round photo with no caption: the question says who or what it is.
        var kind = /image\.tmdb\.org/i.test(url) ? ' is-poster' : '';
        return '<div class="mq-photo ' + side + kind + '"><div class="mq-photo-img"><img src="' + escapeHtml(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest(\'.mq-photo\').remove()"></div></div>';
      }
      cards.forEach(function(card){
        var v = by[card.getAttribute('data-question-id')];
        if(!v || !/^https:\/\//i.test(v.subject_image_url || '')) return;
        var row = card.querySelector('.mq-qrow'); if(!row) return;
        if(row.querySelector('.mq-photo')) return;
        var old = card.querySelector('.mq-subject, .mq-matchup, .mq-photos'); if(old) old.remove();
        var tile = row.querySelector('.mq-tile'); if(tile) tile.remove();
        row.insertAdjacentHTML('afterbegin', photo(v.subject_image_url, 'is-left'));
        // A face-off puts one side on each end of the question.
        if(/^https:\/\//i.test(v.vs_image_url || '')){
          row.classList.add('has-vs');
          row.insertAdjacentHTML('beforeend', photo(v.vs_image_url, 'is-right'));
        }
      });
    }catch(e){}
  }
  // One real number at the top of the Play page: how many calls have been made today.
  async function mqShowCallCount(container){
    return; // removed: the live count row is gone
    try{
      var el = document.getElementById('play-status'); if(!el) return;
      var ids = Array.prototype.slice.call(container.querySelectorAll('.predict-card[data-question-id]')).map(function(c){ return c.getAttribute('data-question-id'); });
      if(!ids.length) return;
      // Count people, not picks: each player makes up to 3 calls a day.
      var r = await sb.from('predictions').select('user_id').in('question_id', ids).limit(5000);
      var label = null;
      if(r && !r.error && r.data){
        var people = {}, anon = 0;
        r.data.forEach(function(x){ if(x.user_id) people[x.user_id] = 1; else anon++; });
        var np = Object.keys(people).length;
        if(!anon && np) label = [np, np === 1 ? 'player' : 'players'];
      }
      if(!label){
        var c = await sb.from('predictions').select('id', { count: 'exact', head: true }).in('question_id', ids);
        var n = c && c.count;
        if(!n){ el.style.display = 'none'; return; }
        label = [n, n === 1 ? 'call' : 'calls'];
      }
      el.innerHTML = '<i class="live-dot"></i><b>' + label[0].toLocaleString('en-US') + '</b> ' + label[1] + ' made today';
      el.style.display = 'flex';
    }catch(e){}
  }
  function buildQuestionCard(q, index, myVote, voteCounts, isLocked, trend, isMostCalled, buddyList, isMover){
    var yesCount = voteCounts.yes || 0;
    var noCount = voteCounts.no || 0;
    var total = yesCount + noCount;
    var yesPct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
    var noPct = total > 0 ? 100 - yesPct : 0;
    var hasVoted = !!myVote;

    var div = document.createElement('div');
    div.className = 'ticket predict-card' + ((!hasVoted && !isLocked) ? ' awaiting' : '') + (hasVoted ? ' pick-' + ((q.resolved && q.correct_answer) ? (myVote === q.correct_answer ? 'yes' : 'no') : myVote) : '');
    mqStartLockTicker();
    div.style.maxWidth = '480px';
    div.style.marginBottom = '16px';
    div.setAttribute('data-question-id', q.id);
    div.setAttribute('data-cat', q.category || '');

    // Once locked, everyone sees percentages (there's nothing left to hide),
    // but only people who actually voted get a "picked" highlight.
    var showPct = hasVoted || isLocked;
    var yesPriceHtml = showPct ? (yesPct + '<span class="opt-pct">%</span>') : (mqIcon('check') + 'Yes');
    var noPriceHtml = showPct ? (noPct + '<span class="opt-pct">%</span>') : (mqIcon('xmark') + 'No');
    var optLabelHidden = showPct ? '' : ' style="display:none;"';
    var yesPickedClass = myVote === 'yes' ? ' picked' : '';
    var noPickedClass = myVote === 'no' ? ' picked' : '';
    var lockedNote = (isLocked && !hasVoted) ? '<div class="ticket-meta" style="margin-top:4px;">Locked \u2014 here\u2019s how the world called it.</div>' : '';
    var trendHtml = showPct ? ('<div class="trend-wrap" style="margin-top:8px;">' + buildTrendSVG(trend) + '</div>') : ('<div class="trend-wrap"><div class="crowd-teaser">' + mqIcon('lock') + '<div class="teaser-body"><div class="teaser-bar"><i></i></div><span>Make your call to see where the crowd stands</span></div></div></div>');

    // Buddy-vs-rival: only reveal once the person has voted themselves (or
    // it's locked) — same reveal gating as the percentages, so this never
    // shows a buddy's pick as a way to peek before committing your own.
    // One line per buddy who has a pick on this question -- there's no cap
    // on how many buddies someone can have.
    var buddyHtml = showPct ? mqBuddyBlockHtml(buddyList, q.id, myVote) : '';

    var vis = mqDetectVisual(q);
    var iconHtml = CATEGORY_ICONS[q.category] || '';
    var leagueHtml = vis.league ? '<span class="mq-league">' + vis.league + '</span>' : '';
    var visualHtml = (vis.kind === 'matchup')
      ? (mqMatchupHtml(vis.teams, vis.icon) + '<div class="mq-qrow"><p class="ticket-q"></p></div>')
      : (vis.kind === 'subject')
      ? (mqSubjectHtml(vis.subject, vis.icon || CATEGORY_ICONS[q.category] || '') + '<div class="mq-qrow"><p class="ticket-q"></p></div>')
      : ('<div class="mq-qrow"><div class="mq-tile">' + (vis.icon || CATEGORY_ICONS[q.category] || '') + '</div><p class="ticket-q"></p></div>');
    var isFinal = !!(q.resolved && q.correct_answer);
    var isVoid = !!q.voided;
    var statusHtml = isVoid
      ? '<span class="status-pill final">Void</span>'
      : isFinal
      ? '<span class="status-pill final">Final</span>'
      : isLocked
        ? '<span class="status-pill inplay"><span class="live-dot"></span>In play</span>'
        : '<span class="status-pill live"><span class="live-dot"></span>Live</span>';
    var resultHtml = '';
    if(isVoid){
      resultHtml = '<div class="result-tag final">' + mqIcon('clock') + '<span>Void — ' + escapeHtml(q.void_reason || 'this question was voided') + '. No points either way.</span></div>';
    }else if(isFinal){
      if(myVote){
        var won = myVote === q.correct_answer;
        resultHtml = '<div class="result-tag ' + (won ? 'win' : 'loss') + '">' + mqIcon(won ? 'check' : 'xmark') + '<span>' +
          (won ? 'You called it \u2014 correct' : 'Missed this one \u2014 the answer was ' + q.correct_answer.toUpperCase()) + '</span></div>';
      }else{
        resultHtml = '<div class="result-tag final">' + mqIcon('check') + '<span>Final answer: ' + q.correct_answer.toUpperCase() + '</span></div>';
      }
    }
    var crowdHtml = '<div class="crowd-bar' + ((showPct && total > 0) ? ' on' : '') + '"><i style="width:0"></i></div>';
    var crowdTagHtml = mqCrowdTagsHtml(myVote, yesPct, noPct, total, trend, showPct);
    var chipsHtml = '';
    if(!isLocked && q.lock_time && !isVoid){
      chipsHtml = '<div class="mq-chips">' +
        '<span class="lock-chip" data-lock="' + escapeHtml(q.lock_time) + '">' + mqIcon('clock') + '<span class="lock-chip-text">' + mqLockText(new Date(q.lock_time).getTime() - Date.now()) + '</span></span>' +
        '<span class="pts-chip' + (q.is_boosted ? ' boost' : '') + '">' + mqIcon('star') + 'Worth ' + (q.is_boosted ? '200' : '100') + ' points</span>' +
        (q.is_boosted ? '<span class="boost-chip">' + mqIcon('bolt') + '2X today</span>' : '') + '</div>';
    }
    var latestHtml = '';
    if(!isLocked && trend && trend.length){
      var ago = mqAgo(Date.now() - trend[trend.length - 1].time.getTime());
      if(ago) latestHtml = '<span class="foot-latest"><i class="live-dot"></i>Latest call ' + ago + '</span>';
    }
    var mostCalledBadge = (isMostCalled && total > 0) ? '<div class="hot-badge">' + mqIcon('flame') + 'Most called today</div>' : '';
    var moverBadge = (isMover && showPct) ? '<div class="mover-badge">' + mqIcon('bolt') + 'Big swing in the last hour</div>' : '';
    var resolutionHtml = q.resolution_criteria
      ? '<details class="resolve-details"><summary>How this resolves <svg class="resolve-chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary><p class="ticket-meta resolution-text"></p></details>'
      : '';

    div.innerHTML =
      '<p class="ticket-meta card-head">' + (index + 1) + ' of 3 · <span class="cat-chip"><span class="cat-tile">' + iconHtml + '</span><span class="cat-label-text"></span>' + leagueHtml + '</span>' + statusHtml + '</p>' +
      visualHtml +
      mostCalledBadge +
      moverBadge +
      chipsHtml +
      '<div class="ticket-row">' +
        '<div class="opt yes' + yesPickedClass + '"><div class="opt-label"' + optLabelHidden + '>YES</div><div class="opt-price">' + yesPriceHtml + '</div></div>' +
        '<div class="opt no' + noPickedClass + '"><div class="opt-label"' + optLabelHidden + '>NO</div><div class="opt-price">' + noPriceHtml + '</div></div>' +
      '</div>' +
      crowdHtml +
      resultHtml +
      ((q.resolved && q.correct_answer) ? '<div class="who-wrap"><button type="button" class="who-btn" data-qid="' + escapeHtml(q.id) + '">Who called it</button><div class="who-list" hidden></div></div>' : '') +
      crowdTagHtml +
      lockedNote +
      buddyHtml +
      trendHtml +
      '<div class="ticket-foot"><div class="foot-left"><div class="foot-players"></div><span class="foot-count">' + total + ' voted</span></div>' + latestHtml + '</div>' +
      '<details class="cmt" data-question-id="' + q.id + '">' +
        '<summary class="cmt-sum"><span>Comments <span class="cmt-count"></span></span>' +
          '<button type="button" class="q-heart" data-q="' + q.id + '" aria-label="Like this question" aria-pressed="false"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20.5S3 15 3 8.8C3 6.2 5 4.3 7.4 4.3c1.8 0 3.4 1 4.6 2.8 1.2-1.8 2.8-2.8 4.6-2.8C19 4.3 21 6.2 21 8.8 21 15 12 20.5 12 20.5z"/></svg><span class="q-heart-n"></span></button>' +
          '<svg class="cmt-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>' +
        '<div class="cmt-body"><div class="cmt-list"></div><div class="cmt-compose"></div></div>' +
      '</details>' +
      resolutionHtml +
      '<p class="form-msg" style="margin-top:8px;"></p>';
    div.querySelector('.ticket-q').textContent = q.question_text;
    if(q.resolution_criteria) div.querySelector('.resolution-text').textContent = q.resolution_criteria;
    div.querySelector('.cat-label-text').textContent = CATEGORY_LABELS[q.category] || q.category;
    if(isFinal){
      var okOpt = div.querySelector('.opt.' + q.correct_answer);
      var badOpt = div.querySelector('.opt.' + (q.correct_answer === 'yes' ? 'no' : 'yes'));
      if(okOpt){ okOpt.classList.add('is-correct'); okOpt.insertAdjacentHTML('beforeend', '<span class="opt-check">' + mqIcon('check') + '</span>'); }
      if(badOpt) badOpt.classList.add('is-wrong');
    }
    if(isLocked){
      div.querySelectorAll('.opt').forEach(function(opt){ opt.style.cursor = 'default'; opt.style.opacity = hasVoted ? '1' : '0.85'; });
    }
    if(showPct){
      mqPct(div.querySelector('.opt.yes .opt-price'), yesPct);
      mqPct(div.querySelector('.opt.no .opt-price'), noPct);
      if(total > 0){
        var fillI = div.querySelector('.crowd-bar i');
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ fillI.style.width = yesPct + '%'; }); });
      }
    }
    return div;
  }


  // ---- How to play: an animated demo of one call (Pick -> Lock -> Score) ----
  // Built from the same classes as the real question cards so it always looks like the real thing.
  function mqInitHowDemo(){
    var host = document.getElementById('how-demo');
    if(!host) return;
    var cap = document.getElementById('how-demo-cap');
    var rules = document.querySelectorAll('#page-how .hw-step');
    var qtext = 'Will the Eagles beat the 49ers on Sunday Night Football?';
    var vis = mqDetectVisual({ question_text: qtext, category: 'sports' }) || {};
    var matchup = (vis.kind === 'matchup') ? mqMatchupHtml(vis.teams, vis.icon) : '';
    var league = vis.league ? '<span class="mq-league">' + vis.league + '</span>' : '';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timers = [], tick = null, running = false, manual = false;
    var TEASER = '<div class="trend-wrap"><div class="crowd-teaser">' + mqIcon('lock') + '<div class="teaser-body"><div class="teaser-bar"><i></i></div><span>Make your call to see where the crowd stands</span></div></div></div>';

    function cardHtml(){
      return '<div class="ticket predict-card awaiting" data-cat="sports" style="max-width:480px;margin:0 auto;">' +
        '<p class="ticket-meta card-head">1 of 3 \u00b7 <span class="cat-chip"><span class="cat-tile">' + (CATEGORY_ICONS.sports || '') + '</span><span>Sports</span>' + league + '</span>' +
          '<span class="status-pill live" data-hd="status"><span class="live-dot"></span>Live</span></p>' +
        matchup +
        '<div class="mq-qrow"><p class="ticket-q">' + escapeHtml(qtext) + '</p></div>' +
        '<div class="mq-chips">' +
          '<span class="lock-chip soon" data-hd="lock">' + mqIcon('clock') + '<span class="lock-chip-text" data-hd="locktext">Locks in 12m 00s</span></span>' +
          '<span class="pts-chip">' + mqIcon('star') + 'Worth 100 points</span></div>' +
        '<div class="ticket-row">' +
          '<div class="opt yes" data-hd="yes"><div class="opt-label" style="display:none;">YES</div><div class="opt-price" data-hd="yesprice">' + mqIcon('check') + 'Yes</div></div>' +
          '<div class="opt no" data-hd="no"><div class="opt-label" style="display:none;">NO</div><div class="opt-price" data-hd="noprice">' + mqIcon('xmark') + 'No</div></div>' +
        '</div>' +
        '<div class="crowd-bar" data-hd="bar"><i style="width:0"></i></div>' +
        '<div class="hd-extra" data-hd="extra">' + TEASER + '</div>' +
        '<div class="hd-bottom">' +
          '<div class="ticket-foot hd-foot" data-hd="foot"><div class="foot-left"><span class="foot-count">128 voted</span></div><span class="foot-latest"><i class="live-dot"></i>Latest call 2m ago</span></div>' +
          '<div class="hd-score" data-hd="score"><span class="hd-score-l">' + mqIcon('star') + 'Points earned</span><b data-hd="scoren">0</b></div>' +
        '</div>' +
      '</div>';
    }
    function q(name){ return host.querySelector('[data-hd="' + name + '"]'); }
    function setCap(txt){ if(cap) cap.textContent = txt; }
    function setRule(i){ rules.forEach(function(r, n){ r.classList.toggle('on', n === i); }); }

    function doPick(){
      var card = host.querySelector('.predict-card');
      card.classList.remove('awaiting'); card.classList.add('pick-yes');
      q('yes').classList.add('picked');
      host.querySelectorAll('.opt-label').forEach(function(l){ l.style.display = ''; });
      q('yesprice').innerHTML = '62<span class="opt-pct">%</span>';
      q('noprice').innerHTML = '38<span class="opt-pct">%</span>';
      var bar = q('bar'); bar.classList.add('on');
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ bar.firstChild.style.width = '62%'; }); });
      q('extra').innerHTML = '<div class="crowd-tags"><div class="crowd-tag with">' + mqIcon('users') + '<span>You\u2019re with 62% of players</span></div></div>';
    }
    function doLock(){
      var lock = q('lock'); lock.classList.remove('soon'); lock.classList.add('done');
      q('locktext').textContent = 'Locked';
      var st = q('status'); st.className = 'status-pill inplay'; st.innerHTML = '<span class="live-dot"></span>In play';
      q('extra').innerHTML = '<div class="result-tag final">' + mqIcon('lock') + '<span>Your call is set</span></div>';
    }
    function doFinal(animate){
      var st = q('status'); st.className = 'status-pill final'; st.textContent = 'Final';
      var yes = q('yes'), no = q('no');
      yes.classList.add('is-correct'); yes.insertAdjacentHTML('beforeend', '<span class="opt-check">' + mqIcon('check') + '</span>');
      no.classList.add('is-wrong');
      q('extra').innerHTML = '<div class="result-tag win">' + mqIcon('check') + '<span>You called it \u2014 correct</span></div>';
      var box = q('score'), n = q('scoren'); box.classList.add('on'); q('foot').classList.add('off');
      if(!animate){ n.textContent = '100'; return; }
      var t0 = Date.now();
      tick = setInterval(function(){
        var p = Math.min(1, (Date.now() - t0) / 900);
        n.textContent = String(Math.round(100 * (1 - Math.pow(1 - p, 3))));
        if(p >= 1){ clearInterval(tick); tick = null; }
      }, 30);
    }

    function clearAll(){
      timers.forEach(clearTimeout); timers = [];
      if(tick){ clearInterval(tick); tick = null; }
    }
    function at(ms, fn){ timers.push(setTimeout(fn, ms)); }

    function play(){
      if(!running) return;
      clearAll();
      host.innerHTML = cardHtml();
      host.classList.remove('fade');
      setRule(0); setCap('Pick Yes or No before the call locks.');
      // little countdown while the pick is open
      var t0 = Date.now();
      var lt = setInterval(function(){
        var el = q('locktext');
        if(!el || el.textContent === 'Locked'){ clearInterval(lt); return; }
        el.textContent = mqLockText(12 * 60000 - (Date.now() - t0));
      }, 1000);
      timers.push(lt);
      at(1700, doPick);
      at(4300, function(){ setRule(1); setCap('It locks before the event starts. After that, no changes.'); doLock(); });
      at(7000, function(){ setRule(2); setCap('Every correct call is worth 100 points.'); doFinal(true); });
      at(11200, function(){ host.classList.add('fade'); });
      at(11650, play);
    }
    function start(){ if(running) return; running = true; play(); }
    function stop(){ running = false; clearAll(); }

    // Pressing a Pick/Lock/Score card jumps straight to that step and stops
    // the auto-loop there, so someone can read that part on their own time
    // instead of it cycling away after a few seconds.
    var STEP_CAPTIONS = [
      'Pick Yes or No before the call locks.',
      'It locks before the event starts. After that, no changes.',
      'Every correct call is worth 100 points.'
    ];
    function showStep(i){
      manual = true;
      stop();
      host.innerHTML = cardHtml();
      host.classList.remove('fade');
      if(i >= 0) doPick();
      if(i >= 1) doLock();
      if(i >= 2) doFinal(false);
      setRule(i);
      setCap(STEP_CAPTIONS[i]);
    }
    rules.forEach(function(r, i){
      r.setAttribute('tabindex', '0');
      r.setAttribute('role', 'button');
      r.setAttribute('aria-label', 'Show the ' + (r.querySelector('.hw-step-h') ? r.querySelector('.hw-step-h').textContent : 'step') + ' step');
      r.addEventListener('click', function(){ showStep(i); });
      r.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); showStep(i); }
      });
    });

    if(reduce){
      host.innerHTML = cardHtml(); doPick(); doLock(); doFinal(false);
      setCap('Pick before the call locks. Every correct call is worth 100 points.');
      return;
    }
    host.innerHTML = cardHtml();
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(manual) return; // someone pressed a step card -- leave it where they put it
          if(e.isIntersecting && !document.hidden) start(); else { stop(); setRule(-1); }
        });
      }, { threshold: 0.35 }).observe(host);
      document.addEventListener('visibilitychange', function(){ if(!manual && document.hidden) { stop(); setRule(-1); } });
    }else{
      start();
    }
  }
  (function(){ var b = document.getElementById('hw-start'); if(b) b.addEventListener('click', function(){ var t = document.querySelector('.pagenav-tab[data-page="home"]'); if(t) t.click(); window.scrollTo(0, 0); }); })();
  try{ mqInitHowDemo(); }catch(e){ /* demo is decoration only; never block the site */ }

  async function getVoteData(questionId){
    // Counts + trend are computed in the database (get_vote_summary): a plain
    // select silently stops at 1,000 rows, which would undercount any question
    // with more votes than that. The trend is thinned server-side above ~200 votes.
    const { data: summary, error: summaryErr } = await sb.rpc('get_vote_summary', { p_question_id: questionId });
    if(!summaryErr && summary){
      return {
        counts: { yes: Number(summary.yes) || 0, no: Number(summary.no) || 0 },
        trend: (summary.trend || []).map(function(pt){ return { time: new Date(pt.t), pct: Number(pt.pct) }; })
      };
    }
    return getVoteDataLegacy(questionId); // function not created yet -- exact below 1,000 votes
  }
  async function getVoteDataLegacy(questionId){
    // Ordered by created_at so we can compute how the Yes% has actually moved
    // over time as votes came in, not just the final snapshot.
    const { data } = await sb.from('predictions').select('choice, created_at').eq('question_id', questionId).order('created_at', { ascending: true });
    const rows = data || [];
    const counts = { yes: 0, no: 0 };
    const trend = [];
    rows.forEach(function(row){
      counts[row.choice]++;
      const total = counts.yes + counts.no;
      trend.push({ time: new Date(row.created_at), pct: Math.round((counts.yes / total) * 100) });
    });
    return { counts: counts, trend: trend };
  }

  function appendSuggestionBox(container, session){
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border-top:1px solid var(--line); margin-top:24px; padding-top:24px;';

    const box = document.createElement('div');
    box.style.cssText = 'max-width:480px; background:var(--paper); border:2px solid var(--yes); border-radius:16px; padding:20px 22px;';

    // Tomorrow's date in ET, used as the earliest date someone can request.
    const etParts = getETDateInfo().dateStr.split('-').map(Number);
    const tomorrowUTC = new Date(Date.UTC(etParts[0], etParts[1] - 1, etParts[2]));
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
    const minDateStr = tomorrowUTC.toISOString().slice(0, 10);

    box.innerHTML =
      '<div style="display:flex; align-items:center; gap:8px;">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--yes)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.1V15h6v-.4c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 2z"/></svg>' +
        '<p class="ticket-q" style="max-width:none; margin:0;">Request a prediction</p>' +
      '</div>' +
      '<p class="ticket-meta">Got an idea for a future call? Tell us what, and which day.</p>' +
      '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; margin-bottom:8px;">' +
      '<select id="suggestion-category" style="padding:10px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); font-family:inherit; font-size:14px;">' +
        '<option value="sports">Sports</option>' +
        '<option value="pop_culture">Pop culture</option>' +
        '<option value="news">News</option>' +
      '</select>' +
      '<input type="date" id="suggestion-date" min="' + minDateStr + '" value="' + minDateStr + '" style="padding:10px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); font-family:inherit; font-size:14px;">' +
      '</div>' +
      '<textarea id="suggestion-text" rows="2" maxlength="300" placeholder="What should we ask?" style="display:block; width:100%; box-sizing:border-box; padding:10px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); font-family:inherit; font-size:14px; resize:none;"></textarea>' +
      '<button type="button" id="suggestion-submit-btn" style="margin-top:10px; padding:10px 22px; border:none; border-radius:10px; background:#FFFFFF; color:#17191D; font-family:inherit; font-weight:600; font-size:15px; cursor:pointer;">Pitch idea</button>' +
      '<p class="form-msg" id="suggestion-msg" style="margin-top:6px;"></p>';
    wrap.appendChild(box);
    const host = document.getElementById('play-suggest') || container;
    if(host !== container) host.innerHTML = '';
    host.appendChild(wrap);

    // If someone typed an idea, got sent off to sign up, and came back signed in
    // (same tab -- e.g. Google sign-in or email+password), put their idea back.
    // Only applies once they actually have a session; kept until it is sent.
    if(session){
      try{
        const draftRaw = sessionStorage.getItem('marqit_pitch_draft');
        if(draftRaw){
          const draft = JSON.parse(draftRaw);
          if(draft && typeof draft.text === 'string' && draft.text){
            document.getElementById('suggestion-text').value = draft.text.slice(0, 300);
            if(['sports', 'pop_culture', 'news'].indexOf(draft.category) !== -1){
              document.getElementById('suggestion-category').value = draft.category;
            }
            if(typeof draft.requestedDate === 'string' && draft.requestedDate >= minDateStr){
              document.getElementById('suggestion-date').value = draft.requestedDate;
            }
            const restoredMsg = document.getElementById('suggestion-msg');
            restoredMsg.className = 'form-msg ok';
            restoredMsg.textContent = 'Welcome! Your idea is saved \u2014 tap Pitch idea to send it.';
          }
        }
      }catch(e){ /* a bad draft should never break the box */ }
    }

    document.getElementById('suggestion-submit-btn').addEventListener('click', async function(){
      const btn = this;
      const category = document.getElementById('suggestion-category').value;
      const requestedDate = document.getElementById('suggestion-date').value;
      const text = document.getElementById('suggestion-text').value.trim();
      const msg = document.getElementById('suggestion-msg');
      msg.className = 'form-msg';
      msg.textContent = '';
      if(!text){
        msg.className = 'form-msg err';
        msg.textContent = 'Type your question idea first.';
        return;
      }
      if(!requestedDate){
        msg.className = 'form-msg err';
        msg.textContent = 'Pick a date for this idea.';
        return;
      }
      btn.disabled = true;
      // Check for a session at click time, not render time: the box now shows to
      // signed-out visitors too, and someone may have signed in since it drew.
      let liveSession = null;
      try{
        const sessRes = await sb.auth.getSession();
        liveSession = sessRes && sessRes.data && sessRes.data.session;
      }catch(e){ liveSession = null; }
      if(!liveSession){
        // Signed-out players can send ideas too (limited to 3 a day per device).
        const dev = mqGuestDeviceId();
        const gres = dev ? await sb.rpc('submit_guest_suggestion', { p_device_id: dev, p_category: category, p_text: text, p_date: requestedDate }) : { error: { message: 'no device' } };
        btn.disabled = false;
        if(gres.error){
          msg.className = 'form-msg err';
          msg.textContent = (gres.error.message && gres.error.message.indexOf('3 ideas') !== -1) ? 'You can send 3 ideas a day. Sign up free to send more.' : 'Could not submit \u2014 try again.';
          return;
        }
        msg.className = 'form-msg ok';
        msg.textContent = 'Sent! Be ready for Marqit predictions tomorrow.';
        document.getElementById('suggestion-text').value = '';
        try{ sessionStorage.removeItem('marqit_pitch_draft'); }catch(e){}
        return;
      }
      const { error } = await sb.from('question_suggestions').insert({
        user_id: liveSession.user.id,
        category: category,
        suggestion_text: text,
        requested_date: requestedDate
      });
      btn.disabled = false;
      if(error){
        msg.className = 'form-msg err';
        msg.textContent = 'Could not submit \u2014 try again.';
        return;
      }
      msg.className = 'form-msg ok';
      msg.textContent = 'Sent! Be ready for Marqit predictions tomorrow.';
      document.getElementById('suggestion-text').value = '';
      try{ sessionStorage.removeItem('marqit_pitch_draft'); }catch(e){}
    });
  }

  // Shared timer state for the daily countdown/pending indicator, tracked
  // outside loadDailyQuestions so repeated calls don't stack up intervals.
  let dailyCountdownInterval = null;
  let dailyPollInterval = null;
  let dailyActivityTickerInterval = null;
  let dailyVoteCountPollInterval = null;
  function clearDailyTimers(){
    if(dailyCountdownInterval){ clearInterval(dailyCountdownInterval); dailyCountdownInterval = null; }
    if(dailyPollInterval){ clearInterval(dailyPollInterval); dailyPollInterval = null; }
    if(dailyActivityTickerInterval){ clearInterval(dailyActivityTickerInterval); dailyActivityTickerInterval = null; }
    if(dailyVoteCountPollInterval){ clearInterval(dailyVoteCountPollInterval); dailyVoteCountPollInterval = null; }
  }
  function formatCountdown(ms){
    if(ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    function pad(n){ return String(n).padStart(2, '0'); }
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  // loadDailyQuestions gets called from more than one place at page load (the
  // startup call AND showSignedIn). Two overlapping runs would both draw into the
  // same container -- the second wipes the first's cards, but the first still
  // appends its Submit/Edit/"Add some stakes" controls after its await, leaving
  // duplicate controls (with duplicate ids). So: only one run at a time, and if
  // another call arrives mid-run, do exactly one more run afterward so the final
  // view reflects the latest sign-in state.
  var dailyLoading = false;
  var dailyReloadQueued = false;
  async function loadDailyQuestions(){
    if(dailyLoading){ dailyReloadQueued = true; return; }
    dailyLoading = true;
    try{
      await loadDailyQuestionsInner();
    } finally {
      dailyLoading = false;
      mqRenderSharePrompt(); // re-show any pending share prompt the render just wiped
      if(dailyReloadQueued){ dailyReloadQueued = false; loadDailyQuestions(); }
    }
  }

  // --- Drop bonus banner --------------------------------------------------
  // Mirrors the daily-drop edge function: once a day, at an unpredictable
  // time, everyone gets pushed the same notification and has a short
  // window where a correct pick scores +50 extra (see resolve_day). This
  // banner is the in-app version of that same window, for anyone who has
  // the tab open (or opens it) during the window, whether or not push
  // notifications are on.
  var dropCountdownInterval = null;
  var dropPollTimeout = null;
  function clearDropTimers(){
    if(dropCountdownInterval){ clearInterval(dropCountdownInterval); dropCountdownInterval = null; }
    if(dropPollTimeout){ clearTimeout(dropPollTimeout); dropPollTimeout = null; }
  }
  async function checkDailyDrop(){
    clearDropTimers();
    var banner = document.getElementById('drop-banner');
    var countdownEl = document.getElementById('drop-banner-countdown');
    if(!banner || !countdownEl) return;

    var today = getETDateInfo().dateStr;
    var drop;
    try{
      var res = await sb.from('daily_drops').select('drop_time, window_seconds, notified').eq('question_date', today).maybeSingle();
      drop = res.data;
    }catch(e){ drop = null; }

    var nextPollMs = 30000; // default: check again in 30s
    if(drop && drop.notified){
      var dropEndMs = new Date(drop.drop_time).getTime() + (drop.window_seconds * 1000);
      var msLeft = dropEndMs - Date.now();
      if(msLeft > 0){
        banner.style.display = 'flex';
        function tick(){
          var left = dropEndMs - Date.now();
          if(left <= 0){
            banner.style.display = 'none';
            clearDropTimers();
            return;
          }
          var m = Math.floor(left / 60000);
          var s = Math.floor((left % 60000) / 1000);
          countdownEl.textContent = m + ':' + (s < 10 ? '0' : '') + s + ' left';
        }
        tick();
        dropCountdownInterval = setInterval(tick, 1000);
        return; // don't schedule a re-poll while the window is actively ticking down
      } else {
        banner.style.display = 'none';
      }
    } else {
      banner.style.display = 'none';
      if(drop && !drop.notified){
        // Scheduled but hasn't fired yet -- no way to know exactly when
        // (that's the point), so just check back periodically.
        var untilDrop = new Date(drop.drop_time).getTime() - Date.now();
        if(untilDrop > 0 && untilDrop < 30000) nextPollMs = Math.max(2000, untilDrop);
      }
    }
    dropPollTimeout = setTimeout(checkDailyDrop, nextPollMs);
  }

  // Placeholder cards shown the instant the Play tab opens, before today's
  // questions/vote data have come back — replaced wholesale once real
  // content is ready. Reuses the existing .skel-card/.sk shimmer styles.
  function mqSkeletonCardsHtml(n){
    var one = '<div class="skel-card"><i class="sk" style="width:34%;"></i><i class="sk" style="width:82%;height:16px;margin-top:14px;"></i><div class="sk-row"><i class="sk"></i><i class="sk"></i></div></div>';
    var out = '';
    for(var i = 0; i < n; i++) out += one;
    return out;
  }
  async function loadDailyQuestionsInner(){
    clearDailyTimers();
    const container = document.getElementById('daily-questions-container');
    if(!container) return;
    container.innerHTML = mqSkeletonCardsHtml(3);

    const today = getETDateInfo().dateStr;
    let { data: questions, error } = await sb.from('daily_questions').select('*').eq('question_date', today).order('slot', { ascending: true }).order('lock_time', { ascending: true });
    let effectiveDate = today;

    // Today's set hasn't posted yet -- before falling back to the "on its
    // way" placeholder, check whether the most recent prior day's questions
    // are still sitting unresolved. A day isn't actually over until an
    // admin has resolved it (marked each question right/wrong); the
    // calendar flipping to a new date doesn't do that on its own. So if
    // yesterday's questions exist and at least one is still unresolved,
    // keep showing that set (it'll render locked, since its lock times
    // have long passed) instead of wiping it at midnight.
    if(!error && (!questions || questions.length === 0)){
      const { data: lastDateRow } = await sb.from('daily_questions').select('question_date').lt('question_date', today).order('question_date', { ascending: false }).limit(1);
      if(lastDateRow && lastDateRow.length){
        const lastDate = lastDateRow[0].question_date;
        const { data: lastQuestions } = await sb.from('daily_questions').select('*').eq('question_date', lastDate).order('slot', { ascending: true }).order('lock_time', { ascending: true });
        if(lastQuestions && lastQuestions.length && lastQuestions.some(function(q){ return !q.resolved; })){
          questions = lastQuestions;
          effectiveDate = lastDate;
        }
      }
    }

    if(error || !questions || questions.length === 0){
      const { data: sessionRes } = await sb.auth.getSession();
      const session = sessionRes && sessionRes.session;
      const signedIn = !!session;
      // The day's three calls are picked from what's trending, so the topics (and
      // categories) are a surprise until they post -- placeholders stay generic.
      const placeholders = [1, 2, 3].map(function(n){
        return '<div class="ticket predict-card" style="max-width:480px; margin-bottom:16px; opacity:0.7;">' +
          '<p class="ticket-meta">Call ' + n + ' of 3</p>' +
          '<p class="ticket-q" style="color:var(--ink-soft); margin-top:6px;">Today\'s call is on its way.</p>' +
          '</div>';
      }).join('');
      const ctaHtml = signedIn ? '' :
        '<button type="button" id="empty-state-signup-btn" style="margin-top:4px; padding:12px 24px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer;">Sign up so you\'re ready</button>';
      container.innerHTML =
        '<p class="ex-sub" style="margin-bottom:16px;">New calls post daily. Check back soon.</p>' +
        placeholders +
        ctaHtml;
      const emptyStateSignupBtn = document.getElementById('empty-state-signup-btn');
      if(emptyStateSignupBtn) emptyStateSignupBtn.addEventListener('click', function(){ openAuthPanel('signup'); });
      appendSuggestionBox(container, session); // everyone sees it; signed-out taps go to sign-up

      // Keep checking in the background — once today's questions actually
      // post, refresh automatically instead of making them hit reload.
      dailyPollInterval = setInterval(async function(){
        const { data: check } = await sb.from('daily_questions').select('id').eq('question_date', getETDateInfo().dateStr).limit(1);
        if(check && check.length > 0){
          clearDailyTimers();
          loadDailyQuestions();
        }
      }, 300000);
      return;
    }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;

    // Guest with saved picks: make sure the server has them (idempotent upsert),
    // so they count in the crowd even if an earlier submit didn't reach it.
    // Retried on every load until it succeeds; remembered per set of picks.
    if(!session){
      try{
        const gp = mqGetGuestPicks(effectiveDate);
        const syncable = questions.filter(function(q){ return new Date() < new Date(q.lock_time) && (gp[q.id] === 'yes' || gp[q.id] === 'no'); });
        const dev = mqGuestDeviceId();
        if(dev && syncable.length){
          const sig = 'mq_guest_synced_' + syncable.map(function(q){ return q.id + gp[q.id]; }).join('|');
          if(!localStorage.getItem(sig)){
            const { error: gErr } = await sb.rpc('submit_guest_predictions', { p_device_id: dev, p_answers: syncable.map(function(q){ return { question_id: q.id, choice: gp[q.id] }; }) });
            if(!gErr) localStorage.setItem(sig, '1');
          }
        }
      }catch(e){}
    }

    // Picks a visitor made before signing up: once they have a session, submit
    // them through the same server-side RPC (it still enforces lock times), but
    // only if they haven't already made calls on this set. Cleared either way.
    if(session){
      try{
        const rawGuest = localStorage.getItem('mq_guest_picks');
        if(rawGuest){
          const guest = JSON.parse(rawGuest);
          localStorage.removeItem('mq_guest_picks');
          if(guest && guest.date === effectiveDate && guest.picks){
            const open = questions.filter(function(q){ return new Date() < new Date(q.lock_time) && (guest.picks[q.id] === 'yes' || guest.picks[q.id] === 'no'); });
            if(open.length === questions.length){
              const { data: already } = await sb.from('predictions').select('question_id').eq('user_id', session.user.id).in('question_id', questions.map(function(q){ return q.id; })).limit(1);
              if(!already || already.length === 0){
                const subRes = await sb.rpc('submit_daily_predictions', { p_answers: open.map(function(q){ return { question_id: q.id, choice: guest.picks[q.id] }; }) });
                if(subRes && !subRes.error){ mqGuestWelcome = true; mqTrack('guest_picks_saved_after_signup'); try{ const dv = mqGuestDeviceId(); if(dv) await sb.rpc('claim_guest_predictions', { p_device_id: dv }); }catch(e){} }
              }
            }
          }
        }
      }catch(e){ /* best effort: they can still pick manually */ }
    }

    // Fetch every buddy's picks once up front (not per-card) so each card
    // can show a buddy-vs-rival line without hitting the DB repeatedly.
    // buddyList is an array now -- there's no limit on how many buddies
    // someone can have, so every one of them shows their own line.
    let buddyList = [];
    if(session){
      const questionIds = questions.map(function(q){ return q.id; });
      let { data: buddyRows } = await sb.from('buddies').select('buddy_id, profiles!buddies_buddy_id_fkey(username)').eq('user_id', session.user.id);
      if(buddyRows && buddyRows.length){
        var seenBuddy = {};
        buddyRows = buddyRows.filter(function(b){ if(seenBuddy[b.buddy_id]) return false; seenBuddy[b.buddy_id] = 1; return true; });
        buddyList = await Promise.all(buddyRows.map(async function(b){
          const { data: buddyPreds } = await sb.from('predictions').select('question_id, choice, created_at').eq('user_id', b.buddy_id).in('question_id', questionIds);
          const buddyPickMap = {};
          (buddyPreds || []).forEach(function(p){ buddyPickMap[p.question_id] = p.choice; });
          return { id: b.buddy_id, username: b.profiles ? b.profiles.username : 'your buddy', picks: buddyPickMap, preds: buddyPreds || [], kind: 'buddy' };
        }));
      }
    }

    // Fetch everything first so we can figure out which question is most-called
    // before building any cards — needs the full picture, not a running total.
    const prepared = [];
    for(let i = 0; i < questions.length; i++){
      const q = questions[i];
      let myVote = null;
      if(!session){
        const gp = mqGetGuestPicks(effectiveDate)[q.id];
        if(gp === 'yes' || gp === 'no') myVote = gp;
      }
      if(session){
        const { data: existingVote } = await sb.from('predictions').select('choice').eq('question_id', q.id).eq('user_id', session.user.id).maybeSingle();
        myVote = existingVote ? existingVote.choice : null;
      }
      const voteData = await getVoteData(q.id);
      // A voided question is closed to new picks no matter what its lock time says.
      const isLocked = !!q.voided || new Date() >= new Date(q.lock_time);
      prepared.push({ q: q, myVote: myVote, voteData: voteData, isLocked: isLocked, total: voteData.counts.yes + voteData.counts.no });
    }

    // Only badge a strict, unique leader — a tie or an all-zero day shouldn't get one.
    let mostCalledId = null;
    const maxTotal = Math.max.apply(null, prepared.map(function(p){ return p.total; }));
    mqUpdateTodayStrip(isFinite(maxTotal) ? maxTotal : 0);
    if(maxTotal > 0){
      const leaders = prepared.filter(function(p){ return p.total === maxTotal; });
      if(leaders.length === 1) mostCalledId = leaders[0].q.id;
    }

    // Biggest mover: whichever open question swung the most in Yes% over the
    // last hour of trend snapshots. Needs at least 2 points spanning enough
    // time to mean anything, and a real swing (5pts+), or nobody gets badged.
    let biggestMoverId = null;
    {
      let bestSwing = 4; // threshold in percentage points
      prepared.forEach(function(p){
        if(p.isLocked || !p.voteData.trend || p.voteData.trend.length < 2) return;
        const trend = p.voteData.trend;
        const nowPct = trend[trend.length - 1].pct;
        const hourAgo = Date.now() - 3600000;
        let past = trend[0];
        for(let k = 0; k < trend.length; k++){ if(trend[k].time.getTime() <= hourAgo) past = trend[k]; }
        const swing = Math.abs(nowPct - past.pct);
        if(swing > bestSwing){ bestSwing = swing; biggestMoverId = p.q.id; }
      });
    }

    // The homepage countdown should reflect when the LAST of today's
    // questions locks, not just whichever one happens to sort first by
    // category — individual questions (e.g. market-close-timed ones) can
    // lock much earlier than the rest, and showing that early time made the
    // "Locks in" timer expire well before the day's other questions closed.
    const stillOpen = prepared.filter(function(p){ return !p.isLocked; });
    const lockTime = stillOpen.length > 0
      ? new Date(Math.max.apply(null, stillOpen.map(function(p){ return new Date(p.q.lock_time).getTime(); })))
      : null;
    const allLockedNow = prepared.every(function(p){ return p.isLocked; });

    container.innerHTML = '';

    if(mqGuestWelcome && session){
      const welcome = document.createElement('div');
      welcome.className = 'trending-strip';
      welcome.innerHTML = mqIcon('check') + '<span><strong>Welcome to Marqit.</strong> Your 3 calls are locked in.</span>';
      container.appendChild(welcome);
    }

    function startPendingPoll(){
      dailyPollInterval = setInterval(async function(){
        const { data: check } = await sb.from('daily_questions').select('id').gt('question_date', effectiveDate).limit(1);
        if(check && check.length > 0){
          clearDailyTimers();
          loadDailyQuestions();
        }
      }, 300000);
    }

    // Trending strip: a one-line pointer to whichever call is getting the
    // most action today, sitting above the fold so it doesn't require
    // scrolling past all three cards to notice. Doesn't reveal percentages
    // — same gating as everything else — just that it's the busiest one.
    if(mostCalledId){
      const mostCalledQ = prepared.find(function(p){ return p.q.id === mostCalledId; });
      if(mostCalledQ){
        const stripEl = document.createElement('div');
        stripEl.className = 'trending-strip';
        stripEl.innerHTML = mqIcon('flame') + '<span>Trending: <strong>' + escapeHtml(mostCalledQ.q.question_text) + '</strong></span>';
        container.appendChild(stripEl);
      }
    }
    mqStartActivityTicker(container, prepared, null);

    // Keep the "X voted" footer count ticking up live, even before you've
    // submitted your own picks — not just in the post-submit reveal. Only
    // polls questions that are still open (re-checked each tick, not just
    // at load), and reuses the same tick-up animation as the reveal so a
    // change mid-poll looks the same either way.
    dailyVoteCountPollInterval = setInterval(async function(){
      for(const p of prepared){
        if(new Date() >= new Date(p.q.lock_time)) continue;
        const card = container.querySelector('[data-question-id="' + p.q.id + '"]');
        if(!card) continue;
        const voteData = await getVoteData(p.q.id);
        const total = voteData.counts.yes + voteData.counts.no;
        mqAnimateFootCount(card.querySelector('.ticket-foot .foot-count'), total);
      }
    }, 20000);

    // Buddy nudge: if a buddy's already finished all of today's questions
    // and you haven't, a small heads-up -- purely "they're done", never
    // which side they picked, so it can't be used to peek ahead either.
    if(session && buddyList.length && !allLockedNow){
      const stillHaveOpenUnanswered = prepared.some(function(p){ return !p.isLocked && !p.myVote; });
      if(stillHaveOpenUnanswered){
        const doneBuddy = buddyList.find(function(b){ return questions.every(function(q){ return !!b.picks[q.id]; }); });
        if(doneBuddy){
          const nudgeEl = document.createElement('div');
          nudgeEl.className = 'trending-strip buddy-nudge';
          nudgeEl.innerHTML = mqIcon('users') + '<span><strong>' + escapeHtml(doneBuddy.username) + '</strong> already made their calls today.</span>';
          container.appendChild(nudgeEl);
        }
      }
    }

    const timerEl = document.createElement('div');
    timerEl.id = 'daily-timer';
    timerEl.className = 'lock-card';
    timerEl.style.cssText = 'max-width:480px; margin-bottom:16px;';
    container.appendChild(timerEl);

    if(allLockedNow || !lockTime){
      timerEl.innerHTML = '<div style="font-size:13px; color:var(--ink-soft); font-weight:600;">New calls soon. Check back.</div>';
      startPendingPoll();
    }else{
      timerEl.innerHTML =
        '<div class="lock-top"><span class="lock-label"><span class="live-dot"></span>Locks in</span><span id="daily-timer-value" class="lock-val">' + formatCountdown(lockTime.getTime() - Date.now()) + '</span></div>' +
        '<div class="lock-bar"><i></i></div>';
      const paintLockBar = function(){
        const rem = lockTime.getTime() - Date.now();
        const frac = Math.max(0, Math.min(1, rem / (16 * 3600 * 1000)));
        const barI = timerEl.querySelector('.lock-bar i');
        if(barI) barI.style.width = (frac * 100) + '%';
        timerEl.classList.toggle('urgent', rem < 2 * 3600000);
        timerEl.classList.toggle('critical', rem < 30 * 60000);
      };
      paintLockBar();
      dailyCountdownInterval = setInterval(function(){
        const remaining = lockTime.getTime() - Date.now();
        if(remaining <= 0){
          clearInterval(dailyCountdownInterval);
          dailyCountdownInterval = null;
          timerEl.innerHTML = '<div style="font-size:13px; color:var(--ink-soft); font-weight:600;">New calls soon. Check back.</div>';
          startPendingPoll();
          return;
        }
        const valueEl = document.getElementById('daily-timer-value');
        if(valueEl) valueEl.textContent = formatCountdown(remaining);
        paintLockBar();
      }, 1000);
    }

    var slateEl = null;
    if(!allLockedNow && lockTime){
      slateEl = mqSlateEl(prepared.length, buddyList.map(function(b){ return b.username; }), prepared.filter(function(p){ return p.q.is_boosted; }).length, buddyList);
      container.appendChild(slateEl);
      // One status box: the lock timer moves into the points slate so the
      // countdown and "Earn up to" sit side by side instead of in two boxes.
      var slateTopEl = slateEl.querySelector('.slate-top');
      if(slateTopEl && timerEl.querySelector('.lock-top')){
        var slateHead = document.createElement('div');
        slateHead.className = 'slate-head';
        slateEl.insertBefore(slateHead, slateEl.firstChild);
        timerEl.classList.add('in-slate');
        timerEl.style.cssText = '';
        slateHead.appendChild(timerEl);
        slateHead.appendChild(slateTopEl);
      }
    }

    // Change 4 data + persistent entry point: any locked call with a pick
    // on it is shareable pre-result, independent of the once-a-day banner
    // above -- so this also gives players a way back into it any time.
    __mqPreResultData = prepared
      .filter(function(p){ return p.isLocked && p.myVote; })
      .map(function(p){ return { category: p.q.category, questionText: p.q.question_text, choice: p.myVote }; });
    var __mqShareBtn = null;
    if(session && __mqPreResultData.length){
      const preResultBtn = document.createElement('button');
      preResultBtn.type = 'button';
      preResultBtn.className = 'cb-btn'; preResultBtn.id = 'share-picks-btn';
      preResultBtn.style.cssText = 'margin-bottom:16px; background:var(--panel); color:var(--ink); border:1px solid var(--line);';
      preResultBtn.textContent = 'Share my picks';
      preResultBtn.addEventListener('click', function(){ mqSharePreResultCard(); });
      preResultBtn.style.cssText = 'margin:4px 0 16px; background:var(--panel); color:var(--ink); border:1px solid var(--line);';
      __mqShareBtn = preResultBtn;
    }

    let allLocked = true;
    for(let i = 0; i < prepared.length; i++){
      const q = prepared[i].q;
      const myVote = prepared[i].myVote;
      const voteData = prepared[i].voteData;
      const isLocked = prepared[i].isLocked;
      if(!isLocked) allLocked = false;
      const card = buildQuestionCard(q, i, myVote, voteData.counts, isLocked, voteData.trend, q.id === mostCalledId, buddyList, q.id === biggestMoverId);
      card.style.setProperty('--delay', (i * 90) + 'ms');
      container.appendChild(card);
      animateTrendLine(card);
    }
    if(__mqShareBtn) container.appendChild(__mqShareBtn);
    mqApplyVisuals(container);
    mqShowCallCount(container);

    // Signed-out visitors can play with no account: pick Yes/No on all three,
    // submit, and see where the crowd stands right away. An account is only
    // offered afterwards, to save a streak and reach the leaderboard.
    if(!session && !allLocked){
      const guestQs = prepared.filter(function(p){ return !p.isLocked; });
      const guestDone = guestQs.every(function(p){ return !!p.myVote; });
      const guestSel = {};
      guestQs.forEach(function(p){ if(p.myVote) guestSel[p.q.id] = p.myVote; });
      const gControls = document.createElement('div');
      gControls.style.cssText = 'max-width:none; margin-top:8px;';

      if(guestDone){
        // Submitted: results are already showing on the cards (myVote was set above).
        const summary = guestQs.map(function(p){ return { category: p.q.category, text: p.q.question_text, choice: p.myVote }; });
        gControls.innerHTML =
          '<div style="padding:16px 18px; background:var(--panel); border:1px solid var(--line); border-radius:14px;">' +
            '<div style="font-family:\'Big Shoulders Display\',sans-serif; font-weight:700; font-size:20px; margin-bottom:4px;">Your calls are in</div>' +
            '<p style="font-size:13.5px; color:var(--ink-soft); line-height:1.45; margin-bottom:12px;">Come back tomorrow for three new ones. Want to keep your streak, climb the leaderboard, and play with buddies and rivals? Make a free account. Free, no purchases, no wagering.</p>' +
            '<button type="button" id="guest-signup-btn" style="width:100%; padding:12px 22px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:14.5px; cursor:pointer;">Save my streak: sign up free</button>' +
            '<button type="button" id="guest-google-btn" style="width:100%; margin-top:8px; padding:11px 16px; border:1.5px solid var(--line); border-radius:10px; background:#FFFFFF; color:#17191D; font-family:inherit; font-weight:600; font-size:14px; cursor:pointer;">Continue with Google</button>' +
            '<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:4px 16px; margin-top:8px;">' +
              '<button type="button" id="guest-login-btn" style="padding:6px 8px; border:none; background:none; color:var(--ink-soft); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer;">Have an account? Log in</button>' +
              '<button type="button" id="guest-share-btn" style="padding:6px 8px; border:none; background:none; color:var(--ink-soft); font-family:inherit; font-size:12.5px; cursor:pointer; text-decoration:underline;">Share my picks</button>' +
              '<button type="button" id="guest-change-btn" style="padding:6px 8px; border:none; background:none; color:var(--ink-soft); font-family:inherit; font-size:12.5px; cursor:pointer; text-decoration:underline;">Change my picks</button>' +
            '</div>' +
            '<p id="guest-msg" class="form-msg" style="margin-top:2px;"></p>' +
          '</div>';
        container.appendChild(gControls);
        const gMsg = document.getElementById('guest-msg');
        function toAuth(mode, method){ mqTrack('guest_signup_click', { method: method }); window.scrollTo({ top: 0, behavior: 'smooth' }); openAuthPanel(mode); }
        document.getElementById('guest-signup-btn').addEventListener('click', function(){ toAuth('signup', 'panel'); });
        document.getElementById('guest-login-btn').addEventListener('click', function(){ toAuth('login', 'login'); });
        document.getElementById('guest-google-btn').addEventListener('click', function(){ mqTrack('guest_signup_click', { method: 'google' }); mqGoogleSignIn(gMsg); });
        document.getElementById('guest-share-btn').addEventListener('click', function(){ mqShareGuestPicks(summary, gMsg); });
        document.getElementById('guest-change-btn').addEventListener('click', function(){ mqTrack('guest_change_picks'); mqSetGuestPicks(effectiveDate, null); loadDailyQuestions(); });
      }else{
        gControls.innerHTML =
          '<div class="pick-dock"><div class="pick-progress" id="pick-progress" style="display:flex;"><span class="pp-dots">' + guestQs.map(function(p){ var v = mqDetectVisual(p.q); return '<i class="pp-slot">' + (v.icon || CATEGORY_ICONS[p.q.category] || '') + '</i>'; }).join('') + '</span><span class="pp-text">0 of ' + guestQs.length + ' picked</span><span class="pp-bonus">All right = +100 bonus</span></div>' +
          '<button type="button" id="guest-submit-btn" disabled style="width:100%; padding:14px 22px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer; opacity:0.4;">Pick all three first</button></div>' +
          '<p style="font-size:12.5px; color:var(--ink-soft); text-align:center; margin-top:0;">No account needed to play.</p>';
        container.appendChild(gControls);
        const gBtn = document.getElementById('guest-submit-btn');
        function updateGuestState(){
          const allPicked = guestQs.every(function(p){ return !!guestSel[p.q.id]; });
          gBtn.disabled = !allPicked;
          gBtn.style.opacity = allPicked ? '1' : '0.4';
          gBtn.textContent = allPicked ? 'Submit your calls' : 'Pick all three first';
          const pp = document.getElementById('pick-progress');
          if(pp){
            const nPicked = guestQs.filter(function(p){ return !!guestSel[p.q.id]; }).length;
            pp.querySelectorAll('.pp-slot').forEach(function(d, i){ const pick = guestSel[guestQs[i].q.id]; d.classList.toggle('yes', pick === 'yes'); d.classList.toggle('no', pick === 'no'); });
            pp.querySelector('.pp-text').textContent = nPicked + ' of ' + guestQs.length + ' picked';
          }
        }
        guestQs.forEach(function(p){
          const card = container.querySelector('[data-question-id="' + p.q.id + '"]');
          if(!card) return;
          card.querySelectorAll('.opt').forEach(function(o){
            o.style.cursor = 'pointer';
            o.addEventListener('click', function(){
              if(!Object.keys(guestSel).length) mqTrack('guest_first_pick');
              guestSel[p.q.id] = o.classList.contains('yes') ? 'yes' : 'no';
              card.querySelector('.opt.yes').classList.toggle('picked', guestSel[p.q.id] === 'yes');
              card.querySelector('.opt.no').classList.toggle('picked', guestSel[p.q.id] === 'no');
              card.classList.remove('awaiting');
              card.classList.toggle('pick-yes', guestSel[p.q.id] === 'yes');
              card.classList.toggle('pick-no', guestSel[p.q.id] === 'no');
              updateGuestState();
            });
          });
        });
        gBtn.addEventListener('click', async function(){
          if(!guestQs.every(function(p){ return !!guestSel[p.q.id]; })) return;
          gBtn.disabled = true; gBtn.textContent = 'Saving\u2026';
          mqTrack('guest_submit_picks');
          mqSetGuestPicks(effectiveDate, guestSel);
          // Count the pick in the crowd. Best effort: if it fails (or the server
          // side isn't set up yet) the guest still sees their results.
          try{
            const dev = mqGuestDeviceId();
            if(dev) await sb.rpc('submit_guest_predictions', { p_device_id: dev, p_answers: guestQs.map(function(p){ return { question_id: p.q.id, choice: guestSel[p.q.id] }; }) });
          }catch(e){}
          // Re-render with the crowd results showing. The re-render swaps the cards
          // for short placeholders, which shrinks the page and drops the visitor at
          // the bottom. Hold the height and put the scroll position back so they
          // stay on the questions.
          var keepY = window.scrollY;
          container.style.minHeight = container.offsetHeight + 'px';
          try{ await loadDailyQuestions(); }finally{ container.style.minHeight = ''; }
          window.scrollTo({ top: keepY, behavior: 'instant' });
        });
        updateGuestState();
      }
    }

    if(slateEl){ mqFillSlate(slateEl, session, prepared.filter(function(p){ return !p.isLocked; }).every(function(p){ return !!p.myVote; })); }
    mqFillPlayers(container, prepared);
    mqFillComments(container, prepared, session);
    mqFillQuestionLikes(container, prepared, session);
    if(!session) mqLoadGuestShareCard();

    // Buddy Bonus achievement: fires the first time any buddy's pick on a
    // visible (voted-on or locked) question matches the player's own pick.
    // Checked here rather than inside buildQuestionCard since that function
    // doesn't have direct access to the session/user id.
    if(session && buddyList.length){
      var gotBuddyMatch = prepared.some(function(p){
        if(!p.myVote) return false;
        return buddyList.some(function(b){ return b.picks && b.picks[p.q.id] === p.myVote; });
      });
      if(gotBuddyMatch) mqAwardAchievement(session.user.id, 'buddy_bonus');
    }
    // Starter badges don't depend on having buddies, so check them on every
    // signed-in load (covers picks saved from a guest session at signup).
    if(session) mqCheckStarterBadges(session.user.id);

    // Change 4 (pre-result picks card): once the day's picks are all
    // locked, prompt sharing them before results are in -- this is
    // deliberately separate from the Change 5 post-result prompt system
    // below, and keeps its own daily key so the two never compete for
    // the "one prompt" slot.
    if(session && allLocked && prepared.every(function(p){ return !!p.myVote; })){
      var shareKey = 'mq_share_prompt_' + session.user.id + '_' + effectiveDate;
      if(!localStorage.getItem(shareKey)){
        try{ localStorage.setItem(shareKey, '1'); }catch(e){}
        var banner = document.createElement('div');
        banner.className = 'trending-strip';
        banner.style.cursor = 'pointer';
        banner.innerHTML = mqIcon('flame') + '<span><strong>Picks are locked.</strong> Tap to share and see who disagrees.</span>';
        banner.addEventListener('click', function(){ mqSharePreResultCard(); });
        container.insertBefore(banner, container.firstChild);
      }
    }

    // One shared Submit for all three, instead of submitting each one alone.
    // The button only turns on once every unlocked question has a pick.
    if(session && !allLocked){
      const selections = {};
      prepared.forEach(function(p){ if(p.myVote) selections[p.q.id] = p.myVote; });
      const editableQuestions = prepared.filter(function(p){ return !p.isLocked; });
      const allAlreadyAnswered = editableQuestions.length > 0 && editableQuestions.every(function(p){ return !!p.myVote; });

      const EDIT_LIMIT = 3;
      let editsUsed = 0;
      const { data: editCountRow } = await sb.from('prediction_edit_counts').select('edit_count').eq('user_id', session.user.id).eq('question_date', today).maybeSingle();
      if(editCountRow){ editsUsed = editCountRow.edit_count; }
      let editsRemaining = Math.max(0, EDIT_LIMIT - editsUsed);

      let editing = false;
      let answering = false;

      const controls = document.createElement('div');
      controls.style.cssText = 'max-width:none; margin-top:8px;';
      controls.innerHTML =
        '<div class="submit-cele" id="submit-cele" aria-hidden="true"><div class="cele-slots" id="cele-slots">' +
          editableQuestions.map(function(){ return '<i class="cele-slot">' + mqIcon('check') + '</i>'; }).join('') +
          '</div><div class="cele-msg" id="cele-msg"></div></div>' +
        '<div class="pick-dock"><div class="pick-progress" id="pick-progress" style="display:' + (allAlreadyAnswered ? 'none' : 'flex') + ';"><span class="pp-dots">' + editableQuestions.map(function(p){ var v = mqDetectVisual(p.q); return '<i class="pp-slot">' + (v.icon || CATEGORY_ICONS[p.q.category] || '') + '</i>'; }).join('') + '</span><span class="pp-text">0 of ' + editableQuestions.length + ' picked</span><span class="pp-bonus">All right = +100 bonus</span></div>' +
        '<button type="button" id="submit-all-btn" disabled style="width:100%; padding:14px 22px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer; opacity:0.4; display:' + (allAlreadyAnswered ? 'none' : 'block') + ';">Pick all three first</button></div>' +
        '<button type="button" id="edit-predictions-btn" style="width:100%; padding:14px 22px; border:1.5px solid var(--line); border-radius:10px; background:none; color:var(--ink); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer; display:' + (allAlreadyAnswered && editsRemaining > 0 ? 'block' : 'none') + ';">Edit predictions</button>' +
        '<p id="edit-limit-msg" style="font-size:12.5px; color:var(--ink-soft); text-align:center; margin-top:4px; display:' + (allAlreadyAnswered && editsRemaining === 0 ? 'block' : 'none') + ';">You\u2019ve used all 3 edits for today\u2019s predictions.</p>' +
        '<p class="form-msg" id="submit-all-msg" style="margin-top:6px;"></p>' +
        '<div id="play-social-prompt" style="display:' + (allAlreadyAnswered ? 'block' : 'none') + '; margin-top:14px; padding:14px 16px; background:var(--panel); border-radius:10px;">' +
          '<div style="font-size:13px; font-weight:600; margin-bottom:8px;">Add some stakes</div>' +
          '<input type="text" id="play-social-username-input" placeholder="their username" style="width:100%; padding:10px 12px; border:1.5px solid var(--line); border-radius:8px; font-family:inherit; font-size:14px; background:var(--paper); color:var(--ink);">' +
          '<div style="display:flex; gap:8px; margin-top:8px;">' +
            '<button type="button" id="play-add-buddy-btn" style="flex:1; padding:9px 12px; border:none; border-radius:8px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:13.5px; cursor:pointer;">Send Buddy request</button>' +
            '<button type="button" id="play-add-rival-btn" style="flex:1; padding:9px 12px; border:1.5px solid var(--line); border-radius:8px; background:none; color:var(--ink); font-family:inherit; font-weight:600; font-size:13.5px; cursor:pointer;">Send Rival request</button>' +
          '</div>' +
          '<p class="form-msg" id="play-social-msg" style="margin-top:8px;"></p>' +
        '</div>';
      container.appendChild(controls);

      const submitBtn = document.getElementById('submit-all-btn');
      const editBtn = document.getElementById('edit-predictions-btn');
      const submitMsg = document.getElementById('submit-all-msg');
      const mqReduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const socialPrompt = document.getElementById('play-social-prompt');
      const socialUsernameInput = document.getElementById('play-social-username-input');
      const socialMsg = document.getElementById('play-social-msg');

      async function sendPlaySocialRequest(kind){
        const uname = socialUsernameInput.value.trim();
        const btn = kind === 'buddy' ? document.getElementById('play-add-buddy-btn') : document.getElementById('play-add-rival-btn');
        socialMsg.className = 'form-msg';
        if(!uname){ socialMsg.classList.add('err'); socialMsg.textContent = 'Enter a username.'; return; }
        if(!session){ socialMsg.classList.add('err'); socialMsg.textContent = 'Sign in above first.'; return; }

        const table = kind === 'buddy' ? 'buddy_requests' : 'rival_requests';
        const relTable = kind === 'buddy' ? 'buddies' : 'rivals';
        const relField = kind === 'buddy' ? 'buddy_id' : 'rival_id';

        btn.disabled = true;

        const { data: targetProfile, error: lookupErr } = await sb.from('profiles').select('id').ilike('username', mqEscapeIlike(uname)).maybeSingle();
        if(lookupErr || !targetProfile){ btn.disabled = false; socialMsg.classList.add('err'); socialMsg.textContent = 'No user found with that username.'; return; }
        if(targetProfile.id === session.user.id){ btn.disabled = false; socialMsg.classList.add('err'); socialMsg.textContent = 'You can\'t ' + kind + ' yourself.'; return; }

        // There's no cap on how many buddies/rivals someone can have -- the
        // only thing worth blocking is asking someone who's already one.
        const { data: already } = await sb.from(relTable).select(relField).eq('user_id', session.user.id).eq(relField, targetProfile.id).maybeSingle();
        if(already){
          btn.disabled = false;
          socialMsg.classList.add('err');
          socialMsg.textContent = 'You\u2019re already a ' + kind + ' with ' + uname + '.';
          return;
        }

        const { error } = await sb.from(table).insert({ from_user_id: session.user.id, to_user_id: targetProfile.id });
        btn.disabled = false;
        if(error){
          socialMsg.classList.add('err');
          socialMsg.textContent = error.code === '23505' ? 'You already have a pending request to them.' : ('Error: ' + error.message);
          return;
        }
        socialMsg.classList.add('ok');
        socialMsg.textContent = (kind === 'buddy' ? 'Buddy' : 'Rival') + ' request sent to ' + uname + '.';
        socialUsernameInput.value = '';
        // Keep the How To Play tab's own Buddy/Rival sections in sync if they've
        // already been rendered once this session.
        if(typeof loadBuddySection === 'function'){ loadBuddySection(); }
        if(typeof loadRivalSection === 'function'){ loadRivalSection(); }
      }

      const playAddBuddyBtn = document.getElementById('play-add-buddy-btn');
      const playAddRivalBtn = document.getElementById('play-add-rival-btn');
      if(playAddBuddyBtn){ playAddBuddyBtn.addEventListener('click', function(){ sendPlaySocialRequest('buddy'); }); }
      if(playAddRivalBtn){ playAddRivalBtn.addEventListener('click', function(){ sendPlaySocialRequest('rival'); }); }

      function updateSubmitState(){
        const allPicked = editableQuestions.every(function(p){ return !!selections[p.q.id]; });
        submitBtn.disabled = !allPicked;
        submitBtn.style.opacity = allPicked ? '1' : '0.4';
        submitBtn.textContent = allPicked ? (editing ? 'Save changes' : 'Submit your calls') : 'Pick all three first';
        const pp = document.getElementById('pick-progress');
        if(pp){
          const nPicked = editableQuestions.filter(function(p){ return !!selections[p.q.id]; }).length;
          pp.querySelectorAll('.pp-slot').forEach(function(d, i){ const pick = selections[editableQuestions[i].q.id]; d.classList.toggle('yes', pick === 'yes'); d.classList.toggle('no', pick === 'no'); });
          pp.querySelector('.pp-text').textContent = nPicked + ' of ' + editableQuestions.length + ' picked';
        }
      }

      function wireCardClicks(){
        editableQuestions.forEach(function(p){
          const card = container.querySelector('[data-question-id="' + p.q.id + '"]');
          if(!card) return;
          card.querySelectorAll('.opt').forEach(function(opt){
            opt.onclick = function(){
              if(p.myVote && !editing) return; // already answered, not currently editing — ignore
              const choice = opt.classList.contains('yes') ? 'yes' : 'no';
              selections[p.q.id] = choice;
              card.querySelector('.opt.yes').classList.toggle('picked', choice === 'yes');
              card.querySelector('.opt.no').classList.toggle('picked', choice === 'no');
              card.classList.remove('awaiting');
              card.classList.toggle('pick-yes', choice === 'yes');
              card.classList.toggle('pick-no', choice === 'no');
              updateSubmitState();
            };
          });
        });
      }
      wireCardClicks();

      submitBtn.addEventListener('click', async function(){
        const allPicked = editableQuestions.every(function(p){ return !!selections[p.q.id]; });
        if(!allPicked || answering) return;
        answering = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        submitMsg.textContent = '';

        // One call does all the validation (lock time + daily edit cap) and all
        // the writes together, server-side — either the whole batch saves, or
        // none of it does. This is the only path that can write to predictions;
        // direct table access is no longer permitted, so this can't be bypassed
        // from outside the app either.
        const payload = editableQuestions.map(function(p){ return { question_id: p.q.id, choice: selections[p.q.id] }; });
        const { data: newEditCount, error: saveError } = await sb.rpc('submit_daily_predictions', { p_answers: payload });

        if(saveError){
          const limitHit = saveError.message && saveError.message.indexOf('used all 3 edits') !== -1;
          const lockHit = saveError.message && saveError.message.indexOf('already locked') !== -1;
          submitMsg.className = 'form-msg err';
          submitMsg.textContent = limitHit
            ? 'You\u2019ve used all 3 edits for today\u2019s predictions.'
            : lockHit
              ? 'That question just locked \u2014 refresh and check before trying again.'
              : 'Something didn\u2019t save \u2014 refresh and check before trying again.';
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? 'Save changes' : 'Submit your calls';
          answering = false;
          if(limitHit){
            editsRemaining = 0;
            editBtn.style.display = 'none';
            document.getElementById('edit-limit-msg').style.display = 'block';
          }
          return;
        }

        editableQuestions.forEach(function(p){ p.myVote = selections[p.q.id]; });

        if(buddyList.length){
          var justGotBuddyMatch = editableQuestions.some(function(p){
            return buddyList.some(function(b){ return b.picks && b.picks[p.q.id] === p.myVote; });
          });
          if(justGotBuddyMatch) mqAwardAchievement(session.user.id, 'buddy_bonus');
        }

        // Starter badges (First Call, etc.) toast right after the picks save,
        // for every player -- not only those with buddies.
        mqCheckStarterBadges(session.user.id);

        setTimeout(function(){ mqMaybeAskPush('after_submit'); }, 2200);

        // ---- Celebration: "N of N locked in" banner + a little pop on each just-submitted card ----
        (function(){
          var cele = document.getElementById('submit-cele');
          if(!cele) return;
          var slots = cele.querySelectorAll('.cele-slot');
          var msgEl = document.getElementById('cele-msg');
          var n = editableQuestions.length;
          cele.style.display = 'block';
          cele.classList.add('on');
          editableQuestions.forEach(function(p){
            var card = container.querySelector('[data-question-id="' + p.q.id + '"]');
            if(card){ card.classList.add('just-submitted'); setTimeout(function(){ card.classList.remove('just-submitted'); }, 900); }
          });
          function settle(){
            var dropBannerEl = document.getElementById('drop-banner');
            var dropActive = dropBannerEl && dropBannerEl.style.display === 'flex';
            msgEl.textContent = n + ' of ' + n + ' locked in.' + (dropActive ? ' Bonus window: correct calls score extra.' : '');
            sb.auth.getSession().then(function(sr){
              var uid = sr && sr.data && sr.data.session && sr.data.session.user.id;
              if(!uid) return;
              sb.from('streaks').select('current_streak').eq('user_id', uid).maybeSingle().then(function(res){
                var streak = res && res.data && res.data.current_streak;
                if(streak > 0) msgEl.textContent += ' Your ' + streak + '-day streak is safe.';
              }, function(){});
            }, function(){});
            setTimeout(function(){ cele.classList.remove('on'); setTimeout(function(){ cele.style.display = 'none'; }, 500); }, 2600);
          }
          if(mqReduceMotion){
            slots.forEach(function(s){ s.classList.add('on'); });
            settle();
          }else{
            slots.forEach(function(s, i){ setTimeout(function(){ s.classList.add('on'); }, 160 + i * 220); });
            setTimeout(settle, 160 + n * 220 + 260);
          }
        })();

        // Reveal real percentages/graphs now that everything's actually answered.
        for(const p of editableQuestions){
          const voteData2 = await getVoteData(p.q.id);
          const card = container.querySelector('[data-question-id="' + p.q.id + '"]');
          if(!card) continue;
          const total2 = voteData2.counts.yes + voteData2.counts.no;
          const yesPct2 = total2 > 0 ? Math.round((voteData2.counts.yes / total2) * 100) : 0;
          const noPct2 = total2 > 0 ? 100 - yesPct2 : 0;
          mqPct(card.querySelector('.opt.yes .opt-price'), yesPct2);
          mqPct(card.querySelector('.opt.no .opt-price'), noPct2);
          const crowdBar2 = card.querySelector('.crowd-bar');
          if(crowdBar2 && total2 > 0){
            crowdBar2.classList.add('on');
            requestAnimationFrame(function(){ requestAnimationFrame(function(){ crowdBar2.querySelector('i').style.width = yesPct2 + '%'; }); });
          }
          const oldTag2 = card.querySelector('.crowd-tags'); if(oldTag2) oldTag2.remove();
          const tagHtml2 = mqCrowdTagsHtml(p.myVote, yesPct2, noPct2, total2, voteData2.trend, true);
          if(tagHtml2 && crowdBar2) crowdBar2.insertAdjacentHTML('afterend', tagHtml2);
          const yesLabel2 = card.querySelector('.opt.yes .opt-label');
          const noLabel2 = card.querySelector('.opt.no .opt-label');
          if(yesLabel2) yesLabel2.style.display = '';
          if(noLabel2) noLabel2.style.display = '';
          mqAnimateFootCount(card.querySelector('.ticket-foot .foot-count'), total2);
          card.querySelectorAll('.buddy-wrap, .buddy-line').forEach(function(n){ n.remove(); });
          const buddyBlock = mqBuddyBlockHtml(buddyList, p.q.id, p.myVote);
          const trendAnchor = card.querySelector('.trend-wrap');
          if(buddyBlock && trendAnchor) trendAnchor.insertAdjacentHTML('beforebegin', buddyBlock);
          const trendWrap2 = card.querySelector('.trend-wrap');
          if(trendWrap2){ trendWrap2.innerHTML = buildTrendSVG(voteData2.trend); animateTrendLine(trendWrap2); }
          card.querySelectorAll('.opt').forEach(function(o){ o.style.cursor = 'default'; });
          if(!mqReduceMotion) card.classList.add('reveal-pop');
        }

        editing = false;
        answering = false;
        submitBtn.style.display = 'none';
        const ppDone = document.getElementById('pick-progress'); if(ppDone) ppDone.style.display = 'none';
        socialPrompt.style.display = 'block';
        submitMsg.className = 'form-msg ok';
        submitMsg.textContent = 'Saved!';

        // The RPC returns the authoritative post-save edit count — trust that
        // over any local bookkeeping.
        editsUsed = typeof newEditCount === 'number' ? newEditCount : editsUsed;
        editsRemaining = Math.max(0, EDIT_LIMIT - editsUsed);
        if(editsRemaining > 0){
          editBtn.textContent = 'Edit predictions';
          editBtn.style.display = 'block';
          document.getElementById('edit-limit-msg').style.display = 'none';
        }else{
          editBtn.style.display = 'none';
          document.getElementById('edit-limit-msg').style.display = 'block';
        }
      });

      editBtn.addEventListener('click', function(){
        if(editsRemaining <= 0) return; // shouldn't be reachable — button is hidden at 0 — but don't allow it either way
        editing = true;
        editBtn.style.display = 'none';
        submitBtn.style.display = 'block';
        const ppEdit = document.getElementById('pick-progress'); if(ppEdit) ppEdit.style.display = 'flex';
        socialPrompt.style.display = 'none';
        editableQuestions.forEach(function(p){
          const card = container.querySelector('[data-question-id="' + p.q.id + '"]');
          if(card) card.querySelectorAll('.opt').forEach(function(o){ o.style.cursor = 'pointer'; });
        });
        wireCardClicks();
        updateSubmitState();
        submitMsg.textContent = '';
      });

      updateSubmitState();
    }

    if(allLocked){
      if(!session){
        const lockedCta = document.createElement('div');
        lockedCta.style.cssText = 'max-width:480px; margin-top:8px;';
        lockedCta.innerHTML = '<p class="ex-sub" style="margin-bottom:10px;">Today\'s calls are locked, but tomorrow\'s three are coming.</p>' +
          '<button type="button" id="locked-state-signup-btn" style="padding:12px 24px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer;">Sign up so you\'re ready</button>';
        container.appendChild(lockedCta);
        document.getElementById('locked-state-signup-btn').addEventListener('click', function(){ openAuthPanel('signup'); });
      }
    }

    appendSuggestionBox(container, session); // everyone sees it, in every state; signed-out taps go to sign-up
  }

  loadDailyQuestions();
  checkDailyDrop();

  // ---- Leaderboard rows: medal badges for the top 3, avatar circles, streak flames, and a "You" highlight ----
  async function mqMyId(){
    try{ var r = await sb.auth.getSession(); return (r && r.data && r.data.session && r.data.session.user.id) || null; }
    catch(e){ return null; }
  }
  // ---- Weekly avatar frame: earned by landing a Perfect Day at least once this week ----
  // (mon-sun, same boundary getWeekStart() already uses elsewhere). Fetched once per
  // page load and cached, since it's read from several places (leaderboard, nav, profile).
  var __mqFrameSetPromise = null;
  function mqFrameSet(){
    if(!__mqFrameSetPromise){
      __mqFrameSetPromise = (async function(){
        try{
          var wk = getWeekStart();
          var res = await sb.from('weekly_frame_earned').select('user_id').eq('week_start', wk);
          return new Set((res.data || []).map(function(r){ return r.user_id; }));
        }catch(e){ return new Set(); }
      })();
    }
    return __mqFrameSetPromise;
  }
  // ---- Champion frame: everyone in the reigning Fall Chapter Cup chapter, or
  // the reigning national org, gets a distinct crown-colored ring, permanent
  // for as long as their chapter/org holds the title. Set by Max via admin_set_champion.
  var __mqChampionSetPromise = null;
  function mqChampionSet(){
    if(!__mqChampionSetPromise){
      __mqChampionSetPromise = (async function(){
        try{
          var res = await sb.rpc('get_champion_member_ids');
          return new Set((res.data || []).map(function(r){ return r.user_id; }));
        }catch(e){ return new Set(); }
      })();
    }
    return __mqChampionSetPromise;
  }

  // Applies/removes the gold frame ring on one avatar element for one user id.
  async function mqApplyFrame(el, userId){
    if(!el || !userId) return;
    try{
      var set = await mqFrameSet();
      el.classList.toggle('has-frame', set.has(userId));
      var champSet = await mqChampionSet();
      el.classList.toggle('has-champion-frame', champSet.has(userId));
    }catch(e){ /* decorative only */ }
  }

  // ---- Rank-change arrows: compares today's live Overall order to the most
  // recent past snapshot resolve_day saved. Fetched once, cached, Overall board only.
  var __mqRankMapPromise = null;
  function mqRankMap(){
    if(!__mqRankMapPromise){
      __mqRankMapPromise = (async function(){
        try{
          var today = getETDateInfo().dateStr;
          var last = await sb.from('rank_snapshots').select('snapshot_date').lt('snapshot_date', today).order('snapshot_date', { ascending: false }).limit(1).maybeSingle();
          if(!last.data) return new Map();
          var rows = await sb.from('rank_snapshots').select('user_id, rank').eq('snapshot_date', last.data.snapshot_date);
          var map = new Map();
          (rows.data || []).forEach(function(r){ map.set(r.user_id, r.rank); });
          return map;
        }catch(e){ return new Map(); }
      })();
    }
    return __mqRankMapPromise;
  }
  // Streak "fire intensity" — the flame badge grows and shifts color as a
  // streak climbs tiers, instead of staying one flat icon regardless of
  // whether it's day 3 or day 90.
  function mqStreakFlameTier(streak){
    if(streak >= 100) return 'legendary';
    if(streak >= 30) return 'roaring';
    if(streak >= 14) return 'strong';
    if(streak >= 7) return 'building';
    return 'ember';
  }
  function mqRankArrowHtml(oldRank, newRank){
    if(oldRank == null) return '';
    var d = oldRank - newRank; // positive = moved up
    if(d === 0) return '<span class="lb-rankchg same">' + mqIcon('flag') + '</span>';
    return '<span class="lb-rankchg ' + (d > 0 ? 'up' : 'down') + '">' + mqIcon(d > 0 ? 'arrowUp' : 'arrowDown') + Math.abs(d) + '</span>';
  }

  async function mqBoardRows(list, myId, showRankChange, remindIds){
    var frameSet = await mqFrameSet();
    var championSet = await mqChampionSet();
    var rankMap = showRankChange ? await mqRankMap() : null;
    return list.map(function(r, i){
      var rank = i + 1;
      var color = /^#[0-9A-Fa-f]{6}$/.test(r.avatar_color || '') ? r.avatar_color : '#2C2F37';
      var mine = !!(myId && r.user_id === myId);
      var face = mqAvatarInner(r.avatar_emoji, r.username);
      var framed = !!(r.user_id && frameSet.has(r.user_id));
      var champ = !!(r.user_id && championSet.has(r.user_id));
      var streak = (r.streak || 0) >= 3 ? '<span class="lb-streak fl-' + mqStreakFlameTier(r.streak) + '">' + mqIcon('flame') + r.streak + '</span>' : '';
      var rankChg = (rankMap && r.user_id) ? mqRankArrowHtml(rankMap.has(r.user_id) ? rankMap.get(r.user_id) : null, rank) : '';
      return '<div class="brow lb' + (rank <= 3 ? ' medal m' + rank : '') + (mine ? ' mine' : '') + '">' +
        '<span class="lb-rank">' + rank + '</span>' +
        '<i class="lb-av' + (framed ? ' has-frame' : '') + (champ ? ' has-champion-frame' : '') + '" style="background:' + color + ';" title="' + (champ ? 'Marqit Champion' : '') + '">' + face + (champ ? '<span class="champ-crown" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg></span>' : '') + '</i>' +
        '<span class="lb-name"><span class="lb-name-text">' + escapeHtml(r.username || 'player') + '</span>' + (mine ? '<em class="lb-you">You</em>' : '') + streak + rankChg + '</span>' +
        '<span class="lb-pts"><b>' + Number(r.points || 0).toLocaleString() + '</b><small>' + (r.unit || 'pts') + '</small></span>' +
        ((!mine && remindIds && r.user_id && remindIds.has(r.user_id)) ? '<button type="button" class="remind-btn lb-remind-btn" data-user-id="' + escapeHtml(r.user_id) + '" data-username="' + escapeHtml(r.username || 'your friend') + '">Remind</button>' : '') +
      '</div>';
    }).join('');
  }

  async function loadBigBoard(){
    const el = document.getElementById('big-board-rows');
    if(!el) return;
    // profiles!inner (not the default left join) is required here -- filtering on
    // a joined column via .eq('profiles.x', ...) only works against an inner join.
    // People who've opted out via hide_from_leaderboard are excluded at the query
    // level, so they never show up in the ranking at all (not just hidden client-side).
    const { data, error } = await sb
      .from('streaks')
      .select('user_id, total_points, current_streak, profiles!inner(username, avatar_emoji, avatar_color, hide_from_leaderboard)')
      .eq('profiles.hide_from_leaderboard', false)
      .order('total_points', { ascending: false })
      .limit(10);

    if(error || !data || data.length === 0){
      el.innerHTML = '<div class="brow"><span>No scores yet \u2014 be the first to play.</span></div>';
      return;
    }

    const myId = await mqMyId();
    el.innerHTML = await mqBoardRows(data.map(function(row){
      const p = row.profiles || {};
      return { user_id: row.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: row.total_points, streak: row.current_streak };
    }), myId, true);
  }

  loadBigBoard();

  // Friends-only view of the Overall board: just you + your buddies +
  // your rivals, same ranked format, no new tables needed.
  async function loadFriendsBoard(){
    const el = document.getElementById('big-board-rows');
    if(!el) return;
    el.innerHTML = '<div class="skel-rows"><i class="sk"></i><i class="sk"></i><i class="sk"></i></div>';
    const myId = await mqMyId();
    if(!myId){
      el.innerHTML = '<div class="brow"><span>Sign in and add a buddy or rival to see this.</span></div>';
      return;
    }
    const [buddyRows, rivalRows] = await Promise.all([
      sb.from('buddies').select('buddy_id').eq('user_id', myId),
      sb.from('rivals').select('rival_id').eq('user_id', myId)
    ]);
    const ids = [myId];
    (buddyRows.data || []).forEach(function(r){ if(ids.indexOf(r.buddy_id) < 0) ids.push(r.buddy_id); });
    (rivalRows.data || []).forEach(function(r){ if(ids.indexOf(r.rival_id) < 0) ids.push(r.rival_id); });
    if(ids.length === 1){
      el.innerHTML = '<div class="brow"><span>Add a buddy or rival to see a Friends board.</span></div>';
      return;
    }
    const { data } = await sb.from('streaks').select('user_id, total_points, current_streak, profiles(username, avatar_emoji, avatar_color)').in('user_id', ids);
    const ranked = (data || []).slice().sort(function(a, b){ return (b.total_points || 0) - (a.total_points || 0); });
    el.innerHTML = await mqBoardRows(ranked.map(function(row){
      const p = row.profiles || {};
      return { user_id: row.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: row.total_points, streak: row.current_streak };
    }), myId, false, new Set(ids));
  }
  // "Streaks" view of the Big Board: the longest ACTIVE streaks right now, in order.
  // A streak only counts as active if the player played today or yesterday (Eastern),
  // so people who stopped playing drop off. Same opt-out rule as Worldwide
  // (hide_from_leaderboard excluded); banned players are hidden by row-level security.
  // Ties go to the longer all-time best, then to total points.
  async function loadStreakBoard(){
    const el = document.getElementById('big-board-rows');
    if(!el) return;
    el.innerHTML = '<div class="skel-rows"><i class="sk"></i><i class="sk"></i><i class="sk"></i></div>';
    const yesterday = mqSchedAddDays(getETDateInfo().dateStr, -1);
    const { data, error } = await sb
      .from('streaks')
      .select('user_id, total_points, current_streak, longest_streak, last_played_date, profiles!inner(username, avatar_emoji, avatar_color, hide_from_leaderboard)')
      .eq('profiles.hide_from_leaderboard', false)
      .gte('last_played_date', yesterday)
      .gt('current_streak', 0)
      .order('current_streak', { ascending: false })
      .order('longest_streak', { ascending: false })
      .order('total_points', { ascending: false })
      .limit(10);

    // The player may have switched tabs while this was loading; don't overwrite that view.
    const activeTab = document.querySelector('#lb-scope-tabs .scope-tab.active');
    if(!activeTab || activeTab.getAttribute('data-scope') !== 'streak') return;

    if(error || !data || data.length === 0){
      el.innerHTML = '<div class="brow"><span>No active streaks yet. Play today to start one.</span></div>';
      return;
    }

    const myId = await mqMyId();
    el.innerHTML = await mqBoardRows(data.map(function(row){
      const p = row.profiles || {};
      const days = row.current_streak || 0;
      return { user_id: row.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: days, unit: days === 1 ? 'day' : 'days' };
    }), myId, false);
  }

  (function(){
    // One delegated listener for the "Remind" buttons on the Friends board.
    var boardEl = document.getElementById('big-board-rows');
    if(boardEl) boardEl.addEventListener('click', function(e){
      var b = e.target.closest('.remind-btn');
      if(b) mqRemindFriend(b, null);
    });
    var tabs = document.getElementById('lb-scope-tabs');
    if(!tabs) return;
    tabs.addEventListener('click', function(e){
      var btn = e.target.closest('.scope-tab');
      if(!btn) return;
      tabs.querySelectorAll('.scope-tab').forEach(function(b){ b.classList.toggle('active', b === btn); });
      var scope = btn.getAttribute('data-scope');
      // Worldwide, Friends and Longest streak share one list; State has its own, filled by loadStateBoard.
      var stateEl = document.getElementById('board-state');
      if(stateEl) stateEl.style.display = (scope === 'state') ? '' : 'none';
      if(boardEl) boardEl.style.display = (scope === 'state') ? 'none' : '';
      if(scope === 'friends') loadFriendsBoard();
      else if(scope === 'worldwide') loadBigBoard();
      else if(scope === 'streak') loadStreakBoard();
    });
  })();

  async function loadChallengeBoard(){
    const el = document.getElementById('challenge-board-rows');
    if(!el) return;
    const { data, error } = await sb
      .from('challenge_points')
      .select('user_id, total_points, profiles(username, avatar_emoji, avatar_color)')
      .order('total_points', { ascending: false })
      .limit(10);

    if(error || !data || data.length === 0){
      el.innerHTML = '<div class="brow"><span>No points awarded yet.</span></div>';
      return;
    }

    const myId = await mqMyId();
    el.innerHTML = await mqBoardRows(data.map(function(row){
      const p = row.profiles || {};
      return { user_id: row.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: row.total_points };
    }), myId);
  }

  loadChallengeBoard();

  var challengeCountdownIntervals = [];

  function clearChallengeCountdowns(){
    challengeCountdownIntervals.forEach(function(id){ clearInterval(id); });
    challengeCountdownIntervals = [];
  }

  const CHALLENGE_MONTH_LABELS = {
    october: { text: 'OCTOBER &middot; MULTIPLE CHOICE', color: '#4C6EF5' },
    november: { text: 'NOVEMBER &middot; CLOSEST GUESS WINS', color: '#F5C336' },
    december: { text: 'DECEMBER &middot; OPEN-ENDED', color: 'var(--ink-soft)' }
  };

  // The shared formatCountdown() above is HH:MM:SS only -- fine for daily
  // questions, which always lock same-day, but Challenge questions can stay
  // open for days or weeks, where that would render as an absurd triple-digit
  // hour count (e.g. "168:00:00" for a week out). Mirrors the day-aware format
  // the hero kickoff countdown already uses on this same tab.
  function formatChallengeCountdown(ms){
    if(ms <= 0) return '0s';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if(d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if(h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
  }

  function buildChallengeCard(q, session, myAnswer){
    const div = document.createElement('div');
    div.className = 'ticket';
    div.style.cssText = 'max-width:480px; margin-bottom:16px;';
    div.setAttribute('data-challenge-question-id', q.id);

    const isLocked = new Date() >= new Date(q.lock_time);
    const isResolved = q.status === 'resolved';
    const badge = (q.question_type === 'multiple_choice')
      ? { text: 'WEEKLY CALL &middot; MULTIPLE CHOICE', color: '#4C6EF5' }
      : (CHALLENGE_MONTH_LABELS[q.month] || { text: q.month, color: 'var(--ink-soft)' });
    const alreadySubmitted = !!myAnswer;
    const inputType = q.question_type === 'numeric' ? 'number' : 'text';
    const placeholder = q.question_type === 'numeric' ? 'Your guess' : 'Your answer';
    const prefill = myAnswer ? (q.question_type === 'numeric' ? myAnswer.guess_numeric : (myAnswer.answer_text || '')) : '';

    let bodyHtml;
    if(isResolved){
      // NEW: resolved questions now render their outcome instead of just
      // vanishing from the widget once status flips to 'resolved'.
      const correctAnswerText = q.question_type === 'numeric'
        ? String(q.correct_value)
        : ((q.accepted_answers && q.accepted_answers.length) ? q.accepted_answers.join(' / ') : '—');
      bodyHtml = '<div style="margin-top:16px; padding:12px 14px; border-radius:10px; background:var(--panel); font-size:14px;">Correct answer: <strong>' + escapeHtml(correctAnswerText) + '</strong></div>';
      if(alreadySubmitted){
        const gotPoints = (myAnswer.points_awarded || 0) > 0;
        bodyHtml += '<p style="font-size:12.5px; margin-top:8px; color:' + (gotPoints ? 'var(--yes)' : 'var(--ink-soft)') + ';">Your pick: <strong>' + escapeHtml(String(prefill)) + '</strong> \u2014 ' + (gotPoints ? ('+' + myAnswer.points_awarded + ' pts') : 'not a match this time') + '</p>';
      }else if(session){
        bodyHtml += '<p style="font-size:12.5px; color:var(--ink-soft); margin-top:8px;">You didn\u2019t submit a pick before this one locked.</p>';
      }
    }else if(!session){
      bodyHtml =
        '<p style="font-size:13px; color:var(--ink-soft); margin-top:14px;">Sign in to submit your Challenge pick.</p>' +
        '<button type="button" class="challenge-signin-btn" style="margin-top:10px; padding:11px 20px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:14px; cursor:pointer;">Sign in</button>';
    }else if(isLocked){
      bodyHtml = alreadySubmitted
        ? '<div style="margin-top:16px; padding:12px 14px; border-radius:10px; background:var(--panel); font-size:14px;">Your pick: <strong>' + escapeHtml(String(prefill)) + '</strong></div>' +
          '<p style="font-size:12.5px; color:var(--ink-soft); margin-top:8px;">Locked &mdash; results post once this is resolved.</p>'
        : '<p style="font-size:13px; color:var(--ink-soft); margin-top:14px;">This one locked before you got a pick in.</p>';
    }else{
      if(q.question_type === 'multiple_choice'){
        const optionsHtml = (q.options || []).map(function(opt){
          const isSelected = !!prefill && String(prefill) === opt;
          return '<button type="button" class="challenge-option-btn" data-option="' + escapeHtml(opt) + '" style="padding:12px 14px; border:1.5px solid ' + (isSelected ? 'var(--ink)' : 'var(--line)') + '; border-radius:10px; background:' + (isSelected ? 'var(--ink)' : 'var(--panel)') + '; color:' + (isSelected ? 'var(--paper)' : 'var(--ink)') + '; font-family:\'Inter\',sans-serif; font-size:14px; text-align:left; cursor:pointer;">' + escapeHtml(opt) + '</button>';
        }).join('');
        bodyHtml =
          '<div class="challenge-options-row" style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">' + optionsHtml + '</div>' +
          '<input type="hidden" class="challenge-answer-input" value="' + escapeHtml(String(prefill)) + '">' +
          '<button type="button" class="challenge-submit-btn" ' + (prefill ? '' : 'disabled') + ' style="margin-top:10px; padding:11px 20px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:14px; cursor:pointer; opacity:' + (prefill ? '1' : '0.4') + ';">' + (alreadySubmitted ? 'Update pick' : 'Submit pick') + '</button>' +
          '<p class="form-msg challenge-msg" style="margin-top:8px;"></p>';
      }else{
        bodyHtml =
          '<div style="margin-top:16px;">' +
            '<input type="' + inputType + '" class="challenge-answer-input" placeholder="' + placeholder + '" value="' + escapeHtml(String(prefill)) + '" style="width:100%; padding:12px 14px; border:1.5px solid var(--line); border-radius:10px; background:var(--panel); color:var(--ink); font-family:\'Inter\',sans-serif; font-size:14px;">' +
          '</div>' +
          '<button type="button" class="challenge-submit-btn" style="margin-top:10px; padding:11px 20px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:14px; cursor:pointer;">' + (alreadySubmitted ? 'Update pick' : 'Submit pick') + '</button>' +
          '<p class="form-msg challenge-msg" style="margin-top:8px;"></p>';
      }
    }

    div.innerHTML =
      '<div style="display:inline-block; background:var(--panel); border:1px solid var(--line); border-radius:100px; padding:4px 12px; font-size:11px; font-weight:700; letter-spacing:0.04em; color:' + badge.color + ';">' + badge.text + (isResolved ? ' &middot; RESOLVED' : '') + '</div>' +
      '<p class="ticket-q" style="max-width:none; margin-top:14px; font-weight:600;"></p>' +
      '<p class="ticket-meta challenge-lock-meta" style="margin-top:6px;"></p>' +
      bodyHtml;
    div.querySelector('.ticket-q').textContent = q.question_text;

    if(isResolved){
      div.querySelector('.challenge-lock-meta').textContent = 'Resolved';
    }else if(!isLocked){
      const lockMetaEl = div.querySelector('.challenge-lock-meta');
      function tick(){
        const remaining = new Date(q.lock_time).getTime() - Date.now();
        if(remaining <= 0){
          lockMetaEl.textContent = 'Locking now\u2026';
          loadChallengeQuestion(); // re-render into the locked state
          return;
        }
        lockMetaEl.textContent = 'Locks in ' + formatChallengeCountdown(remaining);
      }
      tick();
      challengeCountdownIntervals.push(setInterval(tick, 1000));
    }else{
      div.querySelector('.challenge-lock-meta').textContent = 'Locked';
    }

    return div;
  }

  async function loadChallengeQuestion(){
    clearChallengeCountdowns();
    const container = document.getElementById('challenge-live-container');
    if(!container) return;

    // FIXED: previously only fetched status='live', so a question vanished
    // from the widget the instant it resolved. Now also pulls recently
    // resolved ones (last 30 days) so people can see the outcome instead of
    // it just disappearing.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [{ data: liveQuestions, error: liveErr }, { data: resolvedQuestions }] = await Promise.all([
      sb.from('challenge_questions').select('*').eq('status', 'live').order('lock_time', { ascending: true }),
      sb.from('challenge_questions').select('*').eq('status', 'resolved').gte('resolved_at', thirtyDaysAgo.toISOString()).order('resolved_at', { ascending: false })
    ]);

    const questions = (liveQuestions || []).concat(resolvedQuestions || []);
    if(liveErr || questions.length === 0){
      container.innerHTML = ''; // nothing live or recently resolved — keep the hero clean
      return;
    }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;

    container.innerHTML = '';
    for(let i = 0; i < questions.length; i++){
      const q = questions[i];
      let myAnswer = null;
      if(session){
        const { data: existing } = await sb
          .from('challenge_answers')
          .select('guess_numeric, answer_text, points_awarded')
          .eq('question_id', q.id)
          .eq('user_id', session.user.id)
          .maybeSingle();
        myAnswer = existing || null;
      }
      container.appendChild(buildChallengeCard(q, session, myAnswer));
    }

    container.querySelectorAll('.challenge-signin-btn').forEach(function(btn){
      btn.addEventListener('click', function(){ openAuthPanel('signup', 'challenge'); });
    });

    container.querySelectorAll('.challenge-option-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        const card = btn.closest('[data-challenge-question-id]');
        const hiddenInput = card.querySelector('.challenge-answer-input');
        const submitBtn = card.querySelector('.challenge-submit-btn');
        card.querySelectorAll('.challenge-option-btn').forEach(function(b){
          b.style.background = 'var(--panel)';
          b.style.color = 'var(--ink)';
          b.style.borderColor = 'var(--line)';
        });
        btn.style.background = 'var(--ink)';
        btn.style.color = 'var(--paper)';
        btn.style.borderColor = 'var(--ink)';
        hiddenInput.value = btn.getAttribute('data-option');
        if(submitBtn){ submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
      });
    });

    container.querySelectorAll('.challenge-submit-btn').forEach(function(btn){
      btn.addEventListener('click', async function(){
        const card = btn.closest('[data-challenge-question-id]');
        const questionId = card.getAttribute('data-challenge-question-id');
        const q = questions.find(function(x){ return x.id === questionId; });
        const input = card.querySelector('.challenge-answer-input');
        const msg = card.querySelector('.challenge-msg');
        const raw = input.value.trim();

        if(!raw){
          msg.textContent = q.question_type === 'multiple_choice' ? 'Pick an option first.' : 'Enter your pick first.';
          msg.className = 'form-msg challenge-msg err';
          return;
        }

        const payload = { p_question_id: questionId };
        if(q.question_type === 'numeric'){
          const num = Number(raw);
          if(isNaN(num)){ msg.textContent = 'Enter a real number.'; msg.className = 'form-msg challenge-msg err'; return; }
          payload.p_guess_numeric = num;
        }else{
          payload.p_answer_text = raw;
        }

        btn.disabled = true;
        msg.textContent = '';
        const { error: submitErr } = await sb.rpc('submit_challenge_answer', payload);
        btn.disabled = false;

        if(submitErr){
          msg.textContent = submitErr.message || 'Something went wrong — try again.';
          msg.className = 'form-msg challenge-msg err';
          return;
        }
        msg.textContent = 'Locked in. You can update it until this closes.';
        msg.className = 'form-msg challenge-msg ok';
        btn.textContent = 'Update pick';
      });
    });
  }

  loadChallengeQuestion();

  async function loadCategoryBoard(category, elId){
    const el = document.getElementById(elId);
    if(!el) return;

    // Totals are added up in the database (category_top_scorers) -- the old
    // approach downloaded every resolved pick and silently stopped at 1,000 rows.
    const { data: topRows, error } = await sb.rpc('category_top_scorers', { p_category: category, p_limit: 30 });

    if(error){
      el.innerHTML = '<div class="brow"><span>Leaderboard unavailable right now.</span></div>';
      return;
    }
    if(!topRows || topRows.length === 0){
      el.innerHTML = '<div class="brow"><span>No scores yet.</span></div>';
      return;
    }

    const ranked = topRows.map(function(r){ return { user_id: r.user_id, points: Number(r.points) }; });

    if(ranked.length === 0){
      el.innerHTML = '<div class="brow"><span>No correct calls yet.</span></div>';
      return;
    }

    // Pull a generous buffer of candidates (not just the top 5) so that
    // filtering out people who've opted out of leaderboards via
    // hide_from_leaderboard doesn't leave fewer than 5 rows -- someone
    // ranked #3 who's hidden should just be skipped, not leave a gap.
    const candidateIds = ranked.slice(0, 30).map(function(r){ return r.user_id; });
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, username, avatar_emoji, avatar_color')
      .eq('hide_from_leaderboard', false)
      .in('id', candidateIds);

    const profMap = {};
    (profiles || []).forEach(function(p){ profMap[p.id] = p; });
    const visibleRanked = ranked.filter(function(r){ return !!profMap[r.user_id]; }).slice(0, 5);

    if(visibleRanked.length === 0){
      el.innerHTML = '<div class="brow"><span>No correct calls yet.</span></div>';
      return;
    }

    const rankedIds = visibleRanked.map(function(r){ return r.user_id; });
    const { data: streakRows } = await sb.from('streaks').select('user_id, current_streak').in('user_id', rankedIds);
    const streakMap = {};
    (streakRows || []).forEach(function(x){ streakMap[x.user_id] = x.current_streak; });

    const myId = await mqMyId();
    el.innerHTML = await mqBoardRows(visibleRanked.map(function(r){
      const p = profMap[r.user_id] || {};
      return { user_id: r.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: r.points, streak: streakMap[r.user_id] };
    }), myId);
  }

  loadCategoryBoard('sports', 'board-sports');
  loadCategoryBoard('pop_culture', 'board-pop_culture');
  loadCategoryBoard('news', 'board-news');

  function getWeekStart(){
    const et = getETDateInfo();
    const parts = et.dateStr.split('-').map(Number);
    let monday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    // Some older/odd browsers return unexpected date text, which made this an
    // invalid date and crashed toISOString(). Fall back to today's UTC date.
    if(isNaN(monday.getTime())){
      const now = new Date();
      monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
    // Work out the weekday from the date itself (0 = Sunday) instead of trusting
    // the browser's weekday text, so it can't come back undefined.
    const day = monday.getUTCDay();
    const diffToMonday = (day === 0) ? 6 : day - 1;
    monday.setUTCDate(monday.getUTCDate() - diffToMonday);
    return monday.toISOString().slice(0, 10);
  }


  // ---- Your record: 5-week calendar (like a Wordle share grid) + hit-rate rings per category ----
  function mqRing(pct, rgb, label, sub){
    var C = 2 * Math.PI * 26, has = pct !== null;
    var dash = has ? (C * pct / 100) : 0;
    return '<div class="rec-ring">' +
      '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/>' +
      '<circle class="rec-arc" cx="32" cy="32" r="26" fill="none" stroke="rgb(' + rgb + ')" stroke-width="6" stroke-linecap="round" transform="rotate(-90 32 32)" stroke-dasharray="0 ' + C.toFixed(1) + '" data-dash="' + dash.toFixed(1) + '" data-c="' + C.toFixed(1) + '"/>' +
      '<text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)" style="font-family:\'Big Shoulders Display\',Barlow,sans-serif">' + (has ? pct + '%' : 'New') + '</text></svg>' +
      '<b>' + escapeHtml(label) + '</b><span>' + escapeHtml(sub) + '</span></div>';
  }
  // Record calendar: one month at a time (switch months with the arrows). Hover or click any day to see that day's calls, right and wrong.
  var MQ_REC = { month: '', rows: null, byDay: {}, picks: {}, qcache: {}, session: null, bound: false };
  var MQ_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function mqRecDayLabel(d){ var t = new Date(d + 'T12:00:00Z'); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.getUTCDay()] + ', ' + MQ_MONTHS[t.getUTCMonth()].slice(0, 3) + ' ' + t.getUTCDate(); }
  function mqRecRenderMonth(){
    var cal = document.getElementById('rec-cal'), foot = document.getElementById('rec-foot'); if(!cal) return;
    var today = getETDateInfo().dateStr, ym = MQ_REC.month, y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
    var first = new Date(Date.UTC(y, m - 1, 1, 12)), lead = (first.getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
    var curYm = today.slice(0, 7), minYm = '2026-09';
    var lab = document.getElementById('rec-month-label'); if(lab) lab.textContent = MQ_MONTHS[m - 1] + ' ' + y;
    var pv = document.getElementById('rec-prev'), nx = document.getElementById('rec-next');
    if(pv) pv.disabled = ym <= minYm; if(nx) nx.disabled = ym >= curYm;
    var cells = '', played = 0, byDay = MQ_REC.byDay, session = MQ_REC.session;
    for(var b = 0; b < lead; b++) cells += '<i class="rc blank" aria-hidden="true"></i>';
    for(var i = 1; i <= dim; i++){
      var d = ym + '-' + String(i).padStart(2, '0'), v = byDay[d], cls = 'rc', tip = mqRecDayLabel(d);
      if(d > today){ cls += ' future'; }
      else if(!v){ cls += ' none'; tip += ': missed'; }
      else{
        played++;
        if(v.resolved === 0 && v.voided > 0 && v.voided === v.total){ cls += ' pend'; tip += ': voided'; }
        else if(v.resolved === 0){ cls += ' pend'; tip += ': waiting on results'; }
        else if(v.total >= 3 && v.correct + v.voided === v.total){ cls += ' perfect'; tip += ': Perfect Day'; }
        else if(v.correct === 0){ cls += ' l0'; tip += ': 0 of ' + v.resolved + ' right'; }
        else if(v.correct === 1){ cls += ' l1'; tip += ': 1 of ' + v.resolved + ' right'; }
        else{ cls += ' l2'; tip += ': ' + v.correct + ' of ' + v.resolved + ' right'; }
      }
      if(d === today) cls += ' today';
      if(d === MQ_REC.sel) cls += ' sel';
      cells += '<button type="button" class="' + cls + '" style="--i:' + (lead + i) + ';" data-d="' + d + '" title="' + escapeHtml(tip) + '"' + (d > today ? ' disabled' : '') + ' aria-label="' + escapeHtml(tip) + '"></button>';
    }
    cal.innerHTML = cells;
    if(foot && session){
      foot.textContent = played ? played + (played === 1 ? ' day' : ' days') + ' played in ' + MQ_MONTHS[m - 1] + '.' : (ym === curYm ? 'Your record fills in as your calls get scored.' : 'No calls in ' + MQ_MONTHS[m - 1] + '.');
    }
  }
  function mqRecHide(){
    var panel = document.getElementById('rec-day'); if(panel) panel.hidden = true;
    MQ_REC.sel = '';
    document.querySelectorAll('#rec-cal .rc.sel').forEach(function(c){ c.classList.remove('sel'); });
  }
  // The day card floats next to the tapped day instead of pushing the page down.
  function mqRecPlace(){
    var panel = document.getElementById('rec-day'), cell = MQ_REC.sel && document.querySelector('#rec-cal .rc[data-d="' + MQ_REC.sel + '"]');
    if(!panel || panel.hidden || !cell) return;
    var r = cell.getBoundingClientRect(), pw = Math.min(310, window.innerWidth - 24);
    panel.style.width = pw + 'px';
    panel.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)) + 'px';
    var ph = panel.offsetHeight, below = r.bottom + 8;
    panel.style.top = (below + ph > window.innerHeight - 8 ? Math.max(8, r.top - ph - 8) : below) + 'px';
  }
  async function mqRecShowDay(d){
    var panel = document.getElementById('rec-day'); if(!panel || !d) return;
    if(MQ_REC.sel === d && !panel.hidden){ mqRecHide(); return; }
    MQ_REC.sel = d;
    document.querySelectorAll('#rec-cal .rc').forEach(function(c){ c.classList.toggle('sel', c.getAttribute('data-d') === d); });
    panel.hidden = false; mqRecPlace();
    var qs = MQ_REC.qcache[d];
    if(!qs){
      panel.innerHTML = '<div class="rd-h">' + mqRecDayLabel(d) + '</div><p class="rd-empty">Loading…</p>'; mqRecPlace();
      var r = await sb.from('daily_questions').select('id, question_text, category, correct_answer, resolved, voided').eq('question_date', d).order('slot', { ascending: true }).order('lock_time', { ascending: true });
      qs = MQ_REC.qcache[d] = r.data || [];
    }
    if(MQ_REC.sel !== d) return;
    var picks = MQ_REC.picks[d] || {}, right = 0, scored = 0;
    var rows = qs.map(function(q){
      var ch = picks[q.id], st, ic, line;
      if(q.voided){ st = 'void'; ic = '–'; line = 'Voided, doesn’t count'; }
      else if(!ch){ st = 'none'; ic = '–'; line = q.resolved ? 'You didn’t pick · Answer: ' + String(q.correct_answer || '').toUpperCase() : 'You didn’t pick'; }
      else if(!q.resolved){ st = 'pend'; ic = '…'; line = 'You picked ' + String(ch).toUpperCase() + ' · waiting on the result'; }
      else if(ch === q.correct_answer){ st = 'ok'; ic = '✓'; right++; scored++; line = 'You picked ' + String(ch).toUpperCase() + ' · Right'; }
      else { st = 'bad'; ic = '✕'; scored++; line = 'You picked ' + String(ch).toUpperCase() + ' · Answer was ' + String(q.correct_answer || '').toUpperCase(); }
      return '<div class="rd-row ' + st + '"><span class="rd-ic">' + ic + '</span><div class="rd-t"><b>' + escapeHtml(q.question_text) + '</b><em>' + escapeHtml(line) + '</em></div></div>';
    }).join('');
    panel.innerHTML = '<button type="button" class="rd-x" aria-label="Close">&times;</button><div class="rd-h">' + mqRecDayLabel(d) + (scored ? '<span>' + right + ' of ' + scored + ' right</span>' : '') + '</div>' + (rows || '<p class="rd-empty">No questions that day.</p>');
    mqRecPlace();
  }
  async function loadRecord(){
    var cal = document.getElementById('rec-cal');
    if(!cal) return;
    var foot = document.getElementById('rec-foot'), ringsEl = document.getElementById('rec-rings');
    var today = getETDateInfo().dateStr;
    if(!MQ_REC.month) MQ_REC.month = today.slice(0, 7);
    var t = new Date(today + 'T12:00:00Z'), ringFrom = new Date(t.getTime() - 34 * 86400000).toISOString().slice(0, 10);
    var byDay = {}, picks = {}, cat = { sports: { c: 0, t: 0 }, pop_culture: { c: 0, t: 0 }, news: { c: 0, t: 0 } };
    var session = null;
    try{ var sr = await sb.auth.getSession(); session = sr && sr.data && sr.data.session; }catch(e){}
    if(session){
      var res = await sb.from('predictions')
        .select('choice, daily_questions!inner(id, category, correct_answer, resolved, voided, question_date)')
        .eq('user_id', session.user.id)
        .gte('daily_questions.question_date', '2026-09-01')
        .lte('daily_questions.question_date', today);
      (res.data || []).forEach(function(r){
        var dq = r.daily_questions; if(!dq) return;
        (picks[dq.question_date] = picks[dq.question_date] || {})[dq.id] = r.choice;
        var d = byDay[dq.question_date] = byDay[dq.question_date] || { total: 0, resolved: 0, correct: 0, voided: 0 };
        d.total++;
        if(dq.voided){
          d.voided++; // voided: not right, not wrong, and left out of every count
        }else if(dq.resolved){
          d.resolved++;
          var ok = r.choice === dq.correct_answer;
          if(ok) d.correct++;
          if(dq.question_date >= ringFrom && cat[dq.category]){ cat[dq.category].t++; if(ok) cat[dq.category].c++; }
        }
      });
      Object.keys(byDay).forEach(function(d){
        var v = byDay[d];
        if(d >= ringFrom && v.resolved > 0 && v.total >= 3 && v.correct + v.voided === v.total) mqAwardAchievement(session.user.id, 'perfect_day');
      });
    }
    MQ_REC.byDay = byDay; MQ_REC.picks = picks; MQ_REC.session = session;
    mqRecRenderMonth();
    if(!MQ_REC.bound){
      MQ_REC.bound = true;
      var pv = document.getElementById('rec-prev'), nx = document.getElementById('rec-next');
      function step(n){ var y = Number(MQ_REC.month.slice(0, 4)), m = Number(MQ_REC.month.slice(5, 7)) + n; if(m < 1){ m = 12; y--; } if(m > 12){ m = 1; y++; } MQ_REC.month = y + '-' + String(m).padStart(2, '0'); mqRecHide(); mqRecRenderMonth(); }
      if(pv) pv.addEventListener('click', function(){ step(-1); });
      if(nx) nx.addEventListener('click', function(){ step(1); });
      cal.addEventListener('click', function(e){ var b = e.target.closest('button[data-d]'); if(b) mqRecShowDay(b.getAttribute('data-d')); });
      document.addEventListener('click', function(e){
        var p = document.getElementById('rec-day'); if(!p || p.hidden) return;
        if(e.target.closest('.rd-x')){ mqRecHide(); return; }
        if(!e.target.closest('#rec-day') && !e.target.closest('#rec-cal')) mqRecHide();
      });
      document.addEventListener('keydown', function(e){ if(e.key === 'Escape') mqRecHide(); });
      window.addEventListener('scroll', mqRecPlace, { passive: true });
      window.addEventListener('resize', mqRecPlace);
    }

    var defs = [['sports', 'Sports', '255,148,38'], ['pop_culture', 'Pop culture', '170,112,255'], ['news', 'News', '70,140,255']];
    ringsEl.innerHTML = defs.map(function(x){
      var c = cat[x[0]];
      return mqRing(c.t ? Math.round(c.c / c.t * 100) : null, x[2], x[1], c.t ? (c.c + ' of ' + c.t + ' right') : 'first results soon');
    }).join('');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      ringsEl.querySelectorAll('.rec-arc').forEach(function(a){ a.setAttribute('stroke-dasharray', a.getAttribute('data-dash') + ' ' + a.getAttribute('data-c')); });
    }); });

    var recCard = document.getElementById('record-card');
    if(!session){
      mqEmptyState(recCard, { icon: 'chart', title: 'Your record starts with one call', sub: 'Make a free account and every call you make builds a streak, a hit rate and a month-by-month history.', source: 'record' });
      foot.textContent = '';
    }else{ mqClearEmptyState(recCard); }
  }


  // ---- My calls: this week's (Mon-Sun) scored picks, right or wrong, plus this week's hit rate ----
  async function loadMyCalls(){
    var listEl = document.getElementById('mycalls-list'), rateEl = document.getElementById('mycalls-rate');
    if(!listEl) return;
    var session = null;
    try{ var sr = await sb.auth.getSession(); session = sr && sr.data && sr.data.session; }catch(e){}
    var myCallsCard = document.getElementById('mycalls-card');
    if(!session){ if(myCallsCard) myCallsCard.style.display = 'none'; return; }
    if(myCallsCard) myCallsCard.style.display = '';

    // Strictly this week: Monday through Sunday (Eastern). It starts fresh every Monday.
    var weekStart = getWeekStart(), today = getETDateInfo().dateStr;
    var res = await sb.from('predictions')
      .select('choice, daily_questions!inner(question_text, category, correct_answer, resolved, question_date)')
      .eq('user_id', session.user.id)
      .eq('daily_questions.resolved', true)
      .eq('daily_questions.voided', false) // voided calls aren't right or wrong, so they stay out of the hit rate
      .gte('daily_questions.question_date', weekStart)
      .lte('daily_questions.question_date', today)
      .order('daily_questions(question_date)', { ascending: false });

    var rows = res.data || [];
    if(!rows.length){ rateEl.innerHTML = ''; listEl.innerHTML = '<p class="recap-foot" style="border:none;padding:0;">Your calls this week show up here once they\u2019re scored.</p>'; return; }

    var right = rows.filter(function(r){ return r.choice === r.daily_questions.correct_answer; }).length;
    rateEl.innerHTML = '<b>' + Math.round(right / rows.length * 100) + '%</b><span>hit rate \u00b7 this week</span>';

    function callRow(r){
      var dq = r.daily_questions, won = r.choice === dq.correct_answer;
      var icon = CATEGORY_ICONS[dq.category] || '';
      var qtext = (dq.question_text || '').length > 46 ? dq.question_text.slice(0, 44) + '\u2026' : (dq.question_text || '');
      var dayTxt = '';
      try{ dayTxt = dq.question_date === today ? 'Today' : new Date(dq.question_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }); }catch(e){}
      return '<div class="mycall-row ' + (won ? 'win' : 'loss') + '">' +
        '<span class="mycall-cat">' + icon + '</span>' +
        '<span class="mycall-q">' + escapeHtml(qtext) + '</span>' +
        '<span class="mycall-day' + (dq.question_date === today ? ' today' : '') + '" title="' + escapeHtml(dq.question_date || '') + '">' + escapeHtml(dayTxt) + '</span>' +
        '<span class="mycall-res">' + mqIcon(won ? 'check' : 'xmark') + '</span>' +
      '</div>';
    }
    // Your latest three stay in view; the rest of this week sits behind a "Show earlier calls" dropdown.
    var firstRows = rows.slice(0, 3), olderRows = rows.slice(3);
    var html = firstRows.map(callRow).join('');
    if(olderRows.length){
      html += '<details class="mycalls-more">' +
        '<summary><span class="mm-closed">Show ' + olderRows.length + ' earlier ' + (olderRows.length === 1 ? 'call' : 'calls') + '</span><span class="mm-open">Show less</span>' +
        '<svg class="mm-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>' +
        olderRows.map(callRow).join('') +
      '</details>';
    }
    listEl.innerHTML = html;
  }

  async function loadWeeklyRecap(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    const recapCardEl = document.getElementById('recap-card');
    if(!session){ if(recapCardEl) recapCardEl.style.display = 'none'; return; }
    if(recapCardEl) recapCardEl.style.display = '';

    const weekStart = getWeekStart();
    const today = getETDateInfo().dateStr;

    const { data } = await sb
      .from('predictions')
      .select('choice, daily_questions!inner(category, correct_answer, resolved, question_date)')
      .eq('user_id', session.user.id)
      .gte('daily_questions.question_date', weekStart)
      .lte('daily_questions.question_date', today)
      .eq('daily_questions.resolved', true)
      .eq('daily_questions.voided', false); // voided calls stay out of the weekly accuracy

    const { data: myStreak } = await sb.from('streaks').select('current_streak').eq('user_id', session.user.id).maybeSingle();

    if(!data || data.length === 0){
      var streakNow = myStreak ? myStreak.current_streak : 0;
      document.getElementById('recap-streak').textContent = streakNow;
      // Nothing scored yet: show Mon-Sun with the calls you've locked in so far, instead of empty dashes.
      var stripEl = document.getElementById('recap-strip'), daysEl = document.getElementById('recap-strip-days'), statsEl = document.getElementById('recap-stats');
      if(stripEl && daysEl && statsEl){
        var locked = {};
        try{
          var lr = await sb.from('predictions')
            .select('daily_questions!inner(question_date)')
            .eq('user_id', session.user.id)
            .gte('daily_questions.question_date', weekStart)
            .lte('daily_questions.question_date', today);
          (lr.data || []).forEach(function(row){
            var d = row.daily_questions && row.daily_questions.question_date;
            if(d) locked[d] = (locked[d] || 0) + 1;
          });
        }catch(e){ /* the strip still shows without counts */ }
        var names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        var base = new Date(weekStart + 'T00:00:00Z');
        daysEl.innerHTML = names.map(function(nm, i){
          var dt = new Date(base.getTime()); dt.setUTCDate(base.getUTCDate() + i);
          var ds = dt.toISOString().slice(0, 10), n = locked[ds] || 0;
          var cls = 'rs-day' + (ds === today ? ' today' : '') + (ds > today ? ' future' : '') + (n ? ' has' : '');
          return '<div class="' + cls + '"><span class="rs-dot">' + (n ? n : '') + '</span><span class="rs-name">' + nm + '</span></div>';
        }).join('');
        var todayN = locked[today] || 0;
        document.getElementById('recap-strip-streak').textContent = streakNow;
        statsEl.style.display = 'none';
        stripEl.style.display = 'flex';
        document.getElementById('recap-foot').textContent = (todayN ? (todayN + (todayN === 1 ? ' call' : ' calls') + ' locked in today. ') : '') + 'Your week fills in as results come back.';
      }else{
        document.getElementById('recap-foot').textContent = 'No resolved calls yet this week.';
      }
      return;
    }

    let correct = 0;
    const categoryCorrect = {};
    data.forEach(function(row){
      const isCorrect = row.choice === row.daily_questions.correct_answer;
      if(isCorrect){
        correct++;
        const cat = row.daily_questions.category;
        categoryCorrect[cat] = (categoryCorrect[cat] || 0) + 1;
      }
    });

    const accuracy = Math.round((correct / data.length) * 100);
    let topCategory = '—';
    let topCount = 0;
    Object.keys(categoryCorrect).forEach(function(cat){
      if(categoryCorrect[cat] > topCount){ topCount = categoryCorrect[cat]; topCategory = CATEGORY_LABELS[cat] || cat; }
    });

    document.getElementById('recap-accuracy').textContent = accuracy + '%';
    document.getElementById('recap-predictions').textContent = data.length;
    document.getElementById('recap-streak').textContent = myStreak ? myStreak.current_streak : 0;
    document.getElementById('recap-foot').textContent = topCount > 0 ? ('Top category: ' + topCategory) : 'No correct calls yet this week.';
  }

  async function loadTopPredictor(){
    const weekStart = getWeekStart();
    const today = getETDateInfo().dateStr;
    const line = document.getElementById('top-predictor-line');

    // Computed in the database (weekly_top_predictor): needs 3+ resolved calls,
    // and players who hid themselves from leaderboards are never named.
    const { data: top, error } = await sb.rpc('weekly_top_predictor', { p_week_start: weekStart, p_today: today });
    if(error || !top){
      line.textContent = 'Top Predictor of the Week: not available right now.';
      return;
    }
    if(!top.has_resolved){
      line.textContent = 'Top Predictor of the Week: no resolved calls yet this week.';
      return;
    }
    if(!top.best){
      line.textContent = 'Top Predictor of the Week: not enough calls yet this week.';
      return;
    }
    const pct = Math.round((top.best.correct / top.best.total) * 100);
    line.textContent = 'Top Predictor of the Week: ' + (top.best.username || 'a player') + ', ' + pct + '% accuracy.';
  }

  loadWeeklyRecap();
  loadMyCalls();
  loadRecord();
  loadTopPredictor();

  async function loadStateBoard(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    const rowsEl = document.getElementById('board-state');
    const titleEl = document.getElementById('state-board-title');
    if(!session || !rowsEl) return;

    const { data: myProfile } = await sb.from('profiles').select('state').eq('id', session.user.id).maybeSingle();
    const myState = myProfile && myProfile.state;

    if(!myState){
      rowsEl.innerHTML = '<div class="brow"><span>Add your state above and sign in again to see this.</span></div>';
      return;
    }

    titleEl.textContent = myState;

    // Top 5 chosen in the database (state_top_players) instead of downloading
    // everyone in the state and sorting here.
    const { data: topPlayers, error: stateErr } = await sb.rpc('state_top_players', { p_state: myState, p_limit: 5 });
    if(stateErr){
      rowsEl.innerHTML = '<div class="brow"><span>Leaderboard unavailable right now.</span></div>';
      return;
    }
    if(!topPlayers || topPlayers.length === 0){
      rowsEl.innerHTML = '<div class="brow"><span>No one else from ' + myState + ' yet.</span></div>';
      return;
    }

    rowsEl.innerHTML = await mqBoardRows(topPlayers.map(function(r){
      return { user_id: r.user_id, username: r.username, avatar_emoji: r.avatar_emoji, avatar_color: r.avatar_color, points: Number(r.total_points), streak: r.current_streak };
    }), session.user.id);
  }

  loadStateBoard();

  // --- Change 6: weekly group card ----------------------------------------
  // Computed on demand (when a member taps Share), not on a scheduled job --
  // functionally the same shareable output the spec describes, just
  // generated at share time instead of automatically the moment the week
  // closes. Flagging that simplification since a true auto-generated
  // version would need a scheduled Supabase Edge Function, out of scope
  // for a client-side change.
  // Group weeks close on Monday at 2:00 AM Eastern (not midnight) so Sunday
  // night's questions have time to be resolved before the week is called.
  // Returns Monday-start date strings (YYYY-MM-DD, Eastern) for the week
  // currently in progress under that rule, the one before it, and the next.
  // Subtracting 2 real hours before reading the Eastern calendar date makes
  // Mon 12:00-1:59 AM still belong to the previous week; DST-safe because the
  // shift is absolute time, applied before converting to Eastern.
  function getGroupWeekWindow(nowMs){
    const shifted = new Date((typeof nowMs === 'number' ? nowMs : Date.now()) - 2 * 3600 * 1000);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(shifted);
    const wk = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(shifted);
    const dayNum = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wk];
    const diffToMonday = (dayNum === 0) ? 6 : dayNum - 1;
    const parts = dateStr.split('-').map(Number);
    const iso = function(d){ return d.toISOString().slice(0, 10); };
    const current = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - diffToMonday));
    return {
      lastStart: iso(new Date(current.getTime() - 7 * 86400000)),
      currentStart: iso(current),
      nextStart: iso(new Date(current.getTime() + 7 * 86400000))
    };
  }

  // Shows the most recently CLOSED week (a true weekly recap). A group that
  // was created during the current, still-open week has no closed week yet,
  // so it falls back to that week's standings so far.
  async function mqComputeGroupWeeklyTop3(groupId, groupCreatedAt){
    const win = getGroupWeekWindow();
    const useClosedWeek = new Date(groupCreatedAt).getTime() < Date.parse(win.currentStart + 'T00:00:00Z');
    const weekStartStr = useClosedWeek ? win.lastStart : win.currentStart;
    const weekEndStr = useClosedWeek ? win.currentStart : win.nextStart; // exclusive
    const weekStart = new Date(weekStartStr + 'T00:00:00Z');
    const created = new Date(groupCreatedAt);
    const createdWeekday = (created.getUTCDay() + 6) % 7; // Monday = 0
    const createdMonday = new Date(created.getTime() - createdWeekday * 86400000);
    const weekNumber = Math.max(1, Math.round((weekStart.getTime() - Date.UTC(createdMonday.getUTCFullYear(), createdMonday.getUTCMonth(), createdMonday.getUTCDate())) / 604800000) + 1);

    const { data: members } = await sb.from('group_members').select('user_id, share_as_player, profiles(username, avatar_emoji)').eq('group_id', groupId);
    if(!members || !members.length) return { weekNumber: weekNumber, memberCount: 0, top3: [] };

    const memberIds = members.map(function(m){ return m.user_id; });
    const { data: weekPreds } = await sb
      .from('predictions')
      .select('user_id, choice, daily_questions!inner(correct_answer, resolved, question_date)')
      .in('user_id', memberIds)
      .gte('daily_questions.question_date', weekStartStr)
      .lt('daily_questions.question_date', weekEndStr);

    const pointsByUser = {};
    (weekPreds || []).forEach(function(r){
      if(r.daily_questions.resolved && r.choice === r.daily_questions.correct_answer){
        pointsByUser[r.user_id] = (pointsByUser[r.user_id] || 0) + 100;
      }
    });

    const memberMap = {};
    members.forEach(function(m){ memberMap[m.user_id] = m; });

    const ranked = memberIds
      .map(function(uid){ return { user_id: uid, points: pointsByUser[uid] || 0 }; })
      .sort(function(a, b){ return b.points - a.points; })
      .slice(0, 3)
      .map(function(r){
        const m = memberMap[r.user_id];
        const prof = (m && m.profiles) || {};
        const showAsPlayer = !!(m && m.share_as_player);
        return { username: showAsPlayer ? 'Player' : (prof.username || 'player'), emoji: mqAvatarKey(prof.avatar_emoji) || 'target', points: r.points };
      });

    return { weekNumber: weekNumber, memberCount: members.length, top3: ranked };
  }

  function mqDrawGroupWeeklyCard(width, height, groupName, weekData, referralTag){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const L = mqCardLayout(width, height), u = L.u, T = L.top;

    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, T, Math.max(0.85, u));
    const footerTop = mqCardFooterBand(ctx, width, height, 'Join our league', referralTag ? 'playmarqit.com/join' : 'playmarqit.com');

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(78 * u) + "px " + MQ_HEAD_FONT;
    const nameLines = mqWrapLines(ctx, groupName, width * 0.84, 2);
    nameLines.forEach(function(l, i){ ctx.fillText(l, cx, T + 245 * u + i * 92 * u); });
    const weekY = T + 245 * u + (nameLines.length - 1) * 92 * u + 74 * u;

    ctx.fillStyle = MQ_YES;
    ctx.font = "700 " + Math.round(28 * u) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, 'WEEK ' + weekData.weekNumber + '  ·  ' + weekData.memberCount + ' MEMBERS', cx, weekY, 7 * u);

    const n = weekData.top3.length;
    const rowX = width * 0.075, rowW = width * 0.85;
    const rs = weekY + 60 * u;
    const avail = footerTop - 30 * u - rs;
    const gap = 20 * u;
    const rowH = Math.min(150 * u, (avail - gap * (n - 1)) / Math.max(n, 1));
    const fs = Math.min(1, rowH / (150 * u));
    weekData.top3.forEach(function(m, i){
      const ry = rs + i * (rowH + gap), mid = ry + rowH / 2;
      mqCardPanel(ctx, rowX, ry, rowW, rowH, 26 * u, i === 0 ? MQ_YES : null);

      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? MQ_YES : MQ_INK_MUTED;
      ctx.font = "800 " + Math.round(70 * u * fs) + "px " + MQ_DISPLAY_FONT;
      ctx.fillText('0' + (i + 1), rowX + 38 * u, mid + 24 * u * fs);

      const pts = m.points.toLocaleString();
      ctx.textAlign = 'right';
      ctx.fillStyle = i === 0 ? MQ_YES : MQ_INK_SOFT;
      ctx.font = "800 " + Math.round(44 * u * fs) + "px " + MQ_HEAD_FONT;
      ctx.fillText(pts, rowX + rowW - 36 * u, mid + 16 * u * fs);
      const ptsW = ctx.measureText(pts).width;

      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK;
      ctx.font = "700 " + Math.round(44 * u * fs) + "px " + MQ_HEAD_FONT;
      const maxW = rowW - 150 * u - 36 * u - ptsW - 24 * u;
      let uname = String(m.username || '');
      while(uname.length > 1 && ctx.measureText(uname).width > maxW) uname = uname.slice(0, -1);
      if(uname !== m.username) uname = uname.replace(/\s+$/, '') + '…';
      ctx.fillText(uname, rowX + 150 * u, mid + 16 * u * fs);
    });

    return canvas;
  }

  async function mqShareGroupWeeklyCard(groupId, group){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session || !group || !group.card_sharing_enabled) return;

    const weekData = await mqComputeGroupWeeklyTop3(groupId, group.created_at);
    // Change 6 invite-link rule: only included if the owner turned it on.
    const includeInvite = !!group.show_invite_on_card;
    const shareUrl = includeInvite
      ? 'https://playmarqit.com/?group=' + encodeURIComponent(group.invite_code)
      : 'https://playmarqit.com/?' + mqGetReferralTag(session.user.id, 'group', null);
    const shareText = group.name + ', Week ' + weekData.weekNumber + '. Join our league. ' + shareUrl;

    await mqEnsureCardFonts();
    const canvas = mqDrawGroupWeeklyCard(1080, 1920, group.name, weekData, includeInvite);
    const packaged = await mqShareCanvasToFileAndCaption(canvas, 'marqit-group.png');
    if(!packaged) return;

    mqLogCardShare(session.user.id, 'group', null);

    mqOpenShareSheet({ title: group.name, text: group.name + ', Week ' + weekData.weekNumber + '. Join our league.', url: shareUrl, packaged: packaged, filename: 'marqit-group.png' });
  }

  // ---- Champion card: the one non-monetary prize asset. Shareable graphic
  // for whichever chapter or national org Max has crowned via admin_set_champion.
  // This is meant to be posted to the chapter's own Instagram/story -- their
  // bragging rights, and free organic marketing for Marqit in their followers' feeds.
  function mqDrawChampionCard(width, height, name, symbol, subtitle){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const L = mqCardLayout(width, height), u = L.u, T = L.top;

    mqCardBackground(ctx, width, height);
    const logoBottom = mqCardLogoRow(ctx, width, T, Math.max(0.85, u));
    const footerTop = mqCardFooterBand(ctx, width, height, 'Think your chapter can beat this?', 'playmarqit.com');

    // The block (label, symbol, name, subtitle) is centered in the room between
    // the logo and the footer, so a short name doesn't leave it floating high.
    ctx.font = "800 " + Math.round(80 * u) + "px " + MQ_HEAD_FONT;
    const nameLines = mqWrapLines(ctx, name, width * 0.84, 2);
    const labelBase = 30 * u;
    const symBase = labelBase + 250 * u;
    const nameBase = symbol ? symBase + 130 * u : labelBase + 140 * u;
    const lastBase = nameBase + (nameLines.length - 1) * 96 * u;
    const subBase = lastBase + 66 * u;
    const blockH = (subtitle ? subBase : lastBase) + 10 * u;
    const areaTop = logoBottom + 20 * u, areaBottom = footerTop - 20 * u;
    const y0 = areaTop + Math.max(0, (areaBottom - areaTop - blockH) / 2);

    // Tracked label between two thin rules, like an award citation.
    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_YES;
    ctx.font = "700 " + Math.round(32 * u) + "px " + MQ_HEAD_FONT;
    const lw = mqTrackedWidth(ctx, 'CHAMPION', 10 * u);
    mqTrackedText(ctx, 'CHAMPION', cx, y0 + labelBase, 10 * u);
    mqHairline(ctx, cx - lw / 2 - 150 * u, cx - lw / 2 - 30 * u, y0 + labelBase - 11 * u, 0.5);
    mqHairline(ctx, cx + lw / 2 + 30 * u, cx + lw / 2 + 150 * u, y0 + labelBase - 11 * u, 0.5);

    if(symbol){
      ctx.textAlign = 'center';
      ctx.fillStyle = MQ_INK;
      ctx.font = "800 " + Math.round(210 * u) + "px " + MQ_DISPLAY_FONT;
      ctx.fillText(symbol, cx, y0 + symBase);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(80 * u) + "px " + MQ_HEAD_FONT;
    nameLines.forEach(function(l, i){ ctx.fillText(l, cx, y0 + nameBase + i * 96 * u); });

    if(subtitle){
      ctx.fillStyle = MQ_INK_FAINT;
      ctx.font = "700 " + Math.round(34 * u) + "px " + MQ_HEAD_FONT;
      ctx.fillText(subtitle, cx, y0 + subBase);
    }

    return canvas;
  }

  async function mqShareChampionCard(kind, name, symbol, subtitle){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;

    const shareText = name + ' — Marqit Champion. playmarqit.com';
    await mqEnsureCardFonts();
    const canvas = mqDrawChampionCard(1080, 1920, name, symbol, subtitle);
    const packaged = await mqShareCanvasToFileAndCaption(canvas, 'marqit-champion.png');
    if(!packaged) return;

    mqLogCardShare(session.user.id, 'champion', kind);

    mqOpenShareSheet({ title: name, text: name + ' \u2014 Marqit Champion.', url: 'https://playmarqit.com', packaged: packaged, filename: 'marqit-champion.png' });
  }

  // Shows a "Share Champion card" button in the group section if (and only
  // if) the signed-in user's own chapter, or its national org, currently
  // holds the title -- so the button doesn't clutter things for anyone else.
  async function loadChampionCardButton(membershipGroup){
    const el = document.getElementById('champion-card-btn-wrap');
    if(!el) return;
    el.innerHTML = '';
    const { data } = await sb.rpc('get_champion_info');
    const info = data && data[0];
    if(!info || (!info.champion_group_id && !info.champion_org_name)) return;

    const isChapterChamp = membershipGroup && info.champion_group_id === membershipGroup.id;
    const isOrgChamp = membershipGroup && membershipGroup.org_name && info.champion_org_name === membershipGroup.org_name;
    if(!isChapterChamp && !isOrgChamp) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Share Champion card';
    btn.className = 'lb-share-btn';
    btn.addEventListener('click', function(){
      if(isChapterChamp){
        mqShareChampionCard('chapter', membershipGroup.name, info.champion_group_symbol, membershipGroup.school || 'Marqit Chapter Champion');
      } else {
        mqShareChampionCard('org', info.champion_org_name, info.champion_org_symbol, 'Marqit National Champion');
      }
    });
    el.appendChild(btn);
  }

  async function loadGroupSection(){
    if(typeof mqApplyGreekVisibility === 'function') mqApplyGreekVisibility();
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    const outEl = document.getElementById('group-signed-out');
    const noGroupEl = document.getElementById('group-no-group');
    const inGroupEl = document.getElementById('group-in-group');
    if(!outEl) return;

    if(!session){
      outEl.style.display = 'block';
      noGroupEl.style.display = 'none';
      inGroupEl.style.display = 'none';
      return;
    }
    outEl.style.display = 'none';

    const { data: membership } = await sb
      .from('group_members')
      .select('group_id, share_as_player, groups(id, name, invite_code, created_by, created_at, card_sharing_enabled, show_invite_on_card, org_name, school)')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if(!membership){
      noGroupEl.style.display = 'block';
      inGroupEl.style.display = 'none';
      return;
    }

    noGroupEl.style.display = 'none';
    inGroupEl.style.display = 'block';
    if(typeof loadChampionCardButton === 'function') loadChampionCardButton(membership.groups);
    document.getElementById('group-name-display').textContent = membership.groups.name;
    document.getElementById('group-invite-code').textContent = membership.groups.invite_code;

    // Commissioner tools: only the group's creator sees the Rename control.
    const renameBtn = document.getElementById('group-rename-btn');
    if(renameBtn){
      renameBtn.style.display = (membership.groups.created_by === session.user.id) ? 'inline' : 'none';
      renameBtn.onclick = async function(){
        const next = prompt('Rename your group', membership.groups.name);
        if(!next || !next.trim() || next.trim() === membership.groups.name) return;
        const { error } = await sb.from('groups').update({ name: next.trim() }).eq('id', membership.groups.id);
        if(!error) document.getElementById('group-name-display').textContent = next.trim();
      };
    }

    // Change 6: weekly group card. Owner-only settings (both off by
    // default, per spec) control whether the card can be shared publicly
    // at all, and whether it carries the group's invite link.
    const isOwner = membership.groups.created_by === session.user.id;
    const ownerSettingsEl = document.getElementById('group-card-owner-settings');
    const cardSharingCheckbox = document.getElementById('group-card-sharing-checkbox');
    const showInviteCheckbox = document.getElementById('group-card-invite-checkbox');
    if(ownerSettingsEl){
      ownerSettingsEl.style.display = isOwner ? 'block' : 'none';
      if(isOwner && cardSharingCheckbox && showInviteCheckbox){
        cardSharingCheckbox.checked = !!membership.groups.card_sharing_enabled;
        showInviteCheckbox.checked = !!membership.groups.show_invite_on_card;
        cardSharingCheckbox.onchange = async function(){
          await sb.from('groups').update({ card_sharing_enabled: this.checked }).eq('id', membership.groups.id);
          loadGroupSection();
        };
        showInviteCheckbox.onchange = async function(){
          await sb.from('groups').update({ show_invite_on_card: this.checked }).eq('id', membership.groups.id);
        };
      }
    }

    // Any member can choose to appear on a shared group card as "Player"
    // instead of their real username (Change 6 privacy note).
    const asPlayerCheckbox = document.getElementById('group-card-share-as-player-checkbox');
    if(asPlayerCheckbox){
      asPlayerCheckbox.checked = !!membership.share_as_player;
      asPlayerCheckbox.onchange = async function(){
        await sb.from('group_members').update({ share_as_player: this.checked }).eq('user_id', session.user.id).eq('group_id', membership.group_id);
      };
    }

    // Share button only works when the owner has actually turned card
    // sharing on -- "who can share: any group member," but only once the
    // owner opts the group in at all.
    const groupShareBtn = document.getElementById('share-group-card-btn');
    if(groupShareBtn){
      groupShareBtn.style.display = membership.groups.card_sharing_enabled ? 'inline-flex' : 'none';
      groupShareBtn.onclick = function(){ mqShareGroupWeeklyCard(membership.group_id, membership.groups); };
    }

    const { data: members } = await sb.from('group_members').select('user_id, profiles(username, avatar_emoji, avatar_color)').eq('group_id', membership.group_id);
    if(!members || members.length === 0) return;

    const ids = members.map(function(m){ return m.user_id; });
    const { data: streaksData } = await sb.from('streaks').select('user_id, total_points, current_streak').in('user_id', ids);
    const profMap = {};
    members.forEach(function(m){ profMap[m.user_id] = m.profiles || {}; });

    const ranked = (streaksData || []).sort(function(a, b){ return b.total_points - a.total_points; });
    document.getElementById('board-group').innerHTML = await mqBoardRows(ranked.map(function(r){
      const p = profMap[r.user_id] || {};
      return { user_id: r.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: r.total_points, streak: r.current_streak };
    }), session.user.id);

    if(typeof loadGroupParticipation === 'function') loadGroupParticipation(membership.group_id);
  }

  // ---- Today's participation: who in your chapter hasn't answered yet ----
  // The raw-sum points model means one no-show member is lost points for the
  // whole chapter, so surface it plainly so the president/social chair can
  // chase stragglers in the group chat.
  async function loadGroupParticipation(groupId){
    const el = document.getElementById('board-group-participation');
    if(!el) return;
    const { data, error } = await sb.rpc('get_group_participation_today', { p_group_id: groupId });
    if(error || !data){
      el.innerHTML = '<p style="font-size:12px; color:var(--ink-soft); margin:0;">Couldn\'t load today\'s participation.</p>';
      return;
    }
    const total = data.length ? Number(data[0].total_today || 0) : 0;
    if(total === 0){
      el.innerHTML = '<p style="font-size:12px; color:var(--ink-soft); margin:0;">No live questions right now.</p>';
      return;
    }
    el.innerHTML = data.map(function(m){
      const answered = Number(m.answered_count || 0);
      const done = answered >= total;
      return '<div class="brow" style="padding:6px 0;"><span style="font-size:13px;">' + escapeHtml(m.username || 'player') + '</span>' +
        '<span style="font-size:12px; font-weight:700; color:' + (done ? 'var(--yes)' : 'var(--no)') + ';">' + (done ? 'Done' : (answered + '/' + total)) + '</span></div>';
    }).join('');
  }

  // Self-serve opt-in: a president who lands on the plain site (no invite link
  // yet) can flag themselves as setting up a chapter, right from the create form.
  const greekOptInBtn = document.getElementById('greek-opt-in-btn');
  if(greekOptInBtn){
    greekOptInBtn.addEventListener('click', function(){
      try{ localStorage.setItem('marqit_greek', '1'); }catch(e){}
      greekOptInBtn.style.display = 'none';
      const fields = document.getElementById('greek-create-fields');
      if(fields) fields.style.display = 'block';
      const createBtn = document.getElementById('create-group-btn');
      if(createBtn) createBtn.textContent = 'Create chapter';
      const nameInput = document.getElementById('group-name-input');
      if(nameInput) nameInput.placeholder = 'chapter name (e.g. Sigma Chi – UF)';
      if(typeof mqApplyGreekVisibility === 'function') mqApplyGreekVisibility();
    });
  }

  document.getElementById('create-group-btn').addEventListener('click', async function(){
    const btn = this;
    const msg = document.getElementById('group-msg');
    const name = document.getElementById('group-name-input').value.trim();
    const schoolEl = document.getElementById('group-school-input');
    const orgEl = document.getElementById('group-org-input');
    const symbolEl = document.getElementById('group-symbol-input');
    const school = schoolEl ? schoolEl.value.trim() : '';
    const orgName = orgEl ? orgEl.value.trim() : '';
    const symbol = symbolEl ? symbolEl.value.trim() : '';
    msg.className = 'form-msg';
    if(!name){ msg.classList.add('err'); msg.textContent = 'Enter a group name.'; return; }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){ msg.classList.add('err'); msg.textContent = 'Sign in above first.'; return; }

    btn.disabled = true;
    const insertRow = { name: name, created_by: session.user.id };
    if(school) insertRow.school = school;
    if(orgName) insertRow.org_name = orgName;
    if(symbol) insertRow.symbol = symbol;
    const { data: group, error } = await sb.from('groups').insert(insertRow).select().single();
    if(error){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'Error: ' + error.message; return; }

    const { error: joinErr } = await sb.from('group_members').insert({ group_id: group.id, user_id: session.user.id });
    btn.disabled = false;
    if(joinErr){ msg.classList.add('err'); msg.textContent = 'Error: ' + joinErr.message; return; }

    msg.classList.add('ok');
    msg.textContent = 'Group created!';
    loadGroupSection();
    if(typeof loadTopGroupsBoard === 'function') loadTopGroupsBoard();
    if(typeof loadTopOrgsBoard === 'function') loadTopOrgsBoard();
  });

  document.getElementById('join-group-btn').addEventListener('click', async function(){
    const btn = this;
    const msg = document.getElementById('group-msg');
    const code = document.getElementById('join-group-input').value.trim();
    msg.className = 'form-msg';
    if(!code){ msg.classList.add('err'); msg.textContent = 'Enter an invite code.'; return; }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){ msg.classList.add('err'); msg.textContent = 'Sign in above first.'; return; }

    btn.disabled = true;
    const { data: groupId, error: joinErr } = await sb.rpc('join_group_by_invite_code', { p_invite_code: code });
    btn.disabled = false;
    if(joinErr){
      msg.classList.add('err');
      msg.textContent = joinErr.code === '23505' ? 'You\'re already in a group.' : ('Error: ' + joinErr.message);
      return;
    }
    if(!groupId){
      msg.classList.add('err');
      msg.textContent = 'No group found with that code.';
      return;
    }

    msg.classList.add('ok');
    msg.textContent = 'Joined!';
    loadGroupSection();
  });

  document.getElementById('copy-invite-btn').addEventListener('click', function(){
    const code = document.getElementById('group-invite-code').textContent;
    navigator.clipboard.writeText(window.location.origin + '/?group=' + code).then(function(){
      document.getElementById('copy-invite-btn').textContent = 'Copied!';
      setTimeout(function(){ document.getElementById('copy-invite-btn').textContent = 'Copy'; }, 1500);
    });
  });

  document.getElementById('leave-group-btn').addEventListener('click', async function(){
    if(!confirm('Leave this group? You can join or create a new one after.')) return;
    const btn = this;
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;
    btn.disabled = true;
    const { error } = await sb.from('group_members').delete().eq('user_id', session.user.id);
    btn.disabled = false;
    if(error){ alert('Couldn\'t leave the group. Try again in a moment.'); return; }
    loadGroupSection();
  });

  async function autoJoinFromUrl(){
    // Prefer the sessionStorage copy (captureGroupCode, above) so this still
    // works after a sign-up/OAuth round trip that may have dropped the
    // original ?group= query param, then fall back to the live URL.
    let code = null;
    try{ code = sessionStorage.getItem('marqit_pending_group_code'); }catch(e){}
    if(!code){
      const params = new URLSearchParams(window.location.search);
      code = params.get('group');
    }
    if(!code) return;

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return; // not signed in yet -- the SIGNED_IN handler retries this once they are

    await sb.rpc('join_group_by_invite_code', { p_invite_code: code }); // ignore duplicate/already-in-group errors silently
    try{ sessionStorage.removeItem('marqit_pending_group_code'); }catch(e){}
    loadGroupSection();
    if(typeof loadTopGroupsBoard === 'function') loadTopGroupsBoard();
    if(typeof loadTopOrgsBoard === 'function') loadTopOrgsBoard();
  }

  // ---- Group vs. group: this week's head-to-head (get_group_matchups) ----
  async function loadGroupMatchup(){
    var el = document.getElementById('group-matchup');
    if(!el) return;
    try{
      var res = await sb.rpc('get_group_matchups');
      if(res.error || !res.data || !res.data.length){ el.hidden = true; return; }
      var rows = res.data;
      var myId = null;
      try{
        var sr = await sb.auth.getSession();
        var ses = sr.data && sr.data.session;
        if(ses){ var m = await sb.from('group_members').select('group_id').eq('user_id', ses.user.id).maybeSingle(); myId = m.data ? m.data.group_id : null; }
      }catch(e){}
      var mine = myId ? rows.filter(function(r){ return r.group_id === myId; })[0] : null;
      var a = mine || rows[0];
      var b = a.opponent_id ? rows.filter(function(r){ return r.group_id === a.opponent_id; })[0] : null;
      var wk = new Date(a.week_start + 'T12:00:00'); wk.setDate(wk.getDate() + 6);
      var endTxt = wk.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      function side(g, lead){
        var d = document.createElement('div'); d.className = 'gvg-side' + (lead ? ' lead' : '');
        var n = document.createElement('div'); n.className = 'gvg-name'; n.textContent = (g.symbol ? g.symbol + ' ' : '') + g.name;
        var sc = document.createElement('div'); sc.className = 'gvg-score'; sc.textContent = Number(g.score).toLocaleString(undefined, { maximumFractionDigits: 1 });
        var sm = document.createElement('div'); sm.className = 'gvg-sub'; sm.textContent = 'avg pts per member · ' + Number(g.member_count) + (Number(g.member_count) === 1 ? ' member' : ' members');
        d.appendChild(n); d.appendChild(sc); d.appendChild(sm);
        return d;
      }
      el.textContent = '';
      var head = document.createElement('div'); head.className = 'gvg-head';
      head.textContent = (mine ? 'Your matchup' : 'Matchup of the week') + ' · ends ' + endTxt;
      el.appendChild(head);
      if(!b){
        var bye = document.createElement('div'); bye.className = 'gvg-bye'; bye.textContent = a.name + ' has a bye this week. More chapters means more matchups.';
        el.appendChild(bye);
      }else{
        var row = document.createElement('div'); row.className = 'gvg-row';
        var aw = Number(a.score) >= Number(b.score);
        var tie = Number(a.score) === Number(b.score);
        row.appendChild(side(a, aw && !tie));
        var vs = document.createElement('div'); vs.className = 'gvg-vs'; vs.textContent = 'VS';
        row.appendChild(vs);
        row.appendChild(side(b, !aw && !tie));
        el.appendChild(row);
      }
      var note = document.createElement('div'); note.className = 'gvg-note';
      note.textContent = 'Chapters are paired by rank each week. Score is average points per member, so size doesn’t decide it.';
      el.appendChild(note);
      el.hidden = false;
    }catch(e){ el.hidden = true; }
  }

  // ---- Top Chapters: cross-group leaderboard, ranked by combined points ---
  // Deliberately a raw sum (not per-member average) -- a chapter that
  // recruits more people racks up more total points, so growing the group
  // is itself the winning move, not just playing well individually.
  async function loadTopGroupsBoard(p_school){
    loadGroupMatchup();
    const el = document.getElementById('board-top-groups');
    if(!el) return;
    const params = { p_limit: 25 };
    if(p_school) params.p_school = p_school;
    const { data, error } = await sb.rpc('get_top_groups', params);
    if(error || !data || data.length === 0){
      el.innerHTML = '<div class="brow"><span>No chapters on the board yet — create a group to be first.</span></div>';
      return;
    }
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    let myGroupId = null;
    if(session){
      const { data: membership } = await sb.from('group_members').select('group_id').eq('user_id', session.user.id).maybeSingle();
      myGroupId = membership ? membership.group_id : null;
    }
    // Verified badge: a small blue check next to chapters Max has personally
    // confirmed (groups.verified). This is the "exclusivity" lever -- anyone
    // can create a group and start scoring instantly (no join friction), but
    // only verified chapters carry the badge and are eligible for whatever
    // prize/incentive is attached to the board.
    const verifiedBadge = '<svg viewBox="0 0 24 24" width="13" height="13" fill="#4A9EFF" stroke="#4A9EFF" style="vertical-align:-2px; margin-left:4px;" aria-label="Verified chapter"><title>Verified chapter</title><path d="M12 2l2.4 1.9 3-.6 1 2.9 2.9 1-.6 3L22.6 12l-1.9 2.4.6 3-2.9 1-1 2.9-3-.6L12 22.6l-2.4-1.9-3 .6-1-2.9-2.9-1 .6-3L1.4 12l1.9-2.4-.6-3 2.9-1 1-2.9 3 .6L12 2z" stroke="none"/><path d="M8.5 12.2l2.4 2.4 4.8-5.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    // Trending tag: whichever chapter added the most new members in the last
    // 7 days gets a callout, so smaller/newer chapters have a second way to
    // show up besides raw #1 -- keeps them engaged instead of giving up.
    let trendingGroupId = null, trendingMax = 0;
    data.forEach(function(g){
      const n = Number(g.new_members_7d || 0);
      if(n > trendingMax){ trendingMax = n; trendingGroupId = g.group_id; }
    });
    el.innerHTML = data.map(function(g, i){
      const rank = i + 1;
      const mine = !!(myGroupId && g.group_id === myGroupId);
      const symbolBadge = g.symbol ? '<span style="display:inline-block; min-width:22px; padding:1px 5px; margin-right:6px; border-radius:6px; background:var(--yes-bg); color:var(--yes); font-weight:800; font-size:11.5px; text-align:center; vertical-align:1px;">' + escapeHtml(g.symbol) + '</span>' : '';
      const trendingTag = (trendingMax > 0 && g.group_id === trendingGroupId) ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:#DB6653; display:inline-flex; align-items:center; gap:3px;">' + mqIcon('flame') + 'Trending</span>' : '';
      const championTag = g.is_champion ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:#DB6653; display:inline-flex; align-items:center; gap:3px;">' + mqIcon('crown') + 'Champion</span>' : '';
      const foundingTag = g.founding_chapter ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:var(--ink-soft);">Founding Chapter</span>' : '';
      // Gap-to-next-rank: how many points to overtake the chapter directly above -- the competitive nudge.
      let gapLine = '';
      if(rank > 1){
        const above = data[i - 1];
        const gap = Number(above.total_points || 0) - Number(g.total_points || 0);
        if(gap > 0) gapLine = '<div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">' + gap.toLocaleString() + ' pts to catch #' + (rank - 1) + '</div>';
      }
      return '<div class="brow lb' + (rank <= 3 ? ' medal m' + rank : '') + (mine ? ' mine' : '') + '">' +
        '<span class="lb-rank">' + rank + '</span>' +
        '<span class="lb-name">' + symbolBadge + '<span class="lb-name-text">' + escapeHtml(g.name || 'group') + '</span>' + (g.verified ? verifiedBadge : '') + championTag + trendingTag + foundingTag + (mine ? '<em class="lb-you">Yours</em>' : '') +
          '<small style="margin-left:6px; color:var(--ink-soft); font-weight:600;">' + Number(g.member_count || 0).toLocaleString() + (g.member_count === 1 ? ' member' : ' members') + '</small>' + gapLine + '</span>' +
        '<span class="lb-pts"><b>' + Number(g.total_points || 0).toLocaleString() + '</b><small>pts</small></span>' +
      '</div>';
    }).join('');
  }

  // ---- Top Fraternities & Sororities Nationwide: same-org chapters rolled
  // up across every school into one combined-points entity. ----
  async function loadTopOrgsBoard(){
    const el = document.getElementById('board-top-orgs');
    if(!el) return;
    const { data, error } = await sb.rpc('get_top_orgs', { p_limit: 25 });
    if(error || !data || data.length === 0){
      el.innerHTML = '<div class="brow"><span>No national orgs yet — add a national org name when you create your chapter.</span></div>';
      return;
    }
    el.innerHTML = data.map(function(o, i){
      const rank = i + 1;
      const symbolBadge = o.symbol ? '<span style="display:inline-block; min-width:22px; padding:1px 5px; margin-right:6px; border-radius:6px; background:var(--yes-bg); color:var(--yes); font-weight:800; font-size:11.5px; text-align:center; vertical-align:1px;">' + escapeHtml(o.symbol) + '</span>' : '';
      const championTag = o.is_champion ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:#DB6653; display:inline-flex; align-items:center; gap:3px;">' + mqIcon('crown') + 'Champion</span>' : '';
      let gapLine = '';
      if(rank > 1){
        const above = data[i - 1];
        const gap = Number(above.total_points || 0) - Number(o.total_points || 0);
        if(gap > 0) gapLine = '<div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">' + gap.toLocaleString() + ' pts to catch #' + (rank - 1) + '</div>';
      }
      return '<div class="brow lb' + (rank <= 3 ? ' medal m' + rank : '') + '">' +
        '<span class="lb-rank">' + rank + '</span>' +
        '<span class="lb-name">' + symbolBadge + '<span class="lb-name-text">' + escapeHtml(o.org_name || 'org') + '</span>' + championTag +
          '<small style="margin-left:6px; color:var(--ink-soft); font-weight:600;">' + Number(o.chapter_count || 0).toLocaleString() + (o.chapter_count === 1 ? ' chapter' : ' chapters') + ' &middot; ' + Number(o.member_count || 0).toLocaleString() + (o.member_count === 1 ? ' member' : ' members') + '</small>' + gapLine + '</span>' +
        '<span class="lb-pts"><b>' + Number(o.total_points || 0).toLocaleString() + '</b><small>pts</small></span>' +
      '</div>';
    }).join('');
  }

  // ---- School filter dropdown for the Top Chapters board ----
  async function loadGroupSchoolFilter(){
    const sel = document.getElementById('group-school-filter');
    if(!sel) return;
    const { data, error } = await sb.rpc('get_group_schools');
    if(error || !data) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All schools</option>' + data.map(function(s){
      return '<option value="' + escapeHtml(s.school) + '">' + escapeHtml(s.school) + ' (' + s.group_count + ')</option>';
    }).join('');
    sel.value = current;
    if(!sel.dataset.wired){
      sel.dataset.wired = '1';
      sel.addEventListener('change', function(){ loadTopGroupsBoard(sel.value || undefined); });
    }
  }

  // ---- Head-to-Head: pick any two chapters, or any two national orgs ----
  (function(){
    const selA = document.getElementById('h2h-select-a');
    const selB = document.getElementById('h2h-select-b');
    const result = document.getElementById('h2h-result');
    const btnChapters = document.getElementById('h2h-mode-chapters');
    const btnOrgs = document.getElementById('h2h-mode-orgs');
    if(!selA || !selB || !result || !btnChapters || !btnOrgs) return;

    let mode = 'chapters'; // 'chapters' | 'orgs'
    let chapterRows = null; // cached [{group_id,name,member_count,total_points,verified}]
    let orgRows = null;     // cached [{org_name,chapter_count,member_count,total_points}]

    function setActiveBtn(active, inactive){
      active.style.background = 'var(--ink)'; active.style.color = 'var(--paper)';
      inactive.style.background = 'var(--panel)'; inactive.style.color = 'var(--ink)';
    }

    function fillSelects(items, labelFn){
      const opts = '<option value="">Pick one...</option>' + items.map(function(it, i){
        return '<option value="' + i + '">' + escapeHtml(labelFn(it)) + '</option>';
      }).join('');
      selA.innerHTML = opts;
      selB.innerHTML = opts;
    }

    async function loadChapters(){
      if(chapterRows) return chapterRows;
      const { data } = await sb.rpc('get_top_groups', { p_limit: 500 });
      chapterRows = data || [];
      return chapterRows;
    }
    async function loadOrgs(){
      if(orgRows) return orgRows;
      const { data } = await sb.rpc('get_top_orgs', { p_limit: 500 });
      orgRows = data || [];
      return orgRows;
    }

    async function refreshOptions(){
      result.style.display = 'none';
      selA.value = ''; selB.value = '';
      if(mode === 'chapters'){
        const rows = await loadChapters();
        if(rows.length === 0){ selA.innerHTML = selB.innerHTML = '<option value="">No chapters yet</option>'; return; }
        fillSelects(rows, function(r){ return r.name + (r.school ? ' (' + r.school + ')' : ''); });
      } else {
        const rows = await loadOrgs();
        if(rows.length === 0){ selA.innerHTML = selB.innerHTML = '<option value="">No national orgs yet</option>'; return; }
        fillSelects(rows, function(r){ return r.org_name; });
      }
    }

    function shareKey(mode, item){
      // Chapters are identified by group_id (stable uuid); orgs by their name (the only key we have).
      return mode === 'chapters' ? item.group_id : item.org_name;
    }

    function renderComparison(){
      const ia = selA.value, ib = selB.value;
      if(ia === '' || ib === ''){ result.style.display = 'none'; return; }
      const rows = mode === 'chapters' ? chapterRows : orgRows;
      const a = rows[Number(ia)], b = rows[Number(ib)];
      if(!a || !b){ result.style.display = 'none'; return; }

      const nameA = mode === 'chapters' ? a.name : a.org_name;
      const nameB = mode === 'chapters' ? b.name : b.org_name;
      const ptsA = Number(a.total_points || 0), ptsB = Number(b.total_points || 0);
      const memA = Number(a.member_count || 0), memB = Number(b.member_count || 0);
      const winner = ptsA === ptsB ? null : (ptsA > ptsB ? 'a' : 'b');

      function card(name, pts, mem, symbol, side){
        const isWinner = winner === side;
        const symbolBadge = symbol ? '<div style="display:inline-block; padding:3px 10px; margin-bottom:6px; border-radius:8px; background:var(--yes-bg); color:var(--yes); font-weight:800; font-size:13px;">' + escapeHtml(symbol) + '</div><br>' : '';
        return '<div style="flex:1; text-align:center; padding:14px 10px; border-radius:12px; ' + (isWinner ? 'background:var(--yes-bg); border:1.5px solid var(--yes);' : 'background:var(--paper); border:1.5px solid var(--line);') + '">' +
          (isWinner ? '<div style="font-size:11px; font-weight:700; color:var(--yes); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Leading</div>' : '<div style="height:15px;"></div>') +
          symbolBadge +
          '<div style="font-weight:700; font-size:15px; margin-bottom:6px; word-break:break-word;">' + escapeHtml(name || '') + '</div>' +
          '<div style="font-size:22px; font-weight:800;">' + pts.toLocaleString() + '</div>' +
          '<div style="font-size:11.5px; color:var(--ink-soft); margin-top:2px;">points</div>' +
          '<div style="font-size:12px; color:var(--ink-soft); margin-top:8px;">' + mem.toLocaleString() + (mem === 1 ? ' member' : ' members') + '</div>' +
        '</div>';
      }

      result.innerHTML = '<div style="display:flex; gap:12px; align-items:stretch;">' + card(nameA, ptsA, memA, a.symbol, 'a') + card(nameB, ptsB, memB, b.symbol, 'b') + '</div>' +
        (winner ? '' : '<p style="text-align:center; font-size:12.5px; color:var(--ink-soft); margin:10px 0 0;">Tied.</p>') +
        '<button type="button" id="h2h-share-btn" style="display:block; margin:14px auto 0; padding:8px 16px; border:1.5px solid var(--line); border-radius:20px; background:var(--panel); color:var(--ink); font-weight:600; font-size:12.5px; cursor:pointer;">Copy challenge link</button>';
      result.style.display = 'block';

      const shareBtn = document.getElementById('h2h-share-btn');
      if(shareBtn){
        shareBtn.addEventListener('click', function(){
          const url = window.location.origin + window.location.pathname + '?h2h=' + mode + '&a=' + encodeURIComponent(shareKey(mode, a)) + '&b=' + encodeURIComponent(shareKey(mode, b));
          navigator.clipboard.writeText(url).then(function(){
            shareBtn.textContent = 'Copied!';
            setTimeout(function(){ shareBtn.textContent = 'Copy challenge link'; }, 1500);
          });
        });
      }
    }

    btnChapters.addEventListener('click', function(){ if(mode === 'chapters') return; mode = 'chapters'; setActiveBtn(btnChapters, btnOrgs); refreshOptions(); });
    btnOrgs.addEventListener('click', function(){ if(mode === 'orgs') return; mode = 'orgs'; setActiveBtn(btnOrgs, btnChapters); refreshOptions(); });
    selA.addEventListener('change', renderComparison);
    selB.addEventListener('change', renderComparison);

    // If someone opened a shared "?h2h=chapters&a=...&b=..." challenge link,
    // switch to the right mode and preselect both sides automatically.
    (async function loadFromShareLink(){
      const params = new URLSearchParams(window.location.search);
      const h2hMode = params.get('h2h');
      const aKey = params.get('a'), bKey = params.get('b');
      if(!h2hMode || !aKey || !bKey) { refreshOptions(); return; }
      mode = (h2hMode === 'orgs') ? 'orgs' : 'chapters';
      setActiveBtn(mode === 'orgs' ? btnOrgs : btnChapters, mode === 'orgs' ? btnChapters : btnOrgs);
      const rows = mode === 'chapters' ? await loadChapters() : await loadOrgs();
      if(rows.length === 0){ refreshOptions(); return; }
      fillSelects(rows, mode === 'chapters' ? function(r){ return r.name + (r.school ? ' (' + r.school + ')' : ''); } : function(r){ return r.org_name; });
      const idxA = rows.findIndex(function(r){ return shareKey(mode, r) === aKey; });
      const idxB = rows.findIndex(function(r){ return shareKey(mode, r) === bKey; });
      if(idxA >= 0) selA.value = String(idxA);
      if(idxB >= 0) selB.value = String(idxB);
      renderComparison();
    })();
  })();

  mqApplyGreekVisibility();
  loadGroupSection();
  loadTopGroupsBoard();
  loadTopOrgsBoard();
  loadGroupSchoolFilter();
  autoJoinFromUrl();

  // Fall Chapter Cup — season finish line for the Top Chapters/Orgs boards.
  // Ends Nov 30, 2026 11:59pm ET (end of the fall semester rush window).
  (function(){
    var el = document.getElementById('chapter-cup-countdown');
    if(!el) return;
    var target = new Date('2026-11-30T23:59:59-05:00').getTime();
    function tick(){
      var diff = target - Date.now();
      if(diff <= 0){ el.textContent = 'Ended'; clearInterval(timer); return; }
      var d = Math.floor(diff / 86400000);
      el.textContent = d + (d === 1 ? ' day left' : ' days left');
    }
    tick();
    var timer = setInterval(tick, 3600000);
  })();

  // 2026 Marqit Challenge — kickoff countdown (Nov 16, 2026, 12:00am ET)
  (function(){
    var el = document.getElementById('challenge-countdown');
    if(!el) return;
    var target = new Date('2026-11-16T00:00:00-05:00').getTime();
    function tick(){
      var now = Date.now();
      var diff = target - now;
      if(diff <= 0){
        el.textContent = 'Live now';
        clearInterval(timer);
        return;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      if(!el.querySelector('.cd-seg')){
        el.innerHTML = ['days','hrs','min','sec'].map(function(l){ return '<span class="cd-seg"><b>00</b><i>' + l + '</i></span>'; }).join('');
      }
      var segs = el.querySelectorAll('.cd-seg b');
      [d, h, m, s].forEach(function(v, i){
        var t = String(v).padStart(2, '0');
        if(segs[i].textContent !== t){
          segs[i].textContent = t;
          segs[i].classList.remove('flip'); void segs[i].offsetWidth; segs[i].classList.add('flip');
        }
      });
    }
    tick();
    var timer = setInterval(tick, 1000);
  })();

  document.querySelectorAll('.pagenav-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.pagenav-tab').forEach(function(t){ t.classList.remove('active'); });
      this.classList.add('active');
      var target = this.getAttribute('data-page');
      var targetPage = document.getElementById('page-' + target);
      if(!targetPage) return; // tab points at a page that doesn't exist -- do nothing instead of crashing
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      targetPage.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if(target === 'schedule' && typeof mqEnsureWeekScores === 'function') mqEnsureWeekScores();
    });
  });

  // ===== Schedule: key dates across sports, finance, tech, pop culture and news =====
  // Rows live in public.key_events (filled by the fetch-key-events function, plus anything added by
  // hand in the admin page). One fetch of this Monday-to-Sunday (Eastern) feeds both the "Today's key
  // events" row on Play and the Schedule page. Static and swipeable on purpose: the headline ticker
  // above is the only thing on the site that moves by itself.
  var MQ_SCHED_CATS = [['all', 'All'], ['sports', 'Sports'], ['finance', 'Finance'], ['tech', 'Tech'], ['pop_culture', 'Pop culture'], ['news', 'News']];
  var mqSched = { events: [], loaded: false, failed: false, cat: 'all', day: '', fetchedAt: 0, loading: null };

  function mqSchedEtDay(d){
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  function mqSchedAddDays(dateStr, n){
    return new Date(Date.parse(dateStr + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  }
  // The Eastern calendar day an event belongs to. All-day rows store noon UTC of their date.
  function mqSchedEventDay(ev){
    return ev.all_day ? String(ev.starts_at).slice(0, 10) : mqSchedEtDay(new Date(ev.starts_at));
  }
  function mqSchedTime(ev){
    if(ev.all_day) return 'All day';
    return new Date(ev.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function mqSchedWeekDays(){
    var monday = getWeekStart(), out = [];
    for(var i = 0; i < 7; i++) out.push(mqSchedAddDays(monday, i));
    return out;
  }
  // All-day items first (earnings, releases), then by start time; bigger events first within a tie.
  function mqSchedSort(list){
    return list.slice().sort(function(a, b){
      if(a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      if(a.starts_at !== b.starts_at) return a.starts_at < b.starts_at ? -1 : 1;
      if(a.importance !== b.importance) return b.importance - a.importance;
      return a.title < b.title ? -1 : 1;
    });
  }

  function loadSchedule(force){
    if(mqSched.loading) return mqSched.loading;
    if(!force && mqSched.loaded && (Date.now() - mqSched.fetchedAt) < 60000) return Promise.resolve();
    var days = mqSchedWeekDays();
    mqSched.loading = (async function(){
      try{
        var res = await sb.from('key_events')
          .select('id, category, title, subtitle, league, starts_at, all_day, importance, status, url, question_id, external_id')
          .gte('starts_at', mqSchedAddDays(days[0], -1) + 'T00:00:00Z')
          .lte('starts_at', mqSchedAddDays(days[6], 2) + 'T00:00:00Z')
          .order('starts_at', { ascending: true })
          .limit(500);
        if(res.error) throw res.error;
        var inWeek = {};
        days.forEach(function(d){ inWeek[d] = true; });
        mqSched.events = (res.data || []).filter(function(ev){ return inWeek[mqSchedEventDay(ev)]; });
        mqSched.loaded = true;
        mqSched.failed = false;
      }catch(e){
        if(!mqSched.loaded) mqSched.failed = true; // keep showing the last good data if a refresh fails
      }
      mqSched.fetchedAt = Date.now();
      mqSched.loading = null;
      renderSchedToday();
      renderSchedPage();
    })();
    return mqSched.loading;
  }

  function mqSchedTagsHtml(ev, clickable){
    var out = '';
    if(ev.question_id) out += clickable
      ? '<button type="button" class="sched-pick">Play this one ›</button>'
      : '<span class="sched-pick">On today’s board</span>';
    if(ev.status === 'postponed') out += '<span class="sched-flag">Postponed</span>';
    return out;
  }

  // ESPN-style scoreboard strip: one full-width band of boxed cells, grouped by league, that swipes
  // sideways. Sports titles are stored as "Away at Home" (or "Home vs Away" for soccer), so a game
  // becomes a two-team cell; anything else (earnings, releases, awards) becomes a one-title cell.
  // The feed has no scores or logos yet, so cells show the matchup, start time and venue.
  function mqSchedTeams(ev){
    if(ev.category !== 'sports') return null;
    var m = /^(.+?)\s+(?:at|vs\.?|@)\s+(.+)$/i.exec(ev.title || '');
    return m ? [m[1].trim(), m[2].trim()] : null;
  }

  // Team nicknames to the short codes ESPN uses (WSH, SF, CLE, TB), per league so that "Giants" or
  // "Panthers" resolve correctly. A team with no match simply shows its full name.
  var MQ_TEAM_ABBR = {
    NFL: { cardinals:'ARI', falcons:'ATL', ravens:'BAL', bills:'BUF', panthers:'CAR', bears:'CHI', bengals:'CIN', browns:'CLE', cowboys:'DAL', broncos:'DEN', lions:'DET', packers:'GB', texans:'HOU', colts:'IND', jaguars:'JAX', chiefs:'KC', raiders:'LV', chargers:'LAC', rams:'LAR', dolphins:'MIA', vikings:'MIN', patriots:'NE', saints:'NO', giants:'NYG', jets:'NYJ', eagles:'PHI', steelers:'PIT', '49ers':'SF', seahawks:'SEA', buccaneers:'TB', titans:'TEN', commanders:'WSH' },
    MLB: { diamondbacks:'ARI', braves:'ATL', orioles:'BAL', 'red sox':'BOS', cubs:'CHC', 'white sox':'CWS', reds:'CIN', guardians:'CLE', rockies:'COL', tigers:'DET', astros:'HOU', royals:'KC', angels:'LAA', dodgers:'LAD', marlins:'MIA', brewers:'MIL', twins:'MIN', mets:'NYM', yankees:'NYY', athletics:'ATH', phillies:'PHI', pirates:'PIT', padres:'SD', giants:'SF', mariners:'SEA', cardinals:'STL', rays:'TB', rangers:'TEX', 'blue jays':'TOR', nationals:'WSH' },
    NBA: { hawks:'ATL', celtics:'BOS', nets:'BKN', hornets:'CHA', bulls:'CHI', cavaliers:'CLE', mavericks:'DAL', nuggets:'DEN', pistons:'DET', warriors:'GS', rockets:'HOU', pacers:'IND', clippers:'LAC', lakers:'LAL', grizzlies:'MEM', heat:'MIA', bucks:'MIL', timberwolves:'MIN', pelicans:'NO', knicks:'NY', thunder:'OKC', magic:'ORL', '76ers':'PHI', suns:'PHX', 'trail blazers':'POR', kings:'SAC', spurs:'SA', raptors:'TOR', jazz:'UTAH', wizards:'WSH' },
    NHL: { ducks:'ANA', bruins:'BOS', sabres:'BUF', flames:'CGY', hurricanes:'CAR', blackhawks:'CHI', avalanche:'COL', 'blue jackets':'CBJ', stars:'DAL', 'red wings':'DET', oilers:'EDM', panthers:'FLA', kings:'LA', wild:'MIN', canadiens:'MTL', predators:'NSH', devils:'NJ', islanders:'NYI', rangers:'NYR', senators:'OTT', flyers:'PHI', penguins:'PIT', sharks:'SJ', kraken:'SEA', blues:'STL', lightning:'TB', 'maple leafs':'TOR', mammoth:'UTA', 'utah hockey club':'UTA', canucks:'VAN', 'golden knights':'VGK', capitals:'WSH', jets:'WPG' }
  };
  function mqTeamAbbr(league, name){
    var map = MQ_TEAM_ABBR[String(league || '').toUpperCase()];
    if(!map) return null;
    var n = String(name || '').toLowerCase().trim();
    for(var k in map){
      if(!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if(n === k) return map[k];
      var at = n.length - k.length;
      if(at > 0 && n.slice(at) === k && n.charAt(at - 1) === ' ') return map[k];
    }
    return null;
  }
  function mqTeamRowHtml(league, name){
    var abbr = mqTeamAbbr(league, name);
    return abbr
      ? '<div class="sstrip-team" title="' + escapeHtml(name) + '"><b>' + escapeHtml(abbr) + '</b></div>'
      : '<div class="sstrip-team long" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div>';
  }

  // ---- Live scores / records / TV network (Supabase function "scoreboard", ESPN public feed).
  // Optional: if it fails, cells just keep showing time + teams. No logos: a plain round badge instead.
  var mqScore = { games: [], at: 0, busy: false, byDay: {} };
  // Accents are stripped first, so "Fenerbahçe" and ESPN's "Fenerbahce" count as the same team.
  function mqNormTeam(n){ return String(n || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, '').trim(); }
  function mqSameTeam(a, b){
    a = mqNormTeam(a); b = mqNormTeam(b);
    if(!a || !b) return false;
    if(a === b) return true;
    return a.split(' ').pop() === b.split(' ').pop() && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0 || a.split(' ')[0] === b.split(' ')[0]);
  }
  var MQ_LEAGUE_ALIAS = { 'champions league': 'UCL', 'premier league': 'EPL' };
  function mqLeagueKey(l){ l = String(l || ''); return MQ_LEAGUE_ALIAS[l.toLowerCase()] || l; }
  function mqAllGames(){
    var out = mqScore.games.slice();
    Object.keys(mqScore.byDay).forEach(function(k){ (mqScore.byDay[k].games || []).forEach(function(g){ out.push(g); }); });
    return out;
  }
  function mqGameFor(ev, teams){
    var all = mqAllGames();
    if(!teams || !all.length) return null;
    var t0 = new Date(ev.starts_at).getTime();
    for(var i = 0; i < all.length; i++){
      var g = all[i];
      if(g.league !== mqLeagueKey(ev.league)) continue;
      if(Math.abs(new Date(g.start).getTime() - t0) > 6 * 3600000) continue;
      // Either order: "A vs B" lists the home team first, "A at B" lists the away team first.
      if((mqSameTeam(g.away.name, teams[0]) && mqSameTeam(g.home.name, teams[1])) || (mqSameTeam(g.away.name, teams[1]) && mqSameTeam(g.home.name, teams[0]))) return g;
    }
    return null;
  }
  // Badge color: the team's primary color, or its alternate when the primary is too dark to see on the dark bar.
  function mqLum(h){
    var n = parseInt(h.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function(v){ v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function mqTeamColor(side){
    var c = [side.color, side.alt].filter(function(x){ return x && mqLum(x) > .035; })[0];
    return c || '#4B5160';
  }
  // The jersey number of the team's top player (NFL: the passing leader), shown in the team-colored circle.
  function mqLeadNum(side){
    var l = (side.leaders || []).filter(function(x){ return x.num; })[0];
    return l ? String(l.num).slice(0, 2) : '';
  }
  // Team logo (ESPN's own artwork, from the same feed as the scores). Drawn over the letters, which stay as the fallback.
  function mqLogoImg(side){
    var u = String((side && side.logo) || '');
    if(!/^https:\/\/a\.espncdn\.com\/i\/teamlogos\/[a-z0-9\/_\-.]+\.png$/i.test(u)) return '';
    return '<img class="mq-tlg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="' + escapeHtml(u) + '" onload="this.parentNode.classList.add(\'has-logo\')" onerror="this.remove()">';
  }
  function mqBadgeStyle(side){
    var c = mqTeamColor(side);
    return 'background:' + c + ';color:' + (mqLum(c) > .4 ? '#10131A' : '#fff');
  }
  function mqLiveRowHtml(side, winning, showScore){
    var right = showScore && side.score != null ? side.score : (side.record || '');
    return '<div class="sstrip-team live' + (winning === false ? ' lost' : '') + '" title="' + escapeHtml(side.name) + '">' +
      '<i class="sstrip-badge mq-lg-host" aria-hidden="true" style="' + mqBadgeStyle(side) + '"><u>' + escapeHtml(side.abbr.charAt(0)) + '</u>' + mqLogoImg(side) + '</i>' +
      (side.rank ? '<em class="sstrip-rk">' + side.rank + '</em>' : '') +
      '<b>' + escapeHtml(side.abbr) + '</b><span class="sstrip-rec' + (showScore && side.score != null ? ' score' : '') + '">' + escapeHtml(right) + '</span></div>';
  }
  function mqLoadScores(){
    if(mqScore.busy || Date.now() - mqScore.at < 25000) return;
    mqScore.busy = true;
    fetch(SUPABASE_URL + '/functions/v1/scoreboard').then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
      mqScore.busy = false; mqScore.at = Date.now();
      if(!d || !d.games) return;
      mqScore.games = d.games;
      try{ renderSchedToday(); }catch(e){}
      try{ var pg = document.getElementById('page-schedule'); if(pg && pg.offsetParent) renderSchedPage(); }catch(e){}
    }).catch(function(){ mqScore.busy = false; mqScore.at = Date.now(); });
  }
  setInterval(function(){ if(!document.hidden && mqSched.loaded) mqLoadScores(); }, 30000);

  // Every game for each day of the week (Schedule page only): fills the page with all the sports,
  // not just the handful the schedule table marks as marquee, and gives each its team colors.
  var mqSynth = {};
  function mqEnsureWeekScores(){
    if(!mqSched.loaded) return;
    var days = mqSchedWeekDays();
    days.forEach(function(d){
      var k = d.replace(/-/g, ''), c = mqScore.byDay[k];
      if(c && (c.busy || Date.now() - c.at < 300000)) return;
      mqScore.byDay[k] = { busy: true, at: Date.now(), games: c ? c.games : [] };
      fetch(SUPABASE_URL + '/functions/v1/scoreboard?dates=' + k).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
        .then(function(d2){
          mqScore.byDay[k] = { busy: false, at: Date.now(), games: d2 && d2.games ? d2.games : (c ? c.games : []) };
          try{ renderSchedPage(); }catch(e){}
        });
    });
  }
  // The schedule table's events for a day, plus any ESPN game it left out (shown as ordinary events).
  function mqSchedDayEvents(day){
    var list = mqSched.events.filter(function(ev){ return mqSchedEventDay(ev) === day; });
    var seen = {};
    list.forEach(function(ev){
      if(ev.category !== 'sports') return;
      var g = mqGameFor(ev, mqSchedTeams(ev));
      if(g) seen[g.league + ':' + g.away.id + '@' + g.home.id] = true;
    });
    // Games for the day come from the per-day scoreboard cache and, for today, also from the
    // ribbon's own scoreboard fetch, so the top strip never depends on the schedule page having loaded.
    var bd = mqScore.byDay[day.replace(/-/g, '')];
    var feed = (bd ? bd.games : []).concat(day === getETDateInfo().dateStr ? (mqScore.games || []) : []);
    feed.forEach(function(g){
      if(mqSchedEtDay(new Date(g.start)) !== day) return;
      var key = g.league + ':' + g.away.id + '@' + g.home.id;
      if(seen[key]) return;
      seen[key] = true;
      var id = 'g:' + key;
      mqSynth[id] = mqSynth[id] || { id: id, category: 'sports', title: g.away.name + ' at ' + g.home.name, subtitle: g.network || null,
        league: g.league, starts_at: g.start, all_day: false, importance: 1, status: 'scheduled', url: null, question_id: null, synth: true };
      list.push(mqSynth[id]);
    });
    return list;
  }

  // Price + daily change for the earnings cells in the ribbon (Supabase function "stock-chart", Yahoo Finance).
  var mqQuotes = {};
  function mqQuoteFor(sym){ return mqQuotes[sym] && mqQuotes[sym].d; }
  function mqLoadQuotes(list){
    var changed = false, todo = [];
    list.forEach(function(ev){
      if(ev.category !== 'finance' || !ev.league) return;
      var q = mqQuotes[ev.league];
      if(q && (q.busy || Date.now() - q.at < 300000)) return;
      if(todo.length < 8) todo.push(ev.league);
    });
    todo.forEach(function(sym){
      var prev = mqQuotes[sym] && mqQuotes[sym].d;
      mqQuotes[sym] = { busy: true, at: Date.now(), d: prev };
      fetch(SUPABASE_URL + '/functions/v1/stock-chart?symbol=' + encodeURIComponent(sym) + '&range=1d')
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
        .then(function(d){
          mqQuotes[sym] = { busy: false, at: Date.now(), d: d && d.points ? { last: d.last, prev: d.prevClose } : prev };
          try{ renderSchedToday(true); }catch(e){}
          try{ var pg = document.getElementById('page-schedule'); if(pg && pg.offsetParent) renderSchedPage(); }catch(e){}
        });
    });
  }
  function mqQuoteHtml(sym){
    var q = mqQuoteFor(sym);
    if(!q || !q.prev) return '<div class="sstrip-quote"></div>';
    var ch = q.last - q.prev, pc = ch / q.prev * 100;
    return '<div class="sstrip-quote ' + (ch >= 0 ? 'up' : 'down') + '"><b>$' + q.last.toFixed(2) + '</b><span>' + (ch >= 0 ? '▲' : '▼') + ' ' + Math.abs(pc).toFixed(2) + '%</span></div>';
  }

  function mqSchedCellHtml(ev, clickable){
    var teams = mqSchedTeams(ev), g = mqGameFor(ev, teams), status = mqSchedTime(ev), net = '';
    var body;
    if(g){
      var started = g.state !== 'pre', hs = parseInt(g.home.score, 10), as = parseInt(g.away.score, 10);
      var done = g.state === 'post', tie = hs === as;
      body = '<div class="sstrip-teams">' +
        mqLiveRowHtml(g.away, done && !tie ? as > hs : null, started) + mqLiveRowHtml(g.home, done && !tie ? hs > as : null, started) + '</div>';
      if(g.state === 'in') status = g.detail || 'Live';
      else if(done) status = g.detail || 'Final';
      net = g.network || '';
    } else {
      body = teams
        ? '<div class="sstrip-teams">' + mqTeamRowHtml(ev.league, teams[0]) + mqTeamRowHtml(ev.league, teams[1]) + '</div>'
        : '<div class="sstrip-title">' + escapeHtml(ev.title) + '</div>';
    }
    var tags = mqSchedTagsHtml(ev, clickable);
    var side = net || ev.subtitle;
    if(ev.category === 'finance' && ev.league && clickable === false){
      // The group header already says "Earnings", so the cell shows the timing instead of repeating it.
      status = /before/i.test(ev.subtitle || '') ? 'Before open' : /after/i.test(ev.subtitle || '') ? 'After close' : (ev.subtitle || 'Earnings');
      side = '';
      body = '<div class="sstrip-title one">' + escapeHtml(ev.title.replace(/ earnings$/i, '')) + '</div>' + mqQuoteHtml(ev.league);
    }
    var canOpen = (ev.category === 'finance' && ev.league) || (ev.category === 'sports' && teams) || mqIsMedia(ev);
    var bandStyle = g ? ' style="--ca:' + mqTeamColor(g.away) + ';--cb:' + mqTeamColor(g.home) + '"' : '';
    var isArt = mqIsMedia(ev), isAlbum = isArt && /^album$/i.test(ev.league || '');
    return '<div data-cat="' + escapeHtml(ev.category || '') + '" class="sstrip-cell' + (ev.question_id ? ' has-q' : '') + (g && g.state === 'in' ? ' is-live' : '') + (canOpen ? ' is-click' : '') + (isArt ? ' has-art' : '') + '"' +
      (canOpen ? ' data-ev="' + escapeHtml(String(ev.id)) + '" role="button" tabindex="0"' : '') + '>' +
      (isArt ? '<span class="sstrip-art' + (isAlbum ? ' sq' : '') + '" data-art="' + escapeHtml(String(ev.id)) + '"></span>' : '') +
      '<div class="sstrip-time"><span>' + escapeHtml(status) + '</span>' +
        (side ? '<span class="sstrip-sub">' + escapeHtml(side) + '</span>' : '') + '</div>' +
      body +
      (tags ? '<div class="sstrip-tags">' + tags + '</div>' : '') +
    '</div>';
  }


  // ---- Click a ribbon cell: sports -> score, records, season numbers; earnings -> price chart.
  var MQ_STAT_LABELS = { avgPointsFor: 'Points per game', avgPointsAgainst: 'Allowed per game', differential: 'Point differential',
    winPercent: 'Win %', pointsFor: 'Points for', pointsAgainst: 'Points against' };
  function mqPanelClose(){ var m = document.getElementById('mq-evpanel'); if(m) m.remove(); document.body.classList.remove('mq-evopen'); }
  function mqPanelOpen(inner){
    mqPanelClose();
    var m = document.createElement('div');
    m.id = 'mq-evpanel'; m.className = 'evp-back';
    m.innerHTML = '<div class="evp" role="dialog" aria-modal="true"><button type="button" class="evp-x" aria-label="Close">&times;</button>' + inner + '</div>';
    m.addEventListener('click', function(e){ if(e.target === m || e.target.closest('.evp-x')) mqPanelClose(); });
    document.body.appendChild(m); document.body.classList.add('mq-evopen');
    return m.querySelector('.evp');
  }
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') mqPanelClose(); });

  function mqWinPct(rec){
    var n = String(rec || '').split('-').map(function(x){ return parseInt(x, 10); });
    if(n.length < 2 || n.some(isNaN)) return null;
    var w = n[0], l = n[1], t = n[2] || 0, tot = w + l + t;
    if(!tot) return null;
    return (w + t / 2) / tot;
  }
  function mqFmtNum(v, dec){ return isNaN(v) ? '' : (dec === 'pct' ? (v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, '')) : String(v)); }
  // One comparison row: away value | label | home value, with a thin bar for each side.
  function mqCmpRow(label, a, b, o){
    o = o || {};
    var na = parseFloat(a), nb = parseFloat(b), bars = '', wa = false, wb = false;
    if(o.bar && !isNaN(na) && !isNaN(nb) && na >= 0 && nb >= 0 && na + nb > 0){
      var pa = na / (na + nb) * 100, pb = 100 - pa;
      wa = o.low ? na < nb : na > nb; wb = o.low ? nb < na : nb > na;
      bars = '<div class="cmp-bars"><i class="' + (wa ? 'win' : '') + '" style="width:' + pa.toFixed(1) + '%"></i><i class="' + (wb ? 'win' : '') + '" style="width:' + pb.toFixed(1) + '%"></i></div>';
    }
    return '<div class="cmp-row"><span class="cmp-v' + (wa ? ' win' : '') + '">' + escapeHtml(a == null ? '–' : a) + '</span><span class="cmp-l">' + escapeHtml(label) + '</span>' +
      '<span class="cmp-v r' + (wb ? ' win' : '') + '">' + escapeHtml(b == null ? '–' : b) + '</span>' + bars + '</div>';
  }
  function mqStat(d, key){ var x = (d && d.stats || []).filter(function(r){ return r.label === key; })[0]; return x ? x.value : null; }
  function mqCompareHtml(a, b){
    if(!a || a.error || !b || b.error) return '<p class="evp-muted">Season numbers aren’t available right now.</p>';
    var rows = [];
    rows.push(mqCmpRow('Record', a.record, b.record));
    if(a.standing || b.standing) rows.push(mqCmpRow('Standing', a.standing, b.standing));
    rows.push(mqCmpRow('Home', a.home, b.home));
    rows.push(mqCmpRow('Road', a.road, b.road));
    var pa = mqWinPct(a.record), pb = mqWinPct(b.record);
    if(pa != null && pb != null) rows.push(mqCmpRow('Win %', mqFmtNum(pa, 'pct'), mqFmtNum(pb, 'pct'), { bar: true }));
    [['avgPointsFor', 'Points per game', false], ['avgPointsAgainst', 'Allowed per game', true]].forEach(function(k){
      var x = mqStat(a, k[0]), y = mqStat(b, k[0]);
      if(x != null && y != null) rows.push(mqCmpRow(k[1], x, y, { bar: true, low: k[2] }));
    });
    var da = mqStat(a, 'differential'), db = mqStat(b, 'differential');
    if(da != null && db != null) rows.push(mqCmpRow('Point differential', da, db));
    return '<div class="cmp">' + rows.join('') + '</div>';
  }
  var MQ_SPORT = { NFL: 'football', NBA: 'basketball', WNBA: 'basketball', NHL: 'hockey', MLB: 'baseball' };
  function mqInitials(l){
    var p = String(l.full || l.name || '').replace(/\b(jr|sr|ii|iii|iv)\.?$/i, '').trim().split(/\s+/).filter(Boolean);
    if(!p.length) return '?';
    var a = p[0].replace(/[^A-Za-z\u00C0-\u024F]/g, '').charAt(0), b = p.length > 1 ? p[p.length - 1].replace(/[^A-Za-z\u00C0-\u024F]/g, '').charAt(0) : '';
    return (a + b).toUpperCase() || '?';
  }
  function mqPlayerAttr(l, team, league){
    var sp = MQ_SPORT[String(league || '').toUpperCase()];
    var hs = /^https:\/\/a\.espncdn\.com\/i\/headshots\//.test(l.hs || '') ? ' data-ph="' + escapeHtml(l.hs) + '"' : '';
    return (sp && l.full) ? ' data-pn="' + escapeHtml(l.full) + '" data-pt="' + escapeHtml(team || '') + '" data-ps="' + sp + '"' + hs : '';
  }
  // Swap the jersey-number circle for the player's ESPN headshot (one player, same framing for everyone).
  // The headshot link comes with the leaders data (field hs). No headshot available: the badge stays.
  function mqPlayerPhotos(root){
    if(!root) return;
    [].forEach.call(root.querySelectorAll('.kp[data-pn]'), function(k){
      var src = k.getAttribute('data-ph');
      if(!/^https:\/\/a\.espncdn\.com\/i\/headshots\//.test(src || '')) return;
      var num = k.querySelector('.kp-num');
      if(!num) return;
      var e = new Image();
      e.onload = function(){
        e.onload = null;
        if(!k.isConnected || k.querySelector('.kp-ph')) return;
        e.className = 'kp-ph'; e.alt = ''; e.referrerPolicy = 'no-referrer';
        num.replaceWith(e);
      };
      e.src = src;
    });
  }
  function mqKeyPlayersHtml(g){
    var rows = [], seen = {};
    (g.away.leaders || []).forEach(function(la){
      if(seen[la.label]) return; seen[la.label] = 1;
      var lb = (g.home.leaders || []).filter(function(x){ return x.label === la.label; })[0];
      if(!lb) return;
      function who(l, side, cls){
        return '<div class="kp ' + cls + '"' + mqPlayerAttr(l, side.name, g.league) + '><i class="kp-num" style="' + mqBadgeStyle(side) + '">' + escapeHtml(mqInitials(l)) + '</i>' +
          '<span class="kp-t"><b>' + escapeHtml(l.name) + (l.pos ? ' <small>' + escapeHtml(l.pos) + '</small>' : '') + '</b><em>' + escapeHtml(l.line) + '</em></span></div>';
      }
      rows.push('<div class="kp-row">' + who(la, g.away, 'a') + '<span class="cmp-l">' + escapeHtml(la.label) + '</span>' + who(lb, g.home, 'h') + '</div>');
    });
    return rows.length ? '<div class="kp-head">Team leaders</div><div class="kp-list">' + rows.slice(0, 3).join('') + '</div>' : '';
  }
  // ===== Live game detail: line score, team stats, player stats, recent plays. Refreshes while the panel is open. =====
  var MQ_COLS = { forwards: ['G', 'A', 'S', '+/-', 'TOI'], defenses: ['G', 'A', 'S', '+/-', 'TOI'], goalies: ['SA', 'SV', 'SV%'],
    passing: ['C/ATT', 'YDS', 'TD', 'INT'], rushing: ['CAR', 'YDS', 'AVG', 'TD'], receiving: ['REC', 'YDS', 'TD'], batting: ['AB', 'R', 'H', 'RBI'], pitching: ['IP', 'H', 'ER', 'K'] };
  var MQ_CAT = { defenses: 'Defense', goalies: 'Goalies', forwards: 'Forwards' };
  function mqLiveTable(grp){
    var pref = MQ_COLS[String(grp.cat).toLowerCase()] || ['MIN', 'PTS', 'REB', 'AST', 'FG'];
    var idx = pref.map(function(l){ return grp.labels.indexOf(l); }).filter(function(i){ return i >= 0; });
    if(idx.length < 3) idx = grp.labels.slice(0, 5).map(function(_, i){ return i; });
    var name = MQ_CAT[String(grp.cat).toLowerCase()] || (grp.cat ? grp.cat.charAt(0).toUpperCase() + grp.cat.slice(1) : 'Players');
    return '<table class="lv-tbl"><thead><tr><th>' + escapeHtml(name) + '</th>' + idx.map(function(i){ return '<th>' + escapeHtml(grp.labels[i]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      grp.rows.map(function(r){
        return '<tr><td>' + escapeHtml(r.name) + (r.pos ? ' <small>' + escapeHtml(r.pos) + '</small>' : '') + '</td>' + idx.map(function(i){ return '<td>' + escapeHtml(r.stats[i] == null ? '' : r.stats[i]) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function mqLiveHtml(d, pick){
    var out = '', a = d.away, h = d.home;
    if(a && h && ((a.lines || []).length || (h.lines || []).length)){
      var n = Math.max((a.lines || []).length, (h.lines || []).length), hdr = '';
      for(var i = 0; i < n; i++) hdr += '<th>' + (i + 1) + '</th>';
      var row = function(t){ var c = ''; for(var i = 0; i < n; i++) c += '<td>' + escapeHtml((t.lines || [])[i] == null ? '' : t.lines[i]) + '</td>'; return '<tr><td>' + escapeHtml(t.abbr) + '</td>' + c + '<td class="t">' + escapeHtml(t.score == null ? '' : t.score) + '</td></tr>'; };
      out += '<table class="lv-line"><thead><tr><th></th>' + hdr + '<th class="t">T</th></tr></thead><tbody>' + row(a) + row(h) + '</tbody></table>';
    }
    if(d.teamStats && d.teamStats.length){
      out += '<div class="kp-head">Team stats</div><div class="cmp">' + d.teamStats.map(function(s){ return mqCmpRow(s.label, s.away, s.home, { bar: /^[\d.]+%?$/.test(s.away) && /^[\d.]+%?$/.test(s.home) }); }).join('') + '</div>';
    }
    var pl = d.players || {}, side = pick === 'home' ? 'home' : 'away', groups = pl[side] || [];
    if((pl.away || []).length || (pl.home || []).length){
      out += '<div class="kp-head">Players</div><div class="lv-tabs"><button type="button" data-side="away" class="' + (side === 'away' ? 'on' : '') + '">' + escapeHtml(a ? a.name : 'Away') + '</button><button type="button" data-side="home" class="' + (side === 'home' ? 'on' : '') + '">' + escapeHtml(h ? h.name : 'Home') + '</button></div>' +
        (groups.length ? groups.map(mqLiveTable).join('') : '<p class="evp-muted">No player stats yet.</p>');
    }
    if(d.plays && d.plays.length){
      out += '<div class="kp-head">Latest plays</div><ul class="lv-plays">' + d.plays.map(function(p){
        return '<li class="' + (p.score ? 'score' : '') + '"><b>' + escapeHtml(p.t) + '</b><span>' + escapeHtml(p.text) + '</span></li>';
      }).join('') + '</ul>';
    }
    return out || '<p class="evp-muted">Live stats will show up here once the game gets going.</p>';
  }
  function mqLiveStart(el, g){
    var box = el.querySelector('#lvp'), pick = 'away', last = null;
    if(!box) return;
    function paint(){ if(last) box.innerHTML = mqLiveHtml(last, pick); }
    box.addEventListener('click', function(e){
      var b = e.target.closest('.lv-tabs button'); if(!b) return;
      pick = b.getAttribute('data-side'); paint();
    });
    function tick(){
      if(!el.isConnected) return;
      fetch(SUPABASE_URL + '/functions/v1/scoreboard?game=' + encodeURIComponent(g.league + ':' + g.id)).then(function(r){ return r.json(); }).catch(function(){ return null; }).then(function(d){
        if(!el.isConnected) return;
        if(!d || d.error){ if(!last) box.innerHTML = '<p class="evp-muted">Live stats aren’t available right now.</p>'; }
        else {
          last = d; paint();
          var sc = el.querySelectorAll('.gh-sc'); if(sc.length > 1 && d.away && d.home){ sc[0].textContent = d.away.score; sc[1].textContent = d.home.score; }
          var stt = el.querySelector('.gh-status'); if(stt) stt.textContent = d.detail || stt.textContent;
        }
        if(d && d.state === 'in') setTimeout(tick, 15000);
      });
    }
    tick();
  }

  function mqOpenGamePanel(ev){
    var teams = mqSchedTeams(ev), g = mqGameFor(ev, teams);
    var status = g ? (g.state === 'pre' ? mqSchedTime(ev) : (g.detail || '')) : mqSchedTime(ev);
    var net = (g && g.network) || ev.subtitle || '';
    var away = g ? g.away : { name: teams[0], abbr: mqTeamAbbr(ev.league, teams[0]) || teams[0], score: null, record: null };
    var home = g ? g.home : { name: teams[1], abbr: mqTeamAbbr(ev.league, teams[1]) || teams[1], score: null, record: null };
    var show = g && g.state !== 'pre';
    function side(t, cls){
      return '<div class="gh-team ' + cls + '" style="--tc:' + mqTeamColor(t) + '"><b class="gh-abbr">' + escapeHtml(t.abbr) + '</b><span class="gh-name">' + escapeHtml(t.name) + '</span>' +
        (t.record ? '<span class="gh-rec">' + escapeHtml(t.record) + '</span>' : '') + '</div>';
    }
    var mid = show
      ? '<div class="gh-mid"><b class="gh-sc">' + escapeHtml(away.score) + '</b><span class="gh-dash">–</span><b class="gh-sc">' + escapeHtml(home.score) + '</b></div>'
      : '<div class="gh-mid"><span class="gh-at">at</span></div>';
    // Plain-language description shown for every game, so a panel never opens empty.
    function blurb(){
      var ar = away.record ? ' (' + away.record + ')' : '', hr = home.record ? ' (' + home.record + ')' : '', t = mqSchedTime(ev), parts = [];
      if(g && g.state === 'in') parts.push(escapeHtml(away.name + ar) + ' and ' + escapeHtml(home.name + hr) + ' are playing now in the ' + escapeHtml(ev.league) + '.');
      else if(g && g.state === 'post') parts.push(escapeHtml(away.name + ar) + ' played ' + escapeHtml(home.name + hr) + ' in the ' + escapeHtml(ev.league) + '.');
      else parts.push(escapeHtml(away.name + ar) + ' visit ' + escapeHtml(home.name + hr) + ' in the ' + escapeHtml(ev.league) + (t ? ', scheduled for ' + escapeHtml(t) : '') + '.');
      var pa = mqWinPct(away.record), ph = mqWinPct(home.record);
      if(pa != null && ph != null && Math.abs(pa - ph) >= 0.05) parts.push(escapeHtml(pa > ph ? away.name : home.name) + ' comes in with the better record.');
      if(net && g && g.state !== 'post') parts.push('Watch on ' + escapeHtml(net) + '.');
      return '<p class="evp-desc">' + parts.join(' ') + '</p>';
    }
    var el = mqPanelOpen('<div class="evp-bar"></div><div class="evp-kicker">' + escapeHtml(ev.league) + (net ? ' · ' + escapeHtml(net) : '') + '</div>' +
      '<div class="gh">' + side(away, 'a') + mid + side(home, 'h') + '</div>' +
      '<div class="gh-status' + (g && g.state === 'in' ? ' live' : '') + '">' + escapeHtml(status) + '</div>' +
      (g && g.state !== 'pre' && g.id ? '<div class="lvp" id="lvp"><p class="evp-muted">Loading live stats…</p></div>' : '') +
      '<div class="evp-body">' + blurb() + (g ? '<p class="evp-muted">Loading season numbers…</p>' : '') + '</div>');
    if(!g && !teams) return;
    if(g && g.state !== 'pre' && g.id) mqLiveStart(el, g);
    var get = function(t){
      return fetch(SUPABASE_URL + '/functions/v1/scoreboard?team=' + encodeURIComponent(ev.league + ':' + t.id))
        .then(function(r){ return r.json(); }).catch(function(){ return null; });
    };
    // Not on today's scoreboard feed? Look the teams up by name so the season numbers still load.
    var sidesP = g ? Promise.resolve([g.away, g.home]) : Promise.all([0, 1].map(function(i){
      return fetch(SUPABASE_URL + '/functions/v1/team-id?league=' + encodeURIComponent(ev.league) + '&name=' + encodeURIComponent(teams[i]))
        .then(function(r){ return r.json(); }).catch(function(){ return null; }).then(function(d){ return { id: d && d.id, name: teams[i] }; });
    }));
    sidesP.then(function(sides){
      return Promise.all(sides.map(function(t){ return t && t.id ? get(t) : Promise.resolve(null); }));
    }).then(function(r){
      var body = el.querySelector('.evp-body');
      if(!body || !body.isConnected) return;
      var okA = r[0] && !r[0].error, okB = r[1] && !r[1].error;
      if(okA && !away.record && r[0].record) away.record = r[0].record;
      if(okB && !home.record && r[1].record) home.record = r[1].record;
      var kg = g ? g : { league: ev.league, away: { name: away.name }, home: { name: home.name } };
      var kgAway = Object.assign({}, kg.away), kgHome = Object.assign({}, kg.home);
      if(okA && !(kgAway.leaders || []).length){ kgAway.leaders = r[0].leaders; kgAway.color = kgAway.color || r[0].color; kgAway.alt = kgAway.alt || r[0].alt; }
      if(okB && !(kgHome.leaders || []).length){ kgHome.leaders = r[1].leaders; kgHome.color = kgHome.color || r[1].color; kgHome.alt = kgHome.alt || r[1].alt; }
      kg = Object.assign({}, kg, { away: kgAway, home: kgHome });
      body.innerHTML = blurb() + mqKeyPlayersHtml(kg) + (okA && okB ? mqCompareHtml(r[0], r[1]) : '');
      mqPlayerPhotos(body);
    });
  }

  // ---- Click a movie, TV or album cell: release info, cast with photos, scores, box office (media-details function).
  function mqIsMedia(ev){
    return ev && ev.category === 'pop_culture' && /^(movie|tv|album)$/i.test(String(ev.league || ''));
  }
  var MQ_MEDIA = {};
  function mqMediaUrl(ev){
    var kind = String(ev.league).toLowerCase();
    if(kind === 'album') return SUPABASE_URL + '/functions/v1/media-details?kind=album&title=' + encodeURIComponent(ev.title || '');
    var m = /^(movie|tv):(\d+)$/.exec(String(ev.external_id || '')) || /themoviedb\.org\/(movie|tv)\/(\d+)/.exec(String(ev.url || ''));
    return m ? SUPABASE_URL + '/functions/v1/media-details?kind=' + m[1] + '&id=' + m[2] : null;
  }
  function mqMediaGet(ev){
    var url = mqMediaUrl(ev);
    if(!url) return Promise.resolve(null);
    if(MQ_MEDIA[url] && Date.now() - MQ_MEDIA[url].at < 600000) return MQ_MEDIA[url].p;
    var p = fetch(url).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
      .then(function(d){ if(!d || d.error){ delete MQ_MEDIA[url]; return null; } return d; });
    MQ_MEDIA[url] = { at: Date.now(), p: p };
    return p;
  }
  function mqSafeImg(u){ return /^https:\/\/([a-z0-9-]+\.)*(tmdb\.org|dzcdn\.net)\//i.test(u || '') ? u : ''; }
  function mqSafeLink(u){ return /^https:\/\/(www\.)?(themoviedb\.org|youtube\.com|deezer\.com)\//i.test(u || '') ? u : ''; }
  function mqMediaDate(s){
    if(!s) return '';
    var d = new Date(String(s).slice(0, 10) + 'T12:00:00Z');
    return isNaN(d) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function mqRunTime(min){
    if(!min) return '';
    return min >= 60 ? Math.floor(min / 60) + 'h' + (min % 60 ? ' ' + (min % 60) + 'm' : '') : min + 'm';
  }
  function mqMediaHtml(d){
    var out = '', link = mqSafeLink(d.link), poster = mqSafeImg(d.cover || d.poster);
    var facts = [];
    if(d.kind === 'album'){
      if(d.found === false) return '<p class="evp-muted">This album isn’t listed with our music source yet. Check back on release day.</p>';
      if(d.releaseDate) facts.push(mqMediaDate(d.releaseDate));
      if(d.label) facts.push(d.label);
      if(d.tracks) facts.push(d.tracks + ' tracks');
      if(d.durationSec) facts.push(mqRunTime(Math.round(d.durationSec / 60)));
      out += '<div class="mdp-head">' + (poster ? '<img class="mdp-cover sq" src="' + escapeHtml(poster) + '" alt="" referrerpolicy="no-referrer">' : '') +
        '<div class="mdp-meta">' +
          (d.artist ? '<div class="mdp-artist">' + (mqSafeImg(d.artistPhoto) ? '<img src="' + escapeHtml(mqSafeImg(d.artistPhoto)) + '" alt="" referrerpolicy="no-referrer">' : '') + '<b>' + escapeHtml(d.artist) + '</b></div>' : '') +
          (facts.length ? '<div class="mdp-facts">' + facts.map(function(f){ return '<span>' + escapeHtml(f) + '</span>'; }).join('') + '</div>' : '') +
          ((d.genres || []).length ? '<div class="mdp-genres">' + d.genres.map(escapeHtml).join(' · ') + '</div>' : '') +
        '</div></div>';
      var astats = [];
      if(d.chart && d.chart.position) astats.push(['Deezer top albums', '#' + d.chart.position, d.chart.position <= 10 ? 'good' : '']);
      if(d.fans) astats.push(['Deezer fans', d.fans >= 1e6 ? (d.fans / 1e6).toFixed(1) + 'M' : d.fans >= 1e3 ? Math.round(d.fans / 1e3) + 'K' : String(d.fans), '']);
      if(astats.length) out += '<div class="mdp-sec"><div class="fd-h">Performance</div><div class="mdp-scores">' +
        astats.map(function(t){ return '<div class="mdp-sc ' + t[2] + '"><b>' + escapeHtml(t[1]) + '</b><span>' + escapeHtml(t[0]) + '</span></div>'; }).join('') + '</div>' +
        '<p class="mdp-jw">Chart is Deezer’s worldwide top 100 albums today, not Billboard.</p></div>';
      else if(d.chart && d.chart.position === null) out += '<p class="evp-muted">Not in Deezer’s worldwide top 100 albums yet.</p>';
      if(link) out += '<a class="mdp-link" href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Listen on Deezer ›</a>';
      return out;
    }
    if(d.releaseDate) facts.push(mqMediaDate(d.releaseDate));
    if(d.rating) facts.push(d.rating);
    if(d.kind === 'movie' && d.runtime) facts.push(mqRunTime(d.runtime));
    if(d.kind === 'tv'){
      if(d.seasons) facts.push(d.seasons + (d.seasons === 1 ? ' season' : ' seasons'));
      if(d.episodes) facts.push(d.episodes + ' episodes');
    }
    if(d.network) facts.push(d.network);
    out += '<div class="mdp-head">' + (poster ? '<img class="mdp-cover" src="' + escapeHtml(poster) + '" alt="" referrerpolicy="no-referrer">' : '') +
      '<div class="mdp-meta">' +
        (facts.length ? '<div class="mdp-facts">' + facts.map(function(f){ return '<span>' + escapeHtml(f) + '</span>'; }).join('') + '</div>' : '') +
        ((d.genres || []).length ? '<div class="mdp-genres">' + d.genres.map(escapeHtml).join(' · ') + '</div>' : '') +
        (d.tagline ? '<div class="mdp-tag">' + escapeHtml(d.tagline) + '</div>' : '') +
      '</div></div>';
    if(d.overview) out += '<p class="evp-desc">' + escapeHtml(d.overview) + '</p>';

    var s = d.scores || {}, tiles = [];
    if(s.rt != null) tiles.push(['Rotten Tomatoes', s.rt + '%', s.rt >= 60 ? 'good' : 'bad']);
    if(s.metacritic != null) tiles.push(['Metacritic', String(s.metacritic), s.metacritic >= 61 ? 'good' : s.metacritic >= 40 ? 'mid' : 'bad']);
    if(s.imdb != null) tiles.push(['IMDb', s.imdb.toFixed(1), '']);
    if(s.tmdb) tiles.push(['Viewer score', s.tmdb.avg.toFixed(1), '']);
    if(tiles.length) out += '<div class="mdp-sec"><div class="fd-h">Scores</div><div class="mdp-scores">' +
      tiles.map(function(t){ return '<div class="mdp-sc ' + t[2] + '"><b>' + escapeHtml(t[1]) + '</b><span>' + escapeHtml(t[0]) + '</span></div>'; }).join('') + '</div></div>';
    else if(d.kind === 'movie' || d.kind === 'tv') out += '<p class="evp-muted">Review scores show up here once critics weigh in.</p>';

    var m = d.money;
    if(m){
      var rows = [['Domestic total', m.domesticTotal], ['Worldwide total', m.worldwideTotal], ['Budget', m.budget]].filter(function(r){ return r[1]; });
      if(rows.length) out += '<div class="mdp-sec"><div class="fd-h">Box office</div><dl class="mdp-dl">' +
        rows.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd>' + mqMoney(r[1]) + '</dd></div>'; }).join('') + '</dl></div>';
    } else if(d.kind === 'movie'){
      out += '<p class="evp-muted">No box office reported yet. Opening-weekend numbers usually come in on Monday.</p>';
    }

    var w = d.watch;
    if(w){
      var wrow = function(label, arr){
        return (arr || []).length ? '<div class="mdp-wr"><span>' + label + '</span><div>' + arr.map(function(n){ return '<em>' + escapeHtml(n) + '</em>'; }).join('') + '</div></div>' : '';
      };
      var wl = /^https:\/\/www\.themoviedb\.org\//.test(w.link || '') ? w.link : '';
      out += '<div class="mdp-sec"><div class="fd-h">Where to watch</div>' + wrow('Stream', w.stream) + wrow('Rent', w.rent) + wrow('Buy', w.buy) +
        '<p class="mdp-jw">Streaming data from JustWatch' + (wl ? ' · <a href="' + escapeHtml(wl) + '" target="_blank" rel="noopener noreferrer">See all options</a>' : '') + '</p></div>';
    } else if(d.kind === 'movie' && d.status === 'Released'){
      out += '<p class="evp-muted">No streaming or rental options listed yet.</p>';
    }

    if((d.cast || []).length) out += '<div class="mdp-sec"><div class="fd-h">Top cast</div><div class="mdp-cast">' +
      d.cast.map(function(c){
        var ph = mqSafeImg(c.photo);
        return '<div class="mdp-c"><span class="mdp-ph">' + (ph ? '<img src="' + escapeHtml(ph) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<i>' + escapeHtml(mqInitials({ name: c.name })) + '</i>') + '</span>' +
          '<b>' + escapeHtml(c.name) + '</b>' + (c.character ? '<em>' + escapeHtml(c.character) + '</em>' : '') + '</div>';
      }).join('') + '</div></div>';

    var trailer = mqSafeLink(d.trailer);
    if(trailer || link) out += '<div class="mdp-links">' + (trailer ? '<a href="' + escapeHtml(trailer) + '" target="_blank" rel="noopener noreferrer">Watch trailer ›</a>' : '') +
      (link ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">More details ›</a>' : '') + '</div>';
    return out;
  }
  function mqOpenMediaPanel(ev){
    var kind = String(ev.league).toLowerCase();
    var kicker = (kind === 'tv' ? 'TV series' : kind === 'album' ? 'Album' : 'Movie') + ' · ' + escapeHtml(mqSchedTime(ev) === 'All day' ? (ev.subtitle || 'Out today') : mqSchedTime(ev));
    var foot = kind === 'album'
      ? 'Album details and chart from Deezer.'
      : 'Film and TV details from TMDB, review scores and box office from OMDb. This product uses the TMDB API but is not endorsed or certified by TMDB.';
    var el = mqPanelOpen('<div class="evp-bar"></div><div class="evp-kicker">' + kicker + '</div>' +
      '<h3 class="evp-title">' + escapeHtml(kind === 'album' ? String(ev.title).replace(/^.*?:\s+/, '') : ev.title) + '</h3>' +
      '<div class="evp-body mdp" id="mdp"><div class="fd-sk"><i></i><i></i><i></i></div></div>' +
      '<p class="evp-foot">' + foot + '</p>');
    mqMediaGet(ev).then(function(d){
      var box = el.querySelector('#mdp'); if(!box || !box.isConnected) return;
      if(d){ box.innerHTML = mqMediaHtml(d); return; }
      var u = mqSafeLink(ev.url);
      box.innerHTML = '<p class="evp-muted">Couldn’t load the details right now. Try again in a minute.</p>' +
        (u ? '<a class="mdp-link" href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer">More details ›</a>' : '');
    });
  }

  // Analyst and valuation numbers are fetched ahead of time (the table does it for every row), so the panel opens already filled in.
  var MQ_FUND = {};
  function mqFundGet(sym){
    sym = String(sym).toUpperCase();
    if(MQ_FUND[sym] && Date.now() - MQ_FUND[sym].at < 600000) return MQ_FUND[sym].p;
    var p = fetch(SUPABASE_URL + '/functions/v1/stock-details?symbol=' + encodeURIComponent(sym))
      .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
      .then(function(d){ if(!d || d.error){ delete MQ_FUND[sym]; return null; } return d; });
    MQ_FUND[sym] = { at: Date.now(), p: p };
    return p;
  }
  // Company leaders: [Wikipedia company name, CEO, founders ('|' separated), optional CEO label]. A face only shows when an openly licensed photo of that exact person exists; otherwise initials.
  var MQ_LEAD = {"AAPL":["Apple","John Ternus","Steve Jobs|Steve Wozniak"],"MSFT":["Microsoft","Satya Nadella","Bill Gates|Paul Allen"],"NVDA":["NVIDIA","Jensen Huang","Jensen Huang|Chris Malachowsky"],"AVGO":["Broadcom","Hock Tan","Henry Samueli"],"ORCL":["Oracle","Clay Magouyrk","Larry Ellison","Co-CEO"],"CRM":["Salesforce","Marc Benioff","Marc Benioff|Parker Harris"],"ADBE":["Adobe","Shantanu Narayen","John Warnock|Charles Geschke"],"AMD":["AMD","Lisa Su","Jerry Sanders"],"CSCO":["Cisco","Chuck Robbins","Sandy Lerner|Leonard Bosack"],"IBM":["IBM","Arvind Krishna",""],"INTU":["Intuit","Sasan Goodarzi","Scott Cook"],"QCOM":["Qualcomm","Cristiano Amon","Irwin Jacobs|Andrew Viterbi"],"TXN":["Texas Instruments","Haviv Ilan",""],"NOW":["ServiceNow","Bill McDermott","Fred Luddy"],"AMAT":["Applied Materials","Gary Dickerson",""],"MU":["Micron","Sanjay Mehrotra",""],"LRCX":["Lam Research","Tim Archer","David Lam"],"PANW":["Palo Alto Networks","Nikesh Arora","Nir Zuk"],"ANET":["Arista","Jayshree Ullal","Andy Bechtolsheim|David Cheriton"],"KLAC":["KLA","Rick Wallace",""],"INTC":["Intel","Lip-Bu Tan","Gordon Moore|Robert Noyce"],"ACN":["Accenture","Julie Sweet",""],"TSM":["TSMC","C. C. Wei","Morris Chang"],"ASML":["ASML","Christophe Fouquet",""],"ARM":["Arm","Rene Haas","Hermann Hauser"],"MRVL":["Marvell","Matt Murphy","Sehat Sutardja"],"DELL":["Dell","Michael Dell","Michael Dell"],"SMCI":["Super Micro","Charles Liang","Charles Liang"],"VRT":["Vertiv","Giordano Albertazzi",""],"CRWV":["CoreWeave","Michael Intrator","Michael Intrator|Brian Venturo"],"CEG":["Constellation Energy","Joe Dominguez",""],"VST":["Vistra","Jim Burke",""],"PLTR":["Palantir","Alex Karp","Peter Thiel|Alex Karp|Joe Lonsdale"],"APP":["AppLovin","Adam Foroughi","Adam Foroughi|John Krystynak"],"CRWD":["CrowdStrike","George Kurtz","George Kurtz|Dmitri Alperovitch"],"SNOW":["Snowflake","Sridhar Ramaswamy","Benoit Dageville"],"DDOG":["Datadog","Olivier Pomel","Olivier Pomel|Alexis Le-Quoc"],"WDAY":["Workday","Aneel Bhusri","Aneel Bhusri|Dave Duffield"],"ADSK":["Autodesk","Andrew Anagnost","John Walker"],"TEAM":["Atlassian","Mike Cannon-Brookes","Mike Cannon-Brookes|Scott Farquhar"],"JPM":["JPMorgan Chase","Jamie Dimon",""],"V":["Visa","Ryan McInerney","Dee Hock"],"MA":["Mastercard","Michael Miebach",""],"BAC":["Bank of America","Brian Moynihan","A. P. Giannini"],"WFC":["Wells Fargo","Charlie Scharf",""],"GS":["Goldman Sachs","David Solomon",""],"MS":["Morgan Stanley","Ted Pick",""],"AXP":["American Express","Stephen Squeri",""],"C":["Citigroup","Jane Fraser","Sandy Weill"],"BLK":["BlackRock","Larry Fink","Larry Fink"],"SCHW":["Charles Schwab","Rick Wurster","Charles R. Schwab"],"SPGI":["S&P Global","Martina Cheung",""],"PGR":["Progressive","Tricia Griffith","Peter Lewis"],"BX":["Blackstone","Stephen Schwarzman","Stephen Schwarzman|Peter G. Peterson"],"LLY":["Eli Lilly","Dave Ricks","Eli Lilly"],"UNH":["UnitedHealth","Stephen Hemsley","Richard Burke"],"JNJ":["Johnson & Johnson","Joaquin Duato",""],"ABBV":["AbbVie","Rob Michael",""],"MRK":["Merck","Rob Davis",""],"TMO":["Thermo Fisher","Marc Casper",""],"ABT":["Abbott","Robert Ford",""],"ISRG":["Intuitive Surgical","Dave Rosa","Fred Moll"],"AMGN":["Amgen","Bob Bradway",""],"PFE":["Pfizer","Albert Bourla",""],"DHR":["Danaher","Julie Sawyer Montgomery","Steven Rales|Mitchell Rales"],"BSX":["Boston Scientific","Mike Mahoney","John Abele|Pete Nicholas"],"GILD":["Gilead","Daniel O'Day","Michael Riordan"],"VRTX":["Vertex","Reshma Kewalramani","Joshua Boger"],"AMZN":["Amazon","Andy Jassy","Jeff Bezos"],"TSLA":["Tesla","Elon Musk","Martin Eberhard|Marc Tarpenning"],"HD":["Home Depot","Ted Decker","Bernie Marcus|Arthur Blank"],"MCD":["McDonald's","Chris Kempczinski","Ray Kroc"],"BKNG":["Booking Holdings","Glenn Fogel",""],"LOW":["Lowe's","Marvin Ellison",""],"TJX":["TJX","Ernie Herrman",""],"NKE":["Nike","Elliott Hill","Phil Knight|Bill Bowerman"],"SBUX":["Starbucks","Brian Niccol","Howard Schultz"],"MELI":["MercadoLibre","Ariel Szarfsztejn","Marcos Galperin"],"ABNB":["Airbnb","Brian Chesky","Brian Chesky|Joe Gebbia|Nathan Blecharczyk"],"CMG":["Chipotle","Scott Boatwright","Steve Ells"],"ORLY":["O'Reilly Automotive","Brad Beckham",""],"GM":["General Motors","Mary Barra","William C. Durant"],"F":["Ford","Jim Farley","Henry Ford"],"MAR":["Marriott","Anthony Capuano","J. Willard Marriott"],"WMT":["Walmart","John Furner","Sam Walton"],"COST":["Costco","Ron Vachris","Jim Sinegal|Jeffrey Brotman"],"PG":["Procter & Gamble","Shailesh Jejurikar",""],"KO":["Coca-Cola","Henrique Braun",""],"PEP":["PepsiCo","Ramon Laguarta",""],"PM":["Philip Morris","Jacek Olczak",""],"MDLZ":["Mondelez","Dirk Van de Put",""],"MO":["Altria","Billy Gifford",""],"CL":["Colgate-Palmolive","Noel Wallace",""],"TGT":["Target","Michael Fiddelke",""],"KMB":["Kimberly-Clark","Mike Hsu",""],"KDP":["Keurig Dr Pepper","Tim Cofer",""],"GIS":["General Mills","Jeff Harmening",""],"STZ":["Constellation Brands","Nicholas Fink",""],"MNST":["Monster Beverage","Hilton Schlosberg","Rodney Sacks|Hilton Schlosberg"],"KR":["Kroger","Greg Foran",""],"HSY":["Hershey","Kirk Tanner","Milton S. Hershey"],"XOM":["ExxonMobil","Darren Woods","John D. Rockefeller"],"CVX":["Chevron","Mike Wirth",""],"COP":["ConocoPhillips","Andy O'Brien",""],"SLB":["SLB","Olivier Le Peuch",""],"EOG":["EOG Resources","Ezra Yacob",""],"WMB":["Williams Companies","Chad Zamarin",""],"PSX":["Phillips 66","Mark Lashier",""],"MPC":["Marathon Petroleum","Maryann Mannen",""],"OXY":["Occidental Petroleum","Richard Jackson","Armand Hammer"],"KMI":["Kinder Morgan","Kim Dang","Rich Kinder"],"VLO":["Valero","Lane Riggs",""],"EPD":["Enterprise Products","Randy Fowler","Dan Duncan","Co-CEO"],"GOOGL":["Alphabet","Sundar Pichai","Larry Page|Sergey Brin"],"GOOG":["Alphabet","Sundar Pichai","Larry Page|Sergey Brin"],"META":["Meta","Mark Zuckerberg","Mark Zuckerberg|Eduardo Saverin"],"NFLX":["Netflix","Ted Sarandos","Reed Hastings|Marc Randolph","Co-CEO"],"DIS":["Disney","Josh D'Amaro","Walt Disney|Roy O. Disney"],"TMUS":["T-Mobile","Srini Gopalan",""],"T":["AT&T","John Stankey",""],"VZ":["Verizon","Dan Schulman",""],"CMCSA":["Comcast","Brian Roberts","Ralph J. Roberts"],"SPOT":["Spotify","Alex Norstrom","Daniel Ek|Martin Lorentzon","Co-CEO"],"EA":["Electronic Arts","Andrew Wilson","Trip Hawkins"],"TTWO":["Take-Two","Strauss Zelnick",""],"GE":["General Electric","Larry Culp",""],"CAT":["Caterpillar","Joe Creed",""],"RTX":["RTX","Chris Calio",""],"UNP":["Union Pacific","Jim Vena",""],"BA":["Boeing","Kelly Ortberg","William Boeing"],"HON":["Honeywell","Vimal Kapur",""],"DE":["Deere","John May","John Deere"],"LMT":["Lockheed Martin","Jim Taiclet",""],"UPS":["UPS","Carol Tome","Jim Casey"],"ETN":["Eaton","Paulo Ruiz",""],"GEV":["GE Vernova","Scott Strazik",""],"ADP":["ADP","Maria Black","Henry Taub"],"WM":["Waste Management","Jim Fish","Dean Buntrock"],"NOC":["Northrop Grumman","Kathy Warden","Jack Northrop"],"UBER":["Uber","Dara Khosrowshahi","Garrett Camp|Travis Kalanick"],"PYPL":["PayPal","Enrique Lores","Max Levchin|Peter Thiel"],"SHOP":["Shopify","Tobias Lutke","Tobias Lutke"],"SNAP":["Snap","Evan Spiegel","Evan Spiegel|Bobby Murphy"],"PINS":["Pinterest","Bill Ready","Ben Silbermann|Evan Sharp"],"COIN":["Coinbase","Brian Armstrong","Brian Armstrong|Fred Ehrsam"],"HOOD":["Robinhood","Vlad Tenev","Vlad Tenev|Baiju Bhatt"],"DASH":["DoorDash","Tony Xu","Tony Xu"],"RBLX":["Roblox","David Baszucki","David Baszucki|Erik Cassel"],"RIVN":["Rivian","RJ Scaringe","RJ Scaringe"],"SOFI":["SoFi","Anthony Noto","Mike Cagney"],"LULU":["Lululemon","Heidi O'Neill","Chip Wilson"],"UAL":["United Airlines","Scott Kirby",""],"DAL":["Delta Air Lines","Ed Bastian",""],"LUV":["Southwest Airlines","Bob Jordan","Herb Kelleher|Rollin King"],"FDX":["FedEx","Raj Subramaniam","Fred Smith"],"SPCX":["SpaceX","Elon Musk","Elon Musk"]};
  var MQ_PP = {};
  function mqLead(sym){
    var r = MQ_LEAD[sym]; if(!r) return null;
    var f = r[2] ? r[2].split('|') : [];
    return { co: r[0], ceo: r[1], label: r[3] || 'CEO', founders: f };
  }
  function mqPersonPhoto(name, co){
    var k = name + '|' + co;
    return MQ_PP[k] = MQ_PP[k] || fetch(SUPABASE_URL + '/functions/v1/player-photo?kind=person&name=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(co))
      .then(function(r){ return r.json(); }).catch(function(){ return null; })
      .then(function(d){ return d && d.found && /^https:\/\/commons\.wikimedia\.org\//.test(d.photo || '') ? d : null; });
  }
  function mqPerson(name, co, role){
    return '<span class="ceo-p"><span class="ceo-ph" data-who="' + escapeHtml(name) + '" data-co="' + escapeHtml(co) + '"><i>' + escapeHtml(mqInitials({ name: name })) + '</i></span><span class="ceo-t"><b>' + escapeHtml(name) + '</b><em>' + escapeHtml(role) + '</em></span></span>';
  }
  // Everyone for a ticker: the CEO first, then founders who are not the CEO. A founder who runs the company is labelled so once.
  function mqPeople(sym, maxF){
    var L = mqLead(sym); if(!L) return [];
    var isF = L.founders.indexOf(L.ceo) >= 0;
    var out = [[L.ceo, L.co, L.label + (isF ? ' · Founder' : '')]];
    L.founders.filter(function(n){ return n !== L.ceo; }).slice(0, maxF == null ? 4 : maxF).forEach(function(n){ out.push([n, L.co, 'Founder']); });
    return out;
  }
  function mqCeoLine(sym){
    var p = mqPeople(sym); if(!p.length) return '';
    return '<div class="ceo-line" data-sym="' + sym + '">' + p.map(function(x){ return mqPerson(x[0], x[1], x[2]); }).join('') + '</div>';
  }
  function mqCeoCell(sym){
    var p = mqPeople(sym, 2); if(!p.length) return '<td class="ceo"></td>';
    return '<td class="ceo">' + p.map(function(x, i){ return mqPerson(x[0], x[1], x[2]); }).join('') + '</td>';
  }
  function mqCeoFaces(root){
    [].forEach.call(root.querySelectorAll('.ceo-ph[data-who]'), function(ph){
      var who = ph.getAttribute('data-who'), co = ph.getAttribute('data-co');
      mqPersonPhoto(who, co).then(function(d){
        if(!d || !ph.isConnected || ph.querySelector('img')) return;
        var img = new Image();
        img.onload = function(){
          if(!ph.isConnected || ph.querySelector('img')) return;
          img.alt = ''; img.referrerPolicy = 'no-referrer'; ph.innerHTML = ''; ph.appendChild(img);
          var href = /^https:\/\/commons\.wikimedia\.org\//.test(d.pageUrl || '') ? d.pageUrl : 'https://commons.wikimedia.org';
          var label = who + ': ' + (d.author || 'Wikimedia Commons') + ' · ' + (d.license || '');
          var box = document.getElementById('co-cr');
          if(box && ph.closest('.co-t')){
            if(box.querySelector('[data-s="' + who.replace(/"/g, '') + '"]')) return;
            var a = document.createElement('a'); a.setAttribute('data-s', who.replace(/"/g, '')); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.href = href; a.textContent = label; box.appendChild(a);
          } else {
            var t = ph.parentNode.querySelector('.ceo-t');
            if(t && !t.querySelector('.kp-cr')){
              var cr = document.createElement('a'); cr.className = 'kp-cr'; cr.target = '_blank'; cr.rel = 'noopener noreferrer'; cr.href = href;
              cr.textContent = 'Photo: ' + (d.author || 'Wikimedia Commons') + ' · ' + (d.license || ''); t.appendChild(cr);
            }
          }
        };
        img.src = d.photo;
      });
    });
  }
  var MQ_RANGES = [['1d', '1D'], ['3m', '3M'], ['6m', '6M'], ['ytd', 'YTD']];
  function mqOpenStockPanel(ev){
    var sym = String(ev.league).toUpperCase();
    var el = mqPanelOpen('<div class="evp-bar"></div><div class="evp-kicker">' + escapeHtml(sym) + ' · ' + escapeHtml(ev.subtitle || 'Earnings') + '</div>' +
      '<h3 class="evp-title">' + escapeHtml(ev.title.replace(/ earnings$/i, '')) + '</h3>' +
      mqCeoLine(sym) +
      '<div class="evp-price"><b id="evp-px">…</b><span id="evp-chg"></span></div>' +
      '<div class="evp-chart" id="evp-chart"><p class="evp-muted">Loading chart…</p></div>' +
      '<div class="evp-ranges">' + MQ_RANGES.map(function(r, i){ return '<button type="button" data-r="' + r[0] + '"' + (i === 0 ? ' class="on"' : '') + '>' + r[1] + '</button>'; }).join('') + '</div>' +
      '<div id="evp-fund"><div class="fd-sk"><i></i><i></i><i></i></div></div>' +
      '<p class="evp-foot">Prices from Yahoo Finance, about 15 minutes delayed. Analyst and valuation figures from Nasdaq. Not investment advice.</p>');
    var seq = 0;
    mqCeoFaces(el);
    mqFundGet(sym).then(function(d){ var box = el.querySelector('#evp-fund'); if(!box || !box.isConnected) return; if(d) box.innerHTML = mqFundHtml(d); else box.innerHTML = ''; });
    function load(range){
      var my = ++seq, box = el.querySelector('#evp-chart');
      box.innerHTML = '<p class="evp-muted">Loading chart…</p>';
      fetch(SUPABASE_URL + '/functions/v1/stock-chart?symbol=' + encodeURIComponent(sym) + '&range=' + range)
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
        .then(function(d){
          if(my !== seq || !box.isConnected) return;
          if(!d || !d.points){ box.innerHTML = '<p class="evp-muted">Couldn’t load the chart right now. Try again in a minute.</p>'; return; }
          mqDrawChart(el, box, d, range);
        });
    }
    el.querySelector('.evp-ranges').addEventListener('click', function(e){
      var b = e.target.closest('button[data-r]'); if(!b) return;
      el.querySelectorAll('.evp-ranges button').forEach(function(x){ x.classList.toggle('on', x === b); });
      load(b.getAttribute('data-r'));
    });
    load('1d');
  }
  function mqMoney(n){
    if(n == null) return '–';
    var a = Math.abs(n);
    if(a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if(a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if(a >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
    return '$' + n.toFixed(2);
  }
  function mqFundHtml(d){
    var out = '', a = d.analysts, f = function(v, suf){ return v == null ? '–' : v + (suf || ''); };
    if(a && a.count){
      var tot = a.count, bp = a.buy / tot * 100, hp = a.hold / tot * 100, sp = a.sell / tot * 100;
      var cons = String(a.consensus || '').toLowerCase();
      var cls = /buy/.test(cons) ? 'buy' : /sell/.test(cons) ? 'sell' : 'hold';
      out += '<div class="fd-sec"><div class="fd-h">Wall Street view' + (a.consensus ? '<span class="fd-badge ' + cls + '">' + escapeHtml(a.consensus) + '</span>' : '') + '</div>' +
        '<div class="fd-bar"><i class="b" style="width:' + bp + '%"></i><i class="h" style="width:' + hp + '%"></i><i class="s" style="width:' + sp + '%"></i></div>' +
        '<div class="fd-leg"><span><b>' + a.buy + '</b> Buy</span><span><b>' + a.hold + '</b> Hold</span><span><b>' + a.sell + '</b> Sell</span><em>' + tot + ' analysts</em></div>';
      var t = a.target;
      if(t && t.mean != null){
        var up = d.price ? (t.mean / d.price - 1) * 100 : null;
        var lo = t.low, hi = t.high, pos = function(v){ return hi > lo ? Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)) : 50; };
        out += '<div class="fd-tg"><div class="fd-tgt">Price target <b>$' + t.mean.toFixed(2) + '</b>' + (up != null ? '<span class="' + (up >= 0 ? 'up' : 'dn') + '">' + (up >= 0 ? '+' : '') + up.toFixed(1) + '% vs now</span>' : '') + '</div>' +
          (lo != null && hi != null ? '<div class="fd-rng"><u style="left:' + pos(t.mean) + '%"></u>' + (d.price ? '<s style="left:' + pos(d.price) + '%"></s>' : '') + '</div><div class="fd-rl"><span>Low $' + lo.toFixed(0) + '</span><span>High $' + hi.toFixed(0) + '</span></div>' : '') + '</div>';
      }
      out += '</div>';
    }
    var v = d.valuation || {}, m = d.margins || {}, cells = [
      ['Market cap', mqMoney(d.marketCap), 'Total value of all shares'],
      ['P/E ratio', f(v.pe), 'Price per $1 of yearly profit'],
      ['Forward P/E', f(v.forwardPe), 'Based on next 4 quarters expected'],
      ['EPS (TTM)', v.epsTtm == null ? '–' : '$' + v.epsTtm.toFixed(2), 'Profit per share, last 12 months'],
      ['Revenue (TTM)', mqMoney(d.revenueTtm), 'Sales, last 12 months'],
      ['52-week range', d.range52 ? '$' + d.range52[0].toFixed(0) + '–$' + d.range52[1].toFixed(0) : '–', 'Lowest and highest price'],
      ['Gross margin', f(m.gross, '%'), 'Left after cost of goods'],
      ['Operating margin', f(m.operating, '%'), 'Left after running the business'],
      ['Net margin', f(m.net, '%'), 'Left as final profit']
    ].filter(function(c){ return c[1] !== '–'; });
    if(cells.length) out += '<div class="fd-sec"><div class="fd-h">Key numbers</div><div class="fd-grid">' + cells.map(function(c){
      return '<div class="fd-c" title="' + escapeHtml(c[2]) + '"><span>' + c[0] + '</span><b>' + escapeHtml(c[1]) + '</b><small>' + escapeHtml(c[2]) + '</small></div>'; }).join('') + '</div></div>';
    return out;
  }

  // ---------- Rankings panel (standings, music charts, biggest companies) ----------
  // Team badges and company logos are trademarks, so they stay off unless this is deliberately switched on.
  var MQ_USE_LOGOS = false;
  var MQ_RK = { cache: {}, kind: 'nba' };
  var MQ_RK_TABS = [['nba','NBA'],['nfl','NFL'],['nhl','NHL'],['mlb','MLB'],['country','Country songs'],['songs','Top songs'],['artists','Artists'],['markets','Biggest companies']];
  var MQ_DOMAINS = { NVDA:'nvidia.com', AAPL:'apple.com', GOOGL:'google.com', GOOG:'google.com', MSFT:'microsoft.com', AMZN:'amazon.com', TSM:'tsmc.com', META:'meta.com', AVGO:'broadcom.com', TSLA:'tesla.com', BRK:'berkshirehathaway.com', WMT:'walmart.com', JPM:'jpmorganchase.com', LLY:'lilly.com', V:'visa.com', ORCL:'oracle.com', NFLX:'netflix.com', XOM:'exxonmobil.com', MA:'mastercard.com', COST:'costco.com', JNJ:'jnj.com', HD:'homedepot.com', PG:'pg.com', BAC:'bankofamerica.com', ABBV:'abbvie.com', KO:'coca-cola.com', AMD:'amd.com', PLTR:'palantir.com', SAP:'sap.com', ASML:'asml.com', BABA:'alibaba.com', NVO:'novonordisk.com', SPCX:'spacex.com' };
  function mqRkFetch(kind){
    var k = (kind === 'country' || kind === 'songs' || kind === 'artists') ? 'music' : kind;
    if(MQ_RK.cache[k] && Date.now() - MQ_RK.cache[k].at < 300000) return Promise.resolve(MQ_RK.cache[k].d);
    return fetch(SUPABASE_URL + '/functions/v1/rankings?v=4&kind=' + k).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
      .then(function(d){ if(d && !d.error) MQ_RK.cache[k] = { at: Date.now(), d: d }; return d && !d.error ? d : null; });
  }
  function mqRkConf(kind, g){
    var n = String(g.name || '');
    if(kind === 'nhl') return /atlantic|metropolitan/i.test(n) ? 'Eastern Conference' : 'Western Conference';
    if(g.conf) return String(g.conf).replace(/^East$/i, 'Eastern Conference').replace(/^West$/i, 'Western Conference');
    var m = n.match(/^(AFC|NFC|American League|National League)/i); return m ? m[1] : '';
  }
  function mqRkLogo(sym, name){
    var d = MQ_DOMAINS[String(sym).toUpperCase()], ch = escapeHtml(String(name || sym).charAt(0));
    return '<span class="rk-logo">' + (d && MQ_USE_LOGOS ? '<img src="https://www.google.com/s2/favicons?sz=128&domain=' + d + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<i>' + ch + '</i></span>';
  }
  // Team mark: the badge picture when we have one, otherwise a team-colored circle with the abbreviation.
  function mqRkTeamMark(r, big){
    return '<span class="rk-dot mq-lg-host' + (big ? ' big' : '') + '" style="' + mqBadgeStyle(r) + '"><u>' + escapeHtml((r.abbr || '').slice(0, 3)) + '</u>' + mqLogoImg(r) + '</span>';
  }
  function mqRkNum(v){ var n = parseFloat(String(v == null ? '' : v).replace(/[$,%\s+]/g, '')); return isNaN(n) ? null : n; }
  function mqRkWinPct(r, otl){
    var w = Number(r.w), l = Number(r.l), t = Number(r.t) || 0, o = Number(r.otl) || 0;
    if(isNaN(w) || isNaN(l)) return { v: null, txt: '' };
    var gp = w + l + t + o, v = null;
    if(!gp) return { v: null, txt: '' };
    v = otl && r.pts != null && !isNaN(Number(r.pts)) ? Number(r.pts) / (2 * gp) : (w + t / 2) / gp;
    return { v: Math.max(0, Math.min(1, v)), txt: v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, '') };
  }
  function mqRkStandings(kind, d){
    if(!d || !d.groups || !d.groups.length) return '<p class="evp-muted">Standings aren’t available right now.</p>';
    var hasT = kind === 'nfl', hasOtl = kind === 'nhl', out = '', confs = [], by = {};
    if(d.phase && /pre/i.test(d.phase)) out += '<p class="rk-note">Preseason records, the regular season hasn’t started.</p>';
    d.groups.forEach(function(g, gi){
      var conf = mqRkConf(kind, g) || '';
      if(!by[conf]){ by[conf] = { name: conf, items: [] }; confs.push(by[conf]); }
      by[conf].items.push([g, gi, conf]);
    });
    function table(g, gi, conf){
      var title = g.name && g.name !== conf && !/^(East|West)$/i.test(g.name) ? g.name : '';
      return '<div class="rk-tc">' + (title ? '<div class="rk-div">' + escapeHtml(title) + '</div>' : '') +
        '<table class="rk-t"><thead><tr><th class="n">#</th><th class="tm">Team</th><th>W</th><th>L</th>' + (hasOtl ? '<th>OTL</th><th>PTS</th>' : hasT ? '<th>T</th>' : '') + '<th>' + (kind === 'nfl' || hasOtl ? 'PCT' : 'GB') + '</th><th>Strk</th></tr></thead><tbody>' +
        g.rows.map(function(r, i){
          var tc = mqTeamColor(r), wp = mqRkWinPct(r, hasOtl);
          return '<tr class="rk-go' + (i === 0 ? ' lead' : '') + '" data-act="team" data-g="' + gi + '" data-r="' + i + '" tabindex="0" style="--tc:' + tc + '"><td class="n">' + (r.seed || i + 1) + '</td><td class="tm">' + mqRkTeamMark(r) + '<span>' + escapeHtml(r.name || r.abbr) + '</span></td><td>' + (r.w == null ? '' : r.w) + '</td><td>' + (r.l == null ? '' : r.l) + '</td>' +
            (hasOtl ? '<td>' + (r.otl == null ? '' : r.otl) + '</td><td>' + (r.pts == null ? '' : r.pts) + '</td>' : hasT ? '<td>' + (r.t == null ? '' : r.t) + '</td>' : '') +
            '<td>' + escapeHtml(String(kind === 'nfl' || hasOtl ? (r.pct == null ? wp.txt : r.pct) : (r.gb == null ? '' : r.gb))) + '</td>' +
            '<td>' + (r.strk ? '<span class="rk-s ' + (/^W/i.test(r.strk) ? 'w' : /^L/i.test(r.strk) ? 'l' : '') + '">' + escapeHtml(String(r.strk)) + '</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return out + '<div class="rk-confs">' + confs.map(function(c){
      return '<div class="rk-confcol">' + (c.name ? '<div class="rk-conf">' + escapeHtml(c.name) + '</div>' : '') + c.items.map(function(it){ return table(it[0], it[1], it[2]); }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function mqRkList(items, artist){
    if(!items || !items.length) return '<p class="evp-muted">This chart isn’t available right now.</p>';
    return '<ol class="rk-l">' + items.map(function(x, i){
      var a = x.artist || '', t = x.title || x.name || '', img = x.image || x.picture || '';
      return '<li class="rk-go" data-act="' + (artist ? 'artist' : 'song') + '" data-i="' + i + '" tabindex="0"><span class="n">' + (x.rank || i + 1) + '</span>' +
        '<span class="rk-art' + (artist ? ' round' : '') + '">' + (img ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '<i>' + escapeHtml(t.charAt(0)) + '</i></span>' +
        '<span class="m"><b>' + escapeHtml(t) + '</b>' + (artist || !a ? '' : '<em>' + escapeHtml(a) + '</em>') + '</span><span class="rk-chev">›</span></li>';
    }).join('') + '</ol>';
  }
  // Company tiles: brand-colored square with the ticker (no logos). Colors are the companies' well-known brand hues.
  var MQ_CO_COLOR = { NVDA:'#76B900', AAPL:'#8E9AA6', GOOGL:'#4285F4', GOOG:'#4285F4', MSFT:'#00A4EF', AMZN:'#FF9900', TSM:'#D4262C', META:'#0866FF', AVGO:'#CC092F', TSLA:'#E31937', SPCX:'#3A6EA5', BRK:'#6B4C9A', WMT:'#0071CE', LLY:'#D52B1E', JPM:'#117ACA', V:'#3B4BB8', XOM:'#ED1B2D', ORCL:'#F80000', MA:'#EB001B', NFLX:'#E50914', COST:'#E31837', JNJ:'#D51900', PG:'#3F6FD8', HD:'#F96302', BAC:'#E31837', ABBV:'#3B6FB6', KO:'#F40009', CVX:'#0054A4', CRM:'#00A1E0', AMD:'#ED1C24', PLTR:'#6E7681', ASML:'#00A0E1', MU:'#1D6FB8', CSCO:'#049FD9', IBM:'#1F70C1', INTC:'#0071C5', QCOM:'#3253DC', ADBE:'#EB1000', DIS:'#2A5CAA', NKE:'#F36F21', PEP:'#2A5DB0', UNH:'#2A7DE1', MRK:'#00857C', PFE:'#2E6FD0', T:'#00A8E0', VZ:'#CD040B', SHOP:'#7AB55C', UBER:'#5E6672', SAP:'#1A8FD8' };
  function mqCoColor(sym){
    var k = String(sym || '').toUpperCase();
    if(MQ_CO_COLOR[k]) return MQ_CO_COLOR[k];
    var h = 0; for(var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',48%,46%)';
  }
  var MQ_PERIODS = [['d', 'Today'], ['m3', '3M'], ['m6', '6M'], ['ytd', 'YTD'], ['y1', '1Y']];
  // Sector tabs for Biggest companies. The sectors themselves come from the rankings function (d.sectors);
  // if it doesn't send any, the tabs stay hidden and the page shows the overall top ten as before.
  var MQ_SECTOR_TABS = [['all', 'All'], ['tech', 'Technology'], ['aiinfra', 'AI infrastructure'], ['aisoft', 'AI software'], ['fin', 'Financials'], ['health', 'Healthcare'], ['disc', 'Consumer discretionary'], ['stap', 'Consumer staples'], ['energy', 'Energy'], ['comm', 'Communication'], ['ind', 'Industrials']];
  function mqRkSec(d){
    var s = MQ_RK.sec || 'all';
    return s !== 'all' && d && d.sectors && d.sectors[s] && d.sectors[s].companies && d.sectors[s].companies.length ? s : 'all';
  }
  // The companies on screen: the overall top ten, or the picked sector's top ten.
  function mqRkCoList(d){
    var s = mqRkSec(d);
    return s === 'all' ? ((d && d.companies) || []) : d.sectors[s].companies;
  }
  function mqRkPerfMissing(list){
    var have = MQ_RK.perf || {};
    return list.map(function(c){ return c.symbol; }).filter(function(s){ return !(s in have); });
  }
  function mqRkPerfLoad(list){
    var need = mqRkPerfMissing(list).slice(0, 15);
    if(!need.length) return Promise.resolve(MQ_RK.perf || null);
    return fetch(SUPABASE_URL + '/functions/v1/stock-perf?symbols=' + encodeURIComponent(need.join(','))).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
      .then(function(p){
        if(p && !p.error){
          MQ_RK.perf = MQ_RK.perf || {};
          need.forEach(function(s){ MQ_RK.perf[s] = p[s] || null; }); // a symbol the function can't price shows a dash, not a spinner
        }
        return MQ_RK.perf || null;
      });
  }
  function mqRkMarkets(d){
    if(!d || !d.companies || !d.companies.length) return '<p class="evp-muted">Market data isn’t available right now.</p>';
    var per = MQ_RK.per || 'd', perf = MQ_RK.perf || {};
    var list = mqRkCoList(d), cs = mqRkSec(d);
    var max = Math.max.apply(null, list.map(function(c){ return Number(c.cap) || 0; })) || 1;
    var secBar = d.sectors ? '<div class="co-sec" role="tablist" aria-label="Sector">' + MQ_SECTOR_TABS.filter(function(t){ return t[0] === 'all' || d.sectors[t[0]]; }).map(function(t){
      return '<button type="button" role="tab" data-sec="' + t[0] + '"' + (t[0] === cs ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' + t[1] + '</button>';
    }).join('') + '</div>' : '';
    var secCap = cs !== 'all' ? '<p class="co-sec-cap">Ten largest · ' + escapeHtml(d.sectors[cs].label || '') + '</p>' : '';
    var sw = '<div class="co-per" role="tablist">' + MQ_PERIODS.map(function(p){ return '<button type="button" data-per="' + p[0] + '"' + (p[0] === per ? ' class="on"' : '') + '>' + p[1] + '</button>'; }).join('') + '</div>';
    var head = per === 'd' ? 'Today' : (MQ_PERIODS.filter(function(p){ return p[0] === per; })[0] || [0, ''])[1];
    return secBar + secCap + sw + '<table class="rk-t co-t"><thead><tr><th>#</th><th>Company</th><th class="ceo-h">Leadership</th><th>Value</th><th>Price</th><th>' + head + '</th></tr></thead><tbody>' + list.map(function(c, i){
      var sym = String(c.symbol || ''), px = mqRkNum(c.price), col = mqCoColor(sym), pc, wait = false;
      if(per === 'd') pc = mqRkNum(c.pct);
      else { var pp = perf[sym]; if(pp && pp[per] != null) pc = Number(pp[per]); else { pc = null; wait = !(sym in perf); } }
      var up = (pc || 0) >= 0;
      var tile = '<span class="co-tile' + (sym.length > 3 ? ' sm' : '') + '" style="--bc:' + col + '">' + escapeHtml(sym.slice(0, 4)) + '</span>';
      var bar = '<span class="co-bar"><i style="width:' + Math.max(3, Math.round((Number(c.cap) || 0) / max * 100)) + '%"></i></span>';
      var ceo = mqCeoCell(sym);
      return '<tr class="rk-go" data-act="co" data-i="' + i + '" tabindex="0"><td class="n">' + c.rank + '</td><td class="t">' + tile + '<span class="co-m"><b>' + escapeHtml(c.name) + '</b>' + bar + '</span></td>' + ceo + '<td class="cap">' + escapeHtml(mqMoney(Number(c.cap))) + '</td><td>' + (px != null ? '$' + px.toFixed(2) : '') + '</td><td class="' + (up ? 'up' : 'dn') + '">' + (wait ? '<span class="co-chg wait">…</span>' : pc == null ? '<span class="co-na">–</span>' : '<span class="co-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + pc.toFixed(2) + '%</span>') + '</td></tr>';
    }).join('') + '</tbody></table><details class="co-cr"><summary>Photo credits · Wikimedia Commons</summary><div class="co-cr-list" id="co-cr"></div></details>';
  }
  // After the company table is drawn: load leaders' faces, and quietly fetch each stock's analyst numbers so opening one is instant.
  function mqRkMarketsAfter(root, d){
    mqCeoFaces(root);
    mqRkCoList(d).slice(0, 12).forEach(function(c){ mqFundGet(c.symbol); });
  }
  var MQ_RK_SRC = { nba: 'ESPN', nfl: 'ESPN', nhl: 'ESPN', mlb: 'ESPN', country: 'Apple iTunes charts, album art © its owners', songs: 'Apple iTunes charts, album art © its owners', artists: 'Deezer, photos © their owners', markets: 'Nasdaq' };
  function mqRkBack(el){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'rk-back'; b.textContent = '‹ Back';
    b.addEventListener('click', function(){ mqPanelClose(); });
    el.insertBefore(b, el.querySelector('.evp-bar'));
  }
  function mqOpenTeamPanel(kind, r){
    var lg = kind.toUpperCase(), tc = mqTeamColor(r);
    var el = mqPanelOpen('<div class="evp-bar" style="background:' + tc + '"></div><div class="evp-kicker">' + lg + '</div>' +
      '<div class="tp-head">' + mqRkTeamMark(r, true) + '<div><h3 class="evp-title">' + escapeHtml(r.name) + '</h3><div class="tp-sub" id="tp-sub">' + escapeHtml([r.w + '-' + r.l + (r.t && r.t !== '0' ? '-' + r.t : '') + (r.otl ? '-' + r.otl : '')].join('')) + '</div></div></div>' +
      '<div class="evp-body"><p class="evp-muted">Loading season numbers…</p></div>');
    mqRkBack(el);
    fetch(SUPABASE_URL + '/functions/v1/scoreboard?team=' + encodeURIComponent(lg + ':' + r.id)).then(function(x){ return x.json(); }).catch(function(){ return null; }).then(function(t){
      var body = el.querySelector('.evp-body'); if(!body || !body.isConnected) return;
      if(!t || t.error){ body.innerHTML = '<p class="evp-muted">Season numbers aren’t available right now.</p>'; return; }
      var sub = el.querySelector('#tp-sub'); if(sub) sub.textContent = [t.record, t.standing].filter(Boolean).join(' · ');
      var side = { color: t.color || r.color, alt: t.alt || r.alt }, out = '';
      if(t.leaders && t.leaders.length){
        out += '<div class="kp-head">Team leaders</div><div class="tp-leaders">' + t.leaders.map(function(l){
          return '<div class="kp"' + mqPlayerAttr(l, t.name, lg) + '><i class="kp-num" style="' + mqBadgeStyle(side) + '">' + escapeHtml(mqInitials(l)) + '</i><span class="kp-t"><b>' + escapeHtml(l.name) + (l.pos ? ' <small>' + escapeHtml(l.pos) + '</small>' : '') + '</b><em>' + escapeHtml(l.label + ' · ' + l.line) + '</em></span></div>';
        }).join('') + '</div>';
      }
      var cells = [['Record', t.record], ['Standing', t.standing], ['Home', t.home], ['Road', t.road]];
      (t.stats || []).forEach(function(s){ var lab = MQ_STAT_LABELS[s.label]; if(lab) cells.push([lab, s.value]); });
      cells = cells.filter(function(c){ return c[1]; });
      out += '<div class="kp-head">Season</div><div class="tp-grid">' + cells.map(function(c){ return '<div><span>' + escapeHtml(c[0]) + '</span><b>' + escapeHtml(String(c[1])) + '</b></div>'; }).join('') + '</div>';
      body.innerHTML = out; mqPlayerPhotos(body);
    });
  }
  function mqOpenSongPanel(x, label){
    var el = mqPanelOpen('<div class="evp-bar"></div><div class="evp-kicker">' + escapeHtml(label) + ' · #' + x.rank + '</div>' +
      '<div class="sg-head">' + (x.image ? '<img class="sg-art" src="' + escapeHtml(x.image) + '" alt="" referrerpolicy="no-referrer">' : '') + '<div><h3 class="evp-title">' + escapeHtml(x.title) + '</h3><div class="tp-sub">' + escapeHtml(x.artist) + '</div>' + (x.album ? '<div class="sg-album">' + escapeHtml(x.album) + '</div>' : '') + '</div></div>' +
      (/^https:\/\//.test(x.link || '') ? '<a class="sg-link" href="' + escapeHtml(x.link) + '" target="_blank" rel="noopener noreferrer">Listen on Apple Music ↗</a>' : ''));
    mqRkBack(el);
  }
  function mqOpenArtistPanel(a){
    var el = mqPanelOpen('<div class="evp-bar"></div><div class="evp-kicker">Top artists · #' + a.rank + '</div>' +
      '<div class="sg-head">' + (a.picture ? '<img class="sg-art round" src="' + escapeHtml(a.picture) + '" alt="" referrerpolicy="no-referrer">' : '') + '<div><h3 class="evp-title">' + escapeHtml(a.name) + '</h3><div class="tp-sub" id="ar-fans"></div></div></div>' +
      '<div class="evp-body"><p class="evp-muted">Loading top tracks…</p></div>');
    mqRkBack(el);
    if(!a.id) return;
    fetch(SUPABASE_URL + '/functions/v1/rankings?v=4&kind=artist&id=' + a.id).then(function(x){ return x.json(); }).catch(function(){ return null; }).then(function(d){
      var body = el.querySelector('.evp-body'); if(!body || !body.isConnected) return;
      if(!d || d.error){ body.innerHTML = ''; return; }
      var f = el.querySelector('#ar-fans'); if(f && d.fans) f.textContent = d.fans.toLocaleString('en-US') + ' fans on Deezer';
      body.innerHTML = (d.top && d.top.length ? '<div class="kp-head">Most played</div><ol class="rk-l ar-top">' + d.top.map(function(t, i){
        return '<li><span class="n">' + (i + 1) + '</span><span class="rk-art">' + (t.cover ? '<img src="' + escapeHtml(t.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><span class="m"><b>' + escapeHtml(t.title) + '</b><em>' + escapeHtml(t.album) + '</em></span></li>';
      }).join('') + '</ol>' : '') + (/^https:\/\//.test(d.link || '') ? '<a class="sg-link" href="' + escapeHtml(d.link) + '" target="_blank" rel="noopener noreferrer">Open on Deezer ↗</a>' : '');
    });
  }
  // ---- Standings | Leaders subtabs for NBA / NFL / NHL / MLB (leaders = season stat leaders with ESPN headshots) ----
  var MQ_SPORT_KINDS = { nba: 1, nfl: 1, nhl: 1, mlb: 1 };
  MQ_RK.sub = 'standings'; MQ_RK.lcat = 0;
  function mqRkLeadersFetch(k){
    var c = MQ_RK.lead = MQ_RK.lead || {};
    if(c[k] && Date.now() - c[k].at < 1800000) return Promise.resolve(c[k].d);
    return fetch(SUPABASE_URL + '/functions/v1/leaders?league=' + k).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
      .then(function(d){ if(d && !d.error && d.categories && d.categories.length) c[k] = { at: Date.now(), d: d }; return c[k] ? c[k].d : null; });
  }
  function mqRkSubBar(k){
    if(!MQ_SPORT_KINDS[k]) return '';
    var s = MQ_RK.sub || 'standings';
    return '<div class="co-per rk-sub" role="tablist"><button type="button" data-sub="standings"' + (s === 'standings' ? ' class="on"' : '') + '>Standings</button><button type="button" data-sub="leaders"' + (s === 'leaders' ? ' class="on"' : '') + '>Leaders</button></div>';
  }
  // Leaders are grouped (Passing / Rushing / Receiving ...) and shown as one card per stat: the leader big, the next four under him, the rest behind "Show more".
  var MQ_LEAD_GROUPS = {
    nba: [['Rebounding', /rebound/i], ['Playmaking', /assist|turnover/i], ['Defense', /steal|block|foul/i], ['Scoring', /./]],
    nfl: [['Passing', /pass(?!es defended)|quarterback/i], ['Rushing', /rush/i], ['Receiving', /receiv|reception/i], ['Defense', /tackle|sack|interception|passes defended/i], ['Scoring', /touchdown|total points/i], ['Kicking & punting', /./]],
    nhl: [['Goaltending', /save|against|shutout|^wins$|goalie/i], ['Scoring', /./]],
    mlb: [['Pitching', /earned run|^wins$|strikeout|saves|walks plus|quality|opponent|holds/i], ['Overall', /replacement|rating|game score/i], ['Hitting', /./]]
  };
  function mqLeadPh(l, cls){
    return '<span class="rk-ph ' + cls + '" style="--tc:' + (l.color || '#3A3F48') + '"><i>' + escapeHtml(mqInitials({ full: l.name })) + '</i>' +
      (l.hs ? '<img src="' + escapeHtml(l.hs) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</span>';
  }
  function mqLeadRow(l, first){
    return '<li class="rk-go" data-act="player" data-pid="' + escapeHtml(l.id) + '" data-pn="' + escapeHtml(l.name) + '" data-pm="' + escapeHtml([l.pos, l.team].filter(Boolean).join(' · ')) + '" data-ph="' + escapeHtml(l.hs || '') + '" tabindex="0">' +
      '<span class="n">' + l.rank + '</span>' + mqLeadPh(l, 'sm') + '<span class="m"><b>' + escapeHtml(l.name) + '</b><em>' + escapeHtml([l.pos, l.abbr].filter(Boolean).join(' · ')) + '</em></span><span class="rk-val' + (first ? ' top' : '') + '">' + escapeHtml(l.value) + '</span></li>';
  }
  function mqLeadCard(c){
    var rows = c.leaders.map(function(l, i){ return mqLeadRow(l, i === 0); });
    return '<div class="rk-card"><div class="rk-card-h">' + escapeHtml(c.label) + '</div><ol class="rk-mini">' + rows.slice(0, 5).join('') + '</ol>' +
      (rows.length > 5 ? '<details class="rk-more"><summary><span class="rk-more-open">Show top 10</span><span class="rk-more-close">Show less</span>' + mqIcon('chevronDown') + '</summary><ol class="rk-mini">' + rows.slice(5).join('') + '</ol></details>' : '') + '</div>';
  }
  // Click any leader: season stats plus status and injury report.
  function mqOpenPlayerPanel(row){
    var id = row.getAttribute('data-pid'), k = MQ_RK.kind; if(!id) return;
    var nm = row.getAttribute('data-pn') || '', meta = row.getAttribute('data-pm') || '', hs = row.getAttribute('data-ph') || '';
    var el = mqPanelOpen('<div class="evp-bar"></div><div class="evp-kicker">' + escapeHtml(k.toUpperCase()) + '</div><div class="sg-head pl-head">' +
      (/^https:\/\/a\.espncdn\.com\//.test(hs) ? '<img class="sg-art round" src="' + escapeHtml(hs) + '" alt="" referrerpolicy="no-referrer">' : '') +
      '<div><h3 class="evp-title">' + escapeHtml(nm) + '</h3><div class="tp-sub" id="pl-sub">' + escapeHtml(meta) + '</div></div></div><div class="evp-body"><p class="evp-muted">Loading stats…</p></div>');
    mqRkBack(el);
    fetch(SUPABASE_URL + '/functions/v1/athlete?league=' + encodeURIComponent(k) + '&id=' + encodeURIComponent(id)).then(function(r){ return r.json(); }).catch(function(){ return null; }).then(function(d){
      var body = el.querySelector('.evp-body'); if(!body || !body.isConnected) return;
      if(!d || d.error){ body.innerHTML = '<p class="evp-muted">Player details aren’t available right now.</p>'; return; }
      var sub = el.querySelector('#pl-sub'); if(sub) sub.textContent = [d.pos, d.team].filter(Boolean).join(' · ');
      var bio = [d.jersey ? '#' + d.jersey : '', d.age ? d.age + ' yrs' : '', d.height, d.weight, d.exp ? d.exp + ' exp' : ''].filter(Boolean).join(' · ');
      var inj = d.injuries || [], out = '';
      out += '<div class="pl-status ' + (inj.length ? 'inj' : 'ok') + '"><b>' + escapeHtml(inj.length ? inj[0].status || 'Injured' : (d.status || 'Active')) + '</b>' + (inj.length ? '' : '<span>No injuries reported</span>') + '</div>';
      inj.forEach(function(i){
        out += '<div class="pl-inj"><b>' + escapeHtml(i.status || 'Injury') + (i.detail ? ' · ' + escapeHtml(i.detail) : '') + '</b>' + (i.comment ? '<p>' + escapeHtml(i.comment) + '</p>' : '') +
          (i.returns ? '<em>Expected back ' + escapeHtml(i.returns) + '</em>' : (i.date ? '<em>Updated ' + escapeHtml(i.date) + '</em>' : '')) + '</div>';
      });
      if(bio) out += '<div class="pl-bio">' + escapeHtml(bio) + '</div>';
      if(d.stats && d.stats.length) out += '<div class="kp-head">' + escapeHtml(d.split || 'Season') + '</div><div class="tp-grid">' + d.stats.map(function(c){ return '<div><span>' + escapeHtml(c.label) + '</span><b>' + escapeHtml(c.value) + '</b></div>'; }).join('') + '</div>';
      else out += '<p class="evp-muted">Season stats aren’t available yet.</p>';
      body.innerHTML = out;
    });
  }
  function mqRkLeadersHtml(k, d){
    if(!d || !d.categories || !d.categories.length) return '<p class="evp-muted">Season leaders aren’t available right now.</p>';
    var defs = MQ_LEAD_GROUPS[k] || [['Leaders', /./]], groups = defs.map(function(g){ return { name: g[0], re: g[1], cats: [] }; });
    d.categories.forEach(function(c){ for(var i = 0; i < groups.length; i++){ if(groups[i].re.test(c.label)){ groups[i].cats.push(c); return; } } });
    return groups.filter(function(g){ return g.cats.length; }).map(function(g){
      return '<section class="rk-grp"><h4 class="rk-grp-h">' + escapeHtml(g.name) + '</h4><div class="rk-cards">' + g.cats.map(mqLeadCard).join('') + '</div></section>';
    }).join('');
  }
  // Standings & charts lives on its own page (the last nav tab). Team, song and artist details still open as a panel on top.
  var mqRkReady = false, mqRkCur = null;
  function mqRkShow(k){
    var root = document.getElementById('rk-page'); if(!root) return;
    MQ_RK.kind = k; mqRkCur = null;
    root.querySelectorAll('.rk-tabs button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-k') === k); });
    var body = root.querySelector('#rk-body'); body.innerHTML = '<p class="evp-muted">Loading…</p>';
    root.querySelector('#rk-foot').textContent = 'Source: ' + MQ_RK_SRC[k] + '. Unofficial feed, may lag. Click any row for details.';
    if(MQ_SPORT_KINDS[k] && MQ_RK.sub === 'leaders'){
      mqRkLeadersFetch(k).then(function(d){
        if(MQ_RK.kind !== k || !body.isConnected) return;
        body.innerHTML = mqRkSubBar(k) + mqRkLeadersHtml(k, d);
      });
      return;
    }
    mqRkFetch(k).then(function(d){
      if(MQ_RK.kind !== k || !body.isConnected) return;
      if(!d){ body.innerHTML = '<p class="evp-muted">Couldn’t load this right now. Try again in a minute.</p>'; return; }
      mqRkCur = d;
      if(k === 'markets') MQ_RK.per = MQ_RK.per || 'd';
      body.innerHTML = mqRkSubBar(k) + (k === 'markets' ? mqRkMarkets(d) : k === 'country' ? mqRkList(d.countrySongs) : k === 'songs' ? mqRkList(d.songs) : k === 'artists' ? mqRkList(d.artists, true) : mqRkStandings(k, d));
      if(k === 'markets'){ mqRkMarketsAfter(body, d); if(MQ_RK.per !== 'd') mqRkSetPer(MQ_RK.per); }
    });
  }
  function mqRkSetPer(p){
    var body = document.querySelector('#rk-body'), d = mqRkCur;
    if(!body || !d || MQ_RK.kind !== 'markets') return;
    var oldBar = body.querySelector('.co-sec'), barX = oldBar ? oldBar.scrollLeft : 0;
    MQ_RK.per = p; body.innerHTML = mqRkMarkets(d); mqRkMarketsAfter(body, d);
    var newBar = body.querySelector('.co-sec'); if(newBar && barX) newBar.scrollLeft = barX;
    var list = mqRkCoList(d);
    if(p !== 'd' && mqRkPerfMissing(list).length) mqRkPerfLoad(list).then(function(){
      if(MQ_RK.per === p && MQ_RK.kind === 'markets' && body.isConnected && mqRkCoList(d) === list){
        var bar = body.querySelector('.co-sec'), x = bar ? bar.scrollLeft : 0;
        body.innerHTML = mqRkMarkets(d); mqRkMarketsAfter(body, d);
        var nb = body.querySelector('.co-sec'); if(nb && x) nb.scrollLeft = x;
      }
    });
  }
  function mqRkSetSec(s){
    MQ_RK.sec = s;
    mqRkSetPer(MQ_RK.per || 'd');
  }
  function mqRkAct(row){
    var cur = mqRkCur;
    if(row && row.getAttribute('data-act') === 'player'){ mqOpenPlayerPanel(row); return; }
    if(!row || !cur) return;
    var a = row.getAttribute('data-act'), k = MQ_RK.kind, i = Number(row.getAttribute('data-i'));
    if(a === 'team') mqOpenTeamPanel(k, cur.groups[Number(row.getAttribute('data-g'))].rows[Number(row.getAttribute('data-r'))]);
    else if(a === 'co'){ var c = mqRkCoList(cur)[i]; mqOpenStockPanel({ league: c.symbol, title: c.name + ' earnings', subtitle: 'Largest companies' }); var p = document.querySelector('#mq-evpanel .evp'); if(p) mqRkBack(p); }
    else if(a === 'song') mqOpenSongPanel((k === 'country' ? cur.countrySongs : cur.songs)[i], k === 'country' ? 'Country songs' : 'Top songs');
    else if(a === 'artist') mqOpenArtistPanel(cur.artists[i]);
  }
  function mqOpenRankings(kind){
    var root = document.getElementById('rk-page'); if(!root) return;
    if(!mqRkReady){
      mqRkReady = true;
      root.querySelector('.rk-tabs').innerHTML = MQ_RK_TABS.map(function(t){ return '<button type="button" role="tab" data-k="' + t[0] + '">' + t[1] + '</button>'; }).join('');
      root.querySelector('.rk-tabs').addEventListener('click', function(e){ var b = e.target.closest('button[data-k]'); if(b) mqRkShow(b.getAttribute('data-k')); });
      root.querySelector('#rk-body').addEventListener('click', function(e){
        var sb = e.target.closest('button[data-sub]');
        if(sb){ MQ_RK.sub = sb.getAttribute('data-sub'); MQ_RK.lcat = 0; mqRkShow(MQ_RK.kind); return; }
        var lb = e.target.closest('button[data-lcat]');
        if(lb){ MQ_RK.lcat = Number(lb.getAttribute('data-lcat')) || 0; var ld = (MQ_RK.lead || {})[MQ_RK.kind]; if(ld){ var bd = root.querySelector('#rk-body'); bd.innerHTML = mqRkSubBar(MQ_RK.kind) + mqRkLeadersHtml(MQ_RK.kind, ld.d); } return; }
        var sc = e.target.closest('button[data-sec]'); if(sc){ mqRkSetSec(sc.getAttribute('data-sec')); return; }
        var pb = e.target.closest('button[data-per]'); if(pb){ mqRkSetPer(pb.getAttribute('data-per')); return; } mqRkAct(e.target.closest('.rk-go')); });
      root.querySelector('#rk-body').addEventListener('keydown', function(e){ if(e.key === 'Enter') mqRkAct(e.target.closest('.rk-go')); });
    }
    if(kind) MQ_RK.kind = kind;
    var tab = document.querySelector('.pagenav-tab[data-page="standings"]');
    if(tab && !document.getElementById('page-standings').offsetParent){ mqRkClicking = true; tab.click(); mqRkClicking = false; }
    mqRkShow(MQ_RK.kind);
  }
  var mqRkClicking = false;
  (function(){ var t = document.querySelector('.pagenav-tab[data-page="standings"]'); if(t) t.addEventListener('click', function(){ if(!mqRkClicking) mqOpenRankings(); }); })();
  window.mqOpenRankings = mqOpenRankings;
  (function(){
    function bind(id){ var b = document.getElementById(id); if(b) b.addEventListener('click', function(){ var h = document.getElementById('hamburger-menu'); if(h) h.style.display = 'none'; mqOpenRankings(); }); }
    ['hamburger-rankings-btn', 'footer-rankings-link', 'sched-rankings-link', 'home-rankings-btn', 'tabs-rankings-link'].forEach(bind);
  })();
  function mqDrawChart(el, box, d, range){
    var pts = d.points, W = 600, H = 220, pad = 8;
    var base = range === '1d' && d.prevClose ? d.prevClose : pts[0][1];
    var last = pts[pts.length - 1][1], up = last >= base;
    var lo = Math.min.apply(null, pts.map(function(p){ return p[1]; })), hi = Math.max.apply(null, pts.map(function(p){ return p[1]; }));
    if(hi === lo){ hi += 1; lo -= 1; }
    var t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    function X(t){ return pad + (t - t0) / ((t1 - t0) || 1) * (W - pad * 2); }
    function Y(v){ return pad + (hi - v) / (hi - lo) * (H - pad * 2); }
    var line = pts.map(function(p, i){ return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
    var col = up ? '#3DDC97' : '#FF6B5B';
    function fmt(v){ return '$' + v.toFixed(2); }
    function setHead(v, label){
      var ch = v - base, pc = ch / base * 100;
      el.querySelector('#evp-px').textContent = fmt(v);
      var c = el.querySelector('#evp-chg');
      c.textContent = (ch >= 0 ? '+' : '−') + Math.abs(ch).toFixed(2) + ' (' + (ch >= 0 ? '+' : '−') + Math.abs(pc).toFixed(2) + '%) ' + label;
      c.style.color = ch >= 0 ? '#3DDC97' : '#FF6B5B';
    }
    var rangeLabel = { '1d': 'today', '3m': 'past 3 months', '6m': 'past 6 months', 'ytd': 'year to date' }[range];
    setHead(last, rangeLabel);
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Price chart">' +
      '<defs><linearGradient id="evg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".30"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      [0.25, 0.5, 0.75].map(function(f){ var y = (pad + f * (H - pad * 2)).toFixed(1); return '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#262930" vector-effect="non-scaling-stroke"/>'; }).join('') +
      (range === '1d' && d.prevClose && d.prevClose > lo && d.prevClose < hi ? '<line x1="0" x2="' + W + '" y1="' + Y(d.prevClose).toFixed(1) + '" y2="' + Y(d.prevClose).toFixed(1) + '" stroke="#5A5E66" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' : '') +
      '<path d="' + line + 'L' + X(t1).toFixed(1) + ' ' + H + 'L' + X(t0).toFixed(1) + ' ' + H + 'Z" fill="url(#evg)"/>' +
      '<path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="1.75" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '<line class="evp-cur" y1="0" y2="' + H + '" stroke="#8A8E96" vector-effect="non-scaling-stroke" style="display:none"/></svg>' +
      '<i class="evp-dot" style="border-color:' + col + '"></i><div class="evp-tip" style="display:none"></div>' +
      '<div class="evp-axis"><span>' + escapeHtml(mqChartDate(t0, range)) + '</span><span>' + escapeHtml(mqChartDate(t1, range)) + '</span></div>' +
      '<div class="evp-hilo"><span>Low ' + fmt(lo) + '</span><span>High ' + fmt(hi) + '</span></div>';
    var svg = box.querySelector('svg'), cur = box.querySelector('.evp-cur'), tip = box.querySelector('.evp-tip'), dot = box.querySelector('.evp-dot');
    var pinned = false;
    function place(pt, showTip){
      var x = X(pt[0]);
      dot.style.left = (x / W * 100) + '%'; dot.style.top = (Y(pt[1]) / H * svg.clientHeight) + 'px';
      cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.style.display = showTip ? '' : 'none';
      if(showTip){
        var r = svg.getBoundingClientRect();
        tip.style.display = ''; tip.textContent = fmt(pt[1]) + ' · ' + mqChartDate(pt[0], range, true);
        tip.style.left = Math.max(0, Math.min(r.width - 170, x / W * r.width - 85)) + 'px';
        setHead(pt[1], mqChartDate(pt[0], range, true));
      } else { tip.style.display = 'none'; setHead(last, rangeLabel); }
    }
    function nearest(e){
      var r = svg.getBoundingClientRect(), cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      var t = t0 + Math.max(0, Math.min(1, cx / r.width)) * (t1 - t0), best = pts[0];
      for(var i = 0; i < pts.length; i++) if(Math.abs(pts[i][0] - t) < Math.abs(best[0] - t)) best = pts[i];
      return best;
    }
    place(pts[pts.length - 1], false);
    svg.addEventListener('mousemove', function(e){ if(!pinned) place(nearest(e), true); });
    svg.addEventListener('mouseleave', function(){ if(!pinned) place(pts[pts.length - 1], false); });
    svg.addEventListener('click', function(e){ pinned = true; box.classList.add('pinned'); place(nearest(e), true); });
    svg.addEventListener('touchstart', function(e){ pinned = true; box.classList.add('pinned'); place(nearest(e), true); }, { passive: true });
    svg.addEventListener('touchmove', function(e){ place(nearest(e), true); }, { passive: true });
    box.addEventListener('dblclick', function(){ pinned = false; box.classList.remove('pinned'); place(pts[pts.length - 1], false); });
  }
  function mqChartDate(sec, range, long){
    var d = new Date(sec * 1000);
    if(range === '1d') return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: long || range === 'ytd' ? 'numeric' : undefined, timeZone: 'America/New_York' });
  }
  function mqEventPanel(cell){
    var id = cell.getAttribute('data-ev');
    var ev = mqSched.events.filter(function(x){ return String(x.id) === id; })[0] || mqSynth[id];
    if(!ev) return;
    if(ev.category === 'finance') mqOpenStockPanel(ev); else if(mqIsMedia(ev)) mqOpenMediaPanel(ev); else mqOpenGamePanel(ev);
  }
  document.addEventListener('click', function(e){
    var c = e.target.closest('.sstrip-cell.is-click, .gm.is-click, .gc.is-click, .gx-tile.is-click');
    if(!c || e.target.closest('.sched-pick')) return;
    mqEventPanel(c);
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' && e.key !== ' ') return;
    var c = e.target.closest && e.target.closest('.sstrip-cell.is-click, .gm.is-click, .gc.is-click, .gx-tile.is-click');
    if(c){ e.preventDefault(); mqEventPanel(c); }
  });

  function mqSchedStripHtml(list, clickable, lead){
    var groups = [], byKey = {};
    // Anything live right now goes first, so its league comes first in the strip.
    function isLive(ev){ var g = mqGameFor(ev, mqSchedTeams(ev)); return !!g && g.state === 'in'; }
    var sorted = mqSchedSort(list), live = sorted.filter(isLive);
    sorted = live.concat(sorted.filter(function(ev){ return live.indexOf(ev) < 0; }));
    sorted.forEach(function(ev){
      var key = ev.category === 'finance' ? 'Earnings' : ev.league || (MQ_SCHED_CATS.filter(function(c){ return c[0] === ev.category; })[0] || [0, 'Events'])[1];
      if(!byKey[key]){ byKey[key] = { name: key, events: [] }; groups.push(byKey[key]); }
      byKey[key].events.push(ev);
    });
    var cells = groups.map(function(g){
      return '<div class="sstrip-league' + (g.name === 'Earnings' ? ' is-earn' : '') + '"><span>' + escapeHtml(g.name) + '</span></div>' +
        g.events.map(function(ev){ return mqSchedCellHtml(ev, clickable); }).join('');
    }).join('');
    return '<div class="sstrip">' +
      '<button type="button" class="sstrip-arrow prev" aria-label="Scroll left">&lsaquo;</button>' +
      '<div class="sstrip-track">' +
        (lead ? '<button type="button" class="sstrip-lead"><b>Today’s events</b><span>Full schedule ›</span></button>' : '') +
        cells + '</div>' +
      '<button type="button" class="sstrip-arrow next" aria-label="Scroll right">&rsaquo;</button>' +
    '</div>';
  }

  // Schedule page: one card per game or event, grouped by league, two columns on wide screens.
  // Schedule page, one day (ESPN-style): live games as score cards on top, then the rest in time slots.
  function mqSchedState(ev){
    var g = mqGameFor(ev, mqSchedTeams(ev));
    return { g: g, st: g ? g.state : 'pre', open: (ev.category === 'finance' && ev.league) || (ev.category === 'sports' && mqSchedTeams(ev)) || mqIsMedia(ev) };
  }
  function mqSchedClickAttrs(ev, open){
    return open ? ' data-ev="' + escapeHtml(String(ev.id)) + '" role="button" tabindex="0"' : '';
  }
  function mqSchedDot(t){ return '<i class="sr-dot" style="background:' + mqTeamColor(t) + '"></i>'; }
  // Classic scoreboard rows: status on the left, the two teams stacked with their scores, network on the right.
  var MQ_LG_NAMES = { EPL: 'Premier League', UCL: 'UEFA Champions League', MLS: 'MLS', NCAAF: 'College football', NFL: 'NFL', NBA: 'NBA', WNBA: 'WNBA', NHL: 'NHL', MLB: 'MLB' };
  function mqLgName(k){ return MQ_LG_NAMES[k] || k; }
  var MQ_ICO = {
    basketball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/>',
    football: '<ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(-35 12 12)"/><path d="M9.5 14.5l5-5M11 11.8l1.4 1.4M12.8 10l1.4 1.4M9.4 13.4L8 12M13 7.4l-1.4-1.4"/>',
    hockey: '<ellipse cx="12" cy="9.5" rx="8" ry="3.5"/><path d="M4 9.5v4.5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V9.5"/>',
    baseball: '<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5c2.5 2.5 2.5 10.5 0 13M18.5 5.5c-2.5 2.5-2.5 10.5 0 13"/>',
    soccer: '<circle cx="12" cy="12" r="9"/><path d="M12 8.6l3 2.2-1.1 3.5h-3.8L9 10.8zM12 8.6V3.2M15 10.8l5-1.6M13.9 14.3l3.2 4.2M10.1 14.3l-3.2 4.2M9 10.8L4 9.2"/>',
    finance: '<path d="M3 17l6-6 4 4 7-8M15 7h5v5"/>',
    other: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
  };
  var MQ_LG_COLOR = { NFL: '#43A863', NBA: '#F28A33', WNBA: '#E5509A', NHL: '#55B8EA', MLB: '#CC6A4C', EPL: '#8B6CF0', UCL: '#3F6FE0', MLS: '#2FB5A5', NCAAF: '#B98A3E', Earnings: '#A3B1C6' };
  function mqLgColor(k){ return MQ_LG_COLOR[k] || '#9AA0AB'; }
  MQ_ICO.star = '<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/>';
  MQ_ICO.sun = '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>';
  MQ_ICO.moon = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
  MQ_ICO.hourglass = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
  var MQ_LG_ICON = { NFL: 'football', NCAAF: 'football', NBA: 'basketball', WNBA: 'basketball', NHL: 'hockey', MLB: 'baseball', EPL: 'soccer', UCL: 'star', MLS: 'soccer', Earnings: 'finance' };
  function mqLgIcon(k){
    return '<i class="ag-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (MQ_ICO[MQ_LG_ICON[k] || 'other']) + '</svg></i>';
  }
  function mqBadge(side){
    var ab = String(side.abbr || side.name || '?').slice(0, 3);
    return '<i class="gm-bd mq-lg-host" style="' + mqBadgeStyle(side) + '" aria-hidden="true"><u>' + escapeHtml(ab) + '</u>' + mqLogoImg(side) + '</i>';
  }
  // Schedule cards: the team circle shows the head coach's photo when an openly licensed one exists; the letters stay otherwise.
  function mqCoachBadge(side){ return mqBadge(side); }
  function mqCoachFaces(){}
  function mqUntil(ev){
    var ms = new Date(ev.starts_at).getTime() - Date.now();
    if(!(ms > 0) || ms > 86400000 || ev.all_day) return '';
    var m = Math.round(ms / 60000);
    return m < 60 ? 'in ' + m + 'm' : 'in ' + Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
  }
  function mqSchedRowHtml(ev, x, showLg){
    var g = x.g, st = x.st, status, body, tail = '';
    if(g){
      var started = st !== 'pre', hs = parseInt(g.home.score, 10), as = parseInt(g.away.score, 10), done = st === 'post';
      status = st === 'in' ? (g.detail || 'Live') : done ? (/^f/i.test(g.detail || '') ? g.detail : 'Final') : mqSchedTime(ev);
      var line = function(t, lost){
        return '<div class="gm-tm' + (lost ? ' lost' : '') + '">' + mqBadge(t) + '<b>' + escapeHtml(t.name) + '</b>' + (t.rank ? '<em class="gm-rk">' + t.rank + '</em>' : '') + '<span>' +
          (started ? escapeHtml(t.score == null ? '0' : t.score) : (t.record ? '<small>' + escapeHtml(t.record) + '</small>' : '')) + '</span></div>';
      };
      body = line(g.away, done && as < hs) + line(g.home, done && hs < as);
      tail = g.network || '';
    } else if(ev.category === 'finance' && ev.league){
      status = 'All day';
      tail = mqQuoteHtml(ev.league);
      body = '<div class="gm-tm"><i class="gm-bd tick">' + escapeHtml(String(ev.league).slice(0, 4)) + '</i><b>' + escapeHtml(ev.title.replace(/ earnings$/i, '')) + '</b></div><div class="gm-sub">Earnings report · ' +
        escapeHtml(/before/i.test(ev.subtitle || '') ? 'before the open' : /after/i.test(ev.subtitle || '') ? 'after the close' : (ev.subtitle || 'time to be announced')) + '</div>';
    } else {
      var teams = mqSchedTeams(ev);
      status = mqSchedTime(ev);
      body = teams ? '<div class="gm-tm"><i class="gm-bd">' + escapeHtml(String(teams[0]).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) + '</i><b>' + escapeHtml(teams[0]) + '</b></div><div class="gm-tm"><i class="gm-bd">' + escapeHtml(String(teams[1]).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) + '</i><b>' + escapeHtml(teams[1]) + '</b></div>' : '<div class="gm-tm"><b>' + escapeHtml(ev.title) + '</b></div>';
      tail = ev.subtitle || '';
    }
    var lg = showLg ? '<small class="gm-lg" style="color:' + mqLgColor(mqSchedKey(ev)) + '">' + escapeHtml(mqLgName(mqSchedKey(ev))) + '</small>' : '';
    return '<div class="gm ' + (st === 'in' ? 'is-live' : st === 'post' ? 'is-done' : '') + (x.open ? ' is-click' : '') + '"' + mqSchedClickAttrs(ev, x.open) + '>' +
      '<span class="gm-t"><span>' + (st === 'in' ? '<i class="ag-pulse"></i>' : '') + escapeHtml(status) + '</span>' + (st === 'pre' && mqUntil(ev) ? '<em class="gm-in">' + mqUntil(ev) + '</em>' : '') + '</span><span class="gm-m">' + lg + body + '</span>' +
      '<span class="gm-n">' + (ev.question_id ? '<button type="button" class="sched-pick">Pick this one</button>' : '') + (tail ? (/^</.test(tail) ? tail : '<small>' + escapeHtml(tail) + '</small>') : '') + '</span></div>';
  }
  // Schedule, boards layout: a grid of game cards per league, live games on top, earnings split by before/after the market.
  function mqSchedCardHtml(ev, x, showLg){
    var g = x.g, st = x.st, status, body, net = '', sit = '';
    if(g){
      var started = st !== 'pre', hs = parseInt(g.home.score, 10), as = parseInt(g.away.score, 10), done = st === 'post';
      status = st === 'in' ? (g.detail || 'Live') : done ? (/^f/i.test(g.detail || '') ? g.detail : 'Final') : mqSchedTime(ev);
      var line = function(t, lost){
        return '<div class="gc-tm' + (lost ? ' lost' : '') + '">' + mqBadge(t) + '<b>' + escapeHtml(t.name) + '</b><span>' +
          (started ? escapeHtml(t.score == null ? '0' : t.score) : (t.record ? '<small>' + escapeHtml(t.record) + '</small>' : '')) + '</span></div>';
      };
      // Whoever is trailing is dimmed, live or final, so the leader reads at a glance.
      body = line(g.away, started && as < hs) + line(g.home, started && hs < as);
      net = g.network || '';
      // Live football: who has the ball, down and distance, and the last play.
      if(st === 'in' && g.sit){
        var po = String(g.sit.poss || ''), pt = po && po === String(g.home.id) ? g.home : po && po === String(g.away.id) ? g.away : null;
        var head = [pt ? (pt.abbr || pt.name) + ' ball' : '', g.sit.text || ''].filter(Boolean).join(' · ');
        sit = '<div class="gc-sit' + (g.sit.red ? ' red' : '') + '">' + (head ? '<b>' + escapeHtml(head) + '</b>' : '') + (g.sit.last ? '<span>' + escapeHtml(g.sit.last) + '</span>' : '') + '</div>';
      }
    } else {
      var teams = mqSchedTeams(ev);
      status = mqSchedTime(ev);
      body = teams
        ? [teams[0], teams[1]].map(function(n){ return '<div class="gc-tm"><i class="gm-bd">' + escapeHtml(String(n).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) + '</i><b>' + escapeHtml(n) + '</b></div>'; }).join('')
        : '<div class="gc-tm"><b>' + escapeHtml(ev.title) + '</b></div>';
      net = ev.subtitle || '';
    }
    var lgTag = showLg ? '<span class="gc-lg" style="color:' + mqLgColor(mqSchedKey(ev)) + '">' + escapeHtml(mqLgName(mqSchedKey(ev))) + '</span>' : '';
    return '<div class="gc ' + (st === 'in' ? 'is-live ' : st === 'post' ? 'is-done ' : '') + (x.open ? 'is-click' : '') + '" style="--lg:' + mqLgColor(mqSchedKey(ev)) + '"' + mqSchedClickAttrs(ev, x.open) + '>' +
      '<div class="gc-top"><span class="gc-st">' + (st === 'in' ? '<i class="ag-pulse"></i>' : '') + escapeHtml(status) + (st === 'pre' && mqUntil(ev) ? '<em>' + mqUntil(ev) + '</em>' : '') + '</span>' + lgTag + '</div>' +
      '<div class="gc-body">' + body + '</div>' + sit +
      ((net && !/^</.test(net)) || ev.question_id ? '<div class="gc-foot">' + (net ? '<small>' + escapeHtml(net) + '</small>' : '<small></small>') + (ev.question_id ? '<button type="button" class="sched-pick">Pick this one</button>' : '') + '</div>' : '') + '</div>';
  }
  // Earnings tiles pick up each company's brand hue. Tickers we don't have a hue for get a steady one
  // derived from the ticker, so the same company always looks the same.
  var MQ_EARN_EXTRA = { CMCSA:'#7B5BD6', CMCS:'#7B5BD6', LMT:'#3B7BD4', SPOT:'#1ED760', BA:'#1D5FBF', GE:'#3B9BD8', AXP:'#2E77BC', GS:'#6A9BD1', MS:'#2F7BC9', C:'#2E6FD0', WFC:'#E0483E', SBUX:'#1E9E6A', MCD:'#FFC72C', LUV:'#304CB2', DAL:'#E01933', UPS:'#B98A3E', FDX:'#7D4CC8' };
  function mqEarnColor(sym){
    var s = String(sym || '').toUpperCase();
    if(MQ_CO_COLOR[s]) return MQ_CO_COLOR[s];
    if(MQ_EARN_EXTRA[s]) return MQ_EARN_EXTRA[s];
    var h = 0; for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',58%,62%)';
  }
  function mqSchedEarnHtml(items){
    var cols = [['Before the open', [], 'sun'], ['After the close', [], 'moon'], ['Time to be announced', [], 'hourglass']];
    items.forEach(function(p){
      var ev = p[0], sub = ev.subtitle || '';
      cols[/before/i.test(sub) ? 0 : /after/i.test(sub) ? 1 : 2][1].push(ev);
    });
    var tile = function(ev){
      return '<div class="gx-tile is-click" style="--bc:' + mqEarnColor(ev.league) + '" data-ev="' + escapeHtml(String(ev.id)) + '" role="button" tabindex="0"><i class="gm-bd tick">' + escapeHtml(String(ev.league || '').slice(0, 4)) + '</i>' +
        '<span class="gx-n">' + escapeHtml(String(ev.title || '').replace(/ earnings$/i, '')) + '</span>' + mqQuoteHtml(ev.league) + '</div>';
    };
    return '<section class="gx"><h5 class="gx-h"><span>' + mqLgIcon('Earnings') + 'Earnings</span><em>' + items.length + (items.length === 1 ? ' report' : ' reports') + '</em></h5><div class="gx-cols">' +
      cols.filter(function(c){ return c[1].length; }).map(function(c){
        return '<div class="gx-col gx-' + c[2] + '"><div class="gx-ch"><span class="gx-chl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MQ_ICO[c[2]] + '</svg>' + c[0] + '</span><em>' + c[1].length + '</em></div><div class="gx-tiles">' + c[1].map(tile).join('') + '</div></div>';
      }).join('') + '</div></section>';
  }
  function mqSchedAgendaHtml(list){
    var live = [], groups = [], byKey = {};
    mqSchedSort(list).forEach(function(ev){
      var x = mqSchedState(ev), item = [ev, x];
      if(x.st === 'in') live.push(item);
      var k = mqSchedKey(ev);
      if(!byKey[k]){ byKey[k] = []; groups.push(k); }
      byKey[k].push(item);
    });
    var cards = function(l, lg){ return '<div class="gc-grid">' + l.map(function(p){ return mqSchedCardHtml(p[0], p[1], lg); }).join('') + '</div>'; };
    var out = '';
    if(live.length) out += '<section class="gx gx-live"><h5 class="gx-h"><span><i class="ag-pulse"></i>Live now</span><em>' + live.length + (live.length === 1 ? ' game' : ' games') + '</em></h5>' + cards(live, true) + '</section>';
    groups.forEach(function(k){
      if(k === 'Earnings'){ out += mqSchedEarnHtml(byKey[k]); return; }
      var l = byKey[k].filter(function(p){ return p[1].st !== 'in'; });
      if(l.length) out += '<section class="gx" style="--lg:' + mqLgColor(k) + '"><h5 class="gx-h"><span>' + mqLgIcon(k) + escapeHtml(mqLgName(k)) + '</span><em>' + l.length + (l.length === 1 ? ' game' : ' games') + '</em></h5>' + cards(l, false) + '</section>';
    });
    return '<div class="sched-boards">' + out + '</div>';
  }

  // The top strip on the Play page: every event today, in every league. It must never be thinned by
  // importance or a count cap (that is how a full Sunday used to show one game). The stored schedule
  // supplies earnings, releases and anything a question is about; the live scoreboard supplies every game.
  // Hidden only until there is something to show.
  function renderSchedToday(fromQuote){
    var box = document.getElementById('sched-today'), cards = document.getElementById('sched-today-cards');
    if(!box || !cards) return;
    var today = getETDateInfo().dateStr;
    var list = (mqSched.loaded || (mqScore.games && mqScore.games.length)) ? mqSchedSort(mqSchedDayEvents(today)) : [];
    if(!list.length && (!mqSched.loaded || mqSched.events.length === 0)){ box.style.display = 'none'; return; }
    box.style.display = '';
    var oldTrack = cards.querySelector('.sstrip-track'), keep = oldTrack ? oldTrack.scrollLeft : 0;
    cards.innerHTML = list.length
      ? mqSchedStripHtml(list, false, true)
      : '<p class="sched-empty">Nothing big today. Check the rest of the week.</p>';
    var newTrack = cards.querySelector('.sstrip-track');
    if(newTrack && keep) newTrack.scrollLeft = keep;
    mqArtFill(cards);
    if(!fromQuote){ mqLoadScores(); mqLoadQuotes(list); }
  }

  // Poster / album cover thumbnails on the movie, show and album cells of the top strip. The small image URL
  // comes from the media-details function (the same one the click panel uses) and is remembered in this
  // browser for a day, so the strip's 5-minute refresh and repeat visits make no extra requests. No picture
  // found: the thumbnail slot disappears and the cell looks like it did before.
  var MQ_ART_KEY = 'mq_art_v1';
  function mqArtLoad(){ try{ return JSON.parse(localStorage.getItem(MQ_ART_KEY) || '{}') || {}; }catch(e){ return {}; } }
  function mqArtSave(o){ try{ localStorage.setItem(MQ_ART_KEY, JSON.stringify(o)); }catch(e){} }
  function mqArtFill(root){
    var cache = mqArtLoad();
    [].forEach.call(root.querySelectorAll('.sstrip-art[data-art]'), function(span){
      var cell = span.parentNode, id = span.getAttribute('data-art');
      var ev = mqSched.events.filter(function(x){ return String(x.id) === id; })[0];
      function drop(){ if(span.parentNode){ cell.classList.remove('has-art'); span.remove(); } }
      function show(u){
        var im = new Image();
        im.onload = function(){ if(span.isConnected){ span.appendChild(im); span.classList.add('on'); } };
        im.onerror = drop;
        im.alt = ''; im.referrerPolicy = 'no-referrer'; im.decoding = 'async'; im.src = u;
      }
      if(!ev){ drop(); return; }
      var key = ev.external_id || ev.title, c = cache[key];
      if(c && Date.now() < c.exp){ c.u ? show(c.u) : drop(); return; }
      mqMediaGet(ev).then(function(d){
        var u = d ? mqSafeImg(d.thumb || d.cover || d.poster) : '';
        if(d){ cache = mqArtLoad(); cache[key] = { u: u, exp: Date.now() + (u ? 86400000 : 3600000) }; mqArtSave(cache); }
        u ? show(u) : drop();
      });
    });
  }

  function mqSchedKey(ev){
    if(ev.category === 'finance') return 'Earnings';
    if(ev.league) return ev.league;
    return (MQ_SCHED_CATS.filter(function(c){ return c[0] === ev.category; })[0] || [0, 'Events'])[1];
  }
  function renderSchedPage(){
    var chips = document.getElementById('sched-chips'), daysEl = document.getElementById('sched-days'), listEl = document.getElementById('sched-list');
    if(!chips || !daysEl || !listEl) return;
    if(mqSched.failed){
      chips.innerHTML = ''; daysEl.innerHTML = '';
      listEl.innerHTML = '<p class="sched-empty">Couldn’t load the schedule right now. Try again in a minute.</p>';
      return;
    }
    if(!mqSched.loaded) return;
    var days = mqSchedWeekDays(), today = getETDateInfo().dateStr, dayLists = {};
    days.forEach(function(d){ dayLists[d] = mqSchedDayEvents(d); });
    if(document.getElementById('page-schedule') && document.getElementById('page-schedule').offsetParent) mqEnsureWeekScores();
    if(!mqSched.day || days.indexOf(mqSched.day) < 0) mqSched.day = days.indexOf(today) >= 0 ? today : days[0];
    var sel = mqSched.day;
    // League filters for the picked day (ESPN-style): All, then each league that has a game that day.
    var counts = {}, liveN = {}, order = [];
    dayLists[sel].forEach(function(ev){
      var k = mqSchedKey(ev);
      if(!counts[k]){ counts[k] = 0; liveN[k] = 0; order.push(k); }
      counts[k]++;
      if(mqSchedState(ev).st === 'in') liveN[k]++;
    });
    var liveAll = order.reduce(function(a, k){ return a + liveN[k]; }, 0);
    var filter = mqSched.cat && counts[mqSched.cat] ? mqSched.cat : 'all';
    chips.style.display = order.length > 1 ? '' : 'none';
    chips.innerHTML = [['all', 'All']].concat(order.map(function(k){ return [k, k]; })).map(function(c){
      var isAll = c[0] === 'all', n = isAll ? dayLists[sel].length : counts[c[0]], live = isAll ? liveAll : liveN[c[0]];
      // Plain text tabs: the league name and a quiet count; a small red dot marks a league with a live game.
      return '<button type="button" class="scope-tab' + (filter === c[0] ? ' active' : '') + (live ? ' has-live' : '') + '" style="--lg:' + (isAll ? '#EEF0F4' : mqLgColor(c[0])) + '" data-cat="' + escapeHtml(c[0]) + '">' +
        '<span class="sc-name">' + escapeHtml(isAll ? 'All' : mqLgName(c[1])) + '</span>' +
        '<span class="sc-ct"' + (live ? ' title="' + live + ' live now"' : '') + '>' + n + '</span>' +
      '</button>';
    }).join('');
    var byDay = {};
    days.forEach(function(d){
      byDay[d] = dayLists[d].filter(function(ev){ return filter === 'all' || mqSchedKey(ev) === filter; });
    });
    daysEl.innerHTML = days.map(function(d){
      var dt = new Date(Date.parse(d + 'T12:00:00Z')), n = dayLists[d].length;
      return '<button type="button" class="sched-day' + (n ? ' has' : '') + (d === today ? ' today' : '') + (d < today ? ' past' : '') + (d === sel ? ' sel' : '') + '" data-day="' + d + '" aria-pressed="' + (d === sel) + '">' +
        '<b>' + (d === today ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })) + '</b><span>' + dt.getUTCDate() + '</span><em>' + (n ? n + (n === 1 ? ' game' : ' games') : 'Off') + '</em></button>';
    }).join('');
    var selLabel = new Date(Date.parse(sel + 'T12:00:00Z')).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    var scroll = listEl.querySelector('.lv-row'), keep = scroll ? scroll.scrollLeft : 0;
    listEl.innerHTML =
      (byDay[sel].length ? mqSchedAgendaHtml(byDay[sel]) : '<p class="sched-none">Nothing scheduled</p>');
    var ns = listEl.querySelector('.lv-row'); if(ns && keep) ns.scrollLeft = keep;
    mqLoadQuotes(byDay[sel]);
  }

  (function(){
    var chips = document.getElementById('sched-chips');
    if(chips) chips.addEventListener('click', function(e){
      var b = e.target.closest('.scope-tab');
      if(!b) return;
      mqSched.cat = b.getAttribute('data-cat') || 'all';
      renderSchedPage();
    });
    var daysEl = document.getElementById('sched-days');
    if(daysEl) daysEl.addEventListener('click', function(e){
      var b = e.target.closest('.sched-day');
      if(!b) return;
      mqSched.day = b.getAttribute('data-day');
      renderSchedPage();
    });
    // Show each strip's arrows only when there is more to scroll to in that direction.
    function stripState(strip){
      var t = strip.querySelector('.sstrip-track');
      if(!t) return;
      strip.classList.toggle('can-prev', t.scrollLeft > 6);
      strip.classList.toggle('can-next', t.scrollLeft + t.clientWidth < t.scrollWidth - 6);
    }
    function stripStateAll(){ document.querySelectorAll('.sstrip').forEach(stripState); }
    document.addEventListener('scroll', function(e){
      if(e.target && e.target.classList && e.target.classList.contains('sstrip-track')) stripState(e.target.parentNode);
    }, true);
    window.addEventListener('resize', stripStateAll);
    var stripObs = new MutationObserver(function(){ requestAnimationFrame(stripStateAll); });
    ['sched-list', 'sched-today-cards'].forEach(function(id){
      var host = document.getElementById(id);
      if(host) stripObs.observe(host, { childList: true });
    });
    // The "Today's events / Full schedule" cell at the left of the top ribbon opens the Schedule tab.
    document.addEventListener('click', function(e){
      if(!e.target.closest('.sstrip-lead')) return;
      var t = document.querySelector('.pagenav-tab[data-page="schedule"]');
      if(t) t.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // Arrow buttons on every strip scroll it sideways (the strip also swipes and scrolls natively).
    document.addEventListener('click', function(e){
      var a = e.target.closest('.sstrip-arrow');
      if(!a) return;
      var track = a.parentNode.querySelector('.sstrip-track');
      if(track) track.scrollBy({ left: (a.classList.contains('next') ? 1 : -1) * Math.max(240, track.clientWidth * 0.8), behavior: 'smooth' });
    });
    var listEl = document.getElementById('sched-list');
    if(listEl) listEl.addEventListener('click', function(e){
      if(!e.target.closest('.sched-pick')) return;
      var t = document.querySelector('.pagenav-tab[data-page="home"]');
      if(t) t.click();
    });
    var seeAll = document.getElementById('sched-see-all');
    if(seeAll) seeAll.addEventListener('click', function(){
      var t = document.querySelector('.pagenav-tab[data-page="schedule"]');
      if(t) t.click();
    });
    var tab = document.querySelector('.pagenav-tab[data-page="schedule"]');
    if(tab) tab.addEventListener('click', function(){
      mqSched.day = ''; // opening the tab starts on today
      loadSchedule(false);
      renderSchedPage();
    });
    loadSchedule(true);
    setInterval(function(){ if(!document.hidden) loadSchedule(true); }, 300000);
  })();

  const homeCtaChallenge = document.getElementById('home-cta-challenge');
  if(homeCtaChallenge){
    homeCtaChallenge.addEventListener('click', function(){
      document.querySelectorAll('.pagenav-tab').forEach(function(t){
        t.classList.toggle('active', t.getAttribute('data-page') === 'challenge');
      });
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('page-challenge').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      var cn = document.getElementById('chal-name'); if(cn) setTimeout(function(){ cn.focus({ preventScroll: true }); }, 350);
    });
  }

  // ---- Marqit Challenge sign-up: its own short form (name + email), separate from creating a site account ----
  (function(){
    var form = document.getElementById('challenge-signup-form'), box = document.getElementById('chal-join');
    if(!form || !box) return;
    function done(name, already){
      box.innerHTML = '<div class="chal-done"><b>' + (already ? 'You’re already on the list' : 'You’re in') + (name ? ', ' + escapeHtml(name) : '') + '.</b><span>We’ll email you before the Challenge kicks off on Nov 16.</span></div>';
    }
    var joined = null; try { joined = JSON.parse(localStorage.getItem('mq_chal_joined') || 'null'); } catch(e){}
    if(joined && joined.email){ done(joined.name, false); return; }
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = document.getElementById('chal-name').value.trim(), email = document.getElementById('chal-email').value.trim();
      var note = document.getElementById('chal-note'), btn = document.getElementById('chal-submit');
      if(!name){ note.textContent = 'Add your name.'; note.className = 'signup-note err'; return; }
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ note.textContent = 'Check your email address.'; note.className = 'signup-note err'; return; }
      btn.disabled = true; btn.textContent = 'Joining…';
      sb.rpc('challenge_signup', { p_name: name, p_email: email, p_source: 'challenge_page' }).then(function(r){
        btn.disabled = false; btn.textContent = 'Join the Challenge';
        var res = r && r.data;
        if(r.error || (res !== 'ok' && res !== 'already')){ note.textContent = res === 'bad_email' ? 'Check your email address.' : 'Something went wrong. Try again.'; note.className = 'signup-note err'; return; }
        try { localStorage.setItem('mq_chal_joined', JSON.stringify({ name: name, email: email })); } catch(e){}
        done(name, res === 'already');
      });
    });
  })();

  const navHomeLink = document.getElementById('nav-home-link');
  if(navHomeLink){
    navHomeLink.addEventListener('click', function(){
      document.querySelectorAll('.pagenav-tab').forEach(function(t){
        t.classList.toggle('active', t.getAttribute('data-page') === 'home');
      });
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('page-home').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Hamburger menu — holds About Us and Notifications
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  hamburgerBtn.addEventListener('click', function(e){
    e.stopPropagation();
    hamburgerMenu.style.display = hamburgerMenu.style.display === 'block' ? 'none' : 'block';
    if(hamburgerMenu.style.display === 'block') loadNotificationSettings();
  });
  // How to play and the Challenge are no longer top tabs; they open from the menu and the footer
  // (the tab buttons stay in the page, hidden, so every existing link into them still works).
  function mqOpenHiddenTab(page){
    var t = document.querySelector('.pagenav-tab[data-page="' + page + '"]');
    if(t) t.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  [['hamburger-how-btn', 'how'], ['hamburger-challenge-btn', 'challenge'], ['footer-how-link', 'how'], ['footer-challenge-link', 'challenge']].forEach(function(p){
    var el = document.getElementById(p[0]);
    if(el) el.addEventListener('click', function(){ hamburgerMenu.style.display = 'none'; mqOpenHiddenTab(p[1]); });
  });
  document.getElementById('hamburger-about-btn').addEventListener('click', function(){
    document.querySelectorAll('.pagenav-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
    document.getElementById('page-about').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    hamburgerMenu.style.display = 'none';
  });
  (function(){
    var fc = document.getElementById('footer-credits-link');
    if(fc) fc.addEventListener('click', function(){
      document.querySelectorAll('.pagenav-tab').forEach(function(t){ t.classList.remove('active'); });
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('page-about').style.display = 'block';
      var c = document.getElementById('about-credits'); if(c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  })();
  (function(){
    var fa = document.getElementById('footer-about-link');
    if(!fa) return;
    fa.addEventListener('click', function(){
      document.querySelectorAll('.pagenav-tab').forEach(function(t){ t.classList.remove('active'); });
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('page-about').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();
  document.addEventListener('click', function(e){
    if(hamburgerMenu.style.display === 'block' && !hamburgerMenu.contains(e.target) && e.target !== hamburgerBtn && !hamburgerBtn.contains(e.target)){
      hamburgerMenu.style.display = 'none';
    }
  });

  // ---- News safety filter ----
  // Used by both the news ticker and the News tab. Hides headlines about violence,
  // sexual crimes, terrorism, deaths, self-harm and similar. Deliberately strict:
  // hiding a harmless story is fine, showing a sensitive one is not. The server
  // (fetch-news-ticker) applies the same kind of filter before storing anything.
  var MQ_NEWS_BLOCK = new RegExp('\\b(' + [
    // sexual violence and exploitation
    'rape[ds]?', 'rapists?', 'raping', 'molest\\w*', 'pedophil\\w*', 'incest',
    'sexual(ly)?\\s+(assault\\w*|abus\\w*|misconduct|harass\\w*|violence)', 'sex\\s+traffick\\w*', 'traffick\\w*',
    // shootings, killings, murder
    'serial\\s+killers?', 'shootings?', 'shooters?', 'gunm[ae]n', 'gunfire', 'shot\\s+dead', 'shot\\s+and\\s+killed',
    'fatally\\s+shot', 'gunned\\s+down', '(was|were|been|is|being|get|gets)\\s+shot', 'shot\\s+by',
    'murder\\w*', 'homicides?', 'manslaughter', 'slain', 'slaying', 'stabb\\w*', 'killed', 'kills', 'killings?', 'killers?',
    'massacres?', 'mass\\s+casualt\\w*', 'death\\s+toll', 'deadly', 'fatal\\w*', 'found\\s+dead', 'dead\\s+bod\\w*', 'bod(y|ies)\\s+found',
    // bombings, terrorism, war violence
    'bomb\\w*', 'explosions?', 'exploded', 'terror\\w*', 'hostages?', 'behead\\w*', 'genocide', 'torture\\w*',
    'war\\s+crimes?', 'airstrikes?', 'missile\\s+strikes?',
    // self-harm, overdoses, abuse, kidnapping
    'suicid\\w*', 'self-harm', 'overdos\\w*', 'child\\s+abus\\w*', 'abus\\w*\\s+(of\\s+)?(a\\s+)?(child|children|kids?|minors?)',
    'kidnap\\w*', 'abduct\\w*', 'child\\s+endangerment', 'domestic\\s+violence', 'assault\\w*',
    // deaths and funerals of real people
    'die[sd]?', 'dead', 'deaths?', 'dying', 'passed\\s+away', 'funerals?', 'obituar\\w*', 'late\\s+(husband|wife|father|mother|son|daughter)', 'cancer', 'tumou?rs?', 'diagnos\\w*', 'chemo\\w*', 'terminal\\s+ill\\w*', 'health\\s+(battle|scare|struggles?|crisis)', 'hospital\\w*', 'sex(ual)?', 'nude', 'naked'
  ].join('|') + ')\\b', 'i');
  var MQ_NEWS_OK_PHRASES = /\b(shooting\s+(guard|percentage|star|touch|slump|form|stroke)|kill(s|ed|ing)?\s+(it|the\s+(game|show|stage|crowd|room))|die[- ]hards?)\b/gi;
  function mqNewsAllowed(headline){
    var t = String(headline || '');
    if(!t) return false;
    if(/\brehab\b/i.test(t) && /\b(death|deaths|died|dies|dead|dying)\b/i.test(t)) return false;
    return !MQ_NEWS_BLOCK.test(t.replace(MQ_NEWS_OK_PHRASES, ''));
  }

  // News ticker — reads real, already-fetched headlines from news_ticker.
  // No fabricated content: if the table is empty, the strip stays hidden.
  (function(){
    var tickerEl = document.getElementById('news-ticker');
    var trackEl = document.getElementById('news-ticker-track');
    if(!tickerEl || !trackEl) return;

    sb.from('news_ticker')
      .select('headline, source_name, article_url')
      .eq('kind', 'news')
      .order('fetched_at', { ascending: false })
      .then(function(res){
        if(res && res.error){
          // kind column not there yet: fall back to the old query
          return sb.from('news_ticker').select('headline, source_name, article_url').order('fetched_at', { ascending: false });
        }
        return res;
      })
      .then(function(res){
        var rows = ((res && res.data) ? res.data : []).filter(function(r){ return mqNewsAllowed(r.headline); });
        // Stay hidden until there's enough real content that the seamless-loop
        // technique (which duplicates the list once) doesn't visibly show the
        // same headline twice back-to-back \u2014 that's a symptom of too little
        // data, not something to paper over with a shorter list.
        if(rows.length < 6) return;

        function itemHtml(row){
          var headline = escapeHtml(mqDecodeEntities(row.headline || ''));
          var source = row.source_name || '';
          var url = row.article_url || '#';
          var domain = '';
          try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch(e){}
          var logoImg = domain
            ? '<img class="nt-logo" src="https://www.google.com/s2/favicons?sz=64&domain=' + escapeHtml(domain) + '" alt="' + escapeHtml(source) + '" onerror="this.style.display=\'none\'">'
            : '';
          return '<a class="news-ticker-item" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
            logoImg +
            headline +
            '</a>';
        }

        // Render the list twice back-to-back so the CSS animation (which
        // translates by exactly -50%) loops seamlessly with no visible seam.
        var html = rows.map(itemHtml).join('') + rows.map(itemHtml).join('');
        trackEl.innerHTML = html;
        tickerEl.classList.add('has-items');

        // Speed scales to actual content width (~70px/sec) instead of a fixed
        // duration, so it moves at a consistent, brisk pace whether there are
        // 6 headlines or 20 \u2014 a fixed duration would crawl with less content.
        requestAnimationFrame(function(){
          var singleSetWidth = trackEl.scrollWidth / 2;
          var pxPerSecond = 70;
          var duration = Math.max(12, singleSetWidth / pxPerSecond);
          trackEl.style.animationDuration = duration + 's';
        });
      }, function(){ /* fetch failed — stay hidden, fail silently */ });
  })();

  // ===== News + Trending feeds, and discussion threads =====
  // Both tabs show the same kind of card: the story, an optional Yes/No debate, and a
  // comment count. Tapping a card opens its thread (the story, the debate and the full
  // discussion). Trending posts (kind = 'post') are links to social posts, added from the admin page.

  // ---- Followers, record badges, invite bonus, "who called it" ----
  (function(){
    var cache = {}, scanTimer = null, sheetEl = null;
    function getSession(){ return sb.auth.getSession().then(function(r){ return r && r.data && r.data.session; }).catch(function(){ return null; }); }
    function key(n){ return String(n || '').toLowerCase(); }
    function fetchCards(names){
      var need = names.filter(function(n, i){ return n && !(key(n) in cache) && names.indexOf(n) === i; });
      if(!need.length) return Promise.resolve();
      need.forEach(function(n){ cache[key(n)] = null; });
      return sb.rpc('get_user_cards', { p_usernames: need }).then(function(r){
        (r.data || []).forEach(function(c){ cache[key(c.username)] = c; });
      }).catch(function(){ need.forEach(function(n){ delete cache[key(n)]; }); });
    }
    function badgeHtml(c){
      var parts = [];
      if(c.accuracy != null) parts.push(c.accuracy + '% right');
      if((c.streak || 0) >= 3) parts.push(mqIcon('flame') + c.streak);
      return parts.length ? parts.join(' · ') : '';
    }
    function avatar(c, size){
      return '<i class="mq-av" style="width:' + size + 'px;height:' + size + 'px;background:' + escapeHtml(c.avatar_color || '#2B3140') + ';">' + mqAvatarInner(c.avatar_emoji, c.username) + '</i>';
    }

    // record badge next to every name in comment threads
    function scan(){
      var els = Array.prototype.slice.call(document.querySelectorAll('.cmt-who > b:not([data-rec])'));
      if(!els.length) return;
      var names = els.map(function(b){ b.setAttribute('data-rec', '1'); b.classList.add('mq-caller-name'); return b.textContent; });
      fetchCards(names).then(function(){
        els.forEach(function(b){
          var c = cache[key(b.textContent)]; if(!c) return;
          var t = badgeHtml(c); if(!t) return;
          var sp = document.createElement('span'); sp.className = 'rec-badge'; sp.innerHTML = t;
          b.insertAdjacentElement('afterend', sp);
        });
      });
    }
    new MutationObserver(function(){ clearTimeout(scanTimer); scanTimer = setTimeout(scan, 300); }).observe(document.body, { childList: true, subtree: true });

    function toast(msg){
      var t = document.createElement('div'); t.className = 'mq-toast'; t.textContent = msg; document.body.appendChild(t);
      setTimeout(function(){ t.remove(); }, 4500);
    }
    function closeSheet(){ if(sheetEl){ sheetEl.remove(); sheetEl = null; } }

    // caller card (tap any name)
    function openCard(name){
      Promise.all([fetchCards([name]), getSession()]).then(function(res){
        var c = cache[key(name)], session = res[1]; if(!c) return;
        closeSheet();
        sheetEl = document.createElement('div'); sheetEl.className = 'mq-sheet-bg';
        var action = c.is_me ? '<div class="mq-sheet-note">This is you</div>'
          : session ? '<button type="button" class="mq-follow-btn' + (c.is_following ? ' on' : '') + '" data-follow="' + escapeHtml(c.username) + '">' + (c.is_following ? 'Following' : 'Follow') + '</button>'
          : '<button type="button" class="mq-follow-btn" data-signup="1">Sign up free to follow</button>';
        var rec = c.accuracy != null ? (c.accuracy + '% right on ' + c.calls + ' calls') : (Number(c.calls) > 0 ? (c.calls + ' calls so far') : 'New player');
        sheetEl.innerHTML = '<div class="mq-sheet" role="dialog" aria-label="Player"><button type="button" class="mq-sheet-x" aria-label="Close">&times;</button>' +
          '<div class="mq-sheet-top">' + avatar(c, 60) + '<div><div class="mq-sheet-name">' + escapeHtml(c.username) + '</div><div class="mq-sheet-rec">' + rec + ((c.streak || 0) >= 3 ? ' · ' + mqIcon('flame') + c.streak + ' day streak' : '') + '</div></div></div>' +
          '<div class="mq-sheet-counts"><span><b>' + c.followers + '</b> followers</span><span><b>' + c.following + '</b> following</span></div>' +
          action + '<div class="mq-sheet-msg" aria-live="polite"></div></div>';
        document.body.appendChild(sheetEl);
      });
    }
    async function toggleFollow(btn){
      var name = btn.getAttribute('data-follow'), on = btn.classList.contains('on');
      btn.disabled = true;
      var res = await sb.rpc(on ? 'unfollow_user' : 'follow_user', { p_username: name });
      btn.disabled = false;
      var msg = btn.closest('.mq-sheet') && btn.closest('.mq-sheet').querySelector('.mq-sheet-msg');
      if(res.error){ if(msg) msg.textContent = res.error.message; else toast(res.error.message); return; }
      var c = cache[key(name)];
      if(c){ c.is_following = !on; c.followers = Math.max(0, Number(c.followers) + (on ? -1 : 1)); }
      btn.classList.toggle('on', !on); btn.textContent = on ? 'Follow' : 'Following';
      var cnt = btn.closest('.mq-sheet') && btn.closest('.mq-sheet').querySelector('.mq-sheet-counts b');
      if(cnt && c) cnt.textContent = c.followers;
    }
    document.addEventListener('click', function(e){
      var t = e.target;
      if(t.closest('.mq-sheet-x') || (t.classList && t.classList.contains('mq-sheet-bg'))){ closeSheet(); return; }
      var fb = t.closest('button[data-follow]'); if(fb){ toggleFollow(fb); return; }
      var su = t.closest('button[data-signup]'); if(su){ closeSheet(); openAuthPanel('signup'); return; }
      var nm = t.closest('.mq-caller-name, .lb-name-text');
      if(nm && !nm.closest('.mq-sheet')){ var n = nm.textContent.trim(); if(n) openCard(n); }
    });

    // profile menu: counts, invite, anonymity, new followers, suggestions
    function rowHtml(c){
      var b = badgeHtml(c);
      return '<div class="mq-row">' + avatar(c, 36) + '<div class="mq-row-main"><b class="mq-caller-name">' + escapeHtml(c.username) + '</b>' + (b ? '<small>' + b + '</small>' : '') + '</div>' +
        (c.is_me ? '' : '<button type="button" class="mq-follow-btn sm' + (c.is_following ? ' on' : '') + '" data-follow="' + escapeHtml(c.username) + '">' + (c.is_following ? 'Following' : 'Follow') + '</button>') + '</div>';
    }
    async function fillProfile(){
      var box = document.getElementById('mq-social'); if(!box) return;
      var session = await getSession(); if(!session){ box.style.display = 'none'; return; }
      box.style.display = 'block';
      var uid = session.user.id;
      var uname = (document.getElementById('profile-modal-username') || {}).textContent || '';
      delete cache[key(uname)];
      await fetchCards([uname]);
      var mine = cache[key(uname)];
      if(mine){ document.getElementById('mq-followers-n').textContent = mine.followers; document.getElementById('mq-following-n').textContent = mine.following; }
      var link = location.origin + '/?' + mqGetReferralTag(uid, 'invite', 'profile');
      var inv = document.getElementById('mq-invite-btn');
      inv.onclick = function(){
        mqOpenShareSheet({ title: 'Invite friends: +200 points each', text: 'Make 3 daily calls with me on Marqit', url: link });
      };
      sb.rpc('get_my_referrals').then(function(r){
        var row = r.data && r.data[0]; var n = row ? Number(row.friends) : 0;
        document.getElementById('mq-invite-note').textContent = n ? (n + (n === 1 ? ' friend joined' : ' friends joined') + ' · +' + row.points + ' points') : 'You both get 200 points once they make their first call.';
      });
      var anon = document.getElementById('mq-anon-box');
      sb.from('profiles').select('hide_name_on_calls').eq('id', uid).maybeSingle().then(function(r){ anon.checked = !!(r.data && r.data.hide_name_on_calls); });
      anon.onchange = function(){ sb.rpc('set_hide_name_on_calls', { p_hide: anon.checked }); };
      sb.rpc('get_my_followers', { p_limit: 10 }).then(function(r){
        var list = r.data || [], el = document.getElementById('mq-newfollowers');
        el.innerHTML = list.length ? '<div class="mq-soc-h">Your followers</div><div class="mq-rows">' + list.map(rowHtml).join('') + '</div>' : '';
        mqFoldList(el.querySelector('.mq-rows'), 5, { one: 'more follower', many: 'more followers' });
      });
      sb.rpc('get_suggested_callers', { p_limit: 6 }).then(function(r){
        var list = r.data || [], el = document.getElementById('mq-suggested');
        el.innerHTML = list.length ? '<div class="mq-soc-h">Top callers to follow</div><div class="mq-rows">' + list.map(rowHtml).join('') + '</div>' : '';
        mqFoldList(el.querySelector('.mq-rows'), 5, { one: 'more caller', many: 'more callers' });
      });
      claimBonus(uid);
    }
    function claimBonus(uid){
      try{ if(localStorage.getItem('mq_refclaim_' + uid)) return; }catch(e){}
      sb.rpc('claim_referral_bonus').then(function(r){
        if(r.data && r.data.awarded){
          try{ localStorage.setItem('mq_refclaim_' + uid, '1'); }catch(e){}
          toast('Invite bonus: you and your friend each got ' + r.data.points + ' points.');
        }
      });
    }
    var pm = document.getElementById('profile-modal-backdrop');
    if(pm) new MutationObserver(function(){ if(pm.style.display !== 'none') fillProfile(); }).observe(pm, { attributes: true, attributeFilter: ['style'] });
    setTimeout(function(){ getSession().then(function(s){ if(s) claimBonus(s.user.id); }); }, 4000);

    // "Who called it" under resolved Play cards
    document.addEventListener('click', async function(e){
      var btn = e.target.closest && e.target.closest('.who-btn'); if(!btn) return;
      var list = btn.parentNode.querySelector('.who-list');
      if(!list.hidden){ list.hidden = true; return; }
      list.hidden = false; list.textContent = 'Loading...';
      var res = await sb.rpc('get_who_called_it', { p_question_id: btn.getAttribute('data-qid') });
      var rows = res.data || [];
      if(!rows.length){ list.textContent = 'No one to show yet.'; return; }
      var session = await getSession(), hideNow = false;
      if(session){ var pr = await sb.from('profiles').select('hide_name_on_calls').eq('id', session.user.id).maybeSingle(); hideNow = !!(pr.data && pr.data.hide_name_on_calls); }
      list.innerHTML = '<div class="who-head">' + rows[0].total_correct + ' of ' + rows[0].total_calls + ' called it. First 10 shown.</div>' +
        rows.map(function(r){
          if(r.anonymous && !r.is_me) return '<div class="mq-row"><i class="mq-av" style="width:36px;height:36px;background:#2B3140;">?</i><div class="mq-row-main"><b>Anonymous caller</b></div></div>';
          return '<div class="mq-row">' + avatar(r, 36) + '<div class="mq-row-main"><b class="mq-caller-name">' + escapeHtml(r.username || 'player') + '</b>' + (r.is_me ? '<small>You' + (r.anonymous ? ' (hidden from others)' : '') + '</small>' : '') + '</div></div>';
        }).join('') +
        (session ? '<button type="button" class="who-anon" data-hide="' + (hideNow ? '0' : '1') + '">' + (hideNow ? 'Show my name on this list' : 'Hide my name on this list') + '</button>' : '');
    });
    document.addEventListener('click', async function(e){
      var b = e.target.closest && e.target.closest('.who-anon'); if(!b) return;
      b.disabled = true;
      await sb.rpc('set_hide_name_on_calls', { p_hide: b.getAttribute('data-hide') === '1' });
      var card = b.closest('.predict-card'), who = card && card.querySelector('.who-btn');
      if(who){ var l = who.parentNode.querySelector('.who-list'); l.hidden = true; who.click(); }
    });
  })();

  (function(){
    var LANES = [ ['all', 'All'], ['news', 'News'], ['pop', 'Pop Culture'], ['sports', 'Sports'] ];
    var LANE_NAME = { news: 'News', pop: 'Pop Culture', sports: 'Sports' };
    var LANE_BY_SOURCE = {};
    ['ESPN', 'Yahoo Sports', 'Bleacher Report', 'CBS Sports', 'Sports Illustrated', 'The Athletic', 'NFL', 'NBA', 'MLB'].forEach(function(s){ LANE_BY_SOURCE[s] = 'sports'; });
    ['People', 'E! Online', 'Variety', 'Entertainment Weekly', 'Us Weekly', 'TMZ', 'Page Six', 'Rolling Stone', 'The Hollywood Reporter', 'Deadline', 'GQ', 'Elle'].forEach(function(s){ LANE_BY_SOURCE[s] = 'pop'; });
    LANE_BY_SOURCE['Billboard'] = 'music';
    ['Yahoo Finance', 'Forbes', 'CNBC', 'Bloomberg', 'MarketWatch', 'Fortune', "Barron's", 'Investopedia', 'Inc.', 'Fast Company', 'Benzinga', 'TheStreet', "Investor's Business Daily", 'Seeking Alpha', 'CoinDesk', 'Business Insider', 'The Wall Street Journal'].forEach(function(s){ LANE_BY_SOURCE[s] = 'markets'; });
    ['Gizmodo', "Tom's Hardware", 'Space.com', 'Electrek', '9to5Mac', 'The Information', 'TechCrunch', 'The Verge', 'Engadget', 'Wired', 'Ars Technica', 'CNET', 'Mashable', 'VentureBeat', 'ZDNet'].forEach(function(s){ LANE_BY_SOURCE[s] = 'tech'; });
    function laneOf(r){ var l = r.lane || LANE_BY_SOURCE[r.source_name] || 'news'; return l === 'music' ? 'pop' : (l === 'sports' || l === 'pop') ? l : 'news'; }

    var rowsById = {};      // id -> row
    var statsById = {};     // id -> { comments, votes, last_body, last_user }
    var movesById = {};     // trending id -> { now, prev, hist } (rank change since the last day we have data for)
    var resultsById = {};   // id -> { yes_count, no_count, my_choice }
    var allRows = null;     // loaded once, shared by both tabs
    var loadingRows = null;
    var feeds = [];

    function ago(iso){
      var t = iso ? new Date(iso).getTime() : NaN;
      if(isNaN(t)) return '';
      var m = Math.max(0, Math.round((Date.now() - t) / 60000));
      if(m < 2) return 'just now';
      if(m < 60) return m + ' min ago';
      var h = Math.round(m / 60);
      if(h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
      var d = Math.round(h / 24);
      return d + (d === 1 ? ' day ago' : ' days ago');
    }
    function plural(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); }
    function hot(r){
      var s = statsById[r.id] || {};
      var ageH = Math.max(0, (Date.now() - new Date(r.fetched_at || r.published_at || Date.now()).getTime()) / 3600000);
      var base = (Number(s.comments) || 0) * 3 + (Number(s.votes) || 0) + (r.kind === 'post' ? 4 : 0);
      // trend rows carry their position on the source charts (1 = top)
      if(r.kind === 'trend' && r.trend_rank){ base += Math.max(0, 12 - Number(r.trend_rank)); }
      return (base + 1) / Math.pow(ageH + 2, 1.2) + (r.pinned ? 1000 : 0);
    }

    async function loadRows(){
      if(allRows) return allRows;
      if(loadingRows) return loadingRows;
      loadingRows = (async function(){
        var base = 'id, headline, source_name, article_url, published_at, fetched_at';
        var tries = [
          base + ', image_url, take_question, summary, kind, lane, pinned, trend_rank',
          base + ', image_url, take_question, summary, kind, lane, pinned',
          base + ', image_url, take_question',
          base + ', image_url',
          base
        ];
        var res = null;
        for(var i = 0; i < tries.length; i++){
          res = await sb.from('news_ticker').select(tries[i]).order('fetched_at', { ascending: false }).limit(120);
          if(!res.error) break;
        }
        if(!res || res.error){ loadingRows = null; return null; }
        var rows = (res.data || []).filter(function(r){ return r.kind === 'post' || ((!r.kind || r.kind === 'news' || r.kind === 'trend') && mqNewsAllowed(r.headline)); });
        rows.forEach(function(r){ r.kind = r.kind || 'news'; rowsById[r.id] = r; });
        // Load each tab's finished stories on their own, so a busy tab (or the
        // Trending rows) can never crowd another tab out of the newest 120.
        try{
          var cols = 'id, headline, source_name, article_url, published_at, fetched_at, image_url, take_question, summary, kind, lane, pinned';
          var tabQ = function(f){ return f(sb.from('news_ticker').select(cols).eq('kind', 'news').not('take_question', 'is', null).not('image_url', 'is', null)).order('fetched_at', { ascending: false }).limit(60); };
          // Trending is loaded on its own too: the newest 120 rows are mostly News
          // (RSS feeds add dozens an hour), so trends would otherwise get pushed out.
          var trendQ = sb.from('news_ticker').select(cols + ', trend_rank').eq('kind', 'trend').not('take_question', 'is', null).order('fetched_at', { ascending: false }).limit(60);
          var extra = await Promise.all([
            tabQ(function(q){ return q.eq('lane', 'sports'); }),
            tabQ(function(q){ return q.in('lane', ['pop', 'music']); }),
            tabQ(function(q){ return q.or('lane.is.null,lane.not.in.(sports,pop,music)'); }),
            trendQ
          ]);
          extra.forEach(function(x){
            (x.data || []).forEach(function(r){
              if(rowsById[r.id] || !mqNewsAllowed(r.headline)) return;
              r.kind = r.kind || 'news'; rowsById[r.id] = r; rows.push(r);
            });
          });
        }catch(e){}
        allRows = rows;
        return rows;
      })();
      return loadingRows;
    }
    async function loadStats(ids){
      if(!ids.length) return;
      try{
        var res = await sb.rpc('get_news_thread_stats', { p_news_ids: ids });
        if(res.error) throw res.error;
        (res.data || []).forEach(function(s){ statsById[s.news_id] = s; });
      }catch(e){ /* counts are decoration; cards still work */ }
    }
    async function loadMoves(ids){
      if(!ids.length) return;
      try{
        var res = await sb.rpc('get_trend_moves', { p_news_ids: ids });
        if(res.error) throw res.error;
        (res.data || []).forEach(function(m){ movesById[m.news_id] = { now: Number(m.rank_now), prev: m.rank_prev == null ? null : Number(m.rank_prev), hist: !!m.has_history }; });
      }catch(e){ /* moves are decoration; cards still work */ }
    }
    // Movement chip: green up arrow, red down arrow, NEW, flat dash, or nothing until a previous day exists.
    function mvHtml(r){
      var m = movesById[r.id], now = Number(r.trend_rank);
      if(!m || !m.hist) return '';
      if(m.prev == null) return '<span class="mv mv-new">NEW</span>';
      if(m.prev > now) return '<span class="mv mv-up"><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 2l4.500 6.500h-9z" fill="currentColor"/></svg>' + (m.prev - now) + '</span>';
      if(m.prev < now) return '<span class="mv mv-down"><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 10L1.500 3.500h9z" fill="currentColor"/></svg>' + (now - m.prev) + '</span>';
      return '<span class="mv mv-flat">&ndash;</span>';
    }
    // Chart rank plus movement: #3 with an arrow.
    function rankHtml(r){
      if(r.kind !== 'trend' || !r.trend_rank) return '';
      return '<div class="trend-rank"><b>#' + Number(r.trend_rank) + '</b>' + mvHtml(r) + '<span class="tr-on">on ' + escapeHtml(r.source_name || 'the chart') + '</span></div>';
    }
    // "2 min ago" style text for the Updated line.
    function freshText(ts){
      var m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
      if(m < 1) return 'just now';
      if(m < 60) return m + ' min ago';
      var h = Math.floor(m / 60);
      return h < 24 ? h + (h === 1 ? ' hour ago' : ' hours ago') : Math.floor(h / 24) + 'd ago';
    }
    async function loadResults(ids){
      if(!ids.length) return;
      try{
        var res = await sb.rpc('get_news_take_results', { p_news_ids: ids, p_device: mqGuestDeviceId() });
        if(res.error) throw res.error;
        (res.data || []).forEach(function(r){ resultsById[r.news_id] = r; });
      }catch(e){ /* buttons stay available; voting still tries */ }
    }


    // ---- social posts (Trending) ----
    var PLATFORMS = { 'x.com': 'X', 'twitter.com': 'X', 'instagram.com': 'Instagram', 'tiktok.com': 'TikTok', 'bsky.app': 'Bluesky', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'threads.net': 'Threads', 'threads.com': 'Threads' };
    function hostOf(url){ try { return new URL(url).hostname.replace(/^(www|mobile|m)\./, '').toLowerCase(); } catch(e){ return ''; } }
    function platformOf(url){ return PLATFORMS[hostOf(url)] || 'Post'; }
    var scriptLoads = {};
    function loadScript(src){
      if(scriptLoads[src]) return scriptLoads[src];
      scriptLoads[src] = new Promise(function(resolve, reject){
        var sc = document.createElement('script'); sc.src = src; sc.async = true; sc.charset = 'utf-8';
        sc.onload = function(){ resolve(); }; sc.onerror = function(){ reject(new Error('blocked')); };
        document.head.appendChild(sc);
      });
      return scriptLoads[src];
    }
    function embedFallback(el, url){
      el.classList.add('post-fallback');
      el.innerHTML = '<a class="post-open" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">View the post on ' + escapeHtml(platformOf(url)) + ' ↗</a>';
    }
    // Renders the platform's own embed so the post shows exactly as its author made it, with credit.
    async function renderEmbed(el){
      if(el.getAttribute('data-done')) return;
      el.setAttribute('data-done', '1');
      var url = el.getAttribute('data-url') || '', host = hostOf(url);
      try{
        if(host === 'x.com' || host === 'twitter.com'){
          var m = url.match(/status(?:es)?\/(\d+)/);
          if(!m){ embedFallback(el, url); return; }
          await loadScript('https://platform.twitter.com/widgets.js');
          el.innerHTML = '';
          var made = await window.twttr.widgets.createTweet(m[1], el, { theme: 'dark', dnt: true, conversation: 'none', align: 'center' });
          if(!made) embedFallback(el, url);
        }else if(host === 'instagram.com'){
          el.innerHTML = '<blockquote class="instagram-media" data-instgrm-permalink="' + escapeHtml(url) + '" data-instgrm-version="14" style="max-width:540px;width:100%;margin:0 auto;"></blockquote>';
          await loadScript('https://www.instagram.com/embed.js');
          if(window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
        }else if(host === 'tiktok.com'){
          var tm = url.match(/video\/(\d+)/);
          if(!tm){ embedFallback(el, url); return; }
          el.innerHTML = '<blockquote class="tiktok-embed" cite="' + escapeHtml(url) + '" data-video-id="' + tm[1] + '" style="max-width:605px;min-width:300px;margin:0 auto;"><section></section></blockquote>';
          await loadScript('https://www.tiktok.com/embed.js');
        }else if(host === 'youtube.com' || host === 'youtu.be'){
          var ym = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/);
          if(!ym){ embedFallback(el, url); return; }
          el.innerHTML = '<div class="post-yt"><iframe src="https://www.youtube-nocookie.com/embed/' + ym[1] + '" title="YouTube video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
        }else{
          embedFallback(el, url);
        }
      }catch(e){ embedFallback(el, url); }
    }
    var embedObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ embedObserver.unobserve(en.target); renderEmbed(en.target); } });
    }, { rootMargin: '300px 0px' }) : null;
    function wireEmbeds(scope){
      scope.querySelectorAll('.post-embed:not([data-done])').forEach(function(el){
        if(embedObserver && scope !== inner) embedObserver.observe(el); else renderEmbed(el);
      });
    }

    // ---- pieces of markup shared by cards and the thread screen ----
    function metaHtml(r){
      var url = r.article_url || '', domain = '';
      try { if(url) domain = new URL(url).hostname.replace(/^www\./, ''); } catch(e){}
      var when = ago(r.published_at || r.fetched_at);
      var who;
      if(r.kind === 'trend'){
        who = '<span class="plat-badge">' + escapeHtml(r.source_name || 'Trending') + '</span>';
      }else if(r.kind === 'post'){
        who = '<span class="plat-badge">' + escapeHtml(platformOf(url)) + '</span>' + (r.source_name ? '<span class="post-by">' + escapeHtml(r.source_name) + '</span>' : '');
      }else{
        var logo = domain ? '<img class="nt-logo" src="https://www.google.com/s2/favicons?sz=64&domain=' + escapeHtml(domain) + '" alt="" onerror="this.style.display=\'none\'">' : '';
        who = logo + '<span>' + escapeHtml(r.source_name || '') + '</span>';
      }
      return '<div class="news-meta">' + who + (when ? '<span>·</span><span>' + when + '</span>' : '') + '<span class="lane-tag">' + escapeHtml(LANE_NAME[laneOf(r)] || '') + '</span></div>';
    }
    function imgHtml(r){
      if(r.image_url && /^https:\/\//i.test(r.image_url)){
        return '<div class="news-img" style="--bg:url(\'' + encodeURI(r.image_url).replace(/[()\'"]/g, escape) + '\')"><img src="' + escapeHtml(r.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="var c=this.closest(\'.news-card\');if(c&&c.classList.contains(\'is-trend\')){this.parentNode.remove()}else{(c||this.parentNode).remove()}"></div>';
      }
      return '';
    }
    function takeHtml(r){
      if(!r.take_question) return '';
      return '<div class="news-take" data-take-id="' + escapeHtml(r.id) + '">' +
        '<div class="take-label">The debate</div>' +
        '<div class="take-q">' + escapeHtml(mqDecodeEntities(r.take_question)) + '</div>' +
        '<div class="take-btns"><button type="button" class="take-btn take-yes" data-choice="yes">Yes</button><button type="button" class="take-btn take-no" data-choice="no">No</button></div>' +
        '<div class="take-result" hidden></div>' +
        '<div class="take-note">No points. Just the debate.</div></div>';
    }
    function footHtml(r){
      var s = statsById[r.id] || {};
      var c = Number(s.comments) || 0;
      var last = (c && s.last_body) ? '<div class="feed-last"><b>' + escapeHtml(s.last_user || 'player') + '</b> ' + escapeHtml(s.last_body) + '</div>' : '';
      return '<div class="feed-foot" data-foot-id="' + escapeHtml(r.id) + '">' + last +
        '<div class="feed-stats"><span class="feed-cmt">' + '<svg class="mq-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>' + (c ? plural(c, 'comment') : 'Start the discussion') + '</span>' +
        (Number(s.votes) ? '<span>' + plural(Number(s.votes), 'vote') + '</span>' : '') + '</div></div>';
    }
    function isYt(r){ return r.kind === 'trend' && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(r.article_url || ''); }
    function embedHtml(r){
      return '<div class="post-embed" data-url="' + escapeHtml(r.article_url || '') + '"><div class="post-skel">Loading post…</div></div>';
    }
    // Trending cards: a small round photo of the main person involved (found by the fill-trend-photos function).
    function faceHtml(r){
      if(!(r.image_url && /^https:\/\//i.test(r.image_url))) return '';
      return '<img class="trend-face" src="' + escapeHtml(r.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">';
    }
    function cardHtml(r){
      var isPost = r.kind === 'post', isTrend = r.kind === 'trend', yt = isYt(r);
      var lane = LANE_NAME[laneOf(r)] || '', when = ago(r.published_at || r.fetched_at), ks = keyStat(r);
      var photo = (!isPost && !yt && r.image_url && /^https:\/\//i.test(r.image_url))
        ? '<div class="tsc-ph"><img src="' + escapeHtml(r.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add(\'ph-none\');this.remove()"></div>' : '';
      if(!photo && !isPost && !yt) photo = '<div class="tsc-ph ph-none"></div>';
      var rank = isTrend && r.trend_rank ? '<span class="tsc-tr">#' + Number(r.trend_rank) + ' ' + mvHtml(r) + '</span>' : (isTrend ? '<span class="tsc-tr">Trending</span>' : '');
      var by = r.source_name ? '<span class="tcd-by">' + escapeHtml(r.source_name) + '</span>' : '';
      return '<article class="news-card tcd tsc' + (isPost ? ' is-post' : '') + (isTrend ? ' is-trend' : '') + '" data-lane="' + laneOf(r) + '" tabindex="0" role="link" aria-label="Open discussion: ' + escapeHtml(mqDecodeEntities(r.headline)) + '" data-news-id="' + escapeHtml(r.id) + '">' +
        '<div class="tsc-bar"></div><div class="tsc-in"><div class="tsc-chips"><span class="tsc-lane">' + escapeHtml(lane) + '</span>' + rank + by + (when ? '<span class="tsc-when">' + escapeHtml(when) + '</span>' : '') + '</div>' +
        '<div class="tsc-hrow"><div class="news-h tsc-h">' + escapeHtml(mqDecodeEntities(r.headline)) + '</div>' + photo + '</div>' +
        (ks ? '<div class="tcd-stat ' + ks.dir + '"><b>' + escapeHtml(ks.value) + '</b><span>' + escapeHtml(ks.label) + '</span></div>' : '') +
        (isTrend && r.summary && !ks ? '<p class="trend-ctx">' + escapeHtml(mqDecodeEntities(r.summary)) + '</p>' : '') + '</div>' +
        ((isPost || yt) ? embedHtml(r) : '') +
        takeHtml(r) + footHtml(r) + '</article>';
    }

    function paintResult(scope, id){
      var r = resultsById[id]; if(!r) return;
      scope.querySelectorAll('.news-take[data-take-id="' + id + '"]').forEach(function(box){
        var res = box.querySelector('.take-result'); if(!res) return;
        var y = Number(r.yes_count) || 0, n = Number(r.no_count) || 0, t = y + n;
        var yp = t ? Math.round(y * 100 / t) : 0, np = t ? 100 - yp : 0, mine = r.my_choice;
        box.querySelectorAll('.take-btn').forEach(function(b){ b.disabled = !!mine; });
        box.querySelector('.take-btns').hidden = !!mine;
        if(!mine){ res.hidden = true; return; }
        res.hidden = false;
        res.innerHTML = '<div class="take-bar"><i class="take-bar-y" style="width:' + yp + '%"></i><i class="take-bar-n" style="width:' + np + '%"></i></div>' +
          '<div class="take-split"><span class="' + (mine === 'yes' ? 'me' : '') + '">Yes ' + yp + '%</span><span class="' + (mine === 'no' ? 'me' : '') + '">No ' + np + '%</span></div>' +
          '<button type="button" class="take-count voters-btn" data-voters="' + escapeHtml(id) + '" aria-expanded="false">' + plural(t, 'vote') + ' · you said ' + (mine === 'yes' ? 'Yes' : 'No') +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
          '<div class="voters" hidden></div>';
      });
    }
    function paintAll(scope){
      scope.querySelectorAll('.news-take').forEach(function(b){ paintResult(scope, b.getAttribute('data-take-id')); });
    }
    function refreshFoot(id){
      var r = rowsById[id]; if(!r) return;
      document.querySelectorAll('.feed-foot[data-foot-id="' + id + '"]').forEach(function(f){
        var tmp = document.createElement('div'); tmp.innerHTML = footHtml(r);
        f.replaceWith(tmp.firstChild);
      });
    }

    // Click "N votes" to see who voted (signed-in players by username; guests and hidden players as a count).
    async function toggleVoters(btn){
      var box = btn.closest('.news-take'); var list = box && box.querySelector('.voters'); if(!list) return;
      var open = list.hidden; list.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.classList.toggle('open', open);
      if(!open || list.getAttribute('data-loaded')) return;
      list.innerHTML = '<div class="voters-msg">Loading…</div>';
      var res = await sb.rpc('get_news_take_voters', { p_news_id: btn.getAttribute('data-voters') });
      if(res.error || !res.data){ list.innerHTML = '<div class="voters-msg">Could not load voters.</div>'; return; }
      var by = { yes: { names: [], more: 0 }, no: { names: [], more: 0 } };
      res.data.forEach(function(r){
        var g = by[r.choice]; if(!g) return;
        if(r.username) g.names.push(r); else g.more += Number(r.guests || 0) + Number(r.hidden || 0);
      });
      function col(key, label){
        var g = by[key];
        var rows = g.names.map(function(u){
          return '<li><i class="vtr-av" style="background:' + escapeHtml(u.avatar_color || '#2B2E34') + '">' + mqAvatarInner(u.avatar_emoji, u.username) + '</i><span>' + escapeHtml(u.username) + '</span></li>';
        }).join('');
        if(g.more) rows += '<li class="more">' + (g.names.length ? '+ ' : '') + g.more + (g.more === 1 ? ' guest or private player' : ' guests or private players') + '</li>';
        if(!rows) rows = '<li class="more">No one yet</li>';
        return '<div class="vtr-col ' + key + '"><h5>' + label + ' · ' + (g.names.length + g.more) + '</h5><ul>' + rows + '</ul></div>';
      }
      list.innerHTML = col('yes', 'Yes') + col('no', 'No');
      list.setAttribute('data-loaded', '1');
    }
    document.addEventListener('click', function(e){
      var b = e.target.closest('.voters-btn'); if(!b) return;
      e.stopPropagation(); e.preventDefault(); toggleVoters(b);
    }, true);

    async function vote(btn){
      var box = btn.closest('.news-take'); var id = box && box.getAttribute('data-take-id'); if(!id) return;
      document.querySelectorAll('.news-take[data-take-id="' + id + '"] .take-btn').forEach(function(b){ b.disabled = true; });
      var res = await sb.rpc('vote_news_take', { p_news_id: id, p_choice: btn.getAttribute('data-choice'), p_device: mqGuestDeviceId() });
      if(res.error){
        document.querySelectorAll('.news-take[data-take-id="' + id + '"] .take-btn').forEach(function(b){ b.disabled = false; });
        document.querySelectorAll('.news-take[data-take-id="' + id + '"] .take-note').forEach(function(n){ n.textContent = 'Could not save your vote. Try again.'; });
        return;
      }
      await Promise.all([loadResults([id]), loadStats([id])]);
      paintAll(document); refreshFoot(id);
    }

    // Sub-topics inside each lane (Sports > NBA, Pop Culture > Music, News > Tech ...). Matched on the headline,
    // summary and source; first match wins, anything left over lands in "More".
    var NFL_T = 'Chiefs|Cowboys|Eagles|49ers|Packers|Bills|Ravens|Bengals|Lions|Dolphins|Patriots|Jets|Giants|Commanders|Steelers|Browns|Texans|Colts|Jaguars|Titans|Broncos|Raiders|Chargers|Seahawks|Rams|Cardinals|Saints|Falcons|Panthers|Buccaneers|Vikings|Bears';
    var NBA_T = 'Lakers|Celtics|Knicks|Warriors|Bucks|Nuggets|Suns|Heat|Sixers|76ers|Mavericks|Thunder|Timberwolves|Cavaliers|Pacers|Magic|Hawks|Nets|Raptors|Clippers|Kings|Pelicans|Grizzlies|Spurs|Rockets|Jazz|Trail Blazers|Hornets|Pistons|Wizards|Bulls';
    var MLB_T = 'Yankees|Dodgers|Red Sox|Mets|Braves|Astros|Phillies|Padres|Cubs|Guardians|Orioles|Mariners|Blue Jays|Brewers|Twins|Rays|Rangers|Tigers|Royals|Cardinals|Giants|Diamondbacks|Reds|Pirates|Rockies|Marlins|Nationals|Athletics|White Sox|Angels';
    var NHL_T = 'Bruins|Rangers|Maple Leafs|Canadiens|Oilers|Avalanche|Panthers|Lightning|Golden Knights|Stars|Hurricanes|Devils|Kraken|Flames|Canucks|Jets|Wild|Blues|Predators|Penguins|Capitals|Islanders|Flyers|Red Wings|Blackhawks|Senators|Sabres|Sharks|Ducks|Kings|Blue Jackets|Utah';
    var TOPICS = {
      sports: [
        ['nfl', 'NFL', new RegExp('\\bNFL\\b|quarterback|touchdown|Super Bowl|' + NFL_T.replace(/\|/g, '\\b|\\b'), '')],
        ['nba', 'NBA', new RegExp('\\bNBA\\b|WNBA|basketball|' + NBA_T.replace(/\|/g, '\\b|\\b'), '')],
        ['mlb', 'MLB', new RegExp('\\bMLB\\b|baseball|World Series|home run|' + MLB_T.replace(/\|/g, '\\b|\\b'), '')],
        ['nhl', 'NHL', new RegExp('\\bNHL\\b|hockey|Stanley Cup|' + NHL_T.replace(/\|/g, '\\b|\\b'), '')],
        ['soccer', 'Soccer', /soccer|Premier League|\bMLS\b|Champions League|FIFA|World Cup|La Liga|Bundesliga|Messi|Ronaldo|Arsenal|Liverpool|Man(chester)? (United|City)|Chelsea|Tottenham|Real Madrid|Barcelona/i],
        ['college', 'College', /\bNCAA\b|college football|college basketball|March Madness|Heisman|Crimson Tide|Bulldogs|Buckeyes|Wolverines|Longhorns/i],
        ['more', 'More sports', /./]
      ],
      pop: [
        ['music', 'Music', /\b(song|songs|album|albums|single|singer|rapper|rap|tour|concert|Billboard|Grammy|Grammys|Spotify|Apple Music|Hot 100|band|hip-hop|country music|lyrics|music video|festival|chart)\b/i],
        ['screen', 'Movies & TV', /\b(movie|movies|film|films|box office|trailer|series|Netflix|HBO|Disney|Hulu|streaming|season|episode|Emmy|Emmys|Oscar|Oscars|sequel|actor|actress|director|premiere|sitcom|show)\b/i],
        ['gaming', 'Gaming', /\b(video game|gaming|PlayStation|Xbox|Nintendo|Steam|Fortnite|Minecraft|esports|Twitch|GTA)\b/i],
        ['celeb', 'Celebrity', /./]
      ],
      news: [
        ['politics', 'Politics', /\b(president|Trump|Biden|Congress|Senate|House|election|vote|voters|governor|mayor|Democrat|Democrats|Republican|Republicans|White House|Supreme Court|campaign|bill|lawmakers|policy|GOP)\b/i],
        ['business', 'Business', /\b(stock|stocks|market|markets|earnings|economy|inflation|Fed|Wall Street|CEO|shares|IPO|tariff|tariffs|jobs|unemployment|bank|sales|revenue|billion|trillion|profit|company|merger|investors)\b/i],
        ['tech', 'Tech', /\b(AI|OpenAI|Apple|Google|Microsoft|Meta|Nvidia|Amazon|chip|chips|software|iPhone|Tesla|app|cyber|hack|robot|startup|data center|storage|semiconductor|Sandisk|Samsung)\b/i],
        ['world', 'World', /\b(war|Ukraine|Russia|China|Israel|Gaza|Iran|EU|UN|NATO|Europe|Asia|Africa|India|Japan|Mexico|Canada|ceasefire|troops|border)\b/i],
        ['more', 'More news', /./]
      ]
    };
    function topicOf(r){
      var list = TOPICS[laneOf(r)] || [], t = (mqDecodeEntities(r.headline || '') + ' ' + mqDecodeEntities(r.summary || '') + ' ' + (r.source_name || ''));
      if(/apple music/i.test(r.source_name || '') && laneOf(r) === 'pop') return 'music';
      for(var i = 0; i < list.length; i++){ if(list[i][2].test(t)) return list[i][0]; }
      return 'more';
    }

    // ---- feed tabs ----
    function Feed(cfg){
      this.cfg = cfg;
      this.grid = document.getElementById(cfg.gridId);
      this.chips = document.getElementById(cfg.chipsId);
      this.lane = 'all';
      this.sort = 'new';
      this.source = 'all';
      this.topic = 'all';
      this.loaded = false;
      var self = this;
      // "Updated X ago" line under the chips
      this.updEl = document.createElement('p');
      this.updEl.className = 'feed-updated';
      this.grid.parentNode.insertBefore(this.updEl, this.grid);
      // Trending only: a second chip row to filter by source (Google, YouTube, Music...)
      if(cfg.kind === 'trending' && this.chips){
        this.srcChips = document.createElement('div');
        this.srcChips.className = 'feed-chips src-chips';
        this.chips.parentNode.insertBefore(this.srcChips, this.chips.nextSibling);
        this.srcChips.addEventListener('click', function(ev){
          var b = ev.target.closest('.feed-chip'); if(!b) return;
          var sv = b.getAttribute('data-source');
          self.source = (sv === self.source && sv !== 'all') ? 'all' : sv;
          self.srcChips.querySelectorAll('.feed-chip').forEach(function(x){ x.classList.toggle('on', x.getAttribute('data-source') === self.source); });
          self.render();
        });
      }
      if(this.chips){
        this.topicChips = document.createElement('div');
        this.topicChips.className = 'feed-chips topic-chips';
        this.chips.parentNode.insertBefore(this.topicChips, this.chips.nextSibling);
        this.topicChips.addEventListener('click', function(ev){
          var b = ev.target.closest('.feed-chip'); if(!b) return;
          var tv = b.getAttribute('data-topic');
          self.topic = (tv === self.topic && tv !== 'all') ? 'all' : tv;
          self.render();
        });
      }
      if(this.chips){
        this.chips.innerHTML = LANES.map(function(l){ return '<button type="button" class="feed-chip' + (l[0] === 'all' ? ' on' : '') + '" data-lane="' + l[0] + '">' + l[1] + '</button>'; }).join('');
        this.chips.addEventListener('click', function(ev){
          var b = ev.target.closest('.feed-chip'); if(!b) return;
          if(b.hasAttribute('data-lane')){ var lv = b.getAttribute('data-lane'); self.lane = (lv === self.lane && lv !== 'all') ? 'all' : lv; self.topic = 'all'; }
          if(b.hasAttribute('data-sort')){ var sv2 = b.getAttribute('data-sort'); self.sort = (sv2 === self.sort && sv2 !== 'new') ? 'new' : sv2; }
          self.chips.querySelectorAll('.feed-chip').forEach(function(x){
            x.classList.toggle('on', (x.hasAttribute('data-lane') && x.getAttribute('data-lane') === self.lane) || (x.hasAttribute('data-sort') && x.getAttribute('data-sort') === self.sort));
          });
          self.render();
        });
      }
      this.grid.addEventListener('click', onGridClick);
      this.grid.addEventListener('keydown', function(ev){
        if((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('news-card')){ ev.preventDefault(); openThread(ev.target.getAttribute('data-news-id'), true); }
      });
      var tab = document.querySelector('.pagenav-tab[data-page="' + cfg.page + '"]');
      if(tab) tab.addEventListener('click', function(){ self.load(); });
      feeds.push(this);
    }
    Feed.prototype.pick = function(){
      var rows = allRows || [];
      var lane = this.lane, list;
      if(this.cfg.kind === 'news'){
        // Only stories with a photo AND a debate question are shown.
        list = rows.filter(function(r){ return (!r.kind || r.kind === 'news') && r.take_question && r.image_url && /^https:\/\//i.test(r.image_url); });
      }else{
        list = rows.filter(function(r){ return (r.kind === 'post' || r.kind === 'trend') && r.take_question; });
      }
      if(lane !== 'all') list = list.filter(function(r){ return laneOf(r) === lane; });
      this.laneList = list;
      if(lane !== 'all' && this.topic !== 'all') list = list.filter(function(r){ return topicOf(r) === this.topic; }, this);
      var src = this.source;
      if(this.cfg.kind === 'trending' && src !== 'all') list = list.filter(function(r){ return r.kind === 'trend' && r.source_name === src; });
      list = list.slice();
      if(this.sort === 'hot') list.sort(function(a, b){ return hot(b) - hot(a); });
      else list.sort(function(a, b){ return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.fetched_at) - new Date(a.fetched_at); });
      return list;
    };
    // Compact numbered row for the three hottest stories at the top of News.
    function topRowHtml(r, n){
      var s = statsById[r.id] || {}, c = Number(s.comments) || 0;
      var img = (r.image_url && /^https:\/\//i.test(r.image_url)) ? '<img class="tr-img" src="' + escapeHtml(r.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '';
      return '<article class="news-card top-row" data-lane="' + laneOf(r) + '" tabindex="0" role="link" aria-label="Open discussion: ' + escapeHtml(mqDecodeEntities(r.headline)) + '" data-news-id="' + escapeHtml(r.id) + '">' +
        '<span class="tr-n">' + n + '</span>' + img +
        '<div class="tr-main">' + metaHtml(r) + '<div class="news-h">' + escapeHtml(mqDecodeEntities(r.headline)) + '</div>' +
        '<span class="lane-tag tr-tag">' + escapeHtml(LANE_NAME[laneOf(r)] || '') + '</span></div>' +
        (c ? '<span class="tr-c">' + plural(c, 'comment') + '</span>' : '') + '</article>';
    }
    var SRC_CHIPS = [ ['Google Trends', 'Google'], ['YouTube', 'YouTube'], ['Apple Music', 'Music'], ['Wikipedia', 'Wikipedia'], ['Bluesky', 'Bluesky'] ];
    // One row of a source's chart: rank number, picture, title, movement.
    function chartRowHtml(r){
      var s = statsById[r.id] || {}, c = Number(s.comments) || 0;
      var img = (r.image_url && /^https:\/\//i.test(r.image_url)) ? '<img class="tr-img sq" src="' + escapeHtml(r.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '';
      return '<article class="news-card top-row" data-lane="' + laneOf(r) + '" tabindex="0" role="link" aria-label="Open discussion: ' + escapeHtml(mqDecodeEntities(r.headline)) + '" data-news-id="' + escapeHtml(r.id) + '">' +
        '<span class="tr-n">' + Number(r.trend_rank) + '</span>' + img +
        '<div class="tr-main"><div class="news-h">' + escapeHtml(mqDecodeEntities(r.headline)) + '</div>' + (r.summary ? '<div class="tr-sub">' + escapeHtml(mqDecodeEntities(r.summary)) + '</div>' : '') + '</div>' +
        mvHtml(r) + (c ? '<span class="tr-c">' + plural(c, 'comment') + '</span>' : '') + '</article>';
    }
    // Biggest risers: the largest jumps up a source's chart since the last day we have data for.
    function risersHtml(rows){
      var ups = rows.filter(function(r){ var m = movesById[r.id]; return r.kind === 'trend' && m && m.hist && m.prev != null && m.prev > Number(r.trend_rank); })
        .sort(function(a, b){ var ma = movesById[a.id], mb = movesById[b.id]; return (mb.prev - Number(b.trend_rank)) - (ma.prev - Number(a.trend_rank)) || Number(a.trend_rank) - Number(b.trend_rank); })
        .slice(0, 3);
      if(!ups.length) return '';
      return '<div class="news-top3"><div class="nt3-h">Biggest risers today</div>' + ups.map(function(r){
        var m = movesById[r.id], d = m.prev - Number(r.trend_rank);
        return '<article class="news-card top-row" data-lane="' + laneOf(r) + '" tabindex="0" role="link" aria-label="Open discussion: ' + escapeHtml(mqDecodeEntities(r.headline)) + '" data-news-id="' + escapeHtml(r.id) + '">' +
          '<span class="tr-n up">+' + d + '</span><div class="tr-main"><div class="news-h">' + escapeHtml(mqDecodeEntities(r.headline)) + '</div><div class="tr-sub">#' + m.prev + ' to #' + Number(r.trend_rank) + ' on ' + escapeHtml(r.source_name || 'the chart') + '</div></div></article>';
      }).join('') + '</div>';
    }
    Feed.prototype.render = function(){
      var list = this.pick();
      var topHtml = '', chartMode = false;
      if(this.topicChips){
        var counts = {}, tl = TOPICS[this.lane];
        (this.laneList || []).forEach(function(r){ var k = topicOf(r); counts[k] = (counts[k] || 0) + 1; });
        var shown = tl ? tl.filter(function(t){ return counts[t[0]]; }) : [];
        if(this.topic !== 'all' && !counts[this.topic]) this.topic = 'all';
        this.topicChips.style.display = shown.length > 1 ? '' : 'none';
        var tself = this;
        this.topicChips.innerHTML = shown.length > 1 ? '<button type="button" class="feed-chip' + (this.topic === 'all' ? ' on' : '') + '" data-topic="all">All</button>' + shown.map(function(t){
          return '<button type="button" class="feed-chip' + (tself.topic === t[0] ? ' on' : '') + '" data-topic="' + t[0] + '">' + t[1] + '</button>'; }).join('') : '';
      }
      // Source chips: only sources that actually have rows right now
      if(this.srcChips){
        var have = {}; (allRows || []).forEach(function(r){ if(r.kind === 'trend' && r.take_question) have[r.source_name] = 1; });
        var self = this;
        this.srcChips.innerHTML = '<button type="button" class="feed-chip' + (this.source === 'all' ? ' on' : '') + '" data-source="all">All sources</button>' +
          SRC_CHIPS.filter(function(c){ return have[c[0]]; }).map(function(c){ return '<button type="button" class="feed-chip' + (self.source === c[0] ? ' on' : '') + '" data-source="' + c[0] + '">' + c[1] + '</button>'; }).join('');
      }
      if(this.cfg.kind === 'news' && list.length > 5){
        // "Most trending" = the same hot score as the Hot sort: comments and votes, fading with age.
        var hottest = list.slice().sort(function(a, b){ return hot(b) - hot(a); }).slice(0, 5);
        var topIds = {}; hottest.forEach(function(r){ topIds[r.id] = 1; });
        list = list.filter(function(r){ return !topIds[r.id]; });
        topHtml = '<div class="news-top3"><div class="nt3-h">Trending</div>' + hottest.map(function(r, i){ return topRowHtml(r, i + 1); }).join('') + '</div>';
      }else if(this.cfg.kind === 'trending' && this.source !== 'all'){
        // One source selected: show its chart in rank order, top 10.
        chartMode = true;
        var chart = list.filter(function(r){ return r.trend_rank; }).sort(function(a, b){ return Number(a.trend_rank) - Number(b.trend_rank); }).slice(0, 10);
        var label = (SRC_CHIPS.filter(function(c){ return c[0] === this.source; }, this)[0] || [0, this.source])[1];
        topHtml = chart.length ? '<div class="news-top3 chart"><div class="nt3-h">Top ' + chart.length + ' on ' + escapeHtml(this.source) + '</div><div class="nt3-rows">' + chart.map(chartRowHtml).join('') + '</div></div>' : '';
        list = [];
      }else if(this.cfg.kind === 'trending'){
        topHtml = risersHtml(list);
      }
      this.grid.innerHTML = topHtml + (topHtml && list.length && this.cfg.kind === 'news' ? '<div class="news-sec">Latest stories</div>' : '') + list.map(cardHtml).join('') || '<p class="news-empty">' + (this.cfg.kind === 'news' ? 'No stories in this lane right now. Check back soon.' : 'Nothing trending in this lane right now. Check back soon.') + '</p>';
      if(chartMode){ var cr = this.grid.querySelector('.nt3-rows'); if(cr) mqFoldList(cr, 5, { one: 'more', many: 'more' }); }
      // Updated line: newest row of this tab's kind
      var kinds = this.cfg.kind === 'news' ? ['news'] : ['trend', 'post'];
      var newest = 0; (allRows || []).forEach(function(r){ if(kinds.indexOf(r.kind) >= 0 && r.take_question){ var t = new Date(r.fetched_at || r.published_at || 0).getTime(); if(t > newest) newest = t; } });
      this.updEl.textContent = newest ? 'Updated ' + freshText(newest) : '';
      this.updEl.setAttribute('data-ts', String(newest || ''));
      paintAll(this.grid);
      wireEmbeds(this.grid);
    };
    Feed.prototype.load = async function(){
      if(this.loaded) return;
      this.loaded = true;
      var rows = await loadRows();
      if(!rows){ this.loaded = false; this.grid.innerHTML = '<p class="news-empty">This is not loading right now. Try again in a minute.</p>'; return; }
      var ids = rows.map(function(r){ return r.id; });
      var withTake = rows.filter(function(r){ return r.take_question; }).map(function(r){ return r.id; });
      var trendIds = rows.filter(function(r){ return r.kind === 'trend' && r.trend_rank; }).map(function(r){ return r.id; });
      await Promise.all([loadStats(ids), loadResults(withTake), loadMoves(trendIds)]);
      feeds.forEach(function(f){ if(f.loaded) f.render(); });
      openFromUrl();
    };

    function onGridClick(ev){
      var btn = ev.target.closest('.take-btn');
      if(btn){ ev.stopPropagation(); if(!btn.disabled) vote(btn); return; }
      if(ev.target.closest('a') || ev.target.closest('.post-embed')) return;
      var card = ev.target.closest('.news-card');
      if(card && card.getAttribute('data-news-id')) openThread(card.getAttribute('data-news-id'), true);
    }

    // ---- thread screen ----
    var view = document.getElementById('thread-view');
    var inner = document.getElementById('thread-inner');
    var openId = null, openedByUs = false, poll = null, handle = null, sortMode = 'top';

    // Pull the headline number out of a story ("up 1,300%", "$5.2 billion") for the big stat cell.
    function keyStat(r){
      var txt = mqDecodeEntities(r.headline || '') + ' . ' + mqDecodeEntities(r.summary || '');
      var src = [mqDecodeEntities(r.headline || ''), mqDecodeEntities(r.summary || '')];
      var UP = /\b(up|jump|jumps|jumped|surge|surges|surged|soar|soars|soared|rise|rises|rose|gain|gains|gained|climb|climbs|climbed|rally|rallies|rallied|grow|grew|boost|record|higher)\b/i;
      var DN = /\b(down|fall|falls|fell|drop|drops|dropped|plunge|plunges|plunged|slump|slumps|slumped|sink|sinks|sank|slide|slides|slid|cut|cuts|lower|decline|declines|declined|lose|loses|lost|loss)\b/i;
      for(var i = 0; i < src.length; i++){
        var t = src[i], m = t.match(/(\d[\d,]*(?:\.\d+)?)\s?(%|percent\b)/i), money = t.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|[TBMK]\b)?/i);
        var pick = m || money; if(!pick) continue;
        var at = t.indexOf(pick[0]), near = t.slice(Math.max(0, at - 40), at + pick[0].length + 20);
        var dir = DN.test(near) && !UP.test(near) ? 'dn' : UP.test(near) ? 'up' : '';
        var value;
        if(m && (!money || m.index <= money.index || !money)){
          if(Number(m[1].replace(/,/g, '')) > 100000) continue;
          value = (dir === 'up' ? '+' : dir === 'dn' ? '−' : '') + m[1] + '%';
        }else{
          var u = (money[2] || '').toLowerCase();
          var suf = u === 'trillion' || u === 't' ? 'T' : u === 'billion' || u === 'b' ? 'B' : u === 'million' || u === 'm' ? 'M' : u === 'thousand' || u === 'k' ? 'K' : '';
          value = '$' + money[1] + suf;
        }
        var lab = /this year|of the year|year[- ]to[- ]date|so far this|ytd/i.test(near + ' ' + t) ? 'this year' : /today|on monday|on tuesday|on wednesday|on thursday|on friday|overnight/i.test(near) ? 'today' : /week/i.test(near) ? 'this week' : /month/i.test(near) ? 'this month' : m ? 'change' : '';
        return { value: value, label: lab, dir: dir };
      }
      return null;
    }
    // Article screen head: lane bar, chips, headline with a small photo, quick facts, short summary.
    function tscHead(r, isPost, yt, isTrend, text){
      var when = ago(r.published_at || r.fetched_at), lane = LANE_NAME[laneOf(r)] || '';
      var photo = (!isPost && !yt && r.image_url && /^https:\/\//i.test(r.image_url))
        ? '<div class="tsc-ph"><img src="' + escapeHtml(r.image_url) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>' : '';
      var facts = [];
      if(isTrend && r.trend_rank) facts.push(['Rank', '#' + Number(r.trend_rank) + ' ' + mvHtml(r)]);
      if(isPost) facts.push(['Platform', escapeHtml(platformOf(r.article_url || ''))]);
      facts.push([isTrend ? 'On' : 'Source', escapeHtml(r.source_name || (isTrend ? 'The chart' : '–'))]);
      facts.push([isTrend ? 'Topic' : 'Published', isTrend ? escapeHtml(lane) : (when ? escapeHtml(when) : '–')]);
      if(!isTrend && !isPost) facts.unshift(['Topic', escapeHtml(lane)]);
      var ks = null;
      facts = facts.slice(0, ks ? 2 : 3);
      var statCell = ks ? '<div class="tsc-stat ' + ks.dir + '"><span>' + escapeHtml(ks.label || 'Key number') + '</span><b>' + escapeHtml(ks.value) + '</b></div>' : '';
      return '<div class="tsc-in"><div class="tsc-chips"><span class="tsc-lane">' + escapeHtml(lane) + '</span>' + (isTrend ? '<span class="tsc-tr">Trending</span>' : '') + (when ? '<span class="tsc-when">' + escapeHtml(when) + '</span>' : '') + '</div>' +
        '<div class="tsc-hrow"><h3 class="tsc-h">' + escapeHtml(mqDecodeEntities(r.headline)) + '</h3>' + photo + '</div>' +
        '<div class="tsc-facts" style="--n:' + (facts.length + (ks ? 1 : 0)) + '">' + statCell + facts.map(function(f){ return '<div><span>' + f[0] + '</span><b>' + f[1] + '</b></div>'; }).join('') + '</div>' +
        (text ? '<p class="tsc-sum">' + escapeHtml(text) + '</p>' : '') + '</div>';
    }
    async function renderThread(id){
      var r = rowsById[id];
      if(!r){
        var rows = await loadRows(); r = rowsById[id];
        if(!r){
          var one = await sb.from('news_ticker').select('*').eq('id', id).maybeSingle();
          if(one && one.data){ r = one.data; r.kind = r.kind || 'news'; rowsById[id] = r; }
        }
      }
      if(!r){ closeThread(); return; }
      openId = id;
      await Promise.all([loadStats([id]), loadResults(r.take_question ? [id] : [])]);
      var s = statsById[id] || {};
      var isPost = r.kind === 'post', isTrend = r.kind === 'trend', yt = isYt(r), text = isPost ? '' : r.summary;
      var read = (r.article_url && !isPost && !isTrend) ? '<a class="thread-read" href="' + escapeHtml(r.article_url) + '" target="_blank" rel="noopener noreferrer">Read the full story' + (r.source_name ? ' at ' + escapeHtml(r.source_name) : '') + ' ↗</a>' : '';
      inner.innerHTML =
        '<div class="thread-top"><button type="button" class="thread-back" id="thread-back" aria-label="Back">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>Back</button>' +
          '<button type="button" class="thread-share" id="thread-share">Share</button></div>' +
        '<div class="thread-story tsc" data-lane="' + laneOf(r) + '"><div class="tsc-bar"></div>' + tscHead(r, isPost, yt, isTrend, text) +
          (read ? '<div class="tsc-readwrap">' + read + '</div>' : '') +
          ((isPost || yt) ? embedHtml(r) : '') + takeHtml(r) + '</div>' +
        '<div class="thread-cmt-head"><h4>Discussion <span id="thread-count">' + (Number(s.comments) ? '· ' + Number(s.comments) : '') + '</span></h4>' +
          '<span class="thread-sort"><button type="button" class="feed-chip on" data-tsort="top">Top</button><button type="button" class="feed-chip" data-tsort="new">New</button></span></div>' +
        '<details class="cmt thread-cmt" open data-question-id="' + escapeHtml(id) + '" data-sort="' + sortMode + '"><summary class="cmt-sum" style="display:none"><span>Comments <span class="cmt-count"></span></span></summary>' +
          '<div class="cmt-body"><div class="cmt-compose"></div><div class="cmt-list"></div></div></details>';
      paintAll(inner);
      wireEmbeds(inner);
      document.getElementById('thread-back').addEventListener('click', closeThread);
      document.getElementById('thread-share').addEventListener('click', function(){ shareThread(r); });
      inner.querySelectorAll('[data-tsort]').forEach(function(b){
        b.classList.toggle('on', b.getAttribute('data-tsort') === sortMode);
        b.addEventListener('click', function(){
          sortMode = b.getAttribute('data-tsort');
          inner.querySelectorAll('[data-tsort]').forEach(function(x){ x.classList.toggle('on', x === b); });
          var box = inner.querySelector('.thread-cmt'); box.setAttribute('data-sort', sortMode);
          if(handle) handle.rerender();
        });
      });
      var session = null;
      try{ var sr = await sb.auth.getSession(); session = sr && sr.data && sr.data.session; }catch(e){}
      handle = await mqFillComments(inner, [{ q: { id: id } }], session, MQ_NEWS_COMMENT_API);
      clearInterval(poll);
      poll = setInterval(function(){
        if(!handle || document.hidden) return;
        var box = inner.querySelector('.thread-cmt'); var inp = box && box.querySelector('input');
        if(inp && (inp.value || document.activeElement === inp)) return;
        handle.reload();
      }, 20000);
      view.scrollTop = 0;
    }
    function openThread(id, push){
      if(!id) return;
      view.hidden = false; document.body.style.overflow = 'hidden';
      if(push){ openedByUs = true; try{ history.pushState({ thread: id }, '', '?thread=' + encodeURIComponent(id)); }catch(e){} }
      inner.innerHTML = '<div class="thread-top"><button type="button" class="thread-back" id="thread-back">Back</button></div><p class="news-empty">Loading…</p>';
      document.getElementById('thread-back').addEventListener('click', closeThread);
      renderThread(id);
    }
    function hideThread(){
      var id = openId; openId = null; handle = null; clearInterval(poll);
      view.hidden = true; document.body.style.overflow = '';
      if(id){ loadStats([id]).then(function(){ refreshFoot(id); }); }
    }
    function closeThread(){
      if(view.hidden) return;
      if(openedByUs){ openedByUs = false; try{ history.back(); return; }catch(e){} }
      try{ history.replaceState(null, '', location.pathname); }catch(e){}
      hideThread();
    }
    window.__mqCloseThread = closeThread;
    window.addEventListener('popstate', function(){
      var id = new URLSearchParams(location.search).get('thread');
      if(id){ if(view.hidden || openId !== id) openThread(id, false); }
      else hideThread();
    });
    function openFromUrl(){
      var id = new URLSearchParams(location.search).get('thread');
      if(id && view.hidden){
        var tab = document.querySelector('.pagenav-tab[data-page="news"]'); if(tab && !document.querySelector('#page-news').offsetParent) tab.click();
        openThread(id, false);
      }
    }
    function shareThread(r){
      var url = location.origin + '/?thread=' + encodeURIComponent(r.id);
      var data = { title: r.headline, text: r.headline + ' — join the debate on Marqit', url: url };
      var note = document.getElementById('thread-share');
      mqOpenShareSheet({ title: r.headline, text: r.headline + ' \u2014 join the debate on Marqit', url: url });
    }
    view.addEventListener('click', function(ev){
      var btn = ev.target.closest('.take-btn'); if(btn && !btn.disabled){ vote(btn); return; }
      if(ev.target === view) closeThread();
    });
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && !view.hidden) closeThread(); });

    new Feed({ page: 'news', gridId: 'news-grid', chipsId: 'news-chips', kind: 'news', defaultSort: 'new' });
    new Feed({ page: 'trending', gridId: 'trending-grid', chipsId: 'trending-chips', kind: 'trending', defaultSort: 'hot' });

    // ---- Freshness: "Updated X ago" ticks along, and a small dot on the News / Trending tab when there is something new since you last opened it ----
    setInterval(function(){
      feeds.forEach(function(f){
        var ts = Number(f.updEl && f.updEl.getAttribute('data-ts'));
        if(ts) f.updEl.textContent = 'Updated ' + freshText(ts);
      });
    }, 60000);
    (function(){
      var TABS = [
        { page: 'news', key: 'mq_seen_news', q: function(){ return sb.from('news_ticker').select('fetched_at').eq('kind', 'news').not('take_question', 'is', null).not('image_url', 'is', null).order('fetched_at', { ascending: false }).limit(1); } },
        { page: 'trending', key: 'mq_seen_trending', q: function(){ return sb.from('news_ticker').select('fetched_at').in('kind', ['trend', 'post']).not('take_question', 'is', null).order('fetched_at', { ascending: false }).limit(1); } }
      ];
      function getSeen(k){ try{ return Number(localStorage.getItem(k)) || 0; }catch(e){ return 0; } }
      function setSeen(k, v){ try{ localStorage.setItem(k, String(v)); }catch(e){} }
      TABS.forEach(function(t){
        var tab = document.querySelector('.pagenav-tab[data-page="' + t.page + '"]');
        if(!tab) return;
        t.tab = tab; t.newest = 0;
        // Opening the tab marks everything as seen.
        tab.addEventListener('click', function(){ if(t.newest) setSeen(t.key, t.newest); tab.classList.remove('has-new'); });
      });
      async function check(){
        for(var i = 0; i < TABS.length; i++){
          var t = TABS[i]; if(!t.tab) continue;
          try{
            var res = await t.q();
            var row = res && res.data && res.data[0];
            if(!row) continue;
            t.newest = new Date(row.fetched_at).getTime();
            var seen = getSeen(t.key);
            if(!seen){ setSeen(t.key, t.newest); continue; }          // first visit: no dot, just remember where they are
            var open = t.tab.classList.contains('active');
            if(open){ setSeen(t.key, t.newest); t.tab.classList.remove('has-new'); }
            else t.tab.classList.toggle('has-new', t.newest > seen);
          }catch(e){}
        }
      }
      check();
      setInterval(check, 300000);
    })();

    // A shared link (?thread=...) opens straight into the discussion.
    if(new URLSearchParams(location.search).get('thread')){
      var first = feeds[0]; first.load();
    }
  })();


})();



/* Marqit motion layer. Purely cosmetic: if any of this fails, the site still works. */
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) Headline words rise in one after another (works for one-line or multi-line headlines)
  document.querySelectorAll('.hero h1').forEach(function(h){
    if(h.getAttribute('data-split')) return;
    var lines = Array.prototype.slice.call(h.querySelectorAll('.h1-line'));
    var idx = 0;
    function splitEl(el){
      var words = el.textContent.trim().split(/ +/);
      el.innerHTML = words.map(function(w){ return '<span class="w" aria-hidden="true"><span style="--i:' + (idx++) + '">' + w + '</span></span>'; }).join(' ');
    }
    var label = (lines.length ? lines.map(function(l){ return l.textContent.trim(); }).join(' ') : h.textContent.trim());
    h.setAttribute('aria-label', label);
    if(lines.length){ lines.forEach(splitEl); } else { splitEl(h); }
    h.setAttribute('data-split', '1');
  });

  // 2) Sliding underline under the active tab (follows however the tab was switched)
  (function(){
    var row = document.querySelector('.pagenav-row');
    if(!row) return;
    var ind = document.createElement('span');
    ind.className = 'tab-ind';
    row.appendChild(ind);
    row.classList.add('has-ind');
    function place(scrollIntoView){
      var a = row.querySelector('.pagenav-tab.active');
      if(!a){ ind.style.opacity = 0; return; }
      ind.style.opacity = 1;
      ind.style.setProperty('--x', a.offsetLeft + 'px');
      ind.style.setProperty('--w', a.offsetWidth + 'px');
      if(scrollIntoView === true && a.scrollIntoView){ a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
    }
    new MutationObserver(function(){ place(true); }).observe(row, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', function(){ place(false); });
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){ place(false); }); }
    place(false);
  })();

  // 3) Cards ease in as they scroll into view (staggered within a row)
  (function(){
    if(reduce || !('IntersectionObserver' in window)) return;
    var sel = '.rule-card,.duel-card,.streak-card,.tier-row,.tier-chip-row,.recap-card,.share-card,.board,.fold,.section .ex-title';
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    if(!els.length) return;
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        el.classList.add('in');
        var done = function(){ el.classList.remove('reveal', 'in'); el.style.transitionDelay = ''; el.removeEventListener('transitionend', done); };
        el.addEventListener('transitionend', done);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function(el){
      var sibs = Array.prototype.filter.call(el.parentNode.children, function(c){ return c.matches(sel); });
      el.style.transitionDelay = (Math.min(sibs.indexOf(el), 5) * 70) + 'ms';
      el.classList.add('reveal');
      io.observe(el);
    });
  })();

  // 4) Swipe carousels: stretching dots, tap-to-jump, gentle auto-advance
  document.querySelectorAll('[data-carousel]').forEach(function(row){
    var slides = Array.prototype.slice.call(row.children);
    if(slides.length < 2) return;
    var dots = document.createElement('div');
    dots.className = 'dots';
    slides.forEach(function(_, i){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dot' + (i === 0 ? ' on' : ''); b.setAttribute('aria-label', 'Go to card ' + (i + 1));
      b.addEventListener('click', function(){ userTouched(); goTo(i); });
      dots.appendChild(b);
    });
    row.parentNode.insertBefore(dots, row.nextSibling);

    function current(){
      var mid = row.scrollLeft + row.clientWidth / 2, best = 0, bestD = 1e9;
      slides.forEach(function(sl, i){ var d = Math.abs(sl.offsetLeft + sl.offsetWidth / 2 - mid); if(d < bestD){ bestD = d; best = i; } });
      return best;
    }
    function paint(){ var c = current(); Array.prototype.forEach.call(dots.children, function(d, i){ d.classList.toggle('on', i === c); }); }
    function goTo(i){
      var sl = slides[i];
      row.scrollTo({ left: sl.offsetLeft - (row.clientWidth - sl.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
    row.addEventListener('scroll', function(){ window.requestAnimationFrame(paint); }, { passive: true });

    var lastTouch = 0, visible = false;
    function userTouched(){ lastTouch = Date.now(); }
    ['pointerdown', 'wheel', 'touchstart'].forEach(function(ev){ row.addEventListener(ev, userTouched, { passive: true }); });
    if(!reduce && 'IntersectionObserver' in window){
      new IntersectionObserver(function(en){ visible = en[0].isIntersecting; }, { threshold: 0.6 }).observe(row);
      setInterval(function(){
        if(!visible || document.hidden || Date.now() - lastTouch < 9000) return;
        goTo((current() + 1) % slides.length);
      }, 4200);
    }
    paint();
  });
})();



/* Safety net: never leave a shimmer running forever if a leaderboard can't load. */
setTimeout(function(){
  document.querySelectorAll('.skel-rows').forEach(function(el){ el.outerHTML = '<div class="brow"><span>Nothing to show yet.</span></div>'; });
  var tp = document.getElementById('top-predictor-line');
  if(tp && tp.querySelector('.sk')) tp.textContent = 'Top Predictor of the Week: no resolved calls yet.';
}, 8000);


// (Decorative live-price ticker widget removed at the owner's request --
// it was never tied to real data.)


/* Privacy / Terms open in a pop-up over the page (quick to open, quick to close).
   The links keep their normal href, so ctrl/cmd-click, middle-click and
   browsers without JS still open the full page. */
(function(){
  var overlay = null, frame = null, titleEl = null, closeBtn = null, lastFocus = null;
  var TITLES = { 'privacy.html': 'Privacy Policy', 'terms.html': 'Terms of Service' };

  function build(){
    overlay = document.createElement('div');
    overlay.className = 'mq-legal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mq-legal-title');
    overlay.innerHTML =
      '<div class="mq-legal-panel">' +
        '<div class="mq-legal-bar"><span class="mq-legal-title" id="mq-legal-title"></span>' +
        '<button type="button" class="mq-legal-close" aria-label="Close">\u2715</button></div>' +
        '<iframe class="mq-legal-frame" title="Policy"></iframe>' +
      '</div>';
    document.body.appendChild(overlay);
    frame = overlay.querySelector('.mq-legal-frame');
    titleEl = overlay.querySelector('.mq-legal-title');
    closeBtn = overlay.querySelector('.mq-legal-close');
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    frame.addEventListener('load', function(){
      // Links inside the policy (e.g. back to the site) open in a new tab, not inside the pop-up.
      try{ frame.contentDocument.querySelectorAll('a[href]').forEach(function(l){ l.target = '_blank'; l.rel = 'noopener'; }); }catch(e){}
    });
  }
  function open(page){
    if(!overlay) build();
    lastFocus = document.activeElement;
    titleEl.textContent = TITLES[page] || 'Marqit';
    frame.src = page;
    overlay.classList.add('on');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function close(){
    if(!overlay) return;
    overlay.classList.remove('on');
    document.body.style.overflow = '';
    frame.removeAttribute('src');
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest && e.target.closest('a[href="/privacy.html"], a[href="/terms.html"]');
    if(!link) return;
    e.preventDefault();
    open(link.getAttribute('href').replace('/', ''));
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay && overlay.classList.contains('on')) close();
  });
})();

/* Play tab: show how many buddies / rivals you have on the collapsed row, so the count is visible without opening it. */
(function(){
  function bind(listId, badgeId){
    var list = document.getElementById(listId);
    var badge = document.getElementById(badgeId);
    if(!list || !badge) return;
    function update(){
      // Rows tucked into a "Show N more" dropdown still count.
      var n = 0;
      Array.prototype.forEach.call(list.children, function(c){
        n += (c.classList && c.classList.contains('mq-list-more')) ? Math.max(0, c.children.length - 1) : 1;
      });
      badge.textContent = n ? String(n) : '';
      badge.style.display = n ? '' : 'none';
    }
    new MutationObserver(update).observe(list, { childList: true });
    update();
  }
  bind('buddy-active-list', 'buddy-fold-count');
  bind('rival-active-list', 'rival-fold-count');
})();

(function(){
  var join=document.getElementById('join'), title=document.getElementById('auth-panel-title');
  if(!join||!title) return;
  function sync(){ title.style.visibility = join.style.display==='none' || !join.style.display ? 'visible' : 'hidden'; }
  new MutationObserver(sync).observe(join,{attributes:true,attributeFilter:['style']});
  sync();
})();
