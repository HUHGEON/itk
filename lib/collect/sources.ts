/**
 * Free, unauthenticated feeds only. Nothing here needs an API key, which is
 * what keeps the whole pipeline deployable on free tiers.
 */

export interface OutletFeed {
  /** display name used as the article's `source` when the feed omits one */
  name: string;
  url: string;
  lang: string;
}

/**
 * Direct outlet feeds. These are the "공신력 좋은 매체" list plus the majors
 * that actually publish RSS. Bylines from these get matched against the
 * journalist registry, so a story by a tier-0 writer is tiered correctly even
 * when the Google News pass misses it.
 */
/**
 * Some of these are whole-sport feeds (LeedsLive, AD, Ouest-France), and club
 * aliases collide with other sports — the cricket side literally called
 * "SunRisers Leeds" matched the Leeds alias. Anything naming another sport is
 * dropped unless a tracked journalist wrote it.
 */
export const OTHER_SPORT = new RegExp(
  [
    "cricket",
    "wicket",
    "batsman",
    "bowler",
    "test match",
    "the hundred",
    "rugby",
    "scrum",
    "six nations",
    "golf",
    "ryder cup",
    "pga",
    "birdie",
    "tennis",
    "wimbledon",
    "atp ",
    "wta ",
    "\\bf1\\b",
    "formula 1",
    "grand prix",
    "motogp",
    "boxing",
    "\\bufc\\b",
    "darts",
    "snooker",
    "nfl",
    "\\bnba\\b",
    "olympic",
    "cyclisme",
    "radsport",
    "ciclismo",
    // Basketball shares surnames with football reporters — a Google News query
    // for "Ferran Martínez" returned his namesake's ACB player profile.
    "basketball",
    "baloncesto",
    "\\bacb\\b",
    "euroleague",
    "euroliga",
    "pallacanestro",
    "\\bnhl\\b",
    "handball",
    "balonmano",
  ].join("|"),
  "i",
);

/**
 * Titles that are not a story. Archive pagination and CMS artefacts reach the
 * feeds regularly — "Allow FB IA Liverpool FC - Page 2088 of 2144" is an index
 * page, and a two-word Bluesky post is the lead-in to a thread we can't read.
 */
const JUNK_TITLE = new RegExp(
  [
    "page \\d+ of \\d+",
    "^allow fb ia",
    "^(home|news|archive|tag|category|author|index)\\b",
    "^\\W*$",
  ].join("|"),
  "i",
);

export function isJunkTitle(title: string): boolean {
  const t = title.trim();
  // Short posts carry no story of their own: "The ratings.", "Hello friends."
  if (t.length < 20) return true;
  return JUNK_TITLE.test(t);
}

