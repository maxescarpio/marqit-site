import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// THE NEWS SOURCE LIST. Only stories from these outlets are ever stored or shown.
// To add or remove a site, edit this list. Each outlet belongs to one tab:
// 'news' (general, business, finance, tech), 'pop' (pop culture, entertainment,
// music) or 'sports'. Keyed by hostname (minus www.), value is [display name, tab].
type Tab = 'news' | 'pop' | 'sports';
const SOURCES: Record<string, [string, Tab]> = {
  // News: general
  'apnews.com': ['AP News', 'news'],
  'reuters.com': ['Reuters', 'news'],
  'bbc.com': ['BBC', 'news'],
  'bbc.co.uk': ['BBC', 'news'],
  'nbcnews.com': ['NBC News', 'news'],
  'abcnews.go.com': ['ABC News', 'news'],
  'cbsnews.com': ['CBS News', 'news'],
  'usatoday.com': ['USA Today', 'news'],
  'theguardian.com': ['The Guardian', 'news'],
  'nytimes.com': ['The New York Times', 'news'],
  'npr.org': ['NPR', 'news'],
  'time.com': ['Time', 'news'],
  'axios.com': ['Axios', 'news'],
  'nypost.com': ['New York Post', 'news'],
  'newsweek.com': ['Newsweek', 'news'],
  'independent.co.uk': ['The Independent', 'news'],
  // News: business and finance
  'wsj.com': ['The Wall Street Journal', 'news'],
  'bloomberg.com': ['Bloomberg', 'news'],
  'cnbc.com': ['CNBC', 'news'],
  'finance.yahoo.com': ['Yahoo Finance', 'news'],
  'marketwatch.com': ['MarketWatch', 'news'],
  'forbes.com': ['Forbes', 'news'],
  'fortune.com': ['Fortune', 'news'],
  'barrons.com': ["Barron's", 'news'],
  'businessinsider.com': ['Business Insider', 'news'],
  'inc.com': ['Inc.', 'news'],
  'fastcompany.com': ['Fast Company', 'news'],
  'semafor.com': ['Semafor', 'news'],
  'benzinga.com': ['Benzinga', 'news'],
  'thestreet.com': ['TheStreet', 'news'],
  'investors.com': ["Investor's Business Daily", 'news'],
  // News: tech and space
  'techcrunch.com': ['TechCrunch', 'news'],
  'theverge.com': ['The Verge', 'news'],
  'engadget.com': ['Engadget', 'news'],
  'wired.com': ['Wired', 'news'],
  'arstechnica.com': ['Ars Technica', 'news'],
  'cnet.com': ['CNET', 'news'],
  'venturebeat.com': ['VentureBeat', 'news'],
  'gizmodo.com': ['Gizmodo', 'news'],
  'mashable.com': ['Mashable', 'news'],
  'tomshardware.com': ["Tom's Hardware", 'news'],
  'space.com': ['Space.com', 'news'],
  'electrek.co': ['Electrek', 'news'],
  '9to5mac.com': ['9to5Mac', 'news'],
  'theinformation.com': ['The Information', 'news'],
  // Pop culture
  'people.com': ['People', 'pop'],
  'eonline.com': ['E! Online', 'pop'],
  'variety.com': ['Variety', 'pop'],
  'ew.com': ['Entertainment Weekly', 'pop'],
  'usmagazine.com': ['Us Weekly', 'pop'],
  'tmz.com': ['TMZ', 'pop'],
  'pagesix.com': ['Page Six', 'pop'],
  'rollingstone.com': ['Rolling Stone', 'pop'],
  'billboard.com': ['Billboard', 'pop'],
  'hollywoodreporter.com': ['The Hollywood Reporter', 'pop'],
  'deadline.com': ['Deadline', 'pop'],
  // Sports
  'espn.com': ['ESPN', 'sports'],
  'sports.yahoo.com': ['Yahoo Sports', 'sports'],
  'bleacherreport.com': ['Bleacher Report', 'sports'],
  'cbssports.com': ['CBS Sports', 'sports'],
  'si.com': ['Sports Illustrated', 'sports'],
  'theathletic.com': ['The Athletic', 'sports'],
  'nfl.com': ['NFL', 'sports'],
  'nba.com': ['NBA', 'sports'],
  'mlb.com': ['MLB', 'sports'],
};

// Headlines matching any of these are never stored or shown. Strict on purpose
// since the site is being advertised: sexual violence, shootings, killings,
// bombings and terrorism, war violence, self-harm, overdoses, child abuse and
// kidnapping. Keep this in sync with MQ_NEWS_BLOCK in app.js (the site applies
// the same filter again when it displays stories).
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
    // vulgar language
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

