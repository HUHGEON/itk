import type { BoardCell } from "@/lib/games/board";
import type { Grid } from "@/lib/games/data";

/** What the less obvious hexes mean, by category id or, failing that, by kind. */
const HELP: Record<string, string> = {
  league: "그 나라 리그 클럽에서 뛴 적이 있는 선수",
  trophy: "그 대회를 우승한 시즌에 그 팀 소속이었던 선수",
  "rg-afr": "아프리카 나라 국가대표 선수",
  "rg-sam": "남미 나라 국가대표 선수",
  "rg-asia": "아시아·오세아니아 나라 국가대표 선수",
  "rg-nca": "북중미·카리브 나라 국가대표 선수",
  "rg-nor": "노르웨이, 스웨덴, 덴마크, 핀란드, 아이슬란드 선수",
  "rg-celt": "스코틀랜드, 웨일스, 북아일랜드, 아일랜드 선수",
  "rg-balk": "알바니아, 보스니아, 불가리아, 크로아티아, 그리스, 코소보, 몬테네그로, 북마케도니아, 루마니아, 세르비아, 슬로베니아 선수",
  "rg-naf": "알제리, 이집트, 리비아, 모로코, 수단, 튀니지 선수",
  "ps-gk": "골키퍼로 뛴 선수",
  "gr-big5": "잉글랜드·스페인·이탈리아·독일·프랑스 리그 가운데 세 곳 이상에서 뛴 선수",
  "gr-uclf": "챔피언스리그 결승에 오른 시즌에 그 팀 소속이었던 선수",
  "dc-1970": "1970~1979년에 태어난 선수",
  "dc-1980": "1980~1989년에 태어난 선수",
  "dc-1990": "1990~1999년에 태어난 선수",
  "dc-2000": "2000~2009년에 태어난 선수",
};
const help = (c: { id: string; kind: string }) => HELP[c.id] ?? HELP[c.kind];

/** The original's "Technical Area": what the less obvious hexes mean, and when the data was built. */
export function TechnicalArea({ grid, board }: { grid: Grid; board: BoardCell[] }) {
  const onBoard = [...new Set(board.map((c) => c.cat))].map((i) => grid.cats[i]);
  const helped = onBoard.filter(help);
  return (
    <section className="mt-6 w-full rounded-[10px] border border-border p-5 text-xs text-text sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold tracking-wide uppercase">테크니컬 에어리어</h3>
        {grid.built && <p className="text-muted">마지막 업데이트: {grid.built}</p>}
      </div>
      <ul className="space-y-1">
        {helped.map((c) => (
          <li key={c.id}>
            <span>{c.short}: </span>
            <span className="text-muted">{help(c)}</span>
          </li>
        ))}
        {onBoard.some((c) => c.kind === "club") && (
          <li className="text-muted">클럽 칸은 1군 경력만 인정합니다. 유스나 2군에서만 뛰었다면 해당하지 않습니다.</li>
        )}
        {onBoard.some((c) => c.kind === "nation") && (
          <li className="text-muted">
            국가 칸은 성인 국가대표로 뛴 나라 기준입니다. 한 번도 뽑히지 않았다면 등록된 국적을 따릅니다.
          </li>
        )}
      </ul>
    </section>
  );
}

