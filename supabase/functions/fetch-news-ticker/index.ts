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
// (old trades, old feuds) as if it were happening today. A tab that has fewer
// than MIN_PER_TAB finished stories is allowed to take older ones (up to
// LENIENT_AGE_HOURS) so no tab is ever empty or thin.
const MAX_AGE_HOURS = 36;
const LENIENT_AGE_HOURS = 120;
const MIN_PER_TAB = 15;

// Only stories with a photo are stored (the News tab shows a story only if it has a photo and a debate question).
const MAX_ROWS = 150;
const KEEP_PER_TAB = 60;
const TABS: Tab[] = ['news', 'pop', 'sports'];

// Free RSS feeds, mostly finance and tech (CNBC, Yahoo Finance, Bloomberg...),
// plus pop culture and sports. They have no daily cap, so they carry most of the
// volume. A feed that is down or changes format is skipped without breaking the rest.
const FEEDS: Array<[string, string, Tab]> = [
  ['CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'news'],
  ['CNBC', 'https://www.cnbc.com/id/10000664/device/rss/rss.html', 'news'],
  ['CNBC', 'https://www.cnbc.com/id/19854910/device/rss/rss.html', 'news'],
  ['CNBC', 'https://www.cnbc.com/id/15839069/device/rss/rss.html', 'news'],
  ['Yahoo Finance', 'https://finance.yahoo.com/news/rssindex', 'news'],
  ['Bloomberg', 'https://feeds.bloomberg.com/markets/news.rss', 'news'],
  ['Bloomberg', 'https://feeds.bloomberg.com/technology/news.rss', 'news'],
  ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'news'],
  ['The Wall Street Journal', 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', 'news'],
  ['The Wall Street Journal', 'https://feeds.content.dowjones.io/public/rss/RSSWSJD', 'news'],
  ['Fortune', 'https://fortune.com/feed/', 'news'],
  ['Business Insider', 'https://feeds.businessinsider.com/custom/all', 'news'],
  ['TechCrunch', 'https://techcrunch.com/feed/', 'news'],
  ['The Verge', 'https://www.theverge.com/rss/index.xml', 'news'],
  ['Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'news'],
  ['Wired', 'https://www.wired.com/feed/rss', 'news'],
  ['Engadget', 'https://www.engadget.com/rss.xml', 'news'],
  ['Electrek', 'https://electrek.co/feed/', 'news'],
  ['Space.com', 'https://www.space.com/feeds/all', 'news'],
  ['Variety', 'https://variety.com/feed/', 'pop'],
  ['Billboard', 'https://www.billboard.com/feed/', 'pop'],
  ['Rolling Stone', 'https://www.rollingstone.com/feed/', 'pop'],
  ['Deadline', 'https://deadline.com/feed/', 'pop'],
  ['The Hollywood Reporter', 'https://www.hollywoodreporter.com/feed/', 'pop'],
  ['People', 'https://people.com/feed/', 'pop'],
  ['ESPN', 'https://www.espn.com/espn/rss/news', 'sports'],
  ['CBS Sports', 'https://www.cbssports.com/rss/headlines/', 'sports'],
  ['Yahoo Sports', 'https://sports.yahoo.com/rss/', 'sports'],
  ['Sports Illustrated', 'https://www.si.com/rss/si_topstories', 'sports'],
];
const PER_FEED = 12;
const UA = 'Mozilla/5.0 (compatible; MarqitBot/1.0; +https://playmarqit.com)';

type Item = { title: string; url: string; image: string | null; description: string; published: string | null; source: string; tab: Tab };

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&');
}
function xmlTag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
}
function stripHtml(s: string): string { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function rssImage(block: string): string | null {
  const m = block.match(/<media:content[^>]*\burl=["']([^"']+)["']/i)
    || block.match(/<media:thumbnail[^>]*\burl=["']([^"']+)["']/i)
    || block.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*type=["']image/i)
    || block.match(/<enclosure[^>]*type=["']image[^>]*\burl=["']([^"']+)["']/i);
  let u = m ? decodeEntities(m[1]) : '';
  if (!u) {
    const im = decodeEntities(block).match(/<img[^>]*\bsrc=["'](https:\/\/[^"']+)["']/i);
    u = im ? im[1] : '';
  }
  return /^https:\/\//i.test(u) ? u : null;
}
function parseFeed(xml: string, source: string, tab: Tab): Item[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const out: Item[] = [];
  for (const b of blocks.slice(0, PER_FEED)) {
    const title = stripHtml(xmlTag(b, 'title'));
    const url = xmlTag(b, 'link') || ((b.match(/<link[^>]*\bhref=["']([^"']+)["']/i) || [])[1] || '');
    if (!title || !/^https:\/\//i.test(url)) continue;
    const desc = stripHtml(xmlTag(b, 'description') || xmlTag(b, 'summary') || xmlTag(b, 'content:encoded')).slice(0, 700);
    const published = xmlTag(b, 'pubDate') || xmlTag(b, 'published') || xmlTag(b, 'updated') || xmlTag(b, 'dc:date') || null;
    out.push({ title, url, image: rssImage(b), description: desc, published, source, tab });
  }
  return out;
}
async function fetchFeeds(): Promise<{ items: Item[]; failed: number }> {
  let failed = 0;
  const results = await Promise.allSettled(FEEDS.map(async ([name, url, tab]) => {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    return parseFeed(await r.text(), name, tab);
  }));
  const items: Item[] = [];
  for (const r of results) { if (r.status === 'fulfilled') items.push(...r.value); else failed++; }
  return { items, failed };
}
async function ogImage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const t = (await r.text()).slice(0, 80000);
    const m = t.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || t.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const u = m ? decodeEntities(m[1]) : '';
    return /^https:\/\//i.test(u) ? u : null;
  } catch (_) { return null; }
}

// Applies one lane's tab filter to a news_ticker query.
function inTab(q: any, t: Tab) {
  if (t === 'sports') return q.eq('lane', 'sports');
  if (t === 'pop') return q.in('lane', ['pop', 'music']);
  return q.or('lane.is.null,lane.not.in.(sports,pop,music)');
}
// How many finished stories (photo + question) each tab has right now.
async function tabCounts(admin: any): Promise<Record<Tab, number>> {
  const out: Record<Tab, number> = { news: 0, pop: 0, sports: 0 };
  for (const t of TABS) {
    const { count } = await inTab(admin.from('news_ticker').select('id', { count: 'exact', head: true }).eq('kind', 'news').not('take_question', 'is', null).not('image_url', 'is', null), t);
    out[t] = count || 0;
  }
  return out;
}

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

The question must be a real DEBATE built from THIS story: use the actual names, companies, teams, numbers or events in the headline, so a reader instantly knows which story it is about and has a side to pick. It has to be something fans would genuinely fight about in the comments, with a reasonable case for both Yes and No. Never write a question that could be pasted under any other story.

Good (specific, two-sided): "Is Nvidia's $5 trillion valuation a bubble?", "Did Apple overpay for this deal?", "Is Taylor Swift's new album her best yet?", "Is Tesla stock worth $400 after this?", "Is the Lakers' new trade a win?".
Pick a side people can defend, not a forecast. Prefer judgment questions ("Is X a buy?", "Was X the right call?", "Is X overpaid?", "Is X the best Y?", "Did X just win the week?") over "Will X happen?" questions, which have no argument in them. Use "Will" only when fans would truly split on the outcome (a game, a title, a stock holding a level).
Bad (generic, never write these): "Is this a big deal?", "Is this story overhyped?", "Does this change anything?", "Are people overreacting?".

Rules:
- Yes/No question, max 90 characters, plain spoken, and it must name the subject of the story. No "Do you think", no "Should fans".
- Take a firm position: "Is X the best...", "Is X overrated?", "Will X win...", "Is X worth $Y?", "Is X a bubble?", "Is X the GOAT?".
- NEVER write hedged or weak questions: no "one of the best", no "still", no "can ... win together", no spread, odds, "cover", over/under or betting framing, no "could" or "might".
- ONLY use facts, names, teams, companies and numbers that appear in the headline or summary. Do not add rosters, current teams, records, stock prices, titles or dates from your own memory, because they may be out of date. If the story depends on a trade, roster, contract or status you are not sure is current, return null.
- SPORTS: debate what already happened or what the headline itself says is coming. Good: "Was the Broncos' overtime win a fluke?", "Is Sam Darnold the problem in Seattle?", "Did the Brewers just become the team to beat?". Never claim or imply a future game, rematch or schedule that the text does not state: no "again", "rematch", "next game", "next week", "this season" unless those exact ideas are in the headline or summary. Teams do not replay each other on demand.
- SPORTS: never say which team a player plays for, or what role he has, unless the headline or summary says so in this very story. Players transfer; your memory of rosters is out of date. If the question would only work with a roster fact you are unsure of, return null.
- Previews, scouting reports, predictions, odds, fantasy advice, "keys to victory" and injury reports: write a judgment question about what the story actually argues, or return null. Do not turn them into "Will [player] lead [team] past [team]?".
- INJURIES: return null for any story about an injury, surgery, recovery, return from injury or a player being out. Do not ask "will he return" or "will they miss him".
- Never name a private individual. Never accuse anyone of anything.
- Return null for ANYTHING touching: politics or politicians, elections, government, war, military, conflict, crime, courts, lawsuits or verdicts, accidents, disasters, emergencies, health or illness of a real person, death, religion, race, gender identity, immigration, sexual content, or anything tragic or divisive. Also return null if there is no real debate, or the story is a routine press release.
- Write a question for EVERY story that is not on the null list above, even a business or sports story with a mild angle: find the one call people would argue about (Is it a buy? Will it last? Is it the best?). Return null only for the banned topics, a routine press release, or a story where every question would need facts that are not in the text.
- Also give "lane": one of markets (stocks, earnings, finance, billionaires, business), tech, sports, pop (movies, TV, celebrities, streaming), music, news.
Reply with JSON only: {"items":[{"i":0,"q":"question or null","lane":"markets"}]}`;

// ---- question safety net -----------------------------------------------------
const TAB_OF: Record<string, Tab> = { markets: 'news', tech: 'news', news: 'news', sports: 'sports', pop: 'pop', music: 'pop' };
const WEAK_Q = /\b(one of the (best|worst|greatest)|cover the spread|the spread|over\/under|odds|do you think|should fans|could|might)\b/i;
// Questions that assume a future game, a rematch or an injury comeback. The writer has
// no schedule or injury feed, so these tend to be wrong ("beat the Seahawks again").
// "again", "rematch" and "another" are only allowed when the story itself uses the word.
const FUTURE_ASSUMPTION_Q = /\b(again|rematch|another|next (game|match|week|round|season|meeting|time)|return(s|ing|ed)?|comeback|recover(s|y|ed|ing)?|back from)\b/i;
const INJURY_TEXT = /\b(injur\w*|surgery|surgical|hamstring|acl|mcl|meniscus|concussion|sidelined|ruled out|out for the (season|year)|knee (issue|problem|injury)|ankle|fracture\w*|broken (arm|leg|foot|wrist|collarbone|forearm)|torn|strain(ed)?|day-to-day|questionable|doubtful)\b/i;
function badQuestion(q: string, source: string): boolean {
  if (INJURY_TEXT.test(q) || INJURY_TEXT.test(source)) return true;
  const m = q.match(FUTURE_ASSUMPTION_Q);
  if (m && !new RegExp('\\b' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(source)) return true;
  return false;
}
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

// ---- the floor: a tab is never empty, even when the question writer is down ----
// If the AI call fails (out of credits, outage, bad reply) stories stay
// unchecked and would never be shown. When a tab drops under MIN_PER_TAB
// finished stories, the newest UNCHECKED stories in it get a generic question
// written by code. It names nothing, so it cannot be wrong or out of date.
// Stories the AI already rejected (take_checked = true) are never touched, and
// because these stay unchecked, the AI replaces the generic question with a
// real one as soon as it is working again. Politics and conflict are screened
// here too, since no model looked at these stories.
const FLOOR_TARGET = 20;
const FLOOR_POLITICS = /\b(trump|biden|harris|vance|obama|election|elections|senate|senator|congress|congressional|democrat\w*|republican\w*|gop|white\s+house|supreme\s+court|shutdown|impeach\w*|immigration|deport\w*|border|israel\w*|gaza|hamas|hezbollah|ukrain\w*|russia\w*|putin|zelensky\w*|iran\w*|china|taiwan|north\s+korea|nato|war|invasion|troops|military|pentagon|police|arrest\w*|indict\w*|lawsuit|trial|verdict|sentenc\w*|prison|jail|charged|accused|scandal|abortion|vaccine|covid|flood\w*|earthquake|hurricane|wildfire|tornado|storm|evacuat\w*|crash|outbreak|tariffs?|sanctions?)\b/i;
const FLOOR_QUESTIONS = [
  'Is this a big deal?',
  'Is this story overhyped?',
  'Is this the story of the day?',
  'Does this change anything?',
  'Are people overreacting to this?',
];
function floorQuestion(id: string): string {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FLOOR_QUESTIONS[h % FLOOR_QUESTIONS.length];
}
// Second tier, for stories the AI already passed on (take_checked = true, no question).
// The AI says no for good reasons (politics, crime, health) but also for weak ones (no
// angle, wording it could not ground), and it cannot be asked why. So these only
// qualify when they also clear this much stricter word list.
const FLOOR_STRICT = /\b(court|judge|judges|crime|criminal|fbi|dea|cia|sued|sues|fraud|scam\w*|protest\w*|riots?|church|religio\w*|muslim|christian|jewish|islam\w*|racis\w*|racial|transgender|lgbt\w*|gender|illness|disease|virus|pandemic|death|died|dies|killed|injur\w*|accident|disaster|tragedy|tragic|abuse|harass\w*|affair|divorce|rehab|addict\w*|overdose|mental\s+health|allegations?|alleged|investigation)\b/i;
async function floorFill(admin: any) {
  const counts = await tabCounts(admin);
  const filled: Record<string, number> = {};
  for (const t of TABS) {
    if (counts[t] >= MIN_PER_TAB) continue;
    const need = FLOOR_TARGET - counts[t];
    let n = 0;
    for (const tier of [1, 2]) {
      if (n >= need) break;
      let q = admin.from('news_ticker').select('id, headline, summary').eq('kind', 'news').eq('take_checked', tier === 2).is('take_question', null).not('image_url', 'is', null);
      const { data, error } = await inTab(q, t).order('published_at', { ascending: false }).limit(150);
      if (error) throw error;
      const ok = (data || []).filter((r: any) => {
        const text = `${r.headline} ${r.summary || ''}`;
        if (isBlockedHeadline(text) || FLOOR_POLITICS.test(text)) return false;
        return tier === 1 || !FLOOR_STRICT.test(text);
      }).slice(0, need - n);
      for (const r of ok) {
        const { error: uErr } = await admin.from('news_ticker').update({ take_question: floorQuestion(r.id) }).eq('id', r.id).is('take_question', null);
        if (!uErr) n++;
      }
    }
    filled[t] = n;
  }
  return filled;
}

// ---- the question writer: free Gemini key first, Claude as a backup ----------------
// Set GEMINI_API_KEY (Google AI Studio, free) as a Supabase secret. If Gemini fails or
// is rate-limited, Claude is tried when ANTHROPIC_API_KEY has credits. If both fail the
// caller gets an error, and the never-empty floor keeps every tab filled with generic
// questions until the next run.
// Tried in order; a busy (503/429) or missing model just moves on to the next one.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
async function askModel(system: string, user: string, maxTokens: number, claudeModel: string): Promise<{ text: string; via: string }> {
  const errors: string[] = [];
  const gKey = Deno.env.get('GEMINI_API_KEY');
  if (gKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': gKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { maxOutputTokens: Math.max(maxTokens, 8192), temperature: 0.6, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw new Error(model + ' ' + res.status + ' ' + (await res.text()).replace(/\s+/g, ' ').slice(0, 120));
        const out = await res.json();
        const text = (out.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
        if (!text) throw new Error(model + ' empty reply');
        return { text, via: model };
      } catch (e) { errors.push(String(e)); }
    }
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

// Tolerant parse: whole-JSON first, then salvage individual {"i":..,"q":..} objects.
function parseItems(text: string): any[] {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { const it = JSON.parse(m[0]).items; if (Array.isArray(it)) return it; } catch (_) { /* salvage below */ } }
  const out: any[] = [];
  const re = /\{\s*"i"\s*:\s*(\d+)\s*,\s*"q"\s*:\s*(null|"(?:[^"\\]|\\.)*")\s*(?:,\s*"lane"\s*:\s*"([a-z]*)")?\s*\}/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(text))) out.push({ i: Number(x[1]), q: x[2] === 'null' ? null : JSON.parse(x[2]), lane: x[3] });
  return out;
}

async function generateTakes(admin: any) {
  if (!Deno.env.get('GEMINI_API_KEY') && !Deno.env.get('ANTHROPIC_API_KEY')) return { skipped: 'no GEMINI_API_KEY or ANTHROPIC_API_KEY' };
  // Up to 25 waiting stories per tab, so one busy tab cannot starve the others.
  const pending: any[] = [];
  for (const t of TABS) {
    const { data, error } = await inTab(
      admin.from('news_ticker').select('id, headline, summary, source_name, lane').eq('kind', 'news').eq('take_checked', false),
      t,
    ).order('fetched_at', { ascending: false }).limit(25);
    if (error) throw error;
    pending.push(...(data || []));
  }
  if (pending.length === 0) return { generated: 0 };

  // Small batches, run side by side, so one bad reply only loses a few stories.
  const CHUNK = 12;
  const chunks: any[][] = [];
  for (let k = 0; k < pending.length; k += CHUNK) chunks.push(pending.slice(k, k + CHUNK));
  let n = 0, checked = 0, via = '';
  const errs: string[] = [];
  const results = await Promise.allSettled(chunks.map(async (rows) => {
    const list = rows.map((r: any, i: number) => `${i}. ${r.headline}${r.summary ? '\n   Summary: ' + r.summary : ''}`).join('\n');
    let items: any[] = [];
    let used = '';
    for (let attempt = 0; attempt < 2 && !items.length; attempt++) {
      const r = await askModel(TAKE_PROMPT, list, 6000, TAKE_MODEL);
      used = r.via;
      items = parseItems(r.text);
    }
    if (!items.length) throw new Error('no usable JSON from model');
    return { rows, items, used };
  }));
  for (const res of results) {
    if (res.status === 'rejected') { errs.push(String(res.reason).slice(0, 160)); continue; }
    const { rows, items, used } = res.value;
    via = used;
    for (const it of items) {
      const row = rows[it.i];
      if (!row) continue;
      let q = typeof it.q === 'string' ? it.q.trim() : null;
      const storyText = `${row.headline} ${row.summary || ''}`;
      if (q && (q.length < 8 || q.length > 100 || !q.endsWith('?') || isBlockedHeadline(q) || WEAK_Q.test(q) || badQuestion(q, storyText) || !isGrounded(q, storyText))) q = null;
      const upd: any = { take_question: q, take_checked: true };
      if (q && TAB_OF[it.lane] && (!row.lane || row.lane === 'news')) upd.lane = TAB_OF[it.lane];
      const { error: uErr } = await admin.from('news_ticker').update(upd).eq('id', row.id);
      if (!uErr) { checked++; if (q) n++; }
    }
  }
  if (!checked && errs.length) throw new Error(errs.join(' | '));
  return { generated: n, checked, via, errors: errs.length ? errs : undefined };
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
    // Tabs with fewer than MIN_PER_TAB finished stories may take older stories.
    const before = await tabCounts(admin);
    const lenient = new Set<Tab>(TABS.filter((t) => before[t] < MIN_PER_TAB));

    // 1) Currents API (capped per day), 2) RSS feeds (no cap).
    const items: Item[] = [];
    let currentsScanned = 0;
    const slot = Math.floor(Date.now() / (20 * 60 * 1000)) % ROTATING_URLS.length;
    for (const baseUrl of [...QUERY_URLS, ROTATING_URLS[slot]]) {
      try {
        const res = await fetch(`${baseUrl}&apiKey=${currentsApiKey}`, { signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        if (data.status === 'ok' && Array.isArray(data.news)) {
          currentsScanned += data.news.length;
          for (const it of data.news) {
            if (!it.url) continue;
            let hostname: string;
            try { hostname = new URL(it.url).hostname.replace(/^www\./, ''); } catch (_) { continue; }
            const src = SOURCES[hostname]; // not on the allow-list: drop it
            if (!src) continue;
            items.push({ title: String(it.title || ''), url: it.url, image: photoUrl(it), description: typeof it.description === 'string' ? it.description.trim().slice(0, 700) : '', published: it.published || null, source: src[0], tab: src[1] });
          }
        }
      } catch (_) { /* one failed call must not stop the rest */ }
    }
    const feeds = await fetchFeeds();
    items.push(...feeds.items);

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'No stories from Currents or any feed.' }), { status: 502 });
    }

    // Filter: sensitive headlines, undated or too-old stories, duplicates.
    const seen = new Set<string>();
    let candidates = items.filter((it) => {
      if (!it.title || seen.has(it.url)) return false;
      seen.add(it.url);
      if (isBlockedHeadline(it.title)) return false;
      const pubMs = it.published ? new Date(it.published).getTime() : NaN;
      if (!Number.isFinite(pubMs)) return false;
      const maxH = lenient.has(it.tab) ? LENIENT_AGE_HOURS : MAX_AGE_HOURS;
      return Date.now() - pubMs <= maxH * 3600 * 1000;
    });

    // Skip stories already stored.
    const have = new Set<string>();
    for (let i = 0; i < candidates.length; i += 40) {
      const { data } = await admin.from('news_ticker').select('article_url').in('article_url', candidates.slice(i, i + 40).map((c) => c.url));
      (data || []).forEach((r: any) => have.add(r.article_url));
    }
    candidates = candidates.filter((c) => !have.has(c.url));

    // Feed items with no photo: try the article's own preview image (max 24 per run).
    const noPhoto = candidates.filter((c) => !c.image).slice(0, 24);
    await Promise.all(noPhoto.map(async (c) => { c.image = await ogImage(c.url); }));

    const rows = candidates
      .filter((c) => c.image) // no photo: drop it
      .map((c) => ({
        headline: c.title,
        source_name: c.source,
        lane: c.tab,
        article_url: c.url,
        image_url: c.image,
        summary: c.description ? c.description.slice(0, 700) : null,
        published_at: new Date(c.published as string).toISOString(),
      }));

    // Accumulate rather than replace (deduped on article_url).
    let inserted = 0;
    if (rows.length > 0) {
      const { error: upsertError, data: upserted } = await admin
        .from('news_ticker')
        .upsert(rows, { onConflict: 'article_url', ignoreDuplicates: true })
        .select('id');
      if (upsertError) throw upsertError;
      inserted = (upserted || []).length;
    }

    let takes: any = null;
    try { takes = await generateTakes(admin); } catch (e) { takes = { error: String(e) }; }

    // Never-empty floor: top up any tab under MIN_PER_TAB with unchecked stories.
    let floor: any = null;
    try { floor = await floorFill(admin); } catch (e) { floor = { error: String(e) }; }

    // Trim, per tab: keep the newest KEEP_PER_TAB finished stories and the
    // newest waiting ones in every tab, plus the newest MAX_ROWS overall, so one
    // busy tab can never push another tab's stories out.
    const keep = new Set<any>();
    const add = (d: any[] | null) => (d || []).forEach((r: any) => keep.add(r.id));
    const { data: recent } = await admin.from('news_ticker').select('id').eq('kind', 'news').order('fetched_at', { ascending: false }).limit(MAX_ROWS);
    add(recent);
    for (const t of TABS) {
      const { data: done } = await inTab(admin.from('news_ticker').select('id').eq('kind', 'news').not('take_question', 'is', null).not('image_url', 'is', null), t).order('fetched_at', { ascending: false }).limit(KEEP_PER_TAB);
      add(done);
      const { data: wait } = await inTab(admin.from('news_ticker').select('id').eq('kind', 'news').eq('take_checked', false), t).order('fetched_at', { ascending: false }).limit(40);
      add(wait);
    }
    if (keep.size > 0) {
      const { error: trimError } = await admin.from('news_ticker').delete().eq('kind', 'news').not('id', 'in', `(${[...keep].join(',')})`);
      if (trimError) throw trimError;
    }

    const after = await tabCounts(admin);
    return new Response(JSON.stringify({ currents_scanned: currentsScanned, feed_items: feeds.items.length, feeds_failed: feeds.failed, new_rows: inserted, takes, floor, finished_per_tab: after, lenient: [...lenient] }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
