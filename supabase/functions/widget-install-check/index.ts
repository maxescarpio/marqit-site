// widget-install-check
// Public helper for check.html. Given an article link, it fetches the page once and reports in plain words
// whether the Marqit line is on it and whether our side is set up for that page. It never returns page content,
// only a short list of findings. Deploy with JWT verification OFF (public). Only https, public hostnames; no private
// addresses; redirects are followed manually (max 4) with the same checks.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

function safeUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(String(raw).trim()); } catch (_) { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
  if (u.port && u.port !== '443') return null;
  return u;
}
const hostAllowed = (host: string, domains: string[]) =>
  domains.some((d) => { d = d.toLowerCase(); return host === d || host.endsWith('.' + d); });

type Finding = { level: 'ok' | 'warn' | 'fail'; text: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const out: Finding[] = [];
  const add = (level: Finding['level'], text: string) => out.push({ level, text });
  try {
    const body = await req.json().catch(() => ({}));
    const start = typeof body.url === 'string' ? safeUrl(body.url) : null;
    if (!start) return json({ findings: [{ level: 'fail', text: 'Paste the full link to one of your articles, starting with https://' }] });

    let u: URL | null = start, html = '', status = 0, finalUrl = start;
    for (let i = 0; i < 4 && u; i++) {
      const res = await fetch(u.toString(), { redirect: 'manual', headers: { 'User-Agent': 'MarqitInstallCheck/1.0 (+https://playmarqit.com)', Accept: 'text/html' }, signal: AbortSignal.timeout(12000) });
      status = res.status;
      if (status >= 300 && status < 400) { const loc = res.headers.get('location'); u = loc ? safeUrl(new URL(loc, u).toString()) : null; continue; }
      finalUrl = u; if (res.ok) html = (await res.text()).slice(0, 600000); u = null; break;
    }
    if (!html) {
      add('fail', 'We could not open that page (status ' + status + '). It may be private, behind a login or blocking our checker. Open it in a private browser window to see what a visitor sees.');
      return json({ findings: out });
    }
    add('ok', 'We can open the page.');

    // Find the Marqit script tag(s).
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc=["'][^"']*playmarqit\.com\/embed\.js[^"']*["'][^>]*>/gi)].map((m) => m[0]);
    let key = typeof body.site === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(body.site) ? body.site : '';
    let mode = '';
    if (!tags.length) {
      add('fail', 'The Marqit line is not in the page code we can see. Either it was not published, the editor removed it, or it is added by a tag manager (we cannot see those from outside). The next step is to put it in the site header or footer instead of inside a story.');
    } else {
      add('ok', 'The Marqit line is on the page.');
      const tag = tags[0];
      const k = /data-site=["']([^"']+)["']/i.exec(tag)?.[1] || '';
      mode = (/data-mode=["']([^"']+)["']/i.exec(tag)?.[1] || 'inline').toLowerCase();
      if (!k) add('fail', 'The line is missing the site key (data-site="..."). Copy the whole line again.');
      else if (key && k !== key) add('warn', 'The page uses a different site key than the one you gave us.');
      if (k) key = k;
      if (/&lt;script|&amp;|[“”]/.test(tag)) add('fail', 'The code looks changed by the editor (curly quotes or escaped characters). Paste it as plain text in a code or HTML block.');
      if (mode === 'auto') add('ok', 'Site-wide mode is on: the widget places itself in the article.');
      else add('warn', 'It is in "' + mode + '" mode, so the widget only shows right where the line sits.');
    }

    // Article-ness (only matters for site-wide mode).
    if (mode === 'auto') {
      const og = /property=["']og:type["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1] || /content=["']([^"']*)["'][^>]*property=["']og:type["']/i.exec(html)?.[1] || '';
      const artCount = (html.match(/<article\b/gi) || []).length;
      const ld = /"@type"\s*:\s*\[?\s*"(News|Blog|Report|Sports)?Article"/i.test(html);
      if (og ? /article/i.test(og) : (ld || artCount === 1)) add('ok', 'The page looks like an article to the widget.');
      else add('fail', 'The widget does not recognize this page as an article' + (og ? ' (its page type says "' + og + '")' : '') + ', so it stays out of the way. Tell us and we will adjust it.');
      const paras = (html.match(/<p\b[^>]*>[^<]{80,}/gi) || []).length;
      if (paras < 2) add('warn', 'We could not find 2 or more full paragraphs in the page code. If the story loads after the page opens, the widget will use a corner pop-up instead.');
    }

    // Our side.
    if (key) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: site } = await admin.from('widget_sites').select('id, active, question_mode, allowed_domains').eq('site_key', key).maybeSingle();
      if (!site) add('fail', 'We do not recognize that site key. Check it for typos.');
      else {
        if (!site.active) add('fail', 'Your site is switched off on our side. We will switch it on.');
        const doms: string[] = site.allowed_domains || [];
        if (doms.length && !hostAllowed(finalUrl.hostname.toLowerCase(), doms)) add('fail', 'This page is on ' + finalUrl.hostname + ', which is not on your approved list (' + doms.join(', ') + '). The widget stays hidden on other domains. Tell us and we will add it.');
        else add('ok', doms.length ? 'The page address matches your approved domain.' : 'No domain restriction is set.');
        const { data: pk } = await admin.rpc('widget_norm_key', { p: finalUrl.toString() });
        if (pk) {
          const { data: q } = await admin.from('widget_questions').select('active, source').eq('site_id', site.id).eq('page_key', pk).maybeSingle();
          if (!q) add('warn', site.question_mode === 'manual' ? 'There is no question for this page yet. We add one for you.' : 'There is no question for this page yet. One is made the first time a reader opens it.');
          else if (q.active) add('ok', 'A live question exists for this page.');
          else if (q.source === 'auto' || q.source === 'drafting') add('warn', 'A question is written and waiting for our approval. The widget appears once we approve it.');
          else add('warn', 'We chose not to put a question on this page (for example a sensitive story).');
        }
      }
    }
    return json({ findings: out });
  } catch (_e) {
    return json({ findings: [{ level: 'fail', text: 'Something went wrong on our side. Try again in a minute.' }] });
  }
});
