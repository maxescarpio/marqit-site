import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Builds the Trending tab: what people are searching, watching and listening to right now.
// Sources (all free): Google Trends daily searches, Wikipedia most-read, Apple Music top songs,
// Bluesky trending topics, and YouTube Most Popular (needs YOUTUBE_API_KEY, skipped without it).
// Claude then keeps only sports / pop culture / music / tech topics, drops anything sensitive,
// and writes a short context line plus one debate question. Nothing here is an article.

// ---- safety (same word list as the news fetcher, plus politics and conflict) ----
const BLOCKED_HEADLINE = new RegExp(
  '\\b(' + [
    // sexual violence and exploitation
    'rape[ds]?', 'rapists?', 'raping', 'molest\\w*', 'pedophil\\w*', 'incest',
    'sexual(ly)?\\s+(assault\\w*|abus\\w*|misconduct|harass\\w*|violence)',
    'sex\\s+traffick\\w*', 'traffick\\w*',
    // shootings, killings, murder
    'serial\\s+killers?', 'shootings?', 'shooters?', 'gunm[ae]n', 'gunfire',
    'shot\\s+dead', 'shot\\s+and\\s+killed', 'fatally\\s+shot', 'gunned\\s+down',
    '(was|were|been|is|being|get|gets)\\s+shot', 'shot\\s+by',
    'murder\\w*', 'homicides?', 'manslaughter', 'slain', 'slaying', 'stabb\\w*',
    'killed', 'kills', 'killings?', 'killers?', 'massacres?', 'mass\\s+casualt\\w*',
    'death\\s+toll', 'deadly', 'fatal\\w*', 'found\\s+dead', 'dead\\s+bod\\w*', 'bod(y|ies)\\s+found',
    // bombings, terrorism, war violence
    'bomb\\w*', 'explosions?', 'exploded', 'terror\\w*', 'hostages?', 'behead\\w*',
    'genocide', 'torture\\w*', 'war\\s+crimes?', 'airstrikes?', 'missile\\s+strikes?',
    // self-harm, overdoses, abuse, kidnapping
    'suicid\\w*', 'self-harm', 'overdos\\w*',
    'child\\s+abus\\w*', 'abus\\w*\\s+(of\\s+)?(a\\s+)?(child|children|kids?|minors?)',
    'kidnap\\w*', 'abduct\\w*', 'child\\s+endangerment', 'domestic\\s+violence', 'assault\\w*',
    // deaths and funerals of real people
    'die[sd]?', 'dead', 'deaths?', 'dying', 'passed\\s+away', 'funerals?', 'obituar\\w*',
    'late\\s+(husband|wife|father|mother|son|daughter)', 'cancer', 'tumou?rs?', 'diagnos\\w*', 'chemo\\w*', 'terminal\\s+ill\\w*', 'health\\s+(battle|scare|struggles?|crisis)', 'hospital\\w*', 'sex(ual)?', 'nude', 'naked',
    'ass', 'asses', 'asshole\\w*', 'bitch\\w*', 'fuck\\w*', 'shit\\w*', 'damn\\w*', 'crap', 'piss\\w*', 'dick', 'cock', 'whore\\w*', 'slut\\w*',
  ].join('|') + ')\\b',
  'i'
);
const OK_PHRASES = /\b(shooting\s+(guard|percentage|star|touch|slump|form|stroke)|kill(s|ed|ing)?\s+(it|the\s+(game|show|stage|crowd|room))|die[- ]hards?)\b/gi;
const REHAB_DEATH = /\brehab\b/i;
const DEATH_WORD = /\b(death|deaths|died|dies|dead|dying)\b/i;
function isBlockedHeadline(title: string): boolean {
  if (REHAB_DEATH.test(title) && DEATH_WORD.test(title)) return true;
  return BLOCKED_HEADLINE.test(title.replace(OK_PHRASES, ''));
}


const POLITICS = /\b(trump|biden|harris|vance|obama|election|elections|senate|senator|congress|congressional|democrat\w*|republican\w*|gop|white\s+house|supreme\s+court|shutdown|impeach\w*|immigration|ice\s+raids?|deport\w*|border|israel\w*|gaza|hamas|hezbollah|ukrain\w*|russia\w*|putin|zelensky\w*|iran\w*|china|taiwan|north\s+korea|nato|war|invasion|troops|military|pentagon|police|arrest\w*|indict\w*|lawsuit|trial|verdict|sentenc\w*|prison|jail|charged|accused|scandal|abortion|vaccine|covid|flood\w*|inundaci\w*|earthquake|hurricane|wildfire|tornado|storm|evacuat\w*|crash|outbreak)\b/i;
function isBlocked(text: string): boolean {
  const t = text || '';
  if (isBlockedHeadline(t)) return true;
  return POLITICS.test(t);
}