export const OUTLET_FEEDS: OutletFeed[] = [
  // England — nationals
  {
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    lang: "en",
  },
  {
    name: "The Guardian",
    url: "https://www.theguardian.com/football/rss",
    lang: "en",
  },
  {
    name: "Sky Sports",
    url: "https://www.skysports.com/rss/11095",
    lang: "en",
  },
  {
    name: "The Telegraph",
    url: "https://www.telegraph.co.uk/football/rss.xml",
    lang: "en",
  },
  {
    name: "The Independent",
    url: "https://www.independent.co.uk/sport/football/rss",
    lang: "en",
  },
  {
    name: "Daily Mail",
    url: "https://www.dailymail.co.uk/sport/football/index.rss",
    lang: "en",
  },
  {
    name: "Mirror Football",
    url: "https://www.mirror.co.uk/sport/football/?service=rss",
    lang: "en",
  },
  {
    name: "Evening Standard",
    url: "https://www.standard.co.uk/sport/football/rss",
    lang: "en",
  },
  {
    name: "Express Sport",
    url: "https://www.express.co.uk/posts/rss/65/sport",
    lang: "en",
  },
  { name: "90min", url: "https://www.90min.com/posts.rss", lang: "en" },
  {
    name: "FourFourTwo",
    url: "https://www.fourfourtwo.com/feeds/all",
    lang: "en",
  },
  // The Athletic publishes no RSS of its own, but its football coverage flows
  // into the NYT soccer feed — bylines and images included.
  {
    name: "NYT Soccer",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml",
    lang: "en",
  },

  // England — the regional titles that break most club news
  {
    name: "Manchester Evening News",
    url: "https://www.manchestereveningnews.co.uk/sport/football/?service=rss",
    lang: "en",
  },
  {
    name: "Liverpool Echo",
    url: "https://www.liverpoolecho.co.uk/sport/football/?service=rss",
    lang: "en",
  },
  {
    name: "football.london",
    url: "https://www.football.london/?service=rss",
    lang: "en",
  },
  {
    name: "ChronicleLive",
    url: "https://www.chroniclelive.co.uk/sport/football/?service=rss",
    lang: "en",
  },
  {
    name: "BirminghamLive",
    url: "https://www.birminghammail.co.uk/sport/football/?service=rss",
    lang: "en",
  },
  {
    name: "LeedsLive",
    url: "https://www.leeds-live.co.uk/sport/?service=rss",
    lang: "en",
  },
  {
    name: "NottinghamshireLive",
    url: "https://www.nottinghampost.com/sport/football/?service=rss",
    lang: "en",
  },
  {
    name: "Daily Record",
    url: "https://www.dailyrecord.co.uk/sport/football/?service=rss",
    lang: "en",
  },

  // Spain
  {
    name: "MARCA",
    url: "https://e00-marca.uecdn.es/rss/futbol/mas-futbol.xml",
    lang: "es",
  },
  { name: "AS", url: "https://as.com/rss/futbol/portada.xml", lang: "es" },
  {
    name: "Mundo Deportivo",
    url: "https://www.mundodeportivo.com/feed/rss/futbol",
    lang: "es",
  },
  {
    name: "SPORT",
    url: "https://www.sport.es/es/rss/futbol/rss.xml",
    lang: "es",
  },

  // Italy
  {
    name: "Gazzetta dello Sport",
    url: "https://www.gazzetta.it/rss/calcio.xml",
    lang: "it",
  },
  {
    name: "Corriere dello Sport",
    url: "https://www.corrieredellosport.it/rss/calcio",
    lang: "it",
  },
  {
    name: "Tuttosport",
    url: "https://www.tuttosport.com/rss/calcio",
    lang: "it",
  },
  {
    name: "Football Italia",
    url: "https://football-italia.net/feed/",
    lang: "it",
  },

  // Germany
  {
    name: "kicker",
    url: "https://newsfeed.kicker.de/news/fussball",
    lang: "de",
  },
  { name: "WAZ", url: "https://www.waz.de/rss", lang: "de" },
  {
    name: "Ruhr Nachrichten",
    url: "https://www.ruhrnachrichten.de/feed/",
    lang: "de",
  },

  // France
  {
    name: "L'Équipe",
    url: "https://dwh.lequipe.fr/api/edito/rss?path=/Football",
    lang: "fr",
  },
  {
    name: "RMC Sport",
    url: "https://rmcsport.bfmtv.com/rss/football/",
    lang: "fr",
  },
  {
    name: "Foot Mercato",
    url: "https://www.footmercato.net/flux-rss",
    lang: "fr",
  },
  {
    name: "Ouest-France",
    url: "https://www.ouest-france.fr/rss/sport",
    lang: "fr",
  },

  // Netherlands / Belgium
  { name: "Voetbal International", url: "https://www.vi.nl/rss", lang: "nl" },
  { name: "HLN", url: "https://www.hln.be/sport/rss.xml", lang: "nl" },
  { name: "AD Sport", url: "https://www.ad.nl/sport/rss.xml", lang: "nl" },
  // Mike Verweij (tier 0) writes here, and the feed carries bylines.
  { name: "De Telegraaf", url: "https://www.telegraaf.nl/rss", lang: "nl" },

  // Outlets that re-report the big X-only reporters within minutes. Romano
  // publishes almost exclusively on X and Instagram, both closed to free
  // access, so these are the fastest legitimate route to what he breaks —
  // paired with the citation detection in the collector.
  {
    name: "CaughtOffside",
    url: "https://www.caughtoffside.com/feed/",
    lang: "en",
  },
  { name: "GiveMeSport", url: "https://www.givemesport.com/feed/", lang: "en" },
  { name: "SempreMilan", url: "https://sempremilan.com/feed", lang: "en" },
  {
    name: "FC Inter 1908",
    url: "https://www.fcinter1908.it/feed/",
    lang: "it",
  },
  { name: "SOS Fanta", url: "https://www.sosfanta.com/feed/", lang: "it" },

  // Portugal / South America
  { name: "Record", url: "https://www.record.pt/rss", lang: "pt" },
  {
    name: "Globo Esporte",
    url: "https://ge.globo.com/rss/ge/futebol/",
    lang: "pt",
  },
  {
    name: "Olé",
    url: "https://www.ole.com.ar/rss/futbol-internacional/",
    lang: "es",
  },
];

