/*!
 * Marqit prediction widget loader.
 * Paste on any page:
 *   <script async src="https://playmarqit.com/embed.js" data-site="YOUR_SITE_KEY"></script>
 *
 * Options (all optional, set as data- attributes on the script tag):
 *   data-mode="inline"   (default) show the widget right where the script tag sits
 *   data-mode="popup"    floating card in a corner of the screen, with a close button
 *   data-target="#id"    inline only: put the widget inside this element (e.g. your sidebar)
 *   data-position="right" | "left"   popup corner (default right)
 *   data-delay="4"       popup only: seconds before it opens (default 4)
 *   data-width="340"     widget width in px (default 340, never wider than the screen)
 * No cookies are set and nothing is stored on the page except a "closed" flag for popups.
 */
(function(){
  'use strict';
  var script = document.currentScript || (function(){
    var s = document.querySelectorAll('script[data-site]'); return s[s.length - 1];
  })();
  if(!script) return;
  var site = script.getAttribute('data-site');
  if(!site || window['__mqw_' + site]) return;
  window['__mqw_' + site] = true;

  var mode = (script.getAttribute('data-mode') || 'inline').toLowerCase();
  var target = script.getAttribute('data-target');
  var pos = (script.getAttribute('data-position') || 'right').toLowerCase() === 'left' ? 'left' : 'right';
  var delay = Math.max(0, parseFloat(script.getAttribute('data-delay')) || 4) * 1000;
  var width = Math.max(260, Math.min(480, parseInt(script.getAttribute('data-width'), 10) || 340));
  var base;
  try{ base = new URL(script.src, location.href).origin; }catch(e){ base = 'https://playmarqit.com'; }

  var canon = document.querySelector('link[rel="canonical"]');
  var pageUrl = (canon && canon.href) || location.href;
  var src = base + '/widget.html?site=' + encodeURIComponent(site) + '&u=' + encodeURIComponent(pageUrl) + '&h=' + encodeURIComponent(location.hostname);

  var css = document.createElement('style');
  css.textContent =
    '.mqw-wrap{max-width:100%;margin:16px 0;}' +
    '.mqw-frame{display:block;width:100%;border:0;background:transparent;color-scheme:normal;}' +
    '.mqw-pop{position:fixed;bottom:16px;z-index:2147483000;width:' + width + 'px;max-width:calc(100vw - 24px);transform:translateY(24px);opacity:0;visibility:hidden;transition:transform .3s ease,opacity .3s ease,visibility .3s;}' +
    '.mqw-pop.mqw-r{right:16px;}.mqw-pop.mqw-l{left:16px;}' +
    '.mqw-pop.mqw-show{transform:none;opacity:1;visibility:visible;}' +
    '.mqw-x{position:absolute;top:-10px;right:-6px;width:30px;height:30px;border-radius:50%;border:1px solid #2A3B5C;background:#12203A;color:#F2F5FA;font:700 16px/1 -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;padding:0;}' +
    '.mqw-x:focus-visible,.mqw-pill:focus-visible{outline:2px solid #5C9BFF;outline-offset:2px;}' +
    '.mqw-pill{position:fixed;bottom:16px;z-index:2147483000;display:none;align-items:center;gap:8px;padding:0 16px;height:44px;border-radius:22px;border:1px solid #2A3B5C;background:#0A1428;color:#F2F5FA;font:700 14px/1 -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(10,20,40,.35);}' +
    '.mqw-pill.mqw-r{right:16px;}.mqw-pill.mqw-l{left:16px;}.mqw-pill.mqw-show{display:flex;}' +
    '.mqw-pill i{width:8px;height:8px;border-radius:50%;background:#33D18B;display:block;}' +
    '@media (prefers-reduced-motion:reduce){.mqw-pop{transition:none;}}';
  document.head.appendChild(css);

  var iframe = document.createElement('iframe');
  iframe.className = 'mqw-frame';
  iframe.src = src;
  iframe.title = 'Marqit prediction';
  iframe.loading = 'eager';
  iframe.setAttribute('scrolling', 'no');
  iframe.style.height = '0px';
  iframe.style.minHeight = '0';

  var wrap = document.createElement('div');
  var pop = null, pill = null, ready = false, closed = false;
  var closedKey = 'mqw_closed_' + site;
  function wasClosed(){ try{ return Date.now() - Number(localStorage.getItem(closedKey) || 0) < 864e5; }catch(e){ return false; } }

  if(mode === 'popup'){
    pop = wrap;
    pop.className = 'mqw-pop ' + (pos === 'left' ? 'mqw-l' : 'mqw-r');
    pop.setAttribute('role', 'complementary');
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'mqw-x'; x.setAttribute('aria-label', 'Close prediction'); x.textContent = '×';
    x.addEventListener('click', function(){
      closed = true; pop.classList.remove('mqw-show');
      try{ localStorage.setItem(closedKey, String(Date.now())); }catch(e){}
      if(pill) pill.classList.add('mqw-show');
    });
    pop.appendChild(x); pop.appendChild(iframe);
    pill = document.createElement('button');
    pill.type = 'button'; pill.className = 'mqw-pill ' + (pos === 'left' ? 'mqw-l' : 'mqw-r');
    pill.innerHTML = '<i></i>Make the call';
    pill.addEventListener('click', function(){ closed = false; pill.classList.remove('mqw-show'); pop.classList.add('mqw-show'); });
    document.body.appendChild(pop); document.body.appendChild(pill);
  }else{
    wrap.className = 'mqw-wrap';
    wrap.style.width = width + 'px';
    wrap.appendChild(iframe);
    var host = target && document.querySelector(target);
    if(host) host.appendChild(wrap);
    else if(script.parentNode) script.parentNode.insertBefore(wrap, script.nextSibling);
  }

  window.addEventListener('message', function(ev){
    if(ev.source !== iframe.contentWindow) return;
    var m = ev.data;
    if(!m || m.mq !== true) return;
    if(m.type === 'resize' && typeof m.height === 'number'){
      iframe.style.height = Math.min(m.height, 1400) + 'px';
    }else if(m.type === 'empty'){
      // no question set for this page: leave no trace
      if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if(pill && pill.parentNode) pill.parentNode.removeChild(pill);
    }else if(m.type === 'ready' && !ready){
      ready = true;
      if(pop){
        if(wasClosed()){ closed = true; pill.classList.add('mqw-show'); }
        else setTimeout(function(){ if(!closed) pop.classList.add('mqw-show'); }, delay);
      }
    }
  });
})();
