/* Native app helpers. Does nothing in a normal browser; runs only inside the Marqit iOS/Android app (Capacitor). */
(function(){
  var C = window.Capacitor;
  if(!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {};

  // App-store rules: no web-paid subscription (Marqit+), no Google sign-in, no "bets" wording inside the app.
  var st = document.createElement('style');
  st.textContent = '#google-auth-btn, #hamburger-plus-btn, .pagenav-tab[data-page="plus"], #page-plus, #hamburger-handshake-btn { display:none !important; }';
  document.head.appendChild(st);

  // Delete account (required by Apple 5.1.1(v)). Shown in the menu only when signed in.
  function addDeleteButton(){
    var menu = document.getElementById('hamburger-menu');
    var sb = window.mqSb;
    if(!menu || !sb || document.getElementById('delete-account-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'delete-account-btn'; btn.textContent = 'Delete account';
    btn.style.cssText = 'display:none; width:100%; text-align:left; background:none; border:none; padding:10px; font-size:14px; font-weight:600; color:#c0392b; cursor:pointer; border-radius:8px;';
    menu.appendChild(btn);
    var show = function(){ sb.auth.getSession().then(function(r){ btn.style.display = (r.data && r.data.session) ? 'block' : 'none'; }); };
    var toggle = document.getElementById('hamburger-btn');
    document.addEventListener('click', function(){ setTimeout(show, 0); }, true);
    show();
    btn.addEventListener('click', async function(){
      if(!confirm('Delete your Marqit account? This permanently removes your account, picks and streak. It cannot be undone.')) return;
      btn.disabled = true; btn.textContent = 'Deleting…';
      var res = await sb.functions.invoke('delete-account');
      if(res.error || (res.data && res.data.error)){
        btn.disabled = false; btn.textContent = 'Delete account';
        alert('Could not delete your account. Please try again or email help@playmarqit.com.');
        return;
      }
      try{ await sb.auth.signOut(); }catch(e){}
      try{ localStorage.clear(); }catch(e){}
      location.href = '/';
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(addDeleteButton, 500); });
  else setTimeout(addDeleteButton, 500);

  // Native share sheet (the Android WebView has no navigator.share).
  if(P.Share){
    navigator.canShare = function(d){ return !!d && !d.files; }; // text/link only
    navigator.share = function(d){
      d = d || {};
      return P.Share.share({ title: d.title, text: d.text, url: d.url, dialogTitle: d.title || 'Share' });
    };
  }

  // Light haptic tap on prediction/answer buttons, stronger on a lock-in.
  if(P.Haptics){
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('.predict-card button, .mq-share-btn, [data-haptic]');
      if(!b) return;
      try{ P.Haptics.impact({ style: 'LIGHT' }); }catch(err){}
    }, true);
  }
})();