/**
 * Google News locale per reporting country. Querying a German reporter with a
 * German locale surfaces the German-language pieces that an en-GB query buries.
 */
const LOCALES: Record<string, { hl: string; gl: string; ceid: string }> = {
  England: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
  Scotland: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
  Wales: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
  Ireland: { hl: "en-IE", gl: "IE", ceid: "IE:en" },
  Germany: { hl: "de", gl: "DE", ceid: "DE:de" },
  Austria: { hl: "de", gl: "AT", ceid: "AT:de" },
  Switzerland: { hl: "de", gl: "CH", ceid: "CH:de" },
  Spain: { hl: "es", gl: "ES", ceid: "ES:es" },
  Italy: { hl: "it", gl: "IT", ceid: "IT:it" },
  France: { hl: "fr", gl: "FR", ceid: "FR:fr" },
  Belgium: { hl: "fr", gl: "BE", ceid: "BE:fr" },
  Netherlands: { hl: "nl", gl: "NL", ceid: "NL:nl" },
  Portugal: { hl: "pt-PT", gl: "PT", ceid: "PT:pt-150" },
  Brazil: { hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" },
  Argentina: { hl: "es-419", gl: "AR", ceid: "AR:es-419" },
  Turkey: { hl: "tr", gl: "TR", ceid: "TR:tr" },
  Norway: { hl: "no", gl: "NO", ceid: "NO:no" },
  USA: { hl: "en-US", gl: "US", ceid: "US:en" },
  "United States": { hl: "en-US", gl: "US", ceid: "US:en" },
};

const DEFAULT_LOCALE = { hl: "en-GB", gl: "GB", ceid: "GB:en" };

/**
 * Football-context words per locale, OR'd into every query. They are what keeps
 * namesakes out — there are a lot of people called "Simon Stone" — so they have
 * to be words the local press actually uses, not English ones.
 */
const CONTEXT: Record<string, string> = {
  en: "football OR soccer OR transfer",
  de: "Fußball OR Transfer OR Bundesliga",
  es: "fútbol OR fichaje OR traspaso",
  it: "calcio OR calciomercato OR trasferimento",
  fr: "football OR mercato OR transfert",
  nl: "voetbal OR transfer OR eredivisie",
  pt: "futebol OR transferência OR mercado",
  tr: "futbol OR transfer",
  no: "fotball OR overgang",
};

function contextFor(hl: string): string {
  return CONTEXT[hl.split("-")[0]] ?? CONTEXT.en;
}

/**
 * Builds a Google News RSS query for one journalist. The name is quoted so we
 * get their reporting rather than fuzzy matches.
 *
 * The club names are a hint, not a requirement: demanding one meant a reporter
 * whose recent pieces never named their club — or whose club the local press
 * spells differently from our table — returned nothing inside the retention
 * window, which is why 43 of the 244 listed reporters had never produced a
 * single story. The football-context terms carry the namesake filtering on
 * their own.
 */
export function googleNewsUrl(opts: {
  name: string;
  country: string;
  teamNames: string[];
}): string {
  const { hl, gl, ceid } = LOCALES[opts.country] ?? DEFAULT_LOCALE;
  const clubs = opts.teamNames.map((t) => `"${t}"`);
  const context = [...clubs, contextFor(hl)].join(" OR ");
  const q = `"${opts.name}" (${context})`;
  const params = new URLSearchParams({ q, hl, gl, ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}
