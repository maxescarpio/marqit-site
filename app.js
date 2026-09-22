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
      const { data: existingUsername } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
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
    const { data: existing } = await sb.from('profiles').select('id, state, username').eq('id', user.id).maybeSingle();
    if(existing){
      try{ sessionStorage.removeItem('marqit_pending_signup_source'); }catch(e){}
      return existing.username;
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

    let { error: insertErr } = await sb.from('profiles').insert({
      id: user.id,
      username: username,
      state: state,
      age_confirmed: true,
      signup_source: signupSource
    });

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
      const retry = await sb.from('profiles').insert({
        id: user.id,
        username: username,
        state: state,
        age_confirmed: true,
        signup_source: signupSource
      });
      insertErr = retry.error;
      if(insertErr){
        // Still failing -- most likely a parallel call finished in between. Check once more.
        const { data: finalCheck } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
        if(finalCheck) return finalCheck.username;
      }
    }

    if(!insertErr){
      await sb.from('streaks').insert({ user_id: user.id });
      // This call just created the profile. If there was no username to draw from
      // (e.g. a fresh Google sign-in -- OAuth has no username concept), give them
      // one chance to pick something real instead of living with an auto-generated
      // "user_xxxxxxxx" forever. Usernames show everywhere on this site.
      if(hadNoUsername) promptUsernameChoice();
    }
    return username;
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
  document.getElementById('username-prompt-skip-btn').addEventListener('click', function(){
    document.getElementById('username-prompt-backdrop').style.display = 'none';
  });
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

  function showSignedIn(username){
    document.getElementById('nav-signed-out').style.display = 'none';
    document.getElementById('nav-signed-in').style.display = 'flex';
    document.getElementById('auth-panel').style.display = 'none';
    const navUsername = document.getElementById('nav-username');
    if(navUsername) navUsername.textContent = username || '';
    const heroMsg = document.getElementById('hero-status-msg');
    if(heroMsg){
      heroMsg.className = 'form-msg ok';
      heroMsg.textContent = 'You\'re signed in as ' + username + '.';
    }
    loadMyStats();
    loadShareCard(username);
    loadGroupSection();
    loadStateBoard();
    loadBuddySection();
    loadRivalSection();
    loadNotificationSettings();
    loadPendingRequests();
    loadDailyQuestions();
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
  const TIERS = [
    { name: 'Legend', min: 50000 },
    { name: 'Expert', min: 15000 },
    { name: 'Pro', min: 5000 },
    { name: 'Analyst', min: 1000 },
    { name: 'Rookie', min: 0 }
  ];
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

    const { data: profileRow } = await sb.from('profiles').select('username, created_at, avatar_emoji, avatar_color, notify_push, state').eq('id', session.user.id).maybeSingle();
    const { data: streakRow } = await sb.from('streaks').select('*').eq('user_id', session.user.id).maybeSingle();
    if(!profileRow) return;

    selectedAvatarEmoji = profileRow.avatar_emoji || '🎯';
    selectedAvatarColor = profileRow.avatar_color || '#17191D';

    const profileStateInput = document.getElementById('profile-state-input');
    if(profileStateInput) profileStateInput.value = profileRow.state || '';
    document.getElementById('profile-state-msg').textContent = '';

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
      { label: 'Points', value: streakRow ? streakRow.total_points.toLocaleString() : '0' },
      { label: 'Golden stars', value: String(streakRow ? streakRow.golden_stars : '5'), star: true },
      { label: 'Tier', value: myTier },
      { label: 'Current streak', value: streakRow ? streakRow.current_streak : '0' },
      { label: 'Longest streak', value: streakRow ? streakRow.longest_streak : '0' }
    ].forEach(function(stat){
      const div = document.createElement('div');
      div.innerHTML = '<div style="font-size:20px; font-weight:700;"></div><div style="font-size:11.5px; color:var(--ink-soft);"></div>';
      div.firstChild.textContent = stat.value;
      if(stat.star) div.firstChild.insertAdjacentHTML('beforeend', ' ' + mqStarGold(18));
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
    const { data: buddyProfile, error: lookupErr } = await sb.from('profiles').select('id').eq('username', uname).maybeSingle();
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
        '<button type="button" class="remove-buddy-btn" data-buddy-id="' + r.buddy_id + '" style="padding:6px 12px; border:1px solid var(--line); border-radius:8px; background:none; color:var(--ink-soft); font-weight:600; font-size:12.5px; cursor:pointer; white-space:nowrap;">Remove</button>' +
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
    const { data: rivalProfile, error: lookupErr } = await sb.from('profiles').select('id').eq('username', uname).maybeSingle();
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

    const { data: targetProfile, error: lookupErr } = await sb.from('profiles').select('id').eq('username', uname).maybeSingle();
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
    const { data: myPreds } = await sb.from('predictions').select('question_id, choice').eq('user_id', session.user.id);
    const { data: myStreak } = await sb.from('streaks').select('current_streak').eq('user_id', session.user.id).maybeSingle();

    if(!questions || questions.length === 0) return;
    const predMap = {};
    (myPreds || []).forEach(function(p){ predMap[p.question_id] = p.choice; });

    document.getElementById('share-card-title').textContent = 'Marqit · ' + date;
    document.getElementById('share-card-streak').textContent = (myStreak ? myStreak.current_streak : 0) + '-day streak';

    const row = document.getElementById('share-card-row');
    row.innerHTML = '';
    questions.forEach(function(q){
      const myChoice = predMap[q.id];
      const correct = myChoice && q.resolved && myChoice === q.correct_answer;
      const played = !!myChoice && q.resolved;
      const cell = document.createElement('div');
      cell.className = 'share-cell';
      const iconClass = !played ? 'no' : (correct ? 'yes' : 'no');
      const iconPath = !played
        ? '<path d="M12 8v4M12 16h.01"/>'
        : (correct ? '<path d="M5 13l4 4L19 7"/>' : '<path d="M6 6l12 12M18 6L6 18"/>');
      cell.innerHTML =
        '<div class="share-icon ' + iconClass + '"><svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg></div>' +
        '<div class="share-cell-label"></div>';
      cell.querySelector('.share-cell-label').textContent = CATEGORY_LABELS[q.category] || q.category;
      row.appendChild(cell);
    });

    document.getElementById('share-results-btn').style.display = 'inline-flex';
  }

  document.getElementById('share-results-btn').addEventListener('click', async function(){
    const title = document.getElementById('share-card-title').textContent;
    const streak = document.getElementById('share-card-streak').textContent;
    const cells = document.querySelectorAll('#share-card-row .share-cell');
    const msgEl = document.getElementById('share-results-msg');
    if(cells.length === 0) return;

    let correctCount = 0;
    const parts = [];
    cells.forEach(function(cell){
      const isCorrect = cell.querySelector('.share-icon').classList.contains('yes');
      if(isCorrect) correctCount++;
      parts.push({ label: cell.querySelector('.share-cell-label').textContent, correct: isCorrect });
    });
    const shareText = title + ' — ' + streak + '. ' + correctCount + '/' + cells.length + ' correct. Make your own call at playmarqit.com';

    // Render a small, simple on-brand image client-side so nobody has to
    // screenshot the page — this becomes an actual attachable image for an
    // Instagram Story or a tweet, not just a card to photograph.
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#17191D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = "700 88px Arial, sans-serif";
    ctx.fillText('Marqit', canvas.width / 2, 190);
    ctx.beginPath();
    ctx.fillStyle = '#2CBE7C';
    ctx.arc(canvas.width / 2 + 152, 138, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#A8ABB3';
    ctx.font = "600 38px Arial, sans-serif";
    ctx.fillText(streak, canvas.width / 2, 260);

    const startY = 420;
    const rowHeight = 150;
    parts.forEach(function(p, i){
      const y = startY + i * rowHeight;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#F4F4F1';
      ctx.font = "600 46px Arial, sans-serif";
      ctx.fillText(p.label, 130, y);

      ctx.textAlign = 'center';
      ctx.fillStyle = p.correct ? '#2CBE7C' : '#EE5E4E';
      ctx.font = "700 62px Arial, sans-serif";
      ctx.fillText(p.correct ? '✓' : '✗', canvas.width - 150, y + 6);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#7A7D85';
    ctx.font = "600 32px Arial, sans-serif";
    ctx.fillText('playmarqit.com', canvas.width / 2, canvas.height - 90);

    canvas.toBlob(async function(blob){
      if(!blob){
        msgEl.className = 'form-msg err';
        msgEl.textContent = 'Could not generate the image — try again.';
        return;
      }
      const file = new File([blob], 'marqit-results.png', { type: 'image/png' });

      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], text: shareText, url: 'https://playmarqit.com' });
        }catch(e){ /* person canceled the share sheet — not an error */ }
        return;
      }

      // No native image-share support (most desktop browsers) — download the
      // image directly so it's still ready to post, no screenshot needed.
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'marqit-results.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 1000);

      msgEl.className = 'form-msg ok';
      try{
        await navigator.clipboard.writeText(shareText);
        msgEl.textContent = 'Image downloaded and caption copied — ready to post.';
      }catch(e){
        msgEl.textContent = 'Image downloaded — ready to post.';
      }
      setTimeout(function(){ msgEl.textContent = ''; }, 4000);
    }, 'image/png');
  });

  sb.auth.onAuthStateChange(async function(event, session){
    if(event === 'SIGNED_IN' && session && session.user){
      const username = await ensureProfile(session.user);
      showSignedIn(username || 'you');
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
      ensureProfile(session.user).then(function(username){
        showSignedIn(username || 'you');
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
      });
    }catch(e){ /* decoration only */ }
  }
  // One delegated listener handles every reaction button on the page,
  // present or future (cards get re-rendered each load).
  document.addEventListener('click', async function(e){
    var btn = e.target.closest('.reaction-btn');
    if(!btn) return;
    var row = btn.closest('.reaction-row');
    var qid = row && row.getAttribute('data-question-id');
    if(!qid) return;
    var { data: sessionRes } = await sb.auth.getSession();
    var session = sessionRes && sessionRes.session;
    if(!session){ openAuthPanel('signup'); return; }
    var emoji = btn.getAttribute('data-emoji');
    var countEl = btn.querySelector('.reaction-count');
    var wasMine = btn.classList.contains('mine');
    // Optimistic UI: flip it immediately, reconcile if the write fails.
    btn.classList.toggle('mine', !wasMine);
    var n = parseInt(countEl.textContent || '0', 10) || 0;
    n = wasMine ? Math.max(0, n - 1) : n + 1;
    countEl.textContent = n > 0 ? n : '';
    if(wasMine){
      var { error } = await sb.from('question_reactions').delete().eq('question_id', qid).eq('user_id', session.user.id).eq('emoji', emoji);
      if(error){ btn.classList.add('mine'); countEl.textContent = (n + 1) > 0 ? (n + 1) : ''; }
    }else{
      var { error: insErr } = await sb.from('question_reactions').insert({ question_id: qid, user_id: session.user.id, emoji: emoji });
      if(insErr){ btn.classList.remove('mine'); countEl.textContent = (n - 1) > 0 ? (n - 1) : ''; }
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
        REACTION_EMOJIS.map(function(e){ return '<button type="button" class="reaction-btn" data-emoji="' + e + '"><span class="reaction-emoji">' + e + '</span><span class="reaction-count"></span></button>'; }).join('') +
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
    var qtext = 'Will the Cowboys beat the Giants on Sunday Night Football?';
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
      const { error } = await sb.from('question_suggestions').insert({
        user_id: session.user.id,
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
    });
  }

  // Shared timer state for the daily countdown/pending indicator, tracked
  // outside loadDailyQuestions so repeated calls don't stack up intervals.
  let dailyCountdownInterval = null;
  let dailyPollInterval = null;
  function clearDailyTimers(){
    if(dailyCountdownInterval){ clearInterval(dailyCountdownInterval); dailyCountdownInterval = null; }
    if(dailyPollInterval){ clearInterval(dailyPollInterval); dailyPollInterval = null; }
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
      if(dailyReloadQueued){ dailyReloadQueued = false; loadDailyQuestions(); }
    }
  }

  async function loadDailyQuestionsInner(){
    clearDailyTimers();
    const container = document.getElementById('daily-questions-container');
    if(!container) return;

    const today = getETDateInfo().dateStr;
    const { data: questions, error } = await sb.from('daily_questions').select('*').eq('question_date', today).order('lock_time', { ascending: true });

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
      if(signedIn) appendSuggestionBox(container, session);

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

    function startPendingPoll(){
      dailyPollInterval = setInterval(async function(){
        const { data: check } = await sb.from('daily_questions').select('id').gt('question_date', today).limit(1);
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
        timerEl.classList.toggle('urgent', rem < 3600000);
        timerEl.classList.toggle('critical', rem < 600000);
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
      // Signed-out visitors: tapping Yes/No on an open card opens the signup panel.
      if(!session && !isLocked){
        card.querySelectorAll('.opt').forEach(function(o){
          o.style.cursor = 'pointer';
          o.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); openAuthPanel('signup'); });
        });
      }
    }

    if(slateEl){ mqFillSlate(slateEl, session, prepared.filter(function(p){ return !p.isLocked; }).every(function(p){ return !!p.myVote; })); }
    mqFillPlayers(container, prepared);
    mqFillReactions(container, prepared, session);
    mqRenderActivityFeed(prepared, buddyList.concat(rivalList));

    // Auto-prompt the share card once, the first time someone's fully
    // played a day (all 3 locked, all 3 answered) -- instead of making
    // them go dig for the "Share your results" section themselves.
    if(session && allLocked && prepared.every(function(p){ return !!p.myVote; })){
      var shareKey = 'mq_share_prompt_' + session.user.id + '_' + today;
      if(!localStorage.getItem(shareKey)){
        try{ localStorage.setItem(shareKey, '1'); }catch(e){}
        var banner = document.createElement('div');
        banner.className = 'trending-strip';
        banner.style.cursor = 'pointer';
        banner.innerHTML = mqIcon('flame') + '<span><strong>Day complete.</strong> Tap to see your share card.</span>';
        banner.addEventListener('click', function(){
          document.querySelectorAll('.pagenav-tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-page') === 'how'); });
          document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
          document.getElementById('page-how').style.display = 'block';
          var target = document.getElementById('share-card');
          if(target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
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

        const { data: targetProfile, error: lookupErr } = await sb.from('profiles').select('id').eq('username', uname).maybeSingle();
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
            msgEl.textContent = n + ' of ' + n + ' locked in.';
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
          card.querySelector('.ticket-foot .foot-count').textContent = total2 + ' voted';
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
      }else{
        appendSuggestionBox(container, session);
      }
    }
  }

  loadDailyQuestions();

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
  // Applies/removes the gold frame ring on one avatar element for one user id.
  async function mqApplyFrame(el, userId){
    if(!el || !userId) return;
    try{
      var set = await mqFrameSet();
      el.classList.toggle('has-frame', set.has(userId));
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
  function mqRankArrowHtml(oldRank, newRank){
    if(oldRank == null) return '';
    var d = oldRank - newRank; // positive = moved up
    if(d === 0) return '<span class="lb-rankchg same">' + mqIcon('flag') + '</span>';
    return '<span class="lb-rankchg ' + (d > 0 ? 'up' : 'down') + '">' + mqIcon(d > 0 ? 'arrowUp' : 'arrowDown') + Math.abs(d) + '</span>';
  }

  async function mqBoardRows(list, myId, showRankChange){
    var frameSet = await mqFrameSet();
    var rankMap = showRankChange ? await mqRankMap() : null;
    return list.map(function(r, i){
      var rank = i + 1;
      var color = /^#[0-9A-Fa-f]{6}$/.test(r.avatar_color || '') ? r.avatar_color : '#2C2F37';
      var mine = !!(myId && r.user_id === myId);
      var face = r.avatar_emoji || String(r.username || '?').charAt(0).toUpperCase();
      var framed = !!(r.user_id && frameSet.has(r.user_id));
      var streak = (r.streak || 0) >= 3 ? '<span class="lb-streak">' + mqIcon('flame') + r.streak + '</span>' : '';
      var rankChg = (rankMap && r.user_id) ? mqRankArrowHtml(rankMap.has(r.user_id) ? rankMap.get(r.user_id) : null, rank) : '';
      return '<div class="brow lb' + (rank <= 3 ? ' medal m' + rank : '') + (mine ? ' mine' : '') + '">' +
        '<span class="lb-rank">' + rank + '</span>' +
        '<i class="lb-av' + (framed ? ' has-frame' : '') + '" style="background:' + color + ';">' + escapeHtml(face) + '</i>' +
        '<span class="lb-name"><span class="lb-name-text">' + escapeHtml(r.username || 'player') + '</span>' + (mine ? '<em class="lb-you">You</em>' : '') + streak + rankChg + '</span>' +
        '<span class="lb-pts"><b>' + Number(r.points || 0).toLocaleString() + '</b><small>pts</small></span>' +
      '</div>';
    }).join('');
  }

  async function loadBigBoard(){
    const el = document.getElementById('big-board-rows');
    if(!el) return;
    const { data, error } = await sb
      .from('streaks')
      .select('user_id, total_points, current_streak, profiles(username, avatar_emoji, avatar_color)')
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
    }), myId, false);
  }
  (function(){
    var tabs = document.getElementById('lb-scope-tabs');
    if(!tabs) return;
    tabs.addEventListener('click', function(e){
      var btn = e.target.closest('.pagenav-tab');
      if(!btn) return;
      tabs.querySelectorAll('.pagenav-tab').forEach(function(b){ b.classList.toggle('active', b === btn); });
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

    const { data, error } = await sb
      .from('predictions')
      .select('user_id, choice, daily_questions!inner(category, correct_answer, resolved)')
      .eq('daily_questions.category', category)
      .eq('daily_questions.resolved', true);

    if(error || !data || data.length === 0){
      el.innerHTML = '<div class="brow"><span>No scores yet.</span></div>';
      return;
    }

    const tally = {};
    data.forEach(function(row){
      if(row.choice === row.daily_questions.correct_answer){
        tally[row.user_id] = (tally[row.user_id] || 0) + 100;
      }
    });

    const ranked = Object.keys(tally)
      .map(function(uid){ return { user_id: uid, points: tally[uid] }; })
      .sort(function(a, b){ return b.points - a.points; })
      .slice(0, 5);

    if(ranked.length === 0){
      el.innerHTML = '<div class="brow"><span>No correct calls yet.</span></div>';
      return;
    }

    const rankedIds = ranked.map(function(r){ return r.user_id; });
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, username, avatar_emoji, avatar_color')
      .in('id', rankedIds);
    const { data: streakRows } = await sb.from('streaks').select('user_id, current_streak').in('user_id', rankedIds);

    const profMap = {}, streakMap = {};
    (profiles || []).forEach(function(p){ profMap[p.id] = p; });
    (streakRows || []).forEach(function(x){ streakMap[x.user_id] = x.current_streak; });

    const myId = await mqMyId();
    el.innerHTML = await mqBoardRows(ranked.map(function(r){
      const p = profMap[r.user_id] || {};
      return { user_id: r.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: r.points, streak: streakMap[r.user_id] };
    }), myId);
  }

  loadCategoryBoard('sports', 'board-sports');
  loadCategoryBoard('pop_culture', 'board-pop_culture');
  loadCategoryBoard('news', 'board-news');

  function getWeekStart(){
    const et = getETDateInfo();
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = weekdayMap[et.weekday];
    const diffToMonday = (day === 0) ? 6 : day - 1;
    const parts = et.dateStr.split('-').map(Number);
    const monday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
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
      else if(!v){ cls += ' none'; }
      else{
        played++;
        if(v.resolved === 0){ cls += ' pend'; tip += ': waiting on results'; }
        else if(v.total >= 3 && v.correct === v.total){ cls += ' perfect'; tip += ': Perfect Day'; }
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

    const { data } = await sb
      .from('predictions')
      .select('user_id, choice, daily_questions!inner(correct_answer, resolved, question_date)')
      .gte('daily_questions.question_date', weekStart)
      .lte('daily_questions.question_date', today)
      .eq('daily_questions.resolved', true);

    if(!data || data.length === 0){
      line.textContent = 'Top Predictor of the Week: no resolved calls yet this week.';
      return;
    }

    const tally = {};
    data.forEach(function(row){
      if(!tally[row.user_id]) tally[row.user_id] = { correct: 0, total: 0 };
      tally[row.user_id].total++;
      if(row.choice === row.daily_questions.correct_answer){ tally[row.user_id].correct++; }
    });

    const MIN_PREDICTIONS = 3;
    let best = null;
    Object.keys(tally).forEach(function(uid){
      const t = tally[uid];
      if(t.total < MIN_PREDICTIONS) return;
      const acc = t.correct / t.total;
      if(!best || acc > best.acc || (acc === best.acc && t.correct > best.correct)){
        best = { user_id: uid, acc: acc, correct: t.correct };
      }
    });

    if(!best){
      line.textContent = 'Top Predictor of the Week: not enough calls yet this week.';
      return;
    }

    const { data: profile } = await sb.from('profiles').select('username').eq('id', best.user_id).maybeSingle();
    const name = profile ? profile.username : 'a player';
    const pct = Math.round(best.acc * 100);
    line.textContent = 'Top Predictor of the Week: ' + name + ', ' + pct + '% accuracy.';
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

    const { data: statePeople } = await sb.from('profiles').select('id, username, avatar_emoji, avatar_color').eq('state', myState);
    if(!statePeople || statePeople.length === 0){
      rowsEl.innerHTML = '<div class="brow"><span>No one else from ' + myState + ' yet.</span></div>';
      return;
    }

    const ids = statePeople.map(function(p){ return p.id; });
    const { data: streaksData } = await sb.from('streaks').select('user_id, total_points, current_streak').in('user_id', ids);

    const profMap = {};
    statePeople.forEach(function(p){ profMap[p.id] = p; });

    const ranked = (streaksData || [])
      .sort(function(a, b){ return b.total_points - a.total_points; })
      .slice(0, 5);

    rowsEl.innerHTML = await mqBoardRows(ranked.map(function(r){
      const p = profMap[r.user_id] || {};
      return { user_id: r.user_id, username: p.username, avatar_emoji: p.avatar_emoji, avatar_color: p.avatar_color, points: r.total_points, streak: r.current_streak };
    }), session.user.id);
  }

  loadStateBoard();

  async function loadGroupSection(){
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
      .select('group_id, groups(id, name, invite_code, created_by)')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if(!membership){
      noGroupEl.style.display = 'block';
      inGroupEl.style.display = 'none';
      return;
    }

    noGroupEl.style.display = 'none';
    inGroupEl.style.display = 'block';
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
  }

  document.getElementById('create-group-btn').addEventListener('click', async function(){
    const btn = this;
    const msg = document.getElementById('group-msg');
    const name = document.getElementById('group-name-input').value.trim();
    msg.className = 'form-msg';
    if(!name){ msg.classList.add('err'); msg.textContent = 'Enter a group name.'; return; }

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session){ msg.classList.add('err'); msg.textContent = 'Sign in above first.'; return; }

    btn.disabled = true;
    const { data: group, error } = await sb.from('groups').insert({ name: name, created_by: session.user.id }).select().single();
    if(error){ btn.disabled = false; msg.classList.add('err'); msg.textContent = 'Error: ' + error.message; return; }

    const { error: joinErr } = await sb.from('group_members').insert({ group_id: group.id, user_id: session.user.id });
    btn.disabled = false;
    if(joinErr){ msg.classList.add('err'); msg.textContent = 'Error: ' + joinErr.message; return; }

    msg.classList.add('ok');
    msg.textContent = 'Group created!';
    loadGroupSection();
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
    const params = new URLSearchParams(window.location.search);
    const code = params.get('group');
    if(!code) return;

    const { data: sessionRes } = await sb.auth.getSession();
    const session = sessionRes && sessionRes.session;
    if(!session) return; // they'll need to sign in first, then can paste the code manually

    await sb.rpc('join_group_by_invite_code', { p_invite_code: code }); // ignore duplicate/already-in-group errors silently
    loadGroupSection();
  }

  loadGroupSection();
  autoJoinFromUrl();

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
      document.querySelectorAll('.page').forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('page-' + target).style.display = 'block';
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
    var sel = '.rule-card,.duel-card,.streak-card,.tier-row,.recap-card,.share-card,.board,.fold,.section .ex-title';
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
