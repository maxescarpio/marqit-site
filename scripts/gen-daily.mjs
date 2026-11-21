// Builds public, crawlable results pages for finished Marqit days.
//   node scripts/gen-daily.mjs
// Writes daily/<YYYY-MM-DD>.html, daily/index.html and refreshes the daily
// block in sitemap.xml. Only days that are over and fully resolved are
// published, so nobody can see an upcoming call early.
// Uses only the public (publishable) key, the same one the site already ships.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SB = process.env.SUPABASE_URL || 'https://ivapcztkasjfetntkzxy.supabase.co';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_S1DZQXDDpffETdJh2xJONQ_QSNjnunn';
const SITE = 'https://playmarqit.com';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAT = { sports: 'Sports', pop_culture: 'Pop culture', news: 'News', entertainment: 'Entertainment' };
const catName = (c) => CAT[c] || (c ? c.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase()) : 'Daily call');

function todayET() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}
function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
}

async function get(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}
async function summary(id) {
  const r = await fetch(`${SB}/rest/v1/rpc/get_vote_summary`, { method: 'POST', headers: H, body: JSON.stringify({ p_question_id: id }) });
  if (!r.ok) throw new Error(`summary ${id} -> ${r.status}`);
  const j = await r.json();
  return { yes: Number(j.yes || 0), no: Number(j.no || 0) };
}

const HEAD_CSS = `
  :root{ --bg:#0F1114; --card:#16191F; --line:#262A31; --ink:#F2F3F5; --soft:#A3A8B1; --gold:#F2B93B; --yes:#3DBE7A; --no:#E5575B; }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--ink);font-family:'Barlow',sans-serif;line-height:1.55;}
  a{color:var(--gold);}
  .wrap{max-width:720px;margin:0 auto;padding:28px 20px 64px;}
  .top{display:flex;align-items:center;justify-content:space-between;gap:12px;}
  .top img{height:30px;width:auto;display:block;}
  .top a.back{font-size:14px;font-weight:600;color:var(--soft);text-decoration:none;}
  .crumbs{margin-top:22px;font-size:14px;color:var(--soft);}
  .crumbs a{color:var(--soft);}
  h1{font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:46px;line-height:1.02;text-transform:uppercase;margin-top:10px;}
  h1 span{color:var(--gold);}
  .lead{margin-top:14px;font-size:18px;color:#DCE5F5;}
  h2{font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:28px;text-transform:uppercase;margin-top:36px;}
  p{margin-top:8px;color:#DCE5F5;}
  .call{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-top:14px;}
  .call .cat{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--soft);font-weight:700;}
  .call h3{font-size:20px;line-height:1.3;margin-top:6px;color:#fff;}
  .res{display:inline-block;margin-top:12px;padding:5px 12px;border-radius:999px;font-weight:800;font-size:14px;letter-spacing:.05em;text-transform:uppercase;}
  .res.yes{background:rgba(61,190,122,.16);color:var(--yes);}
  .res.no{background:rgba(229,87,91,.16);color:var(--no);}
  .res.void{background:rgba(163,168,177,.16);color:var(--soft);}
  .bar{display:flex;height:12px;border-radius:999px;overflow:hidden;margin-top:14px;background:var(--line);}
  .bar i{display:block;height:100%;}
  .bar .y{background:var(--yes);}
  .bar .n{background:var(--no);}
  .split{display:flex;justify-content:space-between;font-size:14px;color:var(--soft);margin-top:6px;}
  .note{font-size:14px;color:var(--soft);margin-top:10px;}
  .pn{display:flex;justify-content:space-between;gap:12px;margin-top:30px;font-weight:600;}
  .list{list-style:none;margin-top:16px;display:grid;gap:10px;}
  .list a{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;text-decoration:none;color:#fff;font-weight:600;}
  .list small{display:block;font-weight:400;color:var(--soft);margin-top:2px;}
  .cta{display:inline-block;margin-top:36px;padding:15px 26px;border-radius:8px;background:var(--gold);color:#0F1114;font:800 15px 'Barlow',sans-serif;letter-spacing:.07em;text-transform:uppercase;text-decoration:none;box-shadow:0 3px 0 #A57F0E;}
  footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);font-size:14px;color:var(--soft);}
  footer a{color:var(--soft);margin-right:16px;}
  @media(max-width:520px){h1{font-size:36px;}h2{font-size:24px;}}`;

