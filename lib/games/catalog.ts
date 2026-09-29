/** The games, in the order the hub and the rail list them. */
export const GAMES = [
  {
    slug: "possession",
    title: "점유율 전쟁",
    en: "Possession Play",
    tag: "2인",
    blurb: "번갈아 칸을 골라 선수를 대고, 맞닿은 칸까지 빼앗는 1대1 땅따먹기",
  },
  {
    slug: "heatmap",
    title: "히트맵",
    en: "The Heatmap",
    tag: "데일리",
    blurb: "한 번에 여러 칸을 채울수록 점수가 불어나는 혼자 하는 육각 퍼즐",
  },
  {
    slug: "career",
    title: "커리어 추적",
    en: "Career Path",
    tag: "데일리",
    blurb: "한 줄씩 공개되는 이적 경로만 보고 선수를 맞히기",
  },
  {
    slug: "who",
    title: "후 아 유?",
    en: "Who Are Ya?",
    tag: "데일리",
    blurb: "국적·리그·팀·포지션·나이·등번호 힌트로 8번 안에 선수 맞히기",
  },
] as const;

export type GameSlug = (typeof GAMES)[number]["slug"];
