/**
 * The clubs a hex can ask about.
 *
 * Resolved from their English Wikipedia titles rather than typed as Q-numbers
 * from memory, and each one checked against its Korean label before it went
 * in. `short` is what fits on a hex; `search` is what finds the crest.
 */
export interface Club {
  q: string;
  short: string;
  search: string;
}

export const CLUBS: Club[] = [
  { q: "Q9617", short: "아스널", search: "Arsenal" },
  { q: "Q9616", short: "첼시", search: "Chelsea" },
  { q: "Q1130849", short: "리버풀", search: "Liverpool" },
  { q: "Q18656", short: "맨유", search: "Manchester United" },
  { q: "Q50602", short: "맨시티", search: "Manchester City" },
  { q: "Q18741", short: "토트넘", search: "Tottenham" },
  { q: "Q18716", short: "뉴캐슬", search: "Newcastle United" },
  { q: "Q18711", short: "아스톤 빌라", search: "Aston Villa" },
  { q: "Q5794", short: "에버턴", search: "Everton" },
  { q: "Q18747", short: "웨스트햄", search: "West Ham" },
  { q: "Q8682", short: "레알 마드리드", search: "Real Madrid" },
  { q: "Q7156", short: "바르셀로나", search: "Barcelona" },
  { q: "Q8701", short: "아틀레티코", search: "Atletico Madrid" },
  { q: "Q10329", short: "세비야", search: "Sevilla" },
  { q: "Q10333", short: "발렌시아", search: "Valencia" },
  { q: "Q12297", short: "비야레알", search: "Villarreal" },
  { q: "Q1422", short: "유벤투스", search: "Juventus" },
  { q: "Q1543", short: "AC 밀란", search: "AC Milan" },
  { q: "Q631", short: "인테르", search: "Inter" },
  { q: "Q2739", short: "AS 로마", search: "Roma" },
  { q: "Q2641", short: "나폴리", search: "Napoli" },
  { q: "Q2609", short: "라치오", search: "Lazio" },
  { q: "Q15789", short: "바이에른", search: "Bayern Munich" },
  { q: "Q41420", short: "도르트문트", search: "Dortmund" },
  { q: "Q104761", short: "레버쿠젠", search: "Leverkusen" },
  { q: "Q32494", short: "샬케", search: "Schalke" },
  { q: "Q483020", short: "PSG", search: "Paris Saint-Germain" },
  { q: "Q132885", short: "마르세유", search: "Marseille" },
  { q: "Q704", short: "리옹", search: "Lyon" },
  { q: "Q180305", short: "모나코", search: "Monaco" },
  { q: "Q81888", short: "아약스", search: "Ajax" },
  { q: "Q11938", short: "PSV", search: "PSV Eindhoven" },
  { q: "Q131499", short: "벤피카", search: "Benfica" },
  { q: "Q128446", short: "포르투", search: "FC Porto" },
  { q: "Q75729", short: "스포르팅", search: "Sporting CP" },
  { q: "Q19593", short: "셀틱", search: "Celtic" },
  { q: "Q495299", short: "갈라타사라이", search: "Galatasaray" },
];

/**
 * "Had a spell in X" leagues, keyed by the club's country — except England.
 *
 * English clubs are filed under the United Kingdom on Wikidata, exactly like
 * Celtic and Rangers (measured: Arsenal, West Ham and Celtic all answer
 * "United Kingdom"), so for England the test is the club's league instead:
 * anything in the top five divisions of the English pyramid.
 */
