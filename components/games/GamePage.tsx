import { Suspense, type ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";

/**
 * The frame every game page shares: the site shell and a title. No side
 * column: the header's 미니게임 tab already leads back to the four games, and
 * a board wants the width.
 */
export function GamePage({
  title,
  en,
  wide = false,
  width = 520,
  children,
}: {
  title: string;
  en: string;
  /** the hub's card grid takes the full column; a game keeps to its board's width */
  wide?: boolean;
  /** the game's own column width, so the title lines up with what is under it */
  width?: number;
  children: ReactNode;
}) {
  return (
    <Shell
        bare
      rail={null}
      search={
        <>
          <Suspense fallback={null}>
            <SearchBox state={{ tiers: [], teams: [], league: "", who: "", q: "" }} />
          </Suspense>
        </>
      }
      collect={<CollectButton lastCollect={null} />}
    >
      {wide ? (
        /*
         * The hub: a heading and the four cards as one block, centred in the
         * screen. Top-aligned, the cards filled the upper half of a laptop
         * and left the lower half empty.
         */
        <div className="flex min-h-[calc(100dvh-var(--headerh))] flex-col justify-center px-[var(--gutter)] py-10 lg:px-0">
          <header className="mb-9 text-center">
            <p className="text-[13px] font-bold tracking-[0.2em] text-accent">{en}</p>
            <h1 className="mt-2 text-[44px] leading-none font-extrabold tracking-[-0.04em] text-text sm:text-[60px]">
              {title.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="bg-[linear-gradient(90deg,#f1800b,#f69230)] bg-clip-text text-transparent">
                {title.split(" ").at(-1)}
              </span>
            </h1>
          </header>
          {children}
        </div>
      ) : (
        <div className="px-[var(--gutter)] pt-2 pb-16 lg:px-0 lg:pt-6">
          <header className="mx-auto mb-5" style={{ maxWidth: width }}>
            <h1 className="text-[22px] font-bold tracking-tight text-text">{title}</h1>
            <p className="text-[12px] text-faint">{en}</p>
          </header>
          {children}
        </div>
      )}
    </Shell>
  );
}
