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
      <div className="px-[var(--gutter)] pt-2 pb-16 lg:px-0 lg:pt-6">
        <div>
          <header className={wide ? "mb-6" : "mx-auto mb-5"} style={wide ? undefined : { maxWidth: width }}>
            {/* The hub's name is already in the toolbar; a game's is not. */}
            <h1 className={wide ? "sr-only" : "text-[22px] font-bold tracking-tight text-text"}>{title}</h1>
            <p className={wide ? "text-[15px] text-muted" : "text-[12px] text-faint"}>{en}</p>
          </header>
          {children}
        </div>
      </div>
    </Shell>
  );
}
