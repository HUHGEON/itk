/** The games, in the order the hub and the rail list them. */
export const GAMES = [
  {
    slug: "possession",
    title: "Possession Play",
    en: "1대1 축구 땅따먹기",
    tag: "2인",
    blurb: "번갈아 칸을 골라 선수를 대고, 맞닿은 칸까지 빼앗습니다.",
  },
  {
    slug: "heatmap",
    title: "The Heatmap",
    en: "하루 한 판 육각 퍼즐",
    tag: "데일리",
    blurb: "한 번에 여러 칸을 채울수록 점수가 크게 불어납니다.",
  },
  {
    slug: "career",
    title: "Career Path",
    en: "이적 경로로 선수 맞히기",
    tag: "데일리",
    blurb: "한 줄씩 열리는 경력표만 보고 선수를 맞힙니다.",
  },
  {
    slug: "who",
    title: "Who Are Ya?",
    en: "힌트로 오늘의 선수 맞히기",
    tag: "데일리",
    blurb: "국적, 리그, 팀, 포지션, 나이, 등번호를 보고 8번 안에 맞힙니다.",
  },
] as const;

export type GameSlug = (typeof GAMES)[number]["slug"];
