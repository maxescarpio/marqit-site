/* Native app helpers. Does nothing in a normal browser; runs only inside the Marqit iOS/Android app (Capacitor). */
(function(){
  var C = window.Capacitor;
  if(!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {};

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