function shell({ title, desc, path, ld, body }) {
  const url = `${SITE}${path}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="canonical" href="${url}">
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png?v=3">
<meta property="og:site_name" content="Marqit">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og-image.png?v=3">
<meta name="theme-color" content="#0F1114">
<link rel="icon" href="/favicon.ico?v=5" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4">
<link rel="alternate" type="application/rss+xml" title="Marqit daily results" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Big+Shoulders+Display:wght@700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
<style>${HEAD_CSS}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a href="/" aria-label="Marqit home"><img src="/marqit-logo-white.svg?v=3" alt="Marqit"></a>
    <a class="back" href="/">Back to the game</a>
  </header>
  <main>
${body}
    <a class="cta" href="/">Make today&rsquo;s calls</a>
  </main>
  <footer>
    <a href="/how-to-play">Rules &amp; scoring</a><a href="/daily/">Daily results</a><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>
    <p>&copy; 2026 Grand Media Group LLC. Marqit is a free daily prediction game. You must be 18 or older to play.</p>
  </footer>
</div>
</body>
</html>
`;
}

function dayPage(day, qs, prev, next) {
  const date = longDate(day.date);
  const path = `/daily/${day.date}`;
  const title = `Marqit Daily Calls for ${shortDate(day.date)}: Results and Crowd Picks`;
  const live = qs.filter((q) => !q.voided);
  const desc = `The three Marqit calls for ${date}, the right answers and how the crowd voted. ${live.map((q) => q.question_text).join(' ')}`.slice(0, 300);

  const cards = qs.map((q) => {
    const total = q.yes + q.no;
    const yp = total ? Math.round((q.yes / total) * 100) : 0;
    const np = total ? 100 - yp : 0;
    let res;
    if (q.voided) res = '<span class="res void">Voided</span>';
    else if ((q.correct_answer || '').toLowerCase().startsWith('y')) res = '<span class="res yes">Answer: Yes</span>';
    else res = '<span class="res no">Answer: No</span>';
    const split = total
      ? `<div class="bar" role="img" aria-label="${yp}% picked Yes, ${np}% picked No"><i class="y" style="width:${yp}%"></i><i class="n" style="width:${np}%"></i></div>
      <div class="split"><span>Yes ${yp}%</span><span>${total.toLocaleString('en-US')} ${total === 1 ? 'pick' : 'picks'}</span><span>No ${np}%</span></div>`
      : '<p class="note">No picks were recorded for this call.</p>';
    const why = q.why_today ? `<p class="note">${esc(q.why_today)}</p>` : '';
    const how = q.voided
      ? (q.void_reason ? `<p class="note">${esc(q.void_reason)}</p>` : '')
      : (q.resolution_criteria ? `<p class="note"><b>How it was decided:</b> ${esc(q.resolution_criteria)}</p>` : '');
    return `    <section class="call">
      <div class="cat">${esc(catName(q.category))}${q.is_boosted ? ' &middot; Boosted' : ''}</div>
      <h3>${esc(q.question_text)}</h3>
      ${res}
      ${split}
      ${why}
      ${how}
    </section>`;
  }).join('\n');

  const pn = `    <nav class="pn" aria-label="Other days">
      <span>${prev ? `<a href="/daily/${prev}">&larr; ${esc(shortDate(prev))}</a>` : ''}</span>
      <span><a href="/daily/">All days</a></span>
      <span>${next ? `<a href="/daily/${next}">${esc(shortDate(next))} &rarr;</a>` : ''}</span>
    </nav>`;

  const body = `    <p class="crumbs"><a href="/">Marqit</a> &rsaquo; <a href="/daily/">Daily results</a> &rsaquo; ${esc(shortDate(day.date))}</p>
    <h1>Marqit calls for <span>${esc(shortDate(day.date))}</span></h1>
    <p class="lead">Every day Marqit players make three Yes/No calls on sports, pop culture and news. Here are the calls for ${esc(date)}, the final answers and how the crowd voted.</p>
    <h2>The three calls</h2>
${cards}
    <p class="note">Marqit is free to play. Everyone gets the same three calls each day. <a href="/how-to-play">See how scoring works</a>.</p>
${pn}`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${SITE}${path}#page`, url: `${SITE}${path}`, name: title, inLanguage: 'en-US',
        datePublished: day.date, dateModified: day.date,
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@type': 'WebApplication', name: 'Marqit', url: `${SITE}/` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: qs.map((q, i) => ({ '@type': 'ListItem', position: i + 1, name: q.question_text })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Marqit', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Daily results', item: `${SITE}/daily/` },
          { '@type': 'ListItem', position: 3, name: shortDate(day.date), item: `${SITE}${path}` },
        ],
      },
    ],
  };
  return shell({ title, desc, path, ld, body });
}