// Currents' free tier caps raw results at 20/request, so a bigger pool per
// poll means more requests, not a bigger page — pulling the general feed
// plus two targeted categories roughly triples the raw articles scanned
// each cycle (three 20-item batches instead of one), which is what
// actually reduces repetition, since more of the pool gets checked against
// the allow-list each time. 3 calls x 72 polls/day (20-min cadence) = 216
// calls/day, still under the 250/day cap.
const QUERY_URLS = [
  'https://api.currentsapi.services/v1/latest-news?language=en&category=sports',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=entertainment',
];
// Sports and pop culture are pulled every poll so those tabs never run dry; the
// third call rotates through the News tab's feeds (general, business, tech).
// Still 3 calls per poll, so the daily cap is unchanged.
const ROTATING_URLS = [
  'https://api.currentsapi.services/v1/latest-news?language=en',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=business',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=technology',
];
// Stories older than this are dropped, so questions never debate stale news
// (old trades, old feuds) as if it were happening today.
const MAX_AGE_HOURS = 36;

// Only stories with a photo are stored (the News tab shows a story only if it has a photo and a debate question).
const MAX_ROWS = 150;

// Currents sends the photo as `image`, or the text "None" when there isn't one.
function photoUrl(item: any): string | null {
  const u = typeof item.image === 'string' ? item.image.trim() : '';
  return /^https:\/\//i.test(u) ? u : null;
}


// ---- Debate questions -------------------------------------------------------
// Every allowed story gets one neutral Yes/No question so fans can weigh in on
// Marqit. No points are involved. Stories on touchy ground get null (no
// question). take_checked is set once a story has been through the model, so a
// null isn't re-sent every poll; if the API call fails it stays false and the
// next poll retries.
const TAKE_MODEL = 'claude-sonnet-5-5';
const TAKE_PROMPT = `You write the debate question for a story on Marqit, a fan site where people argue about money, tech, sports and pop culture. Each story is a headline plus a short summary.

The main focus is finance and technology: markets, earnings, stocks, IPOs, AI, chips, Nvidia and Jensen Huang, SpaceX and Elon Musk, Tesla, Bezos and Amazon, Apple, Google, Meta, and what the biggest billionaires and companies do or say. Sports and pop culture stories are also welcome.

The question must be the one thing everyone reading is already arguing about, and it must be a DEFINITIVE call that splits the room. Make people want to pick a side.

Rules:
- Yes/No question, max 90 characters, plain spoken. No "Do you think", no "Should fans".
- Take a firm position: "Is X the best...", "Is X overrated?", "Will X win...", "Is X worth $Y?", "Is X a bubble?", "Is X the GOAT?".
- NEVER write hedged or weak questions: no "one of the best", no "still", no "can ... win together", no spread, odds, "cover", over/under or betting framing, no "could" or "might".
- ONLY use facts, names, teams, companies and numbers that appear in the headline or summary. Do not add rosters, current teams, records, stock prices, titles or dates from your own memory, because they may be out of date. If the story depends on a trade, roster, contract or status you are not sure is current, return null.
- Never name a private individual. Never accuse anyone of anything.
- Return null for ANYTHING touching: politics or politicians, elections, government, war, military, conflict, crime, courts, lawsuits or verdicts, accidents, disasters, emergencies, health or illness of a real person, death, religion, race, gender identity, immigration, sexual content, or anything tragic or divisive. Also return null if there is no real debate, or the story is a routine press release.
- Also give "lane": one of markets (stocks, earnings, finance, billionaires, business), tech, sports, pop (movies, TV, celebrities, streaming), music, news.
Reply with JSON only: {"items":[{"i":0,"q":"question or null","lane":"markets"}]}`;

