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
 * Korean particles pick their form from the preceding syllable's 받침, so
 * substituting a name changes which form is correct: the engine wrote "Inter
 * Milan이" against a consonant-final Latin word, and 인테르 ends in a vowel.
 * Left alone the feed reads "인테르이", "뉴캐슬가".
 *
 * Only ever applied to the particle directly after a name this module just
 * replaced. Sweeping the whole string would be a disaster — "국가", "평가" and
 * "높이" all end in what looks like a particle.
 */
const AGREEMENT: Record<string, [withBatchim: string, without: string]> = {
  은: ["은", "는"], 는: ["은", "는"],
  이: ["이", "가"], 가: ["이", "가"],
  을: ["을", "를"], 를: ["을", "를"],
  과: ["과", "와"], 와: ["과", "와"],
  으로: ["으로", "로"], 로: ["으로", "로"],
};

const PARTICLE_AFTER_NAME = "은|는|이|가|을|를|과|와|으로|로";

function agree(korean: string, particle: string): string {
  const pair = AGREEMENT[particle];
  const last = korean.trimEnd().slice(-1);
  const final = finalOf(last);
  if (!pair || final === null) return particle;

  // ㄹ is the exception every Korean speaker knows: 서울로, never 서울으로.
  if (particle === "로" || particle === "으로") {
    return final === 0 || final === 8 ? "로" : "으로";
  }
  return final === 0 ? pair[1] : pair[0];
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
      // Two conditions, both learned the hard way. The parenthetical must hold
      // real Latin letters — without that check "첼시(1-0) 아스날" lost its score
      // and "마드리드(2026)" its year. And the surrounding space may only be
      // eaten when a particle follows: engines write "말디니 (Daniel Maldini) 는"
      // and dropping the middle leaves the particle stranded, but with no
      // particle there is nothing to pull back and the space still separates
      // two words.
      .replace(
        new RegExp(
          `([가-힣])\\s*\\((?=[^)]*[A-Za-zÀ-ÿ]{2})[^)가-힣]{2,40}\\)(?:\\s*(${PARTICLE}))?`,
          "g",
        ),
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
/**
 * Club aliases that name a category rather than a club.
 *
 * `teams.json` aliases exist for *tagging* — deciding whether a story is about
 * Chelsea — where "Blues" in a Chelsea-shaped article is a fair signal.
 * Substitution is the opposite problem: the alias has to identify the club on
 * its own, against every other club in football. Reusing the tagging list
 * turned "Oxford United" into "Oxford 맨체스터 유나이티드".
 */
const AMBIGUOUS_ALIAS = new Set([
  "united", "city", "madrid", "milan", "inter", "villa", "blues", "reds",
]);

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

  for (const team of loadTeams()) {
    for (const name of [team.en, ...(team.aliases ?? [])]) {
      if (AMBIGUOUS_ALIAS.has(name.toLowerCase())) continue;
      add(name, team.ko, 5);
    }
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
      // The trailing group captures the particle riding on the name, so it can
      // be re-agreed against the Korean that replaces it.
      re: new RegExp(
        `(?<![A-Za-zÀ-ÿ0-9])${lenientPattern(name)}(?![A-Za-zÀ-ÿ0-9])` +
          `(?:(${PARTICLE_AFTER_NAME})(?=[\\s.,!?)\\]|…·—–-]|$))?`,
        "gi",
      ),
      ko,
    }));

  return substitutions;
}

function localizeNames(s: string): string {
  let out = s;
  for (const { re, ko } of nameSubstitutions()) {
    // Nothing Latin left means nothing left to substitute.
    if (!/[A-Za-zÀ-ÿ]/.test(out)) break;
    out = out.replace(re, (_m, particle?: string) =>
      particle ? ko + agree(ko, particle) : ko,
    );
  }
  return out;
}

/**
 * A run of quoted speech, which is copied through untouched.
 *
 * Rewriting a quote into 명사형 misquotes the speaker, so quotes are excluded —
 * but excluding the *whole headline* whenever a quote mark appears anywhere was
 * too blunt. A single emphasis mark in "아스날의 '특별한' 영입이 완료됐습니다"
 * disabled the pass for the entire line. Spans let the sentence outside the
 * quote be handled while the quote itself is left alone.
 */
const QUOTED_SPAN = /[“"'‘«「][^”"'’»」]*[”"'’»」]/g;

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
/**
 * Rewrites every clause-final 종결어미 in one unquoted stretch of text.
 *
 * -습니다 → -음 and -ㅂ니다 → -ㅁ are operations Korean itself performs (있습니다
 * → 있음, 앞당깁니다 → 앞당김), so they hold for any verb without a conjugation
 * table.
 *
 * The copula 입니다 gets no rule of its own, and that is deliberate. Deleting it
 * reads better after a noun — "새로운 선수" over "새로운 선수임" — but nothing in
 * the text distinguishes the copula from a verb whose stem ends in 이: 보이다,
 * 쓰이다, 모이다 all conjugate to …입니다 too. The delete rule was cutting
 * "보입니다" down to "보". Falling through to the -ㅂ니다 rule gives 선수임 and
 * 보임: one is stiff, the other is correct, and a stiff headline beats a
 * truncated word.
 */
function rewriteClauses(part: string): string {
  return part
    .replace(new RegExp(`\\s*것입니다${CLAUSE_END}`, "g"), " 전망")
    .replace(new RegExp(`습니다${CLAUSE_END}`, "g"), "음")
    .replace(new RegExp(`(.)니다${CLAUSE_END}`, "gu"), (m, last: string) => {
      if (finalOf(last) !== FINAL_B) return m;
      return withFinal(last, FINAL_M) ?? m;
    });
}

/**
 * A headline can hold more than one clause — "Flick에는 목표가 필요합니다. 경고
 * 비교", "…있습니다(이미 예측 가능했습니다)" — and treating only the last one
 * leaves 서술체 in plain sight.
 *
 * Rewriting in place rather than splitting and rejoining: the separators are
 * what make a two-clause headline readable, and a split that drops them turns
 * "필요합니다. 경고 비교" into the run-on "필요함 경고 비교".
 */
function nominalizeAll(s: string): string {
  let out = "";
  let cursor = 0;
  let endsQuoted = false;

  for (const m of s.matchAll(QUOTED_SPAN)) {
    out += rewriteClauses(s.slice(cursor, m.index));
    out += m[0];
    cursor = m.index + m[0].length;
    endsQuoted = s.slice(cursor).trim() === "";
  }

  if (cursor < s.length) {
    const tail = s.slice(cursor);
    out += rewriteClauses(tail);
    if (tail.trim()) endsQuoted = false;
  }

  // Headlines don't carry a terminal period; interior ones are the separator
  // that keeps the clauses apart, so only the last one goes — and never the one
  // that belongs to somebody's quoted sentence.
  if (!endsQuoted) out = out.replace(/[.\s]+$/, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Everything a translated headline should have done to it before storage. */
export function headlineKo(text: string): string {
  if (!text) return text;
  return nominalizeAll(localizeNames(dropLatinGloss(text))).trim();
}