function indexPage(days) {
  const title = 'Marqit Daily Results: Every Day’s Calls, Answers and Crowd Picks';
  const desc = 'Archive of every finished Marqit day: the three Yes/No calls on sports, pop culture and news, the right answers and how the crowd voted.';
  const items = days.map((d) => `      <li><a href="/daily/${d.date}">${esc(longDate(d.date))}<small>${esc(d.qs.filter((q) => !q.voided).map((q) => q.question_text).slice(0, 1).join(''))}</small></a></li>`).join('\n');
  const body = `    <p class="crumbs"><a href="/">Marqit</a> &rsaquo; Daily results</p>
    <h1>Daily <span>results</span></h1>
    <p class="lead">Marqit gives everyone the same three Yes/No calls every day. This is the archive of finished days, with the right answers and how the crowd voted. New days appear once every call is settled.</p>
    <ul class="list">
${items}
    </ul>`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': `${SITE}/daily/#page`, url: `${SITE}/daily/`, name: title, inLanguage: 'en-US',
        isPartOf: { '@id': `${SITE}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Marqit', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Daily results', item: `${SITE}/daily/` },
        ],
      },
    ],
  };
  return shell({ title, desc, path: '/daily/', ld, body });
}

async function main() {
  const today = todayET();
  // Offline mode: node scripts/gen-daily.mjs --data rows.json (rows carry s:{yes,no})
  const di = process.argv.indexOf('--data');
  const offline = di > -1 ? JSON.parse(readFileSync(process.argv[di + 1], 'utf8')) : null;
  const rows = offline || await get(`daily_questions?select=id,question_date,slot,category,question_text,resolved,correct_answer,resolution_criteria,is_boosted,voided,void_reason,why_today&question_date=lt.${today}&order=question_date.desc,slot.asc&limit=2000`);
  const byDay = new Map();
  for (const r of rows) {
    if (!byDay.has(r.question_date)) byDay.set(r.question_date, []);
    byDay.get(r.question_date).push(r);
  }
  const days = [];
  for (const [date, qs] of byDay) {
    const live = qs.filter((q) => !q.voided);
    if (!live.length || !live.every((q) => q.resolved && q.correct_answer)) continue; // not settled yet
    for (const q of qs) Object.assign(q, q.voided ? { yes: 0, no: 0 } : (q.s ? { yes: q.s.yes, no: q.s.no } : await summary(q.id)));
    days.push({ date, qs });
  }
  days.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!days.length) { console.log('No settled days yet.'); return; }

  const dir = join(ROOT, 'daily');
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}\.html$/.test(f)) rmSync(join(dir, f));
  days.forEach((d, i) => {
    const next = days[i - 1]?.date || null; // newer
    const prev = days[i + 1]?.date || null; // older
    writeFileSync(join(dir, `${d.date}.html`), dayPage(d, d.qs, prev, next));
  });
  writeFileSync(join(dir, 'index.html'), indexPage(days));

  const rfc = (iso) => new Date(`${iso}T12:00:00-05:00`).toUTCString();
  const feedItems = days.slice(0, 30).map((d) => {
    const live = d.qs.filter((q) => !q.voided);
    const desc = live.map((q) => `${q.question_text} Answer: ${(q.correct_answer || '').toLowerCase().startsWith('y') ? 'Yes' : 'No'}.`).join(' ');
    return `    <item>
      <title>${esc(`Marqit calls for ${shortDate(d.date)}`)}</title>
      <link>${SITE}/daily/${d.date}</link>
      <guid isPermaLink="true">${SITE}/daily/${d.date}</guid>
      <pubDate>${rfc(d.date)}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
  }).join('\n');
  writeFileSync(join(ROOT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Marqit daily results</title>
    <link>${SITE}/daily/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>The three daily Marqit calls, the right answers and how the crowd voted.</description>
    <language>en-us</language>
${feedItems}
  </channel>
</rss>
`);

  const sm = join(ROOT, 'sitemap.xml');
  let xml = readFileSync(sm, 'utf8').replace(/\s*<!-- daily:start -->[\s\S]*?<!-- daily:end -->/, '');
  const urls = [`/daily/`, ...days.map((d) => `/daily/${d.date}`)].map((p, i) => `  <url>
    <loc>${SITE}${p}</loc>
    <lastmod>${i === 0 ? days[0].date : p.slice(7)}</lastmod>
    <changefreq>${i === 0 ? 'daily' : 'yearly'}</changefreq>
    <priority>${i === 0 ? '0.8' : '0.6'}</priority>
  </url>`).join('\n');
  xml = xml.replace('</urlset>', `  <!-- daily:start -->\n${urls}\n  <!-- daily:end -->\n</urlset>`);
  writeFileSync(sm, xml);
  console.log(`Wrote ${days.length} day page(s) + index.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
