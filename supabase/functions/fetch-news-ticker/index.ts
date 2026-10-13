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
  'https://api.currentsapi.services/v1/latest-news?language=en',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=sports',
  'https://api.currentsapi.services/v1/latest-news?language=en&category=entertainment',
];

const MAX_ROWS = 40;

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
const TAKE_MODEL = 'claude-haiku-5-5';
const TAKE_PROMPT = `You write one debate question per news headline for a sports / pop-culture fan site.
Rules:
- A Yes/No question a fan could argue either way (an opinion, not a fact lookup). Max 90 characters. Plain, human wording, no hype.
- Only sports, entertainment, TV, music, film, games, tech and lifestyle stories.
- Return null for ANYTHING touching: politics or politicians, elections, government, war, military, conflict, crime, courts or lawsuits, accidents, disasters, weather emergencies, health or illness of a real person, death, religion, race, gender identity, immigration, or anything tragic or divisive.
- Never name a private individual. Never accuse anyone of anything.
Reply with JSON only: {"items":[{"i":0,"q":"question or null"}]}`;

async function generateTakes(admin: any) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return { skipped: 'no ANTHROPIC_API_KEY' };
  const { data: pending, error } = await admin
    .from('news_ticker')
    .select('id, headline')
    .eq('take_checked', false)
    .order('fetched_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  if (!pending || pending.length === 0) return { generated: 0 };

  const list = pending.map((r: any, i: number) => `${i}. ${r.headline}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: TAKE_MODEL, max_tokens: 2000, system: TAKE_PROMPT, messages: [{ role: 'user', content: list }] }),
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
    if (q && (q.length < 8 || q.length > 100 || !q.endsWith('?') || isBlockedHeadline(q))) q = null;
    const { error: uErr } = await admin.from('news_ticker').update({ take_question: q, take_checked: true }).eq('id', row.id);
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
    for (const baseUrl of QUERY_URLS) {
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

        return {
          headline: item.title,
          source_name: displayName,
          article_url: item.url,
          image_url: photoUrl(item),
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
      .order('fetched_at', { ascending: false })
      .limit(MAX_ROWS);
    if (selError) throw selError;

    const keepIds = (keepRows || []).map((r: any) => r.id);
    if (keepIds.length > 0) {
      const { error: trimError } = await admin
        .from('news_ticker')
        .delete()
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
