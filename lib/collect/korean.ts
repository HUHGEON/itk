/**
 * Turns machine-translated Korean into something that reads as a headline.
 *
 * Every free translation engine returns prose: "다니엘 말디니는 칼리아리의 새로운
 * 선수입니다." Korean sports headlines don't end in 종결어미 — they end in a noun
 * ("말디니, 칼리아리 이적"). No free engine can be told this, so the fix has to
 * happen after the engine, in code.
 *
 * The rules below are deliberately mechanical rather than clever. A wrong
 * headline is worse than a stiff one, so anything that can't be derived from
 * Hangul's own structure is left alone.
 */
import { loadJournalists, loadPlayers, loadTeams } from "../registry";

const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
const FINALS = 28;
/** Index of ㅂ and ㅁ in the 종성 table — the pair the -ㅂ니다 rule swaps. */
const FINAL_B = 17;
const FINAL_M = 16;

function isHangul(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= SYLLABLE_START && c <= SYLLABLE_END;
}

/** Rewrites a syllable's 종성. Returns null if `ch` isn't a Hangul syllable. */
function withFinal(ch: string, final: number): string | null {
  if (!isHangul(ch)) return null;
  const code = (ch.codePointAt(0) ?? 0) - SYLLABLE_START;
  return String.fromCodePoint(
    SYLLABLE_START + Math.floor(code / FINALS) * FINALS + final,
  );
}

function finalOf(ch: string): number | null {
  if (!isHangul(ch)) return null;
  return ((ch.codePointAt(0) ?? 0) - SYLLABLE_START) % FINALS;
}

/**
 * Quoted speech keeps its 존댓말 — a quote rewritten into 명사형 is a misquote,
 * not a headline. So the nominalizer only fires on an ending that is actually
 * the end of the sentence, outside any quotation.
 */
function endsInsideQuote(s: string): boolean {
  const trailing = s.trimEnd().slice(-1);
  if (/["'”’»】」]/.test(trailing)) return true;

  // An unbalanced opening quote means everything after it is still quoted.
  let open = 0;
  for (const ch of s) {
    if (ch === "“" || ch === "«" || ch === "「") open++;
    else if (ch === "”" || ch === "»" || ch === "」") open--;
    else if (ch === '"') open = open ? 0 : 1;
  }
  return open > 0;
}

/**
 * "~할 것입니다" is the single most common ending the engines produce for a
 * transfer that hasn't happened yet, and 전망 is what a Korean desk writes
 * there. Handled before the generic rules because 것입니다 would otherwise
 * nominalize to the useless "것임".
 */
const PROSPECTIVE = /\s*것입니다$/;

/**
 * Drops or nominalizes a sentence-final 종결어미.
 *
 * -습니다 → -음 and -ㅂ니다 → -ㅁ are the same operation Korean itself performs
 * (있습니다 → 있음, 앞당깁니다 → 앞당김), so they hold for any verb without a
 * conjugation table. The copula 입니다 is dropped instead of nominalized:
 * "새로운 선수임" is grammatical but nobody writes it.
 */
function nominalize(s: string): string {
  const out = s.trimEnd().replace(/[.\s]+$/, "");
  if (endsInsideQuote(out)) return out;

  if (PROSPECTIVE.test(out)) return `${out.replace(PROSPECTIVE, "")} 전망`;
  if (out.endsWith("입니다")) return out.slice(0, -3).replace(/[\s은는이가]+$/, "");
  if (out.endsWith("습니다")) return `${out.slice(0, -3)}음`;

  if (out.endsWith("니다")) {
    const stem = out.slice(0, -2);
    const last = stem.slice(-1);
    if (finalOf(last) === FINAL_B) {
      const rewritten = withFinal(last, FINAL_M);
      if (rewritten) return stem.slice(0, -1) + rewritten;
    }
  }
  return out;
}

/**
 * Strips the Latin gloss engines bolt onto a name they just transliterated:
 * "브루노 기마랑이스 (🗣️Bruno Guimarães)". The Korean is already there, so the
 * parenthetical is pure noise in a headline.
 */
const PARTICLE = "은|는|이|가|을|를|의|와|과|에서|에게|에|로|으로|도|만";

function dropLatinGloss(s: string): string {
  return (
    s
      // The particle is pulled back with the name: engines write
      // "말디니 (Daniel Maldini) 는", and dropping only the parenthetical
      // leaves the particle stranded a space away from its noun.
      .replace(
        new RegExp(`([가-힣])\\s*\\(\\s*[^)가-힣]{2,40}\\)\\s*(${PARTICLE})?`, "g"),
        (_m, head: string, particle?: string) => head + (particle ?? ""),
      )
      .replace(/\s{2,}/g, " ")
  );
}

/**
 * Names the engine left in Latin script — clubs, reporters, players.
 *
 * This is the free engines' most visible weakness: "Benfica에서 Lens로",
 * "기다릴 수 있음 - Ben Jacobs", "Bruno Guimaraes가 아스날에". It is also the one
 * weakness we can fix with certainty, because all three registries already hold
 * the Korean spelling.
 *
 * One list, sorted longest first, so the longest name always wins — otherwise
 * "Roberto De Zerbi" would be half-consumed by a shorter entry, and
 * "Manchester" would beat "Manchester United".
 */
interface Substitution {
  re: RegExp;
  ko: string;
}

/** Latin letters that carry no decomposition, so NFD alone can't fold them. */
const IRREGULAR: Record<string, string> = {
  ı: "i", ø: "o", ł: "l", đ: "d", ð: "d", ħ: "h", ŧ: "t", ƶ: "z",
};

function fold(ch: string): string {
  const stripped = ch
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return IRREGULAR[stripped] ?? stripped;
}

/**
 * Every accented letter that folds onto each plain one, built by walking the
 * Latin supplements rather than by listing them.
 *
 * Both registries and headlines are inconsistent about diacritics, and in
 * opposite directions: the journalist list stores "Yagiz Sabuncuoglu" while the
 * article says "Yağız Sabuncuoğlu", and stores "Loïc Tanzi" while the article
 * says "Loic Tanzi". Matching each letter as a class of its variants makes both
 * directions work without normalising the text and losing its offsets — which
 * matters, because the replacement has to land back in the original string.
 */
const VARIANTS: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (let code = 0x00c0; code <= 0x024f; code++) {
    const ch = String.fromCodePoint(code);
    const base = fold(ch);
    if (base.length !== 1 || !/[a-z]/.test(base)) continue;
    map.set(base, (map.get(base) ?? "") + ch);
  }
  return map;
})();

