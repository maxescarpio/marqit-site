import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Only headlines from these outlets are shown in the ticker and the News tab.
// Keyed by the article's hostname (minus a leading www.), mapped to the display
// name we want to show instead of the article's author byline.
const ALLOWED_SOURCES: Record<string, string> = {
  // General news
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
  'reuters.com': 'Reuters',
  'apnews.com': 'AP News',
  'nbcnews.com': 'NBC News',
  'abcnews.go.com': 'ABC News',
  'cbsnews.com': 'CBS News',
  'usatoday.com': 'USA Today',
  'theguardian.com': 'The Guardian',
  'nytimes.com': 'The New York Times',
  'washingtonpost.com': 'The Washington Post',
  'wsj.com': 'The Wall Street Journal',
  'politico.com': 'Politico',
  'nypost.com': 'New York Post',
  'metro.co.uk': 'Metro',
  'mirror.co.uk': 'Mirror',
  'npr.org': 'NPR',
  'time.com': 'Time',
  'newsweek.com': 'Newsweek',
  'independent.co.uk': 'The Independent',
  'telegraph.co.uk': 'The Telegraph',
  'axios.com': 'Axios',
  'businessinsider.com': 'Business Insider',
  'thehill.com': 'The Hill',
  'news.sky.com': 'Sky News',
  'aljazeera.com': 'Al Jazeera',
  'latimes.com': 'LA Times',
  // Entertainment
  'people.com': 'People',
  'eonline.com': 'E! Online',
  'variety.com': 'Variety',
  'ew.com': 'Entertainment Weekly',
  'usmagazine.com': 'Us Weekly',
  'tmz.com': 'TMZ',
  'pagesix.com': 'Page Six',
  'rollingstone.com': 'Rolling Stone',
  'billboard.com': 'Billboard',
  'hollywoodreporter.com': 'The Hollywood Reporter',
  'deadline.com': 'Deadline',
  'gq.com': 'GQ',
  'elle.com': 'Elle',
  // Sports
  'espn.com': 'ESPN',
  'sports.yahoo.com': 'Yahoo Sports',
  'bleacherreport.com': 'Bleacher Report',
  'cbssports.com': 'CBS Sports',
  'si.com': 'Sports Illustrated',
  'theathletic.com': 'The Athletic',
  'nfl.com': 'NFL',
  'nba.com': 'NBA',
  'mlb.com': 'MLB',
  // Business / finance
  'finance.yahoo.com': 'Yahoo Finance',
  'forbes.com': 'Forbes',
  'cnbc.com': 'CNBC',
  'bloomberg.com': 'Bloomberg',
  'marketwatch.com': 'MarketWatch',
  'fortune.com': 'Fortune',
  'barrons.com': "Barron's",
  'investopedia.com': 'Investopedia',
  'inc.com': 'Inc.',
  'fastcompany.com': 'Fast Company',
  'semafor.com': 'Semafor',
  'benzinga.com': 'Benzinga',
  'thestreet.com': 'TheStreet',
  'investors.com': "Investor's Business Daily",
  'seekingalpha.com': 'Seeking Alpha',
  'coindesk.com': 'CoinDesk',
  'cnbc.com.au': 'CNBC',
  // Tech
  'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'engadget.com': 'Engadget',
  'wired.com': 'Wired',
  'arstechnica.com': 'Ars Technica',
  'cnet.com': 'CNET',
  'mashable.com': 'Mashable',
  'venturebeat.com': 'VentureBeat',
  'zdnet.com': 'ZDNet',
  'gizmodo.com': 'Gizmodo',
  'tomshardware.com': 'Tom\'s Hardware',
  'space.com': 'Space.com',
  'electrek.co': 'Electrek',
  '9to5mac.com': '9to5Mac',
  'theinformation.com': 'The Information',
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
  'https://api.currentsapi.services/v1/latest-news?language=en&category=business',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=technology',
];
// The third call rotates so sports and entertainment still get pulled, while
// finance and tech (the main focus of the News tab) are pulled every time.
// Still 3 calls per poll, so the daily cap is unchanged.
const ROTATING_URLS = [
  'https://api.currentsapi.services/v1/latest-news?language=en',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=sports',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=entertainment',
];
// Stories older than this are dropped, so questions never debate stale news
// (old trades, old feuds) as if it were happening today.
const MAX_AGE_HOURS = 36;

// Only stories with a photo are stored (the News tab shows a story only if it has a photo and a debate question).
const MAX_ROWS = 100;

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
const LANES_OK = ['markets', 'tech', 'sports', 'pop', 'music', 'news'];
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
    .select('id, headline, summary, source_name')
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
    if (q && LANES_OK.includes(it.lane)) upd.lane = it.lane;
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

        const displayName = ALLOWED_SOURCES[hostname];
        if (!displayName) return null; // not on the allow-list — drop it

        if (item.title && isBlockedHeadline(String(item.title))) return null; // too sensitive — drop it
        if (!photoUrl(item)) return null; // no photo — drop it
        const pubMs = item.published ? new Date(item.published).getTime() : NaN;
        if (!Number.isFinite(pubMs) || Date.now() - pubMs > MAX_AGE_HOURS * 3600 * 1000) return null; // stale or undated — drop it

        return {
          headline: item.title,
          source_name: displayName,
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