const TREND_MODEL = 'claude-sonnet-5-5';
const MAX_KEEP = 30;
const KEEP_HOURS = 48;
// Never-empty floor: the tab always keeps at least MIN_TREND trends. If the AI
// is down, generic (code-written) topics fill it; the newest FLOOR_TARGET trends
// are never retired, however old.
const MIN_TREND = 15;
const FLOOR_TARGET = 20;

type Candidate = { id: number; source: string; title: string; info: string; url: string | null; image: string | null; rank: number };

function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}
function tag(block: string, name: string): string {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decode(m[1]) : '';
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function dayStr(d: Date): string { return d.toISOString().slice(0, 10); }

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': 'MarqitTrending/1.0 (playmarqit.com)', ...headers } });
  if (!res.ok) throw new Error(url.split('?')[0] + ' ' + res.status);
  return res.json();
}

// ---- sources ----
function parseGoogleTrends(xml: string): { title: string; traffic: string; news: string }[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.map((it) => ({
    title: tag(it, 'title'),
    traffic: tag(it, 'ht:approx_traffic'),
    news: tag(it, 'ht:news_item_title'),
  })).filter((x) => x.title);
}
async function googleTrends(): Promise<Candidate[]> {
  const res = await fetch('https://trends.google.com/trending/rss?geo=US', { headers: { 'User-Agent': 'MarqitTrending/1.0' } });
  if (!res.ok) throw new Error('google trends ' + res.status);
  const rows = parseGoogleTrends(await res.text());
  return rows.slice(0, 25).map((r, i) => ({
    id: 0, source: 'Google Trends', title: r.title,
    info: (r.traffic ? r.traffic + ' searches. ' : '') + (r.news ? 'Related headline: ' + r.news : ''),
    url: null, image: null, rank: i + 1,
  }));
}

function wikiSkip(title: string): boolean {
  return /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Category:|Template:|Talk:|User:|-)/.test(title) || title === '.' || /^List_of_/.test(title);
}
async function wikipedia(): Promise<Candidate[]> {
  const d = new Date(Date.now() - 36 * 3600 * 1000); // yesterday UTC; today's data is not published yet
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  const data = await getJson(url);
  const arts = ((data.items || [])[0]?.articles || []).filter((a: any) => !wikiSkip(a.article)).slice(0, 30);
  const out: Candidate[] = [];
  await Promise.all(arts.map(async (a: any, i: number) => {
    try {
      const s = await getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(a.article));
      const extract = String(s.extract || '').slice(0, 220);
      out.push({
        id: 0, source: 'Wikipedia', title: String(s.title || a.article).replace(/_/g, ' '),
        info: `${Number(a.views).toLocaleString('en-US')} page views yesterday. ${s.description ? s.description + '. ' : ''}${extract}`,
        url: null, image: (s.thumbnail && /^https:\/\//.test(s.thumbnail.source || '')) ? s.thumbnail.source : null, rank: i + 1,
      });
    } catch (_) { /* skip this page */ }
  }));
  return out.sort((x, y) => x.rank - y.rank);
}

async function appleMusic(): Promise<Candidate[]> {
  const data = await getJson('https://rss.applemarketingtools.com/api/v2/us/music/most-played/10/songs.json');
  return (data.feed?.results || []).map((r: any, i: number) => ({
    id: 0, source: 'Apple Music', title: `${r.name} by ${r.artistName}`,
    info: `No. ${i + 1} most-played song on Apple Music in the US.`,
    url: null, image: typeof r.artworkUrl100 === 'string' ? r.artworkUrl100.replace('100x100', '600x600') : null, rank: i + 1,
  }));
}

async function bluesky(): Promise<Candidate[]> {
  const data = await getJson('https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=25');
  const topics = [...(data.topics || []), ...(data.suggested || [])];
  return topics.slice(0, 25).map((t: any, i: number) => ({
    id: 0, source: 'Bluesky', title: String(t.topic || t.displayName || ''),
    info: 'Trending topic on Bluesky.', url: null, image: null, rank: i + 1,
  })).filter((c: Candidate) => c.title);
}