// ---- question safety net -----------------------------------------------------
const TAB_OF: Record<string, Tab> = { markets: 'news', tech: 'news', news: 'news', sports: 'sports', pop: 'pop', music: 'pop' };
const WEAK_Q = /\b(one of the (best|worst|greatest)|cover the spread|the spread|over\/under|odds|do you think|should fans|could|might)\b/i;
const SKIP_WORDS = new Set(['is','are','was','will','can','does','do','did','has','have','the','a','an','and','or','in','on','at','to','of','for','best','worst','new','top','this','that','these','who','what','why','how','when','which','it','he','she','they','we','you','i','yes','no','win','still','than','more','most','better','worse','over','under','worth']);
// Every capitalised word or number in the question must appear in the story
// text, so the writer cannot bring in names, teams or figures from its own memory.
function isGrounded(q: string, source: string): boolean {
  const src = source.toLowerCase().replace(/[’']/g, '');
  const words = q.replace(/[?.,!]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const raw = words[i].replace(/[’']s$/i, '').replace(/[’']/g, '');
    const w = raw.toLowerCase();
    if (!w || SKIP_WORDS.has(w)) continue;
    const proper = /^[A-Z]/.test(raw) && i > 0;
    const num = /\d/.test(raw);
    if ((proper || num) && !src.includes(w.replace(/[$%]/g, ''))) return false;
  }
  return true;
}

async function generateTakes(admin: any) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return { skipped: 'no ANTHROPIC_API_KEY' };
  const { data: pending, error } = await admin
    .from('news_ticker')
    .select('id, headline, summary, source_name, lane')
    .eq('take_checked', false)
    .order('fetched_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  if (!pending || pending.length === 0) return { generated: 0 };

  const list = pending.map((r: any, i: number) => `${i}. ${r.headline}${r.summary ? '\n   Summary: ' + r.summary : ''}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: TAKE_MODEL, max_tokens: 3000, system: TAKE_PROMPT, messages: [{ role: 'user', content: list }] }),
  });
  if (!res.ok) throw new Error('anthropic ' + res.status);
  const out = await res.json();
  const text = (out.content || []).map((c: any) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON from model');
  const items = JSON.parse(m[0]).items || [];
  let n = 0;
  for (const it of items) {
    const row = pending[it.i];
    if (!row) continue;
    let q = typeof it.q === 'string' ? it.q.trim() : null;
    if (q && (q.length < 8 || q.length > 100 || !q.endsWith('?') || isBlockedHeadline(q) || WEAK_Q.test(q) || !isGrounded(q, `${row.headline} ${row.summary || ''}`))) q = null;
    const upd: any = { take_question: q, take_checked: true };
    if (q && TAB_OF[it.lane] && (!row.lane || row.lane === 'news')) upd.lane = TAB_OF[it.lane]; // only general outlets are re-sorted by the model
    const { error: uErr } = await admin.from('news_ticker').update(upd).eq('id', row.id);
    if (!uErr && q) n++;
  }
  return { generated: n, checked: items.length };
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const currentsApiKey = Deno.env.get('CURRENTS_API_KEY');

  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!currentsApiKey) {
    return new Response(JSON.stringify({ error: 'CURRENTS_API_KEY secret is not set.' }), { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const allNews: any[] = [];
    const slot = Math.floor(Date.now() / (20 * 60 * 1000)) % ROTATING_URLS.length;
    for (const baseUrl of [...QUERY_URLS, ROTATING_URLS[slot]]) {
      const res = await fetch(`${baseUrl}&apiKey=${currentsApiKey}`);
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.news)) {
        allNews.push(...data.news);
      }
    }

    if (allNews.length === 0) {
      return new Response(JSON.stringify({ error: 'No usable response from any Currents query.' }), { status: 502 });
    }

    const rows = allNews
      .map((item: any) => {
        if (!item.url) return null;
        let hostname: string;
        try { hostname = new URL(item.url).hostname.replace(/^www\./, ''); }
        catch (_) { return null; }

        const src = SOURCES[hostname];
        if (!src) return null;
        const displayName = src[0]; // not on the allow-list — drop it

        if (item.title && isBlockedHeadline(String(item.title))) return null; // too sensitive — drop it
        if (!photoUrl(item)) return null; // no photo — drop it
        const pubMs = item.published ? new Date(item.published).getTime() : NaN;
        if (!Number.isFinite(pubMs) || Date.now() - pubMs > MAX_AGE_HOURS * 3600 * 1000) return null; // stale or undated — drop it

        return {
          headline: item.title,
          source_name: displayName,
          lane: src[1],
          article_url: item.url,
          image_url: photoUrl(item),
          summary: typeof item.description === 'string' ? item.description.trim().slice(0, 700) || null : null,
          published_at: item.published ? new Date(item.published).toISOString() : null
        };
      })
      .filter((r: any) => r && r.headline && r.article_url);

    // Nothing new this pull — leave the existing table exactly as-is rather
    // than wiping it.
    if (rows.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, note: 'No allow-listed headlines in this pull — table left unchanged.' }), { status: 200 });
    }

    // Accumulate rather than replace: upsert new matches (deduped on
    // article_url, which has a unique constraint), then trim down to the
    // newest MAX_ROWS by fetched_at so the table stays bounded without
    // collapsing to just whatever this one pull happened to find.
    const { error: upsertError, data: upserted } = await admin
      .from('news_ticker')
      .upsert(rows, { onConflict: 'article_url', ignoreDuplicates: true })
      .select('id');
    if (upsertError) throw upsertError;

    const { data: keepRows, error: selError } = await admin
      .from('news_ticker')
      .select('id')
      .eq('kind', 'news') // Marqit updates (kind = 'update') are never trimmed
      .order('fetched_at', { ascending: false })
      .limit(MAX_ROWS);
    if (selError) throw selError;

    const keepIds = (keepRows || []).map((r: any) => r.id);
    if (keepIds.length > 0) {
      const { error: trimError } = await admin
        .from('news_ticker')
        .delete()
        .eq('kind', 'news')
        .not('id', 'in', `(${keepIds.join(',')})`);
      if (trimError) throw trimError;
    }

    let takes: any = null;
    try { takes = await generateTakes(admin); } catch (e) { takes = { error: String(e) }; }

    return new Response(JSON.stringify({ scanned: allNews.length, matched: rows.length, newly_inserted: (upserted || []).length, takes }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
