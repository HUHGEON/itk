# ITK

해외 축구 기자 **244명을 신뢰도 티어(0 / 1 / 1.5 / 2 / 3)로 분류**해 두고, 그 사람들이
쓴 기사만 모아 보는 대시보드. 이적설을 "누가 먼저 떴냐"가 아니라 **"누가 떴냐"** 로 거른다.

원칙은 원본 티어표와 같다 — **매체보다 저자다.**

## 스택

| | | 비용 |
|---|---|---|
| 앱 | Next.js 15 (App Router) + Tailwind v4 | Vercel Hobby 무료 |
| DB | Supabase (Postgres) | 무료 티어 |
| 실시간 | Supabase Realtime | 무료 |
| 수집 | Google News RSS + 매체 RSS 23곳 | 무료 |
| 스케줄러 | GitHub Actions cron | 무료 |
| 번역 | Claude API | **선택 · 유일한 유료 요소** |

X(트위터) API는 쓰지 않는다 — 월 $200이라 무료 배포가 불가능하다. 대신 기자 이름을
국가별 로케일로 Google News에 질의하고, 매체 RSS의 바이라인을 기자 명단과 매칭한다.

## 시작하기

### 1. Supabase 프로젝트

**이미 쓰고 있는 프로젝트를 그대로 재사용해도 된다.** 모든 테이블은 `itk`
스키마 안에 만들어지므로 기존 `public` 스키마를 건드리지 않는다.

**Settings → API Keys** 에서 세 값을 복사해 `.env.local` 에 넣는다.

```bash
cp .env.example .env.local
```

| 값 | 용도 | 비밀? |
|---|---|---|
| Project URL | 전부 | 공개 |
| publishable key | 브라우저 실시간 구독 | 공개 |
| secret key | 수집·시드·번역 | **비밀** |

DB 비밀번호나 연결 문자열은 쓰지 않는다 — 아래 참고.

### 2. 스키마 + 데이터

```bash
npm install
npm run db:push   # 테이블·인덱스·RLS·Realtime 설정 (재실행 안전)
npm run merge     # 티어별 JSON → data/journalists.json 병합
npm run seed      # 팀 56개 + 기자 244명 적재
npm run crests    # (선택) 팀 엠블럼
```

### 3. 수집 후 실행

```bash
npm run collect -- --tier 0   # 0티어 27명 + 매체 23곳, 1분 내외
npm run translate             # (선택) 한국어 번역
npm run dev
```

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run db:push` | `supabase/schema.sql` 적용 |
| `npm run merge` | 티어별 파일 병합 · 중복 제거 · 저신뢰 매핑 리포트 |
| `npm run seed` | 팀·기자 레지스트리를 DB에 upsert |
| `npm run collect` | RSS 수집 — `--tier N`, `--slice k/n`, `--no-outlets` |
| `npm run translate` | 한국어 제목·요약 — `--limit N`, `--tier N` |
| `npm run notify` | 디스코드/텔레그램 팀 알림 |
| `npm run crests` | 팀 엠블럼 채우기 |

## 수집기가 차단당하지 않는 이유

모든 요청이 GitHub Actions 러너 **한 IP**에서 나가기 때문에, 순진하게 20분마다 244명을
전부 조회하면 Google News에서 429를 맞는다. 네 가지로 방어한다.

**1. 티어별 회전** — 매 실행마다 전부 긁지 않는다.

| 밴드 | 주기 | 대상 | 요청 수 |
|---|---|---|---|
| hot | 20분 | 0티어 27명 + 매체 23곳 | ~50 |
| warm | 1시간 | 1.5티어 이하를 3등분 | ~55 |
| cold | 6시간 | 전 티어를 4등분 | ~61 |

하루 총 ~3,500 요청. 전량 조회 방식(~17,600)의 1/5이다.

**2. 호스트별 속도 제한** — `news.google.com`은 요청 간 400ms를 강제하고, 전체 동시성은
4로 묶는다. 버스트가 발생하지 않는다.

**3. 조건부 요청** — `feed_state` 테이블에 ETag / Last-Modified를 저장해 다음 요청에
실어 보낸다. 바뀐 게 없으면 304가 오고 본문을 받지 않는다. 매체 피드는 대부분 여기서
끝나므로 트래픽이 크게 준다.

**4. 백오프와 기록** — 429·5xx는 `Retry-After`를 존중해 지수 백오프로 최대 3회 재시도한다.
4xx는 재시도하지 않는다. 연속 실패한 피드는 10분 → 20분 → … 최대 6시간까지 쿨다운에
들어간다.

**유실은 삼키지 않는다.** 실패한 소스는 `collect_runs.failures`에 남고, 한 번의 실행에서
절반 이상이 실패하면 CI가 빨갛게 죽는다. 조용히 0건 수집하는 상황이 생기지 않는다.

```sql
-- 최근 수집 상태 확인
select started_at, sources_ok, sources_304, sources_failed, inserted
from itk.collect_runs order by started_at desc limit 20;

