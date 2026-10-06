/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */
(function(){
  function isValidEmail(v){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function isValidUsername(v){
    return /^[a-zA-Z0-9_]{3,24}$/.test(v);
  }

  var SUPABASE_URL = 'https://ivapcztkasjfetntkzxy.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_S1DZQXDDpffETdJh2xJONQ_QSNjnunn';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  var swRegistrationPromise = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.register('/sw.js').catch(function(){ return null; })
    : Promise.resolve(null);

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
    if(!isValidEmail(email)){
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
        options: { data: { username: username, age_confirmed: true, state: state || null, signup_source: pendingSignupSource }, emailRedirectTo: window.location.origin + window.location.pathname }
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
      msgEl.textContent = 'Check ' + email + ' for a link to confirm your account, then log in.';
      return;
    }

    btn.textContent = 'Logging in…';
    const { error } = await sb.auth.signInWithPassword({ email: email, password: password });
    btn.disabled = false;
    btn.textContent = originalText;
    if(error){
      msgEl.classList.add('err');
      msgEl.textContent = error.message.indexOf('Invalid login') > -1
        ? 'Wrong email or password.'
        : (error.message.indexOf('not confirmed') > -1
          ? 'Confirm your email first \u2014 check your inbox for the link.'
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
      const timeNote = document.querySelector('.auth-time');
      if(timeNote) timeNote.style.display = isSignup ? '' : 'none';
      if(forgotLinkEl) forgotLinkEl.style.display = isSignup ? 'none' : 'block';
      if(passwordEl) passwordEl.autocomplete = isSignup ? 'new-password' : 'current-password';
      // Explicitly toggle 'required' too — some Safari versions still block submit
      // on a required field hidden only via CSS display:none, with no visible error.
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
    document.getElementById('auth-choice').style.display = 'flex';
    document.getElementById('form-msg').textContent = '';
    document.getElementById('form-msg').className = 'form-msg';
  }
  document.getElementById('show-email-form-btn').addEventListener('click', function(){
    document.getElementById('auth-choice').style.display = 'none';
    document.getElementById('join').style.display = 'flex';
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
  document.getElementById('google-auth-btn').addEventListener('click', async function(){
    const msg = document.getElementById('form-msg');
    msg.className = 'form-msg';
    msg.textContent = '';
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
    if(navigator.share){
      try{ await navigator.share({ text: text, url: url }); }catch(e){ /* canceled */ }
      return;
    }
    try{ await navigator.clipboard.writeText(text + ' ' + url); msgEl.className = 'form-msg ok'; msgEl.textContent = 'Copied. Paste it anywhere.'; }
    catch(e){ msgEl.className = 'form-msg err'; msgEl.textContent = 'Could not copy \u2014 try again.'; }
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
    const signupSource = (user.user_metadata && user.user_metadata.signup_source) || storedSignupSource || 'organic';

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
    const { error } = await sb.from('profiles').update({ username: newUsername }).eq('id', session.user.id);
    btn.disabled = false;
    if(error){
      msg.className = 'form-msg err';
      msg.textContent = error.code === '23505' ? 'That username is taken.' : 'Could not save \u2014 try again.';
      return;
    }
    document.getElementById('username-prompt-backdrop').style.display = 'none';
    const navUsername = document.getElementById('nav-username');
    if(navUsername) navUsername.textContent = newUsername;
    const heroMsg = document.getElementById('hero-status-msg');
    if(heroMsg && heroMsg.textContent.indexOf('signed in as') !== -1){
      heroMsg.textContent = 'You\u2019re signed in as ' + newUsername + '.';
    }
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
      heroMsg.className = 'form-msg ok';
      heroMsg.textContent = needsUsername ? 'Pick a username to finish setting up your account.' : 'You\'re signed in as ' + username + '.';
    }
    if(needsUsername) promptUsernameChoice();
    loadMyStats();
    loadShareCard(username);
    loadGroupSection();
    loadStateBoard();
    loadBuddySection();
    loadRivalSection();
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
    perfect_day:   { icon: '\ud83c\udfaf', label: 'Perfect Day',   desc: 'Went 3-for-3 on a single day\u2019s calls.' },
    buddy_bonus:   { icon: '\ud83e\udd1d', label: 'Buddy Bonus',   desc: 'Matched a pick with a buddy.' },
    rival_win:     { icon: '\ud83c\udfc6', label: 'Showdown Winner', desc: 'Won a Rival Showdown.' },
    // Tiered achievements: times_earned isn't a raw count of events, it's the
    // tier reached (RPC divides the underlying count by the tier size), so
    // "\u00d73" here really means "3rd tier" -- 30 correct calls, 300
    // predictions, a 42-day streak, etc. See award_achievement in Supabase.
    sharp_shooter: { icon: '\ud83c\udff9', label: 'Sharp Shooter', desc: 'Every 10 lifetime correct calls earns another tier.', tiered: true, tierSize: 10, tierUnit: 'correct calls' },
    century_club:  { icon: '\ud83d\udcaf', label: 'Century Club',  desc: 'Every 100 lifetime predictions earns another tier.', tiered: true, tierSize: 100, tierUnit: 'predictions' },
    iron_streak:   { icon: '\u26d3\ufe0f', label: 'Iron Streak',   desc: 'Every 14-day streak milestone your best-ever streak passes earns another tier.', tiered: true, tierSize: 14, tierUnit: 'day streak' },
    golden_touch:  { icon: '\u2b50',       label: 'Golden Touch',  desc: 'Every golden star you earn is its own tier.', tiered: true, tierSize: 1, tierUnit: 'golden star' },
    speed_demon:   { icon: '\u26a1',       label: 'Speed Demon',   desc: 'Every 5 correct calls made during a drop bonus window earns another tier.', tiered: true, tierSize: 5, tierUnit: 'drop-bonus calls' },
    point_baron:   { icon: '\ud83d\udc51', label: 'Point Baron',   desc: 'Every 1,000 lifetime points earns another tier.', tiered: true, tierSize: 1000, tierUnit: 'points' },
    regular:       { icon: '\ud83d\udcc5', label: 'Regular',       desc: 'Every 30 days you\u2019ve made a pick earns another tier.', tiered: true, tierSize: 30, tierUnit: 'days played' }
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
  function mqCheckTieredAchievements(userId){
    if(!userId) return;
    TIERED_ACHIEVEMENT_KEYS.forEach(function(key){ mqAwardAchievement(userId, key); });
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
      '<span class="mq-ach-icon">' + meta.icon + '</span>' +
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
      if(circleEmoji) circleEmoji.textContent = profileRow.avatar_emoji || '🎯';
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
      tierRow.querySelectorAll('.tier-chip').forEach(function(chip){
        chip.classList.toggle('active', chip.getAttribute('data-tier') === myTier);
      });
    }
  }

  const AVATAR_EMOJIS = ['🎯','🔥','⚡','🎲','🧠','🎬','🏆','⭐','🚀','🎧','📈','🎮','🦉','🐺','🦅','🐢','🍀','☕','🌙','🌊'];
  const AVATAR_COLORS = ['#17191D','#128A50','#C2372A','#2D5FA6','#8A4FBF','#C77D2E','#3B8C8C','#6B7280'];
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

    selectedAvatarEmoji = profileRow.avatar_emoji || '🎯';
    selectedAvatarColor = profileRow.avatar_color || '#17191D';

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
        badge.innerHTML = '<span class="mq-ach-badge-icon">' + meta.icon + '</span><span class="mq-ach-badge-label"></span>' +
          (earned && times > 1 ? '<span class="mq-ach-badge-count">×' + times + '</span>' : '');
        badge.querySelector('.mq-ach-badge-label').textContent = meta.label;
        achievementsGrid.appendChild(badge);
      });
    }

    document.getElementById('profile-modal-avatar').textContent = selectedAvatarEmoji;
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

    // Emoji picker
    const emojiPicker = document.getElementById('avatar-emoji-picker');
    emojiPicker.innerHTML = '';
    AVATAR_EMOJIS.forEach(function(emoji){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = emoji;
      btn.style.cssText = 'width:36px; height:36px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; border:2px solid ' + (emoji === selectedAvatarEmoji ? 'var(--ink)' : 'var(--line)') + '; background:var(--panel);';
      btn.addEventListener('click', function(){
        selectedAvatarEmoji = emoji;
        document.getElementById('profile-modal-avatar').textContent = emoji;
        emojiPicker.querySelectorAll('button').forEach(function(b){ b.style.borderColor = (b.textContent === emoji) ? 'var(--ink)' : 'var(--line)'; });
      });
      emojiPicker.appendChild(btn);
    });

    // Color picker
    const colorPicker = document.getElementById('avatar-color-picker');
    colorPicker.innerHTML = '';
    AVATAR_COLORS.forEach(function(color){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Color ' + color);
      btn.style.cssText = 'width:30px; height:30px; border-radius:50%; cursor:pointer; background:' + color + '; border:2px solid ' + (color === selectedAvatarColor ? 'var(--ink)' : 'transparent') + '; outline:1px solid var(--line);';
      btn.addEventListener('click', function(){
        selectedAvatarColor = color;
        document.getElementById('profile-modal-avatar').style.background = color;
        colorPicker.querySelectorAll('button').forEach(function(b){ b.style.borderColor = (b.style.background === color || b.getAttribute('aria-label') === 'Color ' + color) ? 'var(--ink)' : 'transparent'; });
      });
      colorPicker.appendChild(btn);
    });
    document.getElementById('profile-customization-msg').textContent = '';

    // Picks history — all-time accuracy computed from the full set, most recent 30 shown
    const { data: picks } = await sb
      .from('predictions')
      .select('choice, created_at, daily_questions!inner(question_text, category, question_date, correct_answer, resolved)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    const picksList = document.getElementById('profile-picks-list');
    picksList.innerHTML = '';
    if(!picks || picks.length === 0){
      picksList.innerHTML = '<p class="ex-sub">No picks yet — head to Play to make your first call.</p>';
    }else{
      picks.slice(0, 30).forEach(function(p){
        const q = p.daily_questions;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--panel); border:1px solid var(--line); border-radius:10px;';
        let resultBadge = '<span style="font-size:11px; color:var(--ink-soft);">Pending</span>';
        if(q.resolved){
          const wasCorrect = p.choice === q.correct_answer;
          resultBadge = '<span style="font-size:11px; font-weight:700; color:' + (wasCorrect ? 'var(--yes)' : 'var(--no)') + ';">' + (wasCorrect ? 'Correct' : 'Missed') + '</span>';
        }
        const dateLabel = q.question_date;
        const catLabel = CATEGORY_LABELS[q.category] || q.category;
        row.innerHTML =
          '<div style="flex:1; min-width:0;">' +
            '<div class="q-text" style="font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>' +
            '<div style="font-size:11px; color:var(--ink-soft); margin-top:2px;">' + dateLabel + ' · ' + catLabel + ' · Called ' + p.choice.toUpperCase() + '</div>' +
          '</div>' + resultBadge;
        row.querySelector('.q-text').textContent = q.question_text;
        picksList.appendChild(row);
      });
    }

    document.getElementById('profile-modal-backdrop').style.display = 'flex';
  }

  const profileCircleBtn = document.getElementById('profile-circle-btn');
  if(profileCircleBtn) profileCircleBtn.addEventListener('click', openProfileModal);

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
      if(circleEmoji) circleEmoji.textContent = selectedAvatarEmoji;
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
        msg.textContent = 'Your browser doesn\u2019t support push notifications.';
        return;
      }

      if(nextOn){
        // Turning on: ask the browser for notification permission first. If the
        // person denies it (or the browser doesn't support it), don't save it as on.
        if(typeof Notification === 'undefined' || !Notification.requestPermission){
          msg.className = 'form-msg err';
          msg.textContent = 'Your browser doesn\u2019t support push notifications.';
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
          msg.textContent = 'Your browser doesn\u2019t support push notifications.';
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

    activeListEl.innerHTML = '';
    for(const r of (rivalRows || [])){
      const name = r.profiles ? r.profiles.username : 'your rival';
      const card = await renderRivalCard(session, r.rival_id, name, myStars);
      activeListEl.appendChild(card);
    }
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

    const { data: questions } = await sb.from('daily_questions').select('*').eq('question_date', date).order('category');
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
      return q.resolved && predMap[q.id] && predMap[q.id] === q.correct_answer;
    });
    if(perfectDay) mqMaybePromptShare(session.user.id, 'perfect_day', date);
    if(calledIt) mqMaybePromptShare(session.user.id, 'called_it', date);

    __mqShareCardData = { session: session, date: date, questions: questions, predMap: predMap, standing: standing, calledIt: calledIt };

    // Change 1: headline leads with standing, not the date/score.
    const titleEl = document.getElementById('share-card-title');
    if(titleEl) titleEl.textContent = standing.tierName + (standing.rankLabel ? ' \u00b7 ' + standing.rankLabel : '');
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

  // --- Shared share-card visual system -------------------------------------
  // One consistent look across every card type (personal results, pre-result
  // picks, group weekly recap, champion): dark ground + faint dot grid +
  // an accent-colored glow, the same "Marqit." wordmark with its green
  // accent dot, and the same logo-mark + url footer used on the site's own
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

  // One typeface for the whole card -- Plus Jakarta Sans, same as every
  // other stat/label on the card, just heavier (800) for the one hero
  // number/symbol. No separate serif display face. Loaded via a <link>
  // in index.html's <head>; canvas won't pick up a webfont until the
  // browser has actually fetched it, so every share handler awaits this
  // before drawing (falls back to Arial if blocked).
  const MQ_HEAD_FONT = "'Plus Jakarta Sans', Arial, sans-serif";
  const MQ_DISPLAY_FONT = MQ_HEAD_FONT;
  let __mqCardFontsReady = null;
  function mqEnsureCardFonts(){
    if(__mqCardFontsReady) return __mqCardFontsReady;
    __mqCardFontsReady = (async function(){
      try{
        if(document.fonts && document.fonts.load){
          await Promise.all([
            document.fonts.load("700 100px " + MQ_HEAD_FONT),
            document.fonts.load("800 100px " + MQ_HEAD_FONT)
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

  // Navy background, matching the og-image and the app's own dark UI --
  // and only the app's actual green/red (the same --yes/--no used for YES
  // and NO everywhere else on the site) ever show up as accent color, so
  // the cards read as the same product rather than a separate palette.
  const MQ_CARD_BG = '#0B1A3D';
  const MQ_YES = '#33D18B';
  const MQ_NO = '#F5644F';
  const MQ_INK = '#FFFFFF';
  const MQ_INK_SOFT = 'rgba(255,255,255,0.82)';
  const MQ_INK_MUTED = 'rgba(255,255,255,0.6)';
  const MQ_INK_FAINT = 'rgba(255,255,255,0.55)';
  function mqCardBackground(ctx, width, height){
    ctx.fillStyle = MQ_CARD_BG;
    ctx.fillRect(0, 0, width, height);
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

  // Small, quiet wordmark pinned to the top-left -- plain white type plus
  // a green dot, no filled "app icon" chip.
  function mqCardLogoRow(ctx, width, y){
    ctx.textAlign = 'left';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(width * 0.034) + "px " + MQ_HEAD_FONT;
    ctx.fillText('Marqit', width * 0.075, y);
    const tw = ctx.measureText('Marqit').width;
    ctx.fillStyle = MQ_YES;
    ctx.beginPath();
    ctx.arc(width * 0.075 + tw + width * 0.013, y - width * 0.028, width * 0.0065, 0, Math.PI * 2);
    ctx.fill();
  }

  // Full-width footer with a hairline top border -- white headline, muted
  // white url line, both sitting right on the navy ground rather than a
  // separate contrasting band.
  function mqCardFooterBand(ctx, width, height, line1, line2){
    const bandH = height * 0.135;
    const bandY = height - bandH;
    mqHairline(ctx, 0, width, bandY, 0.18);

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(width * 0.032) + "px " + MQ_HEAD_FONT;
    ctx.fillText(line1, width / 2, bandY + bandH * 0.48);

    ctx.fillStyle = MQ_INK_FAINT;
    ctx.font = "700 " + Math.round(width * 0.022) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, (line2 || 'playmarqit.com').toUpperCase(), width / 2, bandY + bandH * 0.78, width * 0.003);
  }

  // Draws the daily-results card onto a canvas at the given size (used for
  // both the 9:16 story export and the 1:1 square export -- same layout,
  // just different vertical spacing/canvas height). Returns the canvas.
  // Strava-style hero number for the streak, then today's calls as a row
  // of big Wordle-style tiles -- color and content fill the whole frame.
  function mqDrawResultsCard(width, height, data){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;

    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, height * 0.065);

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK_MUTED;
    ctx.font = "700 " + Math.round(width * 0.022) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, 'DAY STREAK', cx, height * 0.2, width * 0.01);

    // Hero number: same sans as the rest of the card, just bigger and
    // heavier -- no tilt, no shadow, no box, no separate typeface.
    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(width * 0.26) + "px " + MQ_DISPLAY_FONT;
    ctx.fillText(String(data.standing.streakDays), cx, height * 0.335);

    ctx.fillStyle = MQ_INK_SOFT;
    ctx.font = "700 " + Math.round(width * 0.026) + "px " + MQ_HEAD_FONT;
    const tierLine = data.standing.tierName + (data.standing.rankLabel ? '  \u00b7  ' + data.standing.rankLabel : '');
    ctx.fillText(tierLine, cx, height * 0.38);

    // Change 3: "Called it" line, if this card earned one -- a quiet
    // aside, not a badge shouting for attention.
    if(data.calledIt){
      ctx.fillStyle = MQ_YES;
      ctx.font = "700 " + Math.round(width * 0.021) + "px " + MQ_HEAD_FONT;
      ctx.fillText('Called it \u2014 only ' + data.calledIt.pct + '% saw this coming', cx, height * 0.415);
    }

    mqHairline(ctx, width * 0.3, width * 0.7, height * 0.47, 0.15);

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK_FAINT;
    ctx.font = "700 " + Math.round(width * 0.02) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, "TODAY'S CALLS", cx, height * 0.51, width * 0.012);

    // Change 2: each call as a plain text line -- category, then the
    // verdict itself as the only color on the card (the app's own
    // --yes/--no), no shape, box or icon of any kind.
    const lineGap = height * 0.058;
    let ly = height * 0.575;
    data.questions.forEach(function(q){
      const myChoice = data.predMap[q.id];
      const correct = !!myChoice && q.resolved && myChoice === q.correct_answer;
      const incorrect = !!myChoice && q.resolved && myChoice !== q.correct_answer;
      const color = correct ? MQ_YES : (incorrect ? MQ_NO : MQ_INK_MUTED);
      const word = correct ? 'Correct' : (incorrect ? 'Incorrect' : 'Pending');
      const rawLabel = CATEGORY_LABELS[q.category] || q.category;
      const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase() + '  \u2014  ';

      ctx.font = "700 " + Math.round(width * 0.028) + "px " + MQ_HEAD_FONT;
      const lw = ctx.measureText(label).width;
      const ww = ctx.measureText(word).width;
      const startX = cx - (lw + ww) / 2;

      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK_SOFT;
      ctx.fillText(label, startX, ly);
      ctx.fillStyle = color;
      ctx.fillText(word, startX + lw, ly);

      ly += lineGap;
    });

    // Change 7: a one-line challenge + the link, edge to edge.
    mqCardFooterBand(ctx, width, height, 'Beat my ' + data.standing.streakDays + '-day streak', 'playmarqit.com');

    return canvas;
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
    const refTag = mqGetReferralTag(session.user.id, 'daily_results', triggerName);
    const shareUrl = 'https://playmarqit.com/?' + refTag;
    const shareText = 'Beat my ' + data.standing.streakDays + '-day streak. ' + correctCount + '/' + data.questions.length + ' correct today. ' + shareUrl;

    await mqEnsureCardFonts();
    const canvas = mqDrawResultsCard(1080, 1920, data); // story ratio is the default share
    const packaged = await mqShareCanvasToFileAndCaption(canvas, 'marqit-results.png');
    if(!packaged){ if(msgEl){ msgEl.className = 'form-msg err'; msgEl.textContent = 'Could not generate the image \u2014 try again.'; } return; }

    mqLogCardShare(session.user.id, 'daily_results', triggerName);

    if(navigator.canShare && navigator.canShare({ files: [packaged.file] })){
      try{ await navigator.share({ files: [packaged.file], text: shareText, url: shareUrl }); }
      catch(e){ /* person canceled the share sheet -- not an error */ }
      return;
    }

    const blobUrl = URL.createObjectURL(packaged.blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'marqit-results.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 1000);

    if(msgEl){
      msgEl.className = 'form-msg ok';
      try{ await navigator.clipboard.writeText(shareText); msgEl.textContent = 'Image downloaded and caption copied \u2014 ready to post.'; }
      catch(e){ msgEl.textContent = 'Image downloaded \u2014 ready to post.'; }
      setTimeout(function(){ msgEl.textContent = ''; }, 4000);
    }
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
      mqLogCardShare(data.session.user.id, 'daily_results', null);
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

  // Solid blue, full bleed -- each pick is its own big tile with the
  // YES/NO call itself as a solid block of color on the right, Wordle-tile
  // style, rather than a thin pill lost in a mostly-empty card.
  function mqDrawPreResultCard(width, height, data){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;

    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, height * 0.065);

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(width * 0.05) + "px " + MQ_HEAD_FONT;
    ctx.fillText('My picks today', cx, height * 0.18);

    const rowX = width * 0.075;
    const rowW = width * 0.85;
    const rowGap = height * 0.155;
    const rowStart = height * 0.28;
    data.picks.forEach(function(p, i){
      const ry = rowStart + i * rowGap;
      const choiceColor = p.choice === 'yes' ? MQ_YES : MQ_NO;

      mqHairline(ctx, rowX, rowX + rowW, ry, 0.2);

      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK_MUTED;
      ctx.font = "700 " + Math.round(width * 0.018) + "px " + MQ_HEAD_FONT;
      ctx.fillText((CATEGORY_LABELS[p.category] || p.category).toUpperCase(), rowX, ry + height * 0.032);

      ctx.textAlign = 'right';
      ctx.fillStyle = choiceColor;
      ctx.font = "800 " + Math.round(width * 0.024) + "px " + MQ_HEAD_FONT;
      ctx.fillText(p.choice.toUpperCase(), rowX + rowW, ry + height * 0.032);

      ctx.textAlign = 'left';
      ctx.fillStyle = MQ_INK;
      ctx.font = "700 " + Math.round(width * 0.029) + "px " + MQ_HEAD_FONT;
      const words = p.questionText.split(' ');
      let line = '', lines = [], maxWidth = rowW;
      words.forEach(function(w){
        const test = line ? line + ' ' + w : w;
        if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = w; }
        else{ line = test; }
      });
      if(line) lines.push(line);
      lines.slice(0, 2).forEach(function(l, li){ ctx.fillText(l, rowX, ry + height * 0.065 + li * height * 0.038); });
    });

    mqCardFooterBand(ctx, width, height, 'Think I\u2019m wrong? Pick yours.', 'playmarqit.com');

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

    if(navigator.canShare && navigator.canShare({ files: [packaged.file] })){
      try{ await navigator.share({ files: [packaged.file], text: shareText, url: shareUrl }); }
      catch(e){ /* canceled -- not an error */ }
      return;
    }
    const blobUrl = URL.createObjectURL(packaged.blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'marqit-picks.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 1000);
    try{ await navigator.clipboard.writeText(shareText); }catch(e){}
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
      btn.textContent = 'Sent ✓';
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
      btn.textContent = 'Already picked ✓';
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
        '<span>' + (afterSubmit ? 'We’ll let you know when today’s calls are scored, and when a friend reminds you to play.' : 'Get a heads-up when today’s calls are up, and when a friend reminds you to play.') + ' You can turn it off any time in settings.</span></div>' +
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

  sb.auth.onAuthStateChange(async function(event, session){
    if(event === 'SIGNED_IN' && session && session.user){
      const profileResult = await ensureProfile(session.user);
      if(profileResult === 'BANNED') return;
      showSignedIn(profileResult.username || 'you', profileResult.needsUsername);
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
  });

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
        mqLoadNudgeBanner();
        setTimeout(function(){ mqMaybeAskPush('signin'); }, 2500);
      });
    }
  });

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
        '<text x="' + (padL - 6) + '" y="' + (parseFloat(y) + 3) + '" text-anchor="end" font-size="9" fill="var(--ink-soft)" font-family="Inter,sans-serif">' + pct + '%</text>';
    }).join('');

    function fmtTime(t){
      return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    var xLabels =
      '<text x="' + padL + '" y="' + (H - 6) + '" text-anchor="start" font-size="9" fill="var(--ink-soft)" font-family="Inter,sans-serif">' + fmtTime(startT) + '</text>' +
      '<text x="' + (W - padR) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="var(--ink-soft)" font-family="Inter,sans-serif">' + fmtTime(endT) + '</text>';

    // Small markers at each point the percentage actually changed, each with
    // a native tooltip (shows on hover on desktop, on tap on most mobile
    // browsers) giving the exact time and value — so "when it moved" is
    // discoverable without cluttering the chart with permanent labels.
    var moveMarkers = '';
    for(var m = 1; m < points.length; m++){
      if(points[m].pct === points[m - 1].pct) continue;
      var mx = xPos(points[m].time.getTime()).toFixed(1);
      var my = yPos(points[m].pct).toFixed(1);
      moveMarkers += '<circle cx="' + mx + '" cy="' + my + '" r="4" fill="var(--ink)" fill-opacity="0.01" stroke="none">' +
        '<title>' + fmtTime(points[m].time.getTime()) + ' \u2014 ' + points[m].pct + '%</title>' +
        '</circle>' +
        '<circle cx="' + mx + '" cy="' + my + '" r="2" fill="var(--ink)"/>';
    }

    // Small "Yes 62%" bubble on the newest point (flips below the line near the top edge)
    var dotX = parseFloat(endX), dotY = parseFloat(yPos(lastPct).toFixed(1));
    var bw = 58, bh = 19;
    var bx = Math.max(padL, Math.min(dotX - bw + 6, W - padR - bw));
    var by = dotY - bh - 9 < padT ? dotY + 10 : dotY - bh - 9;
    var bubble = '<g class="trend-bubble"><rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + bh + '" rx="9.5" style="fill:rgb(var(--tint))"/>' +
      '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by + 13).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0E1014" font-family="Inter,sans-serif">Yes ' + lastPct + '%</text></g>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-svg" aria-hidden="true">' +
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
      '</svg>';
  }

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
    flag: '<path d="M6 21V4M6 5h12l-2 4 2 4H6"/>'
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
      '<text x="20" y="' + (fs > 11 ? 23.6 : 23) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" letter-spacing=".4" fill="rgb(' + c + ')" style="font-family:\'Big Shoulders Display\',Inter,sans-serif">' + abbr + '</text>' +
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
  function mqSlateEl(count, buddyNames, boostedCount){
    var names = buddyNames || [];
    // 100 per call (200 for a boosted one), +100 for a perfect day, and +25 per call per Buddy.
    var total = count * 100 + (count === 3 ? 100 : 0) + (count * 25 * names.length) + (boostedCount || 0) * 100;
    var el = document.createElement('div');
    el.className = 'mq-slate';
    var buddyLabel = names.map(function(n){ return escapeHtml(n); }).join(', ');
    el.innerHTML =
      '<div class="slate-top"><div class="slate-pts"><span class="slate-pre">Earn up to</span><b>' + total + '</b><span>points today</span></div>' +
      '<div class="slate-meta"><span>' + count + (count === 1 ? ' call' : ' calls') + '</span>' + (count === 3 ? '<span>3 for 3 adds +100</span>' : '') + '</div></div>' +
      '<div class="slate-streak"></div>' +
      '<div class="slate-tier"></div>' +
      (boostedCount ? '<div class="slate-buddy boost"><b class="boost-2x">2X</b><span>One call today is worth double</span></div>' : '') +
      (names.length ? '<div class="slate-buddy">' + mqIcon('link') + '<span>Buddy Bonus: +25 on any call where you match ' + buddyLabel + '</span></div>' : '');
    return el;
  }
  function mqFillSlate(slate, session, answeredAll){
    var el = slate.querySelector('.slate-streak');
    if(!el) return;
    if(!session){ el.innerHTML = mqIcon('flame') + '<span>Sign up free to start a streak</span>'; return; }
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
          return '<i class="av" title="' + escapeHtml(u.username || '') + '" style="background:' + color + ';">' + escapeHtml(u.avatar_emoji || '') + '</i>';
        }).join('');
        var extra = p.total - (byQ[p.q.id] || []).length;
        if(html && extra > 0) html += '<i class="av av-more">+' + extra + '</i>';
        slot.innerHTML = html;
      });
    }catch(e){ /* decoration only */ }
  }
  // Emoji reactions: one fetch for every reaction on today's questions,
  // counts painted per-button, tap toggles your own (insert/delete). Anyone
  // can react, even before voting -- these aren't gated like crowd % since
  // a reaction doesn't reveal which side someone picked.
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
    if(!session){ openAuthPanel('signup'); return; }
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
      if(wasMine){
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
  function mqRenderActivityFeed(prepared, people){
    var listEl = document.getElementById('activity-feed-list');
    var emptyEl = document.getElementById('activity-feed-empty');
    if(!listEl) return;
    if(!people || !people.length){
      listEl.innerHTML = '';
      if(emptyEl) emptyEl.style.display = '';
      return;
    }
    if(emptyEl) emptyEl.style.display = 'none';

    var byQ = {};
    prepared.forEach(function(p){ byQ[p.q.id] = p; });

    var rows = [];
    people.forEach(function(person){
      (person.preds || []).forEach(function(pred){
        var p = byQ[pred.question_id];
        if(!p) return;
        var revealed = !!p.myVote || p.isLocked;
        if(!revealed) return; // same reveal rule as the card itself
        rows.push({
          username: person.username,
          kind: person.kind,
          choice: pred.choice,
          question_text: p.q.question_text,
          created_at: pred.created_at
        });
      });
    });

    rows.sort(function(a, b){ return new Date(b.created_at) - new Date(a.created_at); });
    rows = rows.slice(0, 12);

    if(!rows.length){
      listEl.innerHTML = '<p class="ticket-meta">Nothing to show yet today.</p>';
      return;
    }

    listEl.innerHTML = rows.map(function(r){
      var color = r.kind === 'rival' ? 'var(--no)' : 'var(--yes)';
      var choiceLabel = (r.choice || '').toUpperCase();
      var ago = mqAgo(Date.now() - new Date(r.created_at).getTime());
      return '<div class="ticket-meta" style="display:flex; align-items:flex-start; gap:8px; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:10px 12px;">' +
        mqIcon(r.kind === 'rival' ? 'swap' : 'link') +
        '<span style="flex:1;"><strong style="color:var(--ink);">' + escapeHtml(r.username) + '</strong> picked <strong style="color:' + color + ';">' + choiceLabel + '</strong> on \u201c' + escapeHtml(r.question_text) + '\u201d' +
        (ago ? ' <span style="opacity:.7;">\u00b7 ' + ago + '</span>' : '') + '</span>' +
      '</div>';
    }).join('');
  }
  function mqBuddyInner(name, pick, sameSide){
    var who = escapeHtml(name);
    return sameSide
      ? (mqIcon('link') + '<span>' + who + ' also picked ' + pick.toUpperCase() + ' \u2014 Buddy Bonus</span>')
      : (mqIcon('swap') + '<span>' + who + ' picked ' + pick.toUpperCase() + ' \u2014 opposite call, no Buddy Bonus this time</span>');
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
    var buddyHtml = '';
    if(showPct && buddyList && buddyList.length){
      buddyHtml = buddyList.map(function(b){
        if(!b.picks || !b.picks[q.id]) return '';
        var buddyPick = b.picks[q.id];
        var sameSide = myVote && buddyPick === myVote;
        return '<div class="ticket-meta buddy-line" data-buddy-id="' + b.id + '" style="color:var(' + (sameSide ? '--yes' : '--no') + ');">' + mqBuddyInner(b.username, buddyPick, !!sameSide) + '</div>';
      }).join('');
    }

    var vis = mqDetectVisual(q);
    var iconHtml = CATEGORY_ICONS[q.category] || '';
    var leagueHtml = vis.league ? '<span class="mq-league">' + vis.league + '</span>' : '';
    var visualHtml = (vis.kind === 'matchup')
      ? (mqMatchupHtml(vis.teams, vis.icon) + '<div class="mq-qrow"><p class="ticket-q"></p></div>')
      : (vis.kind === 'subject')
      ? (mqSubjectHtml(vis.subject, vis.icon || CATEGORY_ICONS[q.category] || '') + '<div class="mq-qrow"><p class="ticket-q"></p></div>')
      : ('<div class="mq-qrow"><div class="mq-tile">' + (vis.icon || CATEGORY_ICONS[q.category] || '') + '</div><p class="ticket-q"></p></div>');
    var isFinal = !!(q.resolved && q.correct_answer);
    var statusHtml = isFinal
      ? '<span class="status-pill final">Final</span>'
      : isLocked
        ? '<span class="status-pill inplay"><span class="live-dot"></span>In play</span>'
        : '<span class="status-pill live"><span class="live-dot"></span>Live</span>';
    var resultHtml = '';
    if(isFinal){
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
    if(!isLocked && q.lock_time){
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
      crowdTagHtml +
      lockedNote +
      buddyHtml +
      trendHtml +
      '<div class="ticket-foot"><div class="foot-left"><div class="foot-players"></div><span class="foot-count">' + total + ' voted</span></div>' + latestHtml + '</div>' +
      '<div class="reaction-row" data-question-id="' + q.id + '">' +
        '<div class="reaction-base">' +
          REACTION_EMOJIS.map(function(e){ return '<button type="button" class="reaction-btn" data-emoji="' + e + '"><span class="reaction-emoji">' + e + '</span><span class="reaction-count"></span></button>'; }).join('') +
        '</div>' +
        '<div class="reaction-extra"></div>' +
        '<div class="reaction-more-wrap">' +
          '<button type="button" class="reaction-more-btn" aria-label="More reactions" aria-haspopup="true" aria-expanded="false">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
          '<div class="reaction-menu" role="menu">' +
            EXTRA_REACTION_EMOJIS.map(function(e){ return '<button type="button" class="reaction-btn reaction-menu-btn" data-emoji="' + e + '"><span class="reaction-emoji">' + e + '</span><span class="reaction-count"></span></button>'; }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
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
    var rules = document.querySelectorAll('#page-how .rule-grid .rule-card');
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
      r.setAttribute('aria-label', 'Show the ' + (r.querySelector('.rule-head') ? r.querySelector('.rule-head').textContent : 'step') + ' step');
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
    box.style.cssText = 'max-width:480px; background:var(--paper); border:2px solid var(--yes); border-radius:16px; padding:24px;';

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
      '<select id="suggestion-category" style="padding:10px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); font-family:inherit; font-size:14px; margin-top:14px; margin-bottom:8px;">' +
        '<option value="sports">Sports</option>' +
        '<option value="pop_culture">Pop culture</option>' +
        '<option value="news">News</option>' +
      '</select>' +
      '<input type="date" id="suggestion-date" min="' + minDateStr + '" value="' + minDateStr + '" style="display:block; padding:10px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); font-family:inherit; font-size:14px; margin-bottom:8px;">' +
      '<textarea id="suggestion-text" rows="2" maxlength="300" placeholder="What should we ask?" style="display:block; width:100%; padding:10px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--paper); color:var(--ink); font-family:inherit; font-size:14px; resize:vertical;"></textarea>' +
      '<button type="button" id="suggestion-submit-btn" style="margin-top:12px; padding:11px 22px; border:none; border-radius:10px; background:#FFFFFF; color:#17191D; font-family:inherit; font-weight:600; font-size:15px; cursor:pointer;">Pitch idea</button>' +
      '<p class="form-msg" id="suggestion-msg" style="margin-top:6px;"></p>';
    wrap.appendChild(box);
    container.appendChild(wrap);

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
        btn.disabled = false;
        // Keep what they typed so it can be put back after they sign up.
        try{ sessionStorage.setItem('marqit_pitch_draft', JSON.stringify({ category: category, requestedDate: requestedDate, text: text })); }catch(e){}
        msg.className = 'form-msg';
        msg.textContent = 'Create a free account to send your idea.';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        openAuthPanel('signup');
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
    let { data: questions, error } = await sb.from('daily_questions').select('*').eq('question_date', today).order('lock_time', { ascending: true });
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
        const { data: lastQuestions } = await sb.from('daily_questions').select('*').eq('question_date', lastDate).order('lock_time', { ascending: true });
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
      const cats = ['sports', 'pop_culture', 'news'];
      const placeholders = cats.map(function(cat){
        return '<div class="ticket predict-card" style="max-width:480px; margin-bottom:16px; opacity:0.7;">' +
          '<p class="ticket-meta">' + (CATEGORY_LABELS[cat] || cat) + '</p>' +
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
    // rivalList mirrors buddyList's shape (id, username, picks) purely so the
    // Recent Activity feed below can treat both the same way -- it's not
    // used for the head-to-head Showdown logic, which fetches separately.
    let rivalList = [];
    if(session){
      const questionIds = questions.map(function(q){ return q.id; });
      const { data: buddyRows } = await sb.from('buddies').select('buddy_id, profiles!buddies_buddy_id_fkey(username)').eq('user_id', session.user.id);
      if(buddyRows && buddyRows.length){
        buddyList = await Promise.all(buddyRows.map(async function(b){
          const { data: buddyPreds } = await sb.from('predictions').select('question_id, choice, created_at').eq('user_id', b.buddy_id).in('question_id', questionIds);
          const buddyPickMap = {};
          (buddyPreds || []).forEach(function(p){ buddyPickMap[p.question_id] = p.choice; });
          return { id: b.buddy_id, username: b.profiles ? b.profiles.username : 'your buddy', picks: buddyPickMap, preds: buddyPreds || [], kind: 'buddy' };
        }));
      }
      const { data: rivalRows } = await sb.from('rivals').select('rival_id, profiles!rivals_rival_id_fkey(username)').eq('user_id', session.user.id);
      if(rivalRows && rivalRows.length){
        rivalList = await Promise.all(rivalRows.map(async function(r){
          const { data: rivalPreds } = await sb.from('predictions').select('question_id, choice, created_at').eq('user_id', r.rival_id).in('question_id', questionIds);
          const rivalPickMap = {};
          (rivalPreds || []).forEach(function(p){ rivalPickMap[p.question_id] = p.choice; });
          return { id: r.rival_id, username: r.profiles ? r.profiles.username : 'your rival', picks: rivalPickMap, preds: rivalPreds || [], kind: 'rival' };
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
      const isLocked = new Date() >= new Date(q.lock_time);
      prepared.push({ q: q, myVote: myVote, voteData: voteData, isLocked: isLocked, total: voteData.counts.yes + voteData.counts.no });
    }

    // Only badge a strict, unique leader — a tie or an all-zero day shouldn't get one.
    let mostCalledId = null;
    const maxTotal = Math.max.apply(null, prepared.map(function(p){ return p.total; }));
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
      slateEl = mqSlateEl(prepared.length, buddyList.map(function(b){ return b.username; }), prepared.filter(function(p){ return p.q.is_boosted; }).length);
      container.appendChild(slateEl);
    }

    // Change 4 data + persistent entry point: any locked call with a pick
    // on it is shareable pre-result, independent of the once-a-day banner
    // above -- so this also gives players a way back into it any time.
    __mqPreResultData = prepared
      .filter(function(p){ return p.isLocked && p.myVote; })
      .map(function(p){ return { category: p.q.category, questionText: p.q.question_text, choice: p.myVote }; });
    if(session && __mqPreResultData.length){
      const preResultBtn = document.createElement('button');
      preResultBtn.type = 'button';
      preResultBtn.className = 'cb-btn';
      preResultBtn.style.cssText = 'margin-bottom:16px; background:var(--panel); color:var(--ink); border:1px solid var(--line);';
      preResultBtn.textContent = 'Share my picks';
      preResultBtn.addEventListener('click', function(){ mqSharePreResultCard(); });
      container.insertBefore(preResultBtn, slateEl || container.firstChild);
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

    // Signed-out visitors can play with no account: pick Yes/No on all three,
    // submit, and see where the crowd stands right away. An account is only
    // offered afterwards, to save a streak and reach the leaderboard.
    if(!session && !allLocked){
      const guestQs = prepared.filter(function(p){ return !p.isLocked; });
      const guestDone = guestQs.every(function(p){ return !!p.myVote; });
      const guestSel = {};
      guestQs.forEach(function(p){ if(p.myVote) guestSel[p.q.id] = p.myVote; });
      const gControls = document.createElement('div');
      gControls.style.cssText = 'max-width:480px; margin-top:8px;';

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
          '<div class="pick-progress" id="pick-progress" style="display:flex;"><span class="pp-dots">' + guestQs.map(function(p){ var v = mqDetectVisual(p.q); return '<i class="pp-slot">' + (v.icon || CATEGORY_ICONS[p.q.category] || '') + '</i>'; }).join('') + '</span><span class="pp-text">0 of ' + guestQs.length + ' picked</span><span class="pp-bonus">All right = +100 bonus</span></div>' +
          '<button type="button" id="guest-submit-btn" disabled style="width:100%; padding:14px 22px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer; opacity:0.4;">Pick all three first</button>' +
          '<p style="font-size:12.5px; color:var(--ink-soft); text-align:center; margin-top:8px;">No account needed to play.</p>';
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
          loadDailyQuestions(); // re-render with the crowd results showing
        });
        updateGuestState();
      }
    }

    if(slateEl){ mqFillSlate(slateEl, session, prepared.filter(function(p){ return !p.isLocked; }).every(function(p){ return !!p.myVote; })); }
    mqFillPlayers(container, prepared);
    mqFillReactions(container, prepared, session);
    mqRenderActivityFeed(prepared, buddyList.concat(rivalList));

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
      controls.style.cssText = 'max-width:480px; margin-top:8px;';
      controls.innerHTML =
        '<div class="submit-cele" id="submit-cele" aria-hidden="true"><div class="cele-slots" id="cele-slots">' +
          editableQuestions.map(function(){ return '<i class="cele-slot">' + mqIcon('check') + '</i>'; }).join('') +
          '</div><div class="cele-msg" id="cele-msg"></div></div>' +
        '<div class="pick-progress" id="pick-progress" style="display:' + (allAlreadyAnswered ? 'none' : 'flex') + ';"><span class="pp-dots">' + editableQuestions.map(function(p){ var v = mqDetectVisual(p.q); return '<i class="pp-slot">' + (v.icon || CATEGORY_ICONS[p.q.category] || '') + '</i>'; }).join('') + '</span><span class="pp-text">0 of ' + editableQuestions.length + ' picked</span><span class="pp-bonus">All right = +100 bonus</span></div>' +
        '<button type="button" id="submit-all-btn" disabled style="width:100%; padding:14px 22px; border:none; border-radius:10px; background:var(--ink); color:var(--paper); font-family:inherit; font-weight:600; font-size:15px; cursor:pointer; opacity:0.4; display:' + (allAlreadyAnswered ? 'none' : 'block') + ';">Pick all three first</button>' +
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
            msgEl.textContent = n + ' of ' + n + ' locked in.' + (dropActive ? ' 🔥 Bonus window — correct calls score extra.' : '');
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
          for(const b of buddyList){
            if(!b.picks || !b.picks[p.q.id]) continue;
            if(card.querySelector('.buddy-vs-line[data-buddy-id="' + b.id + '"]')) continue;
            const buddyPick = b.picks[p.q.id];
            const sameSide = p.myVote === buddyPick;
            const buddyDiv = document.createElement('div');
            buddyDiv.className = 'ticket-meta buddy-line buddy-vs-line';
            buddyDiv.setAttribute('data-buddy-id', b.id);
            buddyDiv.style.color = sameSide ? 'var(--yes)' : 'var(--no)';
            buddyDiv.innerHTML = mqBuddyInner(b.username, buddyPick, sameSide);
            const trendAnchor = card.querySelector('.trend-wrap');
            if(trendAnchor) card.insertBefore(buddyDiv, trendAnchor);
          }
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
      var face = r.avatar_emoji || String(r.username || '?').charAt(0).toUpperCase();
      var framed = !!(r.user_id && frameSet.has(r.user_id));
      var champ = !!(r.user_id && championSet.has(r.user_id));
      var streak = (r.streak || 0) >= 3 ? '<span class="lb-streak fl-' + mqStreakFlameTier(r.streak) + '">' + mqIcon('flame') + r.streak + '</span>' : '';
      var rankChg = (rankMap && r.user_id) ? mqRankArrowHtml(rankMap.has(r.user_id) ? rankMap.get(r.user_id) : null, rank) : '';
      return '<div class="brow lb' + (rank <= 3 ? ' medal m' + rank : '') + (mine ? ' mine' : '') + '">' +
        '<span class="lb-rank">' + rank + '</span>' +
        '<i class="lb-av' + (framed ? ' has-frame' : '') + (champ ? ' has-champion-frame' : '') + '" style="background:' + color + ';" title="' + (champ ? 'Marqit Champion' : '') + '">' + escapeHtml(face) + (champ ? '<span class="champ-crown" aria-hidden="true">&#128081;</span>' : '') + '</i>' +
        '<span class="lb-name"><span class="lb-name-text">' + escapeHtml(r.username || 'player') + '</span>' + (mine ? '<em class="lb-you">You</em>' : '') + streak + rankChg + '</span>' +
        '<span class="lb-pts"><b>' + Number(r.points || 0).toLocaleString() + '</b><small>pts</small></span>' +
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
      var titleEl = document.getElementById('lb-board-title-text');
      if(btn.getAttribute('data-scope') === 'friends'){
        if(titleEl) titleEl.textContent = 'Friends Leaderboard';
        loadFriendsBoard();
      }else{
        if(titleEl) titleEl.textContent = 'Marqit Big Leaderboard';
        loadBigBoard();
      }
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
      '<text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)" style="font-family:\'Big Shoulders Display\',Inter,sans-serif">' + (has ? pct + '%' : '\u2014') + '</text></svg>' +
      '<b>' + escapeHtml(label) + '</b><span>' + escapeHtml(sub) + '</span></div>';
  }
  async function loadRecord(){
    var cal = document.getElementById('rec-cal');
    if(!cal) return;
    var foot = document.getElementById('rec-foot'), ringsEl = document.getElementById('rec-rings');
    var today = getETDateInfo().dateStr;
    var t = new Date(today + 'T12:00:00Z');
    var idx = (t.getUTCDay() + 6) % 7;                    // Monday = 0
    var start = new Date(t.getTime() - (idx + 28) * 86400000);
    function ds(d){ return d.toISOString().slice(0, 10); }
    var days = [];
    for(var i = 0; i < 35; i++) days.push(ds(new Date(start.getTime() + i * 86400000)));

    var byDay = {}, cat = { sports: { c: 0, t: 0 }, pop_culture: { c: 0, t: 0 }, news: { c: 0, t: 0 } };
    var session = null;
    try{ var sr = await sb.auth.getSession(); session = sr && sr.data && sr.data.session; }catch(e){}
    if(session){
      var res = await sb.from('predictions')
        .select('choice, daily_questions!inner(category, correct_answer, resolved, question_date)')
        .eq('user_id', session.user.id)
        .gte('daily_questions.question_date', days[0])
        .lte('daily_questions.question_date', today);
      (res.data || []).forEach(function(r){
        var dq = r.daily_questions; if(!dq) return;
        var d = byDay[dq.question_date] = byDay[dq.question_date] || { total: 0, resolved: 0, correct: 0 };
        d.total++;
        if(dq.resolved){
          d.resolved++;
          var ok = r.choice === dq.correct_answer;
          if(ok) d.correct++;
          if(cat[dq.category]){ cat[dq.category].t++; if(ok) cat[dq.category].c++; }
        }
      });
    }
    var played = 0;
    cal.innerHTML = days.map(function(d, i){
      var v = byDay[d], cls = 'rc', tip = d;
      if(d > today){ cls += ' future'; }
      else if(!v){ cls += ' none'; tip += ': missed'; }
      else{
        played++;
        if(v.resolved === 0){ cls += ' pend'; tip += ': waiting on results'; }
        else if(v.total >= 3 && v.correct === v.total){ cls += ' perfect'; tip += ': Perfect Day'; if(session) mqAwardAchievement(session.user.id, 'perfect_day'); }
        else if(v.correct === 0){ cls += ' l0'; tip += ': 0 of ' + v.resolved + ' right'; }
        else if(v.correct === 1){ cls += ' l1'; tip += ': 1 of ' + v.resolved + ' right'; }
        else{ cls += ' l2'; tip += ': ' + v.correct + ' of ' + v.resolved + ' right'; }
      }
      if(d === today) cls += ' today';
      return '<i class="' + cls + '" style="--i:' + i + ';" title="' + escapeHtml(tip) + '"></i>';
    }).join('');

    var defs = [['sports', 'Sports', '255,148,38'], ['pop_culture', 'Pop culture', '170,112,255'], ['news', 'News', '70,140,255']];
    ringsEl.innerHTML = defs.map(function(x){
      var c = cat[x[0]];
      return mqRing(c.t ? Math.round(c.c / c.t * 100) : null, x[2], x[1], c.t ? (c.c + ' of ' + c.t + ' right') : 'no results yet');
    }).join('');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      ringsEl.querySelectorAll('.rec-arc').forEach(function(a){ a.setAttribute('stroke-dasharray', a.getAttribute('data-dash') + ' ' + a.getAttribute('data-c')); });
    }); });

    if(!session) foot.textContent = 'Sign in to see your record.';
    else if(!played) foot.textContent = 'Your record fills in as your calls get scored.';
    else foot.textContent = played + (played === 1 ? ' day' : ' days') + ' played in the last 5 weeks.';
  }


  // ---- My calls: your last several resolved picks, right or wrong, plus overall hit rate ----
  async function loadMyCalls(){
    var listEl = document.getElementById('mycalls-list'), rateEl = document.getElementById('mycalls-rate');
    if(!listEl) return;
    var session = null;
    try{ var sr = await sb.auth.getSession(); session = sr && sr.data && sr.data.session; }catch(e){}
    if(!session){ listEl.innerHTML = '<p class="recap-foot" style="border:none;padding:0;">Sign in to see your calls.</p>'; return; }

    var res = await sb.from('predictions')
      .select('choice, daily_questions!inner(question_text, category, correct_answer, resolved, question_date)')
      .eq('user_id', session.user.id)
      .eq('daily_questions.resolved', true)
      .order('daily_questions(question_date)', { ascending: false })
      .limit(8);

    var rows = res.data || [];
    if(!rows.length){ listEl.innerHTML = '<p class="recap-foot" style="border:none;padding:0;">Your calls show up here once they\u2019re scored.</p>'; return; }

    var right = rows.filter(function(r){ return r.choice === r.daily_questions.correct_answer; }).length;
    rateEl.innerHTML = '<b>' + Math.round(right / rows.length * 100) + '%</b><span>hit rate \u00b7 last ' + rows.length + '</span>';

    listEl.innerHTML = rows.map(function(r){
      var dq = r.daily_questions, won = r.choice === dq.correct_answer;
      var icon = CATEGORY_ICONS[dq.category] || '';
      var qtext = (dq.question_text || '').length > 46 ? dq.question_text.slice(0, 44) + '\u2026' : (dq.question_text || '');
      return '<div class="mycall-row ' + (won ? 'win' : 'loss') + '">' +
        '<span class="mycall-cat">' + icon + '</span>' +
        '<span class="mycall-q">' + escapeHtml(qtext) + '</span>' +
        '<span class="mycall-res">' + mqIcon(won ? 'check' : 'xmark') + '</span>' +
      '</div>';
    }).join('');
  }

  async function loadWeeklyRecap(){
    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return;

    const weekStart = getWeekStart();
    const today = getETDateInfo().dateStr;

    const { data } = await sb
      .from('predictions')
      .select('choice, daily_questions!inner(category, correct_answer, resolved, question_date)')
      .eq('user_id', session.user.id)
      .gte('daily_questions.question_date', weekStart)
      .lte('daily_questions.question_date', today)
      .eq('daily_questions.resolved', true);

    const { data: myStreak } = await sb.from('streaks').select('current_streak').eq('user_id', session.user.id).maybeSingle();

    if(!data || data.length === 0){
      document.getElementById('recap-foot').textContent = 'No resolved calls yet this week.';
      document.getElementById('recap-streak').textContent = myStreak ? myStreak.current_streak : 0;
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
        return { username: showAsPlayer ? 'Player' : (prof.username || 'player'), emoji: prof.avatar_emoji || '\ud83c\udfaf', points: r.points };
      });

    return { weekNumber: weekNumber, memberCount: members.length, top3: ranked };
  }

  function mqDrawGroupWeeklyCard(width, height, groupName, weekData, referralTag){
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, height * 0.065);

    ctx.textAlign = 'center';
    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(width * 0.045) + "px " + MQ_HEAD_FONT;
    let y = height * 0.18;
    const words = groupName.split(' ');
    let line = '', lines = [];
    words.forEach(function(w){
      const test = line ? line + ' ' + w : w;
      if(ctx.measureText(test).width > width * 0.82 && line){ lines.push(line); line = w; }
      else line = test;
    });
    if(line) lines.push(line);
    lines.slice(0, 2).forEach(function(l, i){ ctx.fillText(l, cx, y + i * height * 0.05); });
    y += lines.length * height * 0.05;

    ctx.fillStyle = MQ_YES;
    ctx.font = "700 " + Math.round(width * 0.022) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, 'WEEK ' + weekData.weekNumber + '  ·  ' + weekData.memberCount + ' MEMBERS', cx, y + height * 0.035, width * 0.0025);

    const rowX = width * 0.075;
    const rowW = width * 0.85;
    const rowGap = height * 0.088;
    const rowStart = height * 0.335;
    weekData.top3.forEach(function(m, i){
      const ry = rowStart + i * rowGap;

      mqHairline(ctx, rowX, rowX + rowW, ry, 0.2);

      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? MQ_YES : MQ_INK_MUTED;
      ctx.font = "800 " + Math.round(width * 0.028) + "px " + MQ_HEAD_FONT;
      ctx.fillText('0' + (i + 1), rowX, ry + height * 0.05);

      ctx.fillStyle = MQ_INK;
      ctx.font = "700 " + Math.round(width * 0.032) + "px " + MQ_HEAD_FONT;
      ctx.fillText(m.username, rowX + width * 0.09, ry + height * 0.05);

      ctx.textAlign = 'right';
      ctx.fillStyle = i === 0 ? MQ_YES : MQ_INK_SOFT;
      ctx.font = "800 " + Math.round(width * 0.028) + "px " + MQ_HEAD_FONT;
      ctx.fillText(m.points.toLocaleString(), rowX + rowW, ry + height * 0.05);
    });

    mqCardFooterBand(ctx, width, height, 'Join our league', referralTag ? 'playmarqit.com/join' : 'playmarqit.com');

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

    if(navigator.canShare && navigator.canShare({ files: [packaged.file] })){
      try{ await navigator.share({ files: [packaged.file], text: shareText, url: shareUrl }); }
      catch(e){ /* canceled -- not an error */ }
      return;
    }
    const blobUrl = URL.createObjectURL(packaged.blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'marqit-group.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 1000);
    try{ await navigator.clipboard.writeText(shareText); }catch(e){}
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

    mqCardBackground(ctx, width, height);
    mqCardLogoRow(ctx, width, height * 0.065);
    ctx.textAlign = 'center';

    // A quiet, editorial mark instead of a medallion + emoji: a tracked
    // label between two thin rules, like an award citation rather than a
    // sticker.
    let y = height * 0.22;
    mqHairline(ctx, cx - width * 0.09, cx - width * 0.02, y - height * 0.01, 0.5);
    mqHairline(ctx, cx + width * 0.02, cx + width * 0.09, y - height * 0.01, 0.5);
    ctx.fillStyle = MQ_YES;
    ctx.font = "700 " + Math.round(width * 0.026) + "px " + MQ_HEAD_FONT;
    mqTrackedText(ctx, 'CHAMPION', cx, y, width * 0.009);

    if(symbol){
      y += height * 0.135;
      ctx.fillStyle = MQ_INK;
      ctx.font = "800 " + Math.round(width * 0.13) + "px " + MQ_DISPLAY_FONT;
      ctx.fillText(symbol, cx, y);
      y += height * 0.075;
    } else {
      y += height * 0.045;
    }

    ctx.fillStyle = MQ_INK;
    ctx.font = "800 " + Math.round(width * 0.048) + "px " + MQ_HEAD_FONT;
    // Wrap long chapter/org names onto two lines rather than overflow the card.
    const words = String(name || '').split(' ');
    let line = '', lines = [];
    words.forEach(function(w){
      const test = line ? (line + ' ' + w) : w;
      if(ctx.measureText(test).width > width * 0.82 && line){ lines.push(line); line = w; }
      else line = test;
    });
    if(line) lines.push(line);
    lines.slice(0, 2).forEach(function(l, i){ ctx.fillText(l, cx, y + i * height * 0.056); });
    y += lines.length * height * 0.056 + height * 0.022;

    if(subtitle){
      ctx.fillStyle = MQ_INK_FAINT;
      ctx.font = "700 " + Math.round(width * 0.023) + "px " + MQ_HEAD_FONT;
      ctx.fillText(subtitle, cx, y);
    }

    mqCardFooterBand(ctx, width, height, 'Think your chapter can beat this?', 'playmarqit.com');

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

    if(navigator.canShare && navigator.canShare({ files: [packaged.file] })){
      try{ await navigator.share({ files: [packaged.file], text: shareText, url: 'https://playmarqit.com' }); }
      catch(e){ /* canceled -- not an error */ }
      return;
    }
    const blobUrl = URL.createObjectURL(packaged.blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'marqit-champion.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 1000);
    try{ await navigator.clipboard.writeText(shareText); }catch(e){}
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
    btn.textContent = '\u{1F451} Share Champion card';
    btn.style.cssText = 'margin-top:12px; padding:11px 22px; border:none; border-radius:10px; background:#DB6653; color:#fff; font-family:inherit; font-weight:600; font-size:14px; cursor:pointer;';
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
        '<span style="font-size:12px; font-weight:700; color:' + (done ? 'var(--yes)' : 'var(--no)') + ';">' + (done ? 'Done &#10003;' : (answered + '/' + total)) + '</span></div>';
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

  // ---- Top Chapters: cross-group leaderboard, ranked by combined points ---
  // Deliberately a raw sum (not per-member average) -- a chapter that
  // recruits more people racks up more total points, so growing the group
  // is itself the winning move, not just playing well individually.
  async function loadTopGroupsBoard(p_school){
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
      const trendingTag = (trendingMax > 0 && g.group_id === trendingGroupId) ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:#DB6653;">&#128293; Trending</span>' : '';
      const championTag = g.is_champion ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:#DB6653;">&#128081; Champion</span>' : '';
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
      const championTag = o.is_champion ? '<span style="margin-left:6px; font-size:11px; font-weight:700; color:#DB6653;">&#128081; Champion</span>' : '';
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
    });
  });

  const homeCtaChallenge = document.getElementById('home-cta-challenge');
  if(homeCtaChallenge){
    homeCtaChallenge.addEventListener('click', function(){
      document.querySelectorAll('.pagenav-tab').forEach(function(t){
        t.classList.toggle('active', t.getAttribute('data-page') === 'challenge');
      });
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('page-challenge').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

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
  document.getElementById('hamburger-about-btn').addEventListener('click', function(){
    document.querySelectorAll('.pagenav-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
    document.getElementById('page-about').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    hamburgerMenu.style.display = 'none';
  });
  document.addEventListener('click', function(e){
    if(hamburgerMenu.style.display === 'block' && !hamburgerMenu.contains(e.target) && e.target !== hamburgerBtn && !hamburgerBtn.contains(e.target)){
      hamburgerMenu.style.display = 'none';
    }
  });

  // News ticker — reads real, already-fetched headlines from news_ticker.
  // No fabricated content: if the table is empty, the strip stays hidden.
  (function(){
    var tickerEl = document.getElementById('news-ticker');
    var trackEl = document.getElementById('news-ticker-track');
    if(!tickerEl || !trackEl) return;

    sb.from('news_ticker')
      .select('headline, source_name, article_url')
      .order('fetched_at', { ascending: false })
      .then(function(res){
        var rows = (res && res.data) ? res.data : [];
        // Stay hidden until there's enough real content that the seamless-loop
        // technique (which duplicates the list once) doesn't visibly show the
        // same headline twice back-to-back \u2014 that's a symptom of too little
        // data, not something to paper over with a shorter list.
        if(rows.length < 6) return;

        function itemHtml(row){
          var headline = escapeHtml(row.headline || '');
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