async function youtube(key: string): Promise<Candidate[]> {
  const cats: [string, string][] = [['10', 'music'], ['17', 'sports'], ['24', 'entertainment'], ['28', 'tech']];
  const out: Candidate[] = [];
  await Promise.all(cats.map(async ([cat, label]) => {
    try {
      const d = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&videoCategoryId=${cat}&maxResults=6&key=${key}`);
      (d.items || []).forEach((v: any, i: number) => {
        out.push({
          id: 0, source: 'YouTube', title: String(v.snippet?.title || ''),
          info: `${label} video from ${v.snippet?.channelTitle || 'a channel'}, ${Number(v.statistics?.viewCount || 0).toLocaleString('en-US')} views, among the most popular ${label} videos in the US right now.`,
          url: 'https://www.youtube.com/watch?v=' + v.id, image: null, rank: i + 1,
        });
      });
    } catch (_) { /* skip this category */ }
  }));
  return out;
}

// ---- the question writer: free Gemini key first, Claude as a backup ----------------
// Set GEMINI_API_KEY (Google AI Studio, free) as a Supabase secret. If Gemini fails or
// is rate-limited, Claude is tried when ANTHROPIC_API_KEY has credits. If both fail the
// caller gets an error, and the never-empty floor keeps every tab filled with generic
// questions until the next run.
const GEMINI_MODEL = 'gemini-flash-latest';
async function askModel(system: string, user: string, maxTokens: number, claudeModel: string): Promise<{ text: string; via: string }> {
  const errors: string[] = [];
  const gKey = Deno.env.get('GEMINI_API_KEY');
  if (gKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': gKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: Math.max(maxTokens, 8192), temperature: 0.6, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error('gemini ' + res.status + ' ' + (await res.text()).slice(0, 200));
      const out = await res.json();
      const text = (out.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
      if (!text) throw new Error('gemini empty reply');
      return { text, via: 'gemini' };
    } catch (e) { errors.push(String(e)); }
  }
  const aKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (aKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': aKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: claudeModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error('anthropic ' + res.status + ' ' + (await res.text()).slice(0, 200));
      const out = await res.json();
      return { text: (out.content || []).map((c: any) => c.text || '').join(''), via: 'claude' };
    } catch (e) { errors.push(String(e)); }
  }
  throw new Error(errors.join(' | ') || 'no AI key set (GEMINI_API_KEY or ANTHROPIC_API_KEY)');
}

// ---- the model: keep, rewrite, ask ----
const PROMPT = `You curate the Trending tab of Marqit, a fun daily-predictions site for finance, tech, sports, pop culture and music fans. Below is a numbered list of things trending right now from public sources.

For each item decide whether to KEEP it. Keep at most ${MAX_KEEP} in total, favoring finance and tech first (markets, big companies, AI, chips, billionaires), then sports, pop culture and music, and favoring things fans would actually argue about.

KEEP only: stocks, markets, earnings, IPOs and company business news, AI and chips (Nvidia, Jensen Huang), SpaceX, Tesla, Elon Musk, Jeff Bezos, Amazon, Apple, Google, Meta and other big companies and billionaires (their business moves only, never their politics), sports (teams, players, games, trades), movies, TV, streaming, celebrities and their work, music and songs, video games, tech products and tech companies, viral entertainment.
DROP (keep=false) anything about: politics, politicians, government, elections, war, military, conflict, crime, police, courts, lawsuits, arrests, accidents, disasters, weather emergencies, health or illness of a real person, death or anyone who has died (a death year of 2025 or 2026 in a Wikipedia summary means drop), religion, race, gender identity, immigration, sexual content, anything tragic or divisive. Also drop confusing items, duplicates of something already kept, and anything you cannot explain from the information given.

For each KEPT item return:
- "title": a short, clear topic name a fan would recognize (max 60 characters). For a YouTube video, a clean version of the video title. For a song, "Song Title - Artist".
- "context": ONE plain sentence (max 110 characters) saying why it is trending, using only the information given. No hype. Never invent facts.
- "lane": one of markets (stocks, earnings, finance, billionaires), tech, sports, pop (movies, TV, celebrities, streaming), music, news.
- "q": a Yes/No debate question (max 90 characters) that makes a DEFINITIVE call fans will split on: "Is X the best...", "Will X win...", "Is X overrated?", "Is X a bubble?". Never hedge: no "one of the best", no spread, odds or "cover", no "could" or "might", no "still". Use only names, teams and numbers given in the item, never facts from your own memory (rosters, teams, prices, titles may be out of date). If there is no real debate, or you are unsure it is current, use null.

Reply with JSON only: {"items":[{"i":0,"keep":false},{"i":1,"keep":true,"title":"...","context":"...","lane":"sports","q":"..."}]}`;

async function curate(cands: Candidate[]): Promise<{ items: any[]; via: string }> {
  const list = cands.map((c) => `${c.id}. [${c.source}] ${c.title} :: ${c.info}`).join('\n');
  const { text, via } = await askModel(PROMPT, list, 8000, TREND_MODEL);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON from model');
  return { items: JSON.parse(m[0]).items || [], via };
}

// ---- the floor: no-AI fallback --------------------------------------------------
// Candidates already passed the word and politics filters. Without the model there
// is no relevance pass, so the topic title itself is the only thing the question uses.
const FLOOR_QS: Array<(t: string) => string> = [
  (t) => `Is ${t} the biggest story right now?`,
  (t) => `Is ${t} overhyped?`,
  (t) => `Does ${t} deserve all the attention?`,
  (t) => `Will ${t} be trending again tomorrow?`,
  (t) => `Is ${t} worth the hype?`,
];
// No model looked at these topics, so be stricter than the normal filter: skip anything
// that hints at an incident, injury, legal trouble or a fight, in the title or the
// related headline.
const FLOOR_EXTRA = /\b(shot|shoots?|attack\w*|injur\w*|hurt|victims?|missing|sued|sues|court|allegations?|alleged|fires?|burn\w*|collaps\w*|rescue\w*|emergency|threat\w*|riots?|protests?|strikes?|recall\w*|banned|fraud|scam\w*|feud|beef)\b/i;
const SOURCE_PRIORITY = ['Google Trends', 'YouTube', 'Wikipedia', 'Apple Music', 'Bluesky'];
function floorLane(c: Candidate): string {
  if (c.source === 'Apple Music') return 'music';
  const yt = c.info.match(/^(music|sports|entertainment|tech) video/i);
  if (yt) { const l = yt[1].toLowerCase(); return l === 'entertainment' ? 'pop' : l; }
  const text = c.title + ' ' + c.info.replace(/Related headline:/i, '');
  if (/\b(nfl|nba|mlb|nhl|wnba|ufc|ncaa|mls|fc|vs\.?|playoffs?|world series|super bowl|finals?|grand prix|f1|tennis|golf|quarterback|touchdown|home run|season)\b/i.test(text)) return 'sports';
  if (/\b(stocks?|shares|earnings|ipo|nasdaq|s&p|dow|fed|bitcoin|crypto|nvidia|tesla|spacex|musk|bezos|jensen|apple|google|microsoft|meta|amazon|openai|ai|chips?)\b/i.test(text)) return 'tech';
  return 'pop';
}
function floorContext(c: Candidate): string {
  let ctx = c.info.trim();
  if (isBlocked(ctx)) ctx = ctx.replace(/Related headline:.*/i, '').trim();
  if (ctx.length < 5 || isBlocked(ctx)) ctx = `Trending on ${c.source} right now.`;
  if (ctx.length > 110) ctx = ctx.slice(0, 110).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '...';
  return ctx;
}
function floorRows(all: Candidate[], need: number, taken: Set<string>, today: string): any[] {
  const ordered = [...all].sort((a, b) => (SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)) || (a.rank - b.rank));
  const out: any[] = [];
  const titles = new Set<string>();
  for (const c of ordered) {
    if (out.length >= need) break;
    const title = c.title.trim().slice(0, 60);
    if (title.length < 3 || isBlocked(title) || FLOOR_EXTRA.test(c.title + ' ' + c.info)) continue;
    const tk = slug(title);
    if (!tk || titles.has(tk)) continue;
    const key = c.url || `trend:${slug(c.source)}:${tk}:${today}`;
    if (taken.has(key)) continue;
    const q = FLOOR_QS[(tk.length + c.rank) % FLOOR_QS.length](title);
    if (q.length > 100 || isBlocked(q)) continue;
    titles.add(tk); taken.add(key);
    out.push({
      headline: title, summary: floorContext(c), source_name: c.source, article_url: key, image_url: c.image,
      kind: 'trend', lane: floorLane(c), take_question: q, take_checked: false, trend_rank: Math.min(c.rank, 100), published_at: new Date().toISOString(),
    });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const report: Record<string, any> = {};
    const ytKey = Deno.env.get('YOUTUBE_API_KEY');
    const jobs: [string, Promise<Candidate[]>][] = [
      ['google', googleTrends()], ['wikipedia', wikipedia()], ['apple', appleMusic()], ['bluesky', bluesky()],
    ];
    if (ytKey) jobs.push(['youtube', youtube(ytKey)]); else report.youtube = 'skipped: no YOUTUBE_API_KEY';
    const settled = await Promise.allSettled(jobs.map((j) => j[1]));
    let all: Candidate[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') { report[jobs[i][0]] = r.value.length; all = all.concat(r.value); }
      else report[jobs[i][0]] = 'failed: ' + String((r as PromiseRejectedResult).reason);
    });

    // Drop anything obviously sensitive before it ever reaches the model, then number the rest.
    all = all.filter((c) => !isBlocked(c.title) && !isBlocked(c.info.replace(/Related headline:.*/i, '')));
    all.forEach((c, i) => { c.id = i; });
    if (all.length === 0) return new Response(JSON.stringify({ error: 'No candidates from any source', report }), { status: 502 });

    let decisions: any[] = [];
    try { const c = await curate(all); decisions = c.items; report.ai = 'ok via ' + c.via; } catch (e) { report.ai = 'failed: ' + String(e).slice(0, 300); }
    const today = dayStr(new Date());
    const rows: any[] = [];
    const seen = new Set<string>();
    for (const d of decisions) {
      const c = all[d.i];
      if (!c || !d.keep) continue;
      const title = String(d.title || '').trim();
      const context = String(d.context || '').trim();
      if (title.length < 3 || title.length > 80 || context.length < 5) continue;
      if (isBlocked(title) || isBlocked(context)) continue;
      let q: string | null = typeof d.q === 'string' ? d.q.trim() : null;
      if (q && (q.length < 8 || q.length > 100 || !q.endsWith('?') || isBlocked(q))) q = null;
      const lane = ['sports', 'pop', 'music', 'tech', 'news', 'markets'].includes(d.lane) ? d.lane : 'news';
      const key = c.url || `trend:${slug(c.source)}:${slug(title)}:${today}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        headline: title, summary: context, source_name: c.source, article_url: key, image_url: c.image,
        kind: 'trend', lane, take_question: q, take_checked: true, trend_rank: Math.min(c.rank, 100), published_at: new Date().toISOString(),
      });
      if (rows.length >= MAX_KEEP) break;
    }

    // AI rows replace the generic ones, but only once the AI alone fills the tab.
    if (rows.length >= MIN_TREND) {
      await admin.from('news_ticker').delete().eq('kind', 'trend').eq('take_checked', false).eq('pinned', false);
    }
    let inserted = 0;
    if (rows.length) {
      const { data: ins, error } = await admin.from('news_ticker').upsert(rows, { onConflict: 'article_url', ignoreDuplicates: true }).select('id');
      if (error) throw error;
      inserted = (ins || []).length;
    }

    // Never-empty floor: under MIN_TREND fresh trends, top up from the filtered candidates.
    const freshCutoff = new Date(Date.now() - KEEP_HOURS * 3600 * 1000).toISOString();
    const { count: fresh } = await admin.from('news_ticker').select('id', { count: 'exact', head: true }).eq('kind', 'trend').not('take_question', 'is', null).gte('fetched_at', freshCutoff);
    let floored = 0;
    if ((fresh || 0) < MIN_TREND) {
      const fill = floorRows(all, FLOOR_TARGET - (fresh || 0), new Set(seen), today);
      if (fill.length) {
        const { data: fIns, error: fErr } = await admin.from('news_ticker').upsert(fill, { onConflict: 'article_url', ignoreDuplicates: true }).select('id');
        if (fErr) throw fErr;
        floored = (fIns || []).length;
      }
    }

    // Retire old trends so the tab stays about right now, but never the newest FLOOR_TARGET.
    const { data: newest } = await admin.from('news_ticker').select('id').eq('kind', 'trend').not('take_question', 'is', null).order('fetched_at', { ascending: false }).limit(FLOOR_TARGET);
    let del = admin.from('news_ticker').delete().eq('kind', 'trend').lt('fetched_at', freshCutoff).eq('pinned', false);
    const protect = (newest || []).map((r: any) => r.id);
    if (protect.length) del = del.not('id', 'in', `(${protect.join(',')})`);
    await del;

    return new Response(JSON.stringify({ candidates: all.length, kept: rows.length, inserted, floored, fresh_before_floor: fresh, report }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