-- 계속 죽는 피드 찾기
select url, fail_count, last_status, last_error
from itk.feed_state where fail_count > 0 order by fail_count desc;
```

## 왜 Postgres 직결을 안 쓰나

많은 회사망·공유기·ISP가 웹 포트 외의 아웃바운드를 막는다. Supabase의 direct 연결은
포트 5432(게다가 IPv6 전용)이고 pooler는 6543이라, 그런 네트워크에서는 로컬 개발이
아예 불가능하다.

그래서 **모든 DB 접근이 PostgREST 함수 호출(HTTPS 443)로 나간다.** 테이블에는 아무
역할도 직접 접근하지 못하고, `public.itk_*` 함수만이 유일한 통로다.

| 함수 | 호출 주체 |
|---|---|
| `itk_feed`, `itk_team_activity` | 브라우저(publishable) + 서버 |
| `itk_upsert_articles`, `itk_seed_*`, `itk_feed_state_*`, `itk_record_run`, `itk_apply_translations`, `itk_mark_notified` | **서버 전용** (secret key) |

Postgres는 새 함수에 `EXECUTE`를 `PUBLIC`으로 기본 부여하기 때문에, 쓰기 함수는
명시적으로 `revoke` 한 뒤 `service_role`에만 부여한다. publishable key로는 쓰기
함수를 호출할 수 없다.

부수 효과로 배포도 단순해졌다 — pooler 문자열, prepared statement, 커넥션 고갈 같은
서버리스 이슈가 전부 사라진다.

되돌리고 싶으면 `drop schema itk cascade;` 와 `itk_*` 함수 삭제로 끝난다.

## 알림

- **브라우저** — 탭이 열려 있을 때. Supabase Realtime으로 새 기사가 들어오는 즉시 뜬다
  (수집은 한 번에 수백 건을 넣으므로 3초 디바운스). 우측 패널의 초록 점이 실시간 연결 표시.
- **디스코드 / 텔레그램** — 브라우저를 닫아도 온다. Actions가 `npm run notify`를 돌린다.
  `NOTIFY_TEAMS`, `NOTIFY_MAX_TIER` + 웹훅/봇 토큰이 필요하다.

## 배포

1. GitHub에 push → Vercel에서 import
2. Vercel 환경변수 — `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
3. GitHub Secrets — `SUPABASE_SECRET_KEY`, (선택) `ANTHROPIC_API_KEY`,
   `DISCORD_WEBHOOK_URL` / `TELEGRAM_*`
4. GitHub Variables — `NEXT_PUBLIC_SUPABASE_URL`, (선택) `NOTIFY_TEAMS`,
   `NOTIFY_MAX_TIER`

## 기자 명단 손보기

`data/journalists.json`이 단일 진실 원천이다. 티어 조정, 오탈자 수정, 은퇴한 기자
비활성화(`"active": false`)를 직접 하고 `npm run seed`.

`npm run merge`가 저신뢰 매핑을 출력한다 — 현재 **15명은 한글 표기에서 영문 이름을
확정하지 못했다**(`confidence: "low"`, `note`에 사유). 영문 이름이 틀리면 Google News
질의가 통째로 빗나가므로, 자주 보는 기자부터 고치면 수집 품질이 바로 올라간다.

원본 티어표는 `data/raw-tiers.txt`에 그대로 보존돼 있다.

## 보존 기간

2개월(`RETENTION_DAYS`)이 지난 기사는 수집 단계에서 버리고, 이미 저장된 것도 매 실행마다
`itk_prune`이 지운다. 이적 뉴스는 그보다 오래되면 가치가 없고, 무료 티어 500MB를 지키는
효과도 있다. Google News는 수년 치를 돌려주기 때문에 이 필터가 없으면 대부분이 과거
기사로 채워진다 — 실제로 한 번 실행에 6,879건이 이 조건으로 걸러졌다.

## 알려진 한계

- **기자별 검색 결과는 제목만 나온다.** Google News RSS의 링크는 서버 리다이렉트가
  아니라 JS 페이지라, og 태그를 읽을 수 없다. 즉 이미지와 본문 미리보기가 붙는 것은
  **매체 직접 RSS로 들어온 기사뿐**이고, 기자별 결과는 제목·매체·티어만 보여준다.
  피드에서 카드가 펼쳐지는 것과 한 줄로 끝나는 것이 섞여 있는 이유다.
- **X 단독 속보를 놓친다.** 로마노가 X에만 올리고 기사화되지 않으면 잡히지 않는다.
  이게 무료 구성의 가장 큰 비용이다.
- **저티어일수록 재현율이 낮다.** 2·3티어 지역지 기자는 Google News 색인이 얕고,
  회전 주기도 길다.
- **FotMob 데이터는 쓰지 않는다.** 공개 API가 없고 내부 엔드포인트는 ToS 위반 + 차단
  대상이라, UI 스타일만 참고하고 데이터는 football-data.org / TheSportsDB를 쓴다.
