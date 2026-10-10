/*!
 * Marqit prediction widget loader.
 * Paste on any page:
 *   <script async src="https://playmarqit.com/embed.js" data-site="YOUR_SITE_KEY"></script>
 *
 * Options (all optional, set as data- attributes on the script tag):
 *   data-mode="inline"   (default) show the widget right where the script tag sits
 *   data-mode="popup"    floating card in a corner of the screen, with a close button
 *   data-mode="auto"     SITE-WIDE: paste once in your header or footer. On article pages the widget puts
 *                        itself inside the article after the 2nd or 3rd paragraph (it falls back to a pop-up
 *                        if it cannot find the article). Pages that are not articles are left alone.
 *   data-paths="/news/,/sports/"   auto only: only run on pages whose address starts with one of these
 *   data-exclude="/video/"         auto only: never run on these
 *   data-target="#id"    inline only: put the widget inside this element (e.g. your sidebar)
 *   data-position="right" | "left"   popup corner (default right)
 *   data-delay="4"       popup only: seconds before it opens (default 4)
 *   data-width="340"     widget width in px (default 340, auto 480, never wider than the screen)
 *   Add ?mqdebug to any page address (or data-debug="1") to see a small note saying what the widget is doing
 *   and, if it shows nothing, exactly why.
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
  var isAuto = mode === 'auto';
  var width = Math.max(260, Math.min(isAuto ? 560 : 480, parseInt(script.getAttribute('data-width'), 10) || (isAuto ? 480 : 340)));
  var base;
  try{ base = new URL(script.src, location.href).origin; }catch(e){ base = 'https://playmarqit.com'; }

  var debug = script.getAttribute('data-debug') === '1' || /[?&]mqdebug\b/.test(location.search);
  var dbgBox = null;
  function dbg(msg){
    if(!debug) return;
    try{ console.log('[Marqit] ' + msg); }catch(e){}
    if(!dbgBox){
      dbgBox = document.createElement('div');
      dbgBox.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483600;max-width:340px;background:#0C3470;color:#fff;font:12px/1.4 -apple-system,Segoe UI,Arial,sans-serif;padding:10px 12px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.3);';
      var t = document.createElement('div'); t.style.cssText = 'font-weight:700;margin-bottom:4px;'; t.textContent = 'Marqit debug'; dbgBox.appendChild(t);
      (document.body || document.documentElement).appendChild(dbgBox);
    }
    var l = document.createElement('div'); l.textContent = msg; dbgBox.appendChild(l);
  }
  var REASONS = {
    site: 'The site key was not found, or the site is turned off in admin.',
    domain: 'This page address (' + location.hostname + ') is not on the site\'s allowed domains. Add it in admin.',
    question: 'No question exists for this page yet.',
    pending: 'A question was drafted and is waiting for approval in admin.',
    skipped: 'No question was made for this page (sensitive topic, not a story, unreadable page, or the daily limit was reached).',
    error: 'Could not reach Marqit (network or blocked request).'
  };
  dbg('Script loaded. Site key: ' + site + '. Mode: ' + mode + '.');

  var canon = document.querySelector('link[rel="canonical"]');
  var pageUrl = (canon && canon.href) || location.href;
  var src = base + '/widget.html?site=' + encodeURIComponent(site) + '&u=' + encodeURIComponent(pageUrl) + '&h=' + encodeURIComponent(location.hostname) + (isAuto ? '&auto=1' : '');

  var css = document.createElement('style');
  css.textContent =
    '.mqw-wrap{max-width:100%;margin:16px 0;}' +
    '.mqw-wrap.mqw-auto{width:100%;margin:24px auto;}' +
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

  // ---- auto mode helpers ----
  function csv(a){ return (script.getAttribute(a) || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean); }
  function pathOk(){
    var p = location.pathname || '/';
    if(p === '/' || p === '') return false;
    var ex = csv('data-exclude'); for(var i = 0; i < ex.length; i++){ if(p.indexOf(ex[i]) === 0) return false; }
    var only = csv('data-paths'); if(!only.length) return true;
    for(var j = 0; j < only.length; j++){ if(p.indexOf(only[j]) === 0) return true; }
    return false;
  }
  function looksLikeArticle(){
    var og = document.querySelector('meta[property="og:type"]');
    if(og){ return /article/i.test(og.getAttribute('content') || ''); }
    var ld = document.querySelectorAll('script[type="application/ld+json"]');
    for(var i = 0; i < ld.length; i++){ if(/"@type"\s*:\s*\[?\s*"(News|Blog|Report|Sports)?Article"/i.test(ld[i].textContent || '')) return true; }
    return document.querySelectorAll('article').length === 1;
  }
  function findSpot(){
    var sels = ['[itemprop="articleBody"]', '.entry-content', '.post-content', '.article-content', '.article-body', '.story-body', '.post-body', 'article', 'main'];
    for(var i = 0; i < sels.length; i++){
      var c = document.querySelector(sels[i]); if(!c) continue;
      var ps = [].filter.call(c.querySelectorAll('p'), function(p){
        return p.textContent.trim().length > 80 && !p.closest('aside,nav,footer,figure,blockquote,form,[class*="related"],[class*="comment"]');
      });
      if(ps.length >= 2) return ps[ps.length >= 4 ? 2 : 1];
    }
    return null;
  }

  function start(effMode, anchor){
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

    if(effMode === 'popup'){
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
    }else if(effMode === 'auto'){
      wrap.className = 'mqw-wrap mqw-auto';
      wrap.style.maxWidth = width + 'px';
      wrap.appendChild(iframe);
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
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
        // no question for this page (yet): leave no trace
        dbg('Widget stayed hidden. ' + (REASONS[m.reason] || 'No reason given.'));
        if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if(pill && pill.parentNode) pill.parentNode.removeChild(pill);
      }else if(m.type === 'ready' && !ready){
        ready = true; dbg('Widget loaded and showing.');
        if(pop){
          if(wasClosed()){ closed = true; pill.classList.add('mqw-show'); }
          else setTimeout(function(){ if(!closed) pop.classList.add('mqw-show'); }, delay);
        }
      }
    });
  }

  if(isAuto){
    var go = function(){
      if(!pathOk()){ dbg('Skipped: this page is the home page, or excluded by data-paths / data-exclude.'); return; }
      if(!looksLikeArticle()){ dbg('Skipped: the page does not look like a news article (no article og:type, no Article data, and not exactly one <article>).'); return; }
      var spot = findSpot();
      if(spot){ dbg('Article found. Placing the widget after a paragraph.'); start('auto', spot); }
      else{ dbg('Could not find article paragraphs. Using the corner pop-up instead.'); start('popup'); }
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }else{
    start(mode === 'popup' ? 'popup' : 'inline');
  }
})();