/** A regex matching `name` however its diacritics were or weren't typed. */
function lenientPattern(name: string): string {
  let out = "";
  for (const ch of name) {
    const base = fold(ch);
    const variants = VARIANTS.get(base);
    if (variants && /[a-z]/.test(base)) out += `[${base}${variants}]`;
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return out;
}

let substitutions: Substitution[] | null = null;

function nameSubstitutions(): Substitution[] {
  if (substitutions) return substitutions;

  const seen = new Set<string>();
  const out: { name: string; ko: string }[] = [];

  const add = (name: string, ko: string, min: number) => {
    // Dedup on the folded form: "Loïc Tanzi" and "Loic Tanzi" compile to the
    // same lenient pattern, so keeping both would just double the work.
    const key = [...name].map(fold).join("");
    if (name.length < min || seen.has(key) || !ko) return;
    seen.add(key);
    out.push({ name, ko });
  };

  // Clubs: the canonical name plus aliases long enough to be unambiguous.
  // "United" would hit every other United in football.
  for (const team of loadTeams()) {
    for (const name of [team.en, ...(team.aliases ?? [])]) add(name, team.ko, 5);
  }

  // People are only ever substituted as a full name. A bare surname is a
  // coin flip — "Jones" and "Silva" belong to several players at once, and a
  // wrong name in a headline is worse than an untranslated one.
  for (const player of loadPlayers()) {
    for (const name of player.en) if (name.includes(" ")) add(name, player.ko, 6);
  }

  // A reporter's name is usually the byline the headline is crediting, which
  // is exactly the part a Korean reader needs to recognise.
  for (const j of loadJournalists()) {
    if (j.en.includes(" ")) add(j.en, j.ko, 6);
  }

  substitutions = out
    .sort((a, b) => b.name.length - a.name.length)
    .map(({ name, ko }) => ({
      // The boundary is Latin-only on purpose. `\p{L}` counts Hangul as a
      // letter, so "Arsenal에" — a name with a Korean particle stuck to it,
      // which is every occurrence that matters here — never matched.
      re: new RegExp(
        `(?<![A-Za-zÀ-ÿ0-9])${lenientPattern(name)}(?![A-Za-zÀ-ÿ0-9])`,
        "gi",
      ),
      ko,
    }));

  return substitutions;
}

function localizeNames(s: string): string {
  let out = s;
  for (const { re, ko } of nameSubstitutions()) {
    if (!/[A-Za-zÀ-ÿ]/.test(out)) break;
    out = out.replace(re, ko);
  }
  return out;
}

const QUOTED = /["'“”«»「」]/;

/**
 * What counts as the end of a clause.
 *
 * Everything that can follow a 종결어미 without continuing the sentence.
 * Restricting this to the period and the parentheses left a seventh of the feed
 * untouched, because engines love a colon or a dash: "고려하고 있습니다: 세부
 * 사항", "기다릴 수 있습니다 - Ben Jacobs", "발표했습니다!".
 */
const CLAUSE_END = "(?=\\s*(?:[.()\\[\\]!?:;,·–—|…-]|$))";

/**
 * A headline can hold more than one clause — "Flick에는 목표가 필요합니다. 경고
 * 비교", "…있습니다(이미 예측 가능했습니다)" — and treating only the last one
 * leaves 서술체 in plain sight.
 *
 * Rewriting in place rather than splitting and rejoining: the separators are
 * what make a two-clause headline readable, and a split that drops them turns
 * "필요합니다. 경고 비교" into the run-on "필요함 경고 비교".
 *
 * Only attempted when the headline holds no quotation mark. Deciding per clause
 * whether it sits inside a quote needs a parser, and getting it wrong rewrites
 * someone's words — a quoted headline keeps the single end-of-string rule.
 */
function nominalizeAll(s: string): string {
  if (QUOTED.test(s)) return nominalize(s);

  const out = s
    .replace(new RegExp(`\\s*것입니다${CLAUSE_END}`, "g"), " 전망")
    .replace(new RegExp(`[\\s은는이가]*입니다${CLAUSE_END}`, "g"), "")
    .replace(new RegExp(`습니다${CLAUSE_END}`, "g"), "음")
    .replace(new RegExp(`(.)니다${CLAUSE_END}`, "gu"), (m, last: string) => {
      if (finalOf(last) !== FINAL_B) return m;
      return withFinal(last, FINAL_M) ?? m;
    });

  // Headlines don't carry a terminal period; interior ones are the separator
  // that keeps the clauses apart, so only the last one goes.
  return out.replace(/[.\s]+$/, "").replace(/\s{2,}/g, " ").trim();
}

/** Everything a translated headline should have done to it before storage. */
export function headlineKo(text: string): string {
  if (!text) return text;
  return nominalizeAll(localizeNames(dropLatinGloss(text))).trim();
}