export const LEAGUES: {
  id: string;
  short: string;
  /** the country's top division on FotMob, whose logo marks the hex */
  logo: number;
  country?: string;
  leagues?: string[];
}[] = [
  { id: "lg-eng", short: "잉글랜드 리그", logo: 47, leagues: ["Q9448", "Q19510", "Q19565", "Q48837", "Q58916"] },
  { id: "lg-esp", short: "스페인 리그", logo: 87, country: "Q29" },
  { id: "lg-ita", short: "이탈리아 리그", logo: 55, country: "Q38" },
  { id: "lg-ger", short: "독일 리그", logo: 54, country: "Q183" },
  { id: "lg-fra", short: "프랑스 리그", logo: 53, country: "Q142" },
  { id: "lg-ned", short: "네덜란드 리그", logo: 57, country: "Q55" },
  { id: "lg-por", short: "포르투갈 리그", logo: 61, country: "Q45" },
  { id: "lg-tur", short: "튀르키예 리그", logo: 71, country: "Q43" },
  { id: "lg-ksa", short: "사우디 리그", logo: 536, country: "Q851" },
  { id: "lg-usa", short: "미국 리그", logo: 130, country: "Q30" },
  // The original's other four: Scotland (filed under the UK like England, so
  // by league), Belgium, Brazil and Argentina.
  { id: "lg-sco", short: "스코틀랜드 리그", logo: 64, leagues: ["Q14377162", "Q187304", "Q177138"] },
  { id: "lg-bel", short: "벨기에 리그", logo: 40, country: "Q31" },
  { id: "lg-bra", short: "브라질 리그", logo: 268, country: "Q155" },
  { id: "lg-arg", short: "아르헨티나 리그", logo: 112, country: "Q414" },
];

/**
 * Trophies won - the original's biggest category family after clubs (4 to 9
 * of every 30 hexes across twelve of its boards). Wikidata names each
 * season's winner (P1346 on the season item); a player counts if he was at
 * that club, or with that national side, across the season's years. Years are
 * all Wikidata gives for a spell, so a season boundary is read generously:
 * someone at the club in either of its calendar years is counted.
 */
export const TROPHIES: { id: string; short: string; comps: string[]; logo: number; national?: boolean }[] = [
  { id: "tr-ucl", short: "UCL 우승", comps: ["Q18756"], logo: 42 },
  { id: "tr-uel", short: "UEL 우승", comps: ["Q18760", "Q715496"], logo: 73 },
  { id: "tr-uecl", short: "UECL 우승", comps: ["Q59365764"], logo: 10216 },
  { id: "tr-epl", short: "EPL 우승", comps: ["Q9448"], logo: 47 },
  { id: "tr-fac", short: "FA컵 우승", comps: ["Q11151"], logo: 132 },
  { id: "tr-lal", short: "라리가 우승", comps: ["Q324867"], logo: 87 },
  { id: "tr-cdr", short: "코파 델 레이 우승", comps: ["Q483794"], logo: 138 },
  { id: "tr-sea", short: "세리에 A 우승", comps: ["Q15804"], logo: 55 },
  { id: "tr-coi", short: "코파 이탈리아 우승", comps: ["Q169918"], logo: 141 },
  { id: "tr-wc", short: "월드컵 우승", comps: ["Q19317"], logo: 77, national: true },
  { id: "tr-euro", short: "유로 우승", comps: ["Q260858"], logo: 50, national: true },
  { id: "tr-copa", short: "코파 아메리카 우승", comps: ["Q178750"], logo: 44, national: true },
];

/** Individual honours that sit on the player's own item. */
export const AWARDS: { q: string; short: string }[] = [
  { q: "Q166177", short: "발롱도르" },
  { q: "Q182529", short: "FIFA 올해의 선수" },
  { q: "Q233454", short: "유러피언 골든슈" },
  { q: "Q1588911", short: "골든 보이" },
  { q: "Q794775", short: "EPL 득점왕" },
  { q: "Q72092894", short: "야신 트로피" },
];

/**
 * A reserve, youth or B side, by its English name.
 *
 * These are separate items from the first team, so they never count toward a
 * club hex — but they would count toward "had a spell in Spain" and they would
 * pad a career path with three rows of FC Barcelona C. The site this is
 * modelled on draws the same line: "being in the academy doesn't qualify".
 */
export const YOUTH =
  /\b(U-?\d{2}|under-?\d{2}|youth|academy|reserves?|juvenil|primavera|castilla|jong|next gen|amateur|women|femenino|féminine)\b|\s(B|C|II|III|2|Atl[eè]tic)$/i;
// The squad letter has to be the last word. As a bare \bC\b it matched the
// "C" in "Arsenal F.C." and dropped every English club from the build.
