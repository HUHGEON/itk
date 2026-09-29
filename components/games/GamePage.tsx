import { Suspense, type ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";
import { GamesRail } from "./GamesRail";

/** The frame every game page shares: the site shell, the games rail, a title. */
export function GamePage({
  title,
  en,
  wide = false,
  children,
}: {
  title: string;
  en: string;
  /** the hub's card grid takes the full column; a game keeps to its board's width */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Shell
      rail={<GamesRail />}
      actions={
        <>
          <Suspense fallback={null}>
            <SearchBox state={{ tiers: [], teams: [], league: "", who: "", q: "" }} />
          </Suspense>
          <CollectButton lastCollect={null} />
        </>
      }
    >
      <div className="px-[var(--gutter)] pt-5 pb-16">
        <div className={wide ? "mx-auto max-w-[1180px]" : ""}>
          <header className={wide ? "mb-6" : "mx-auto mb-5 max-w-[520px]"}>
            <h1 className={`font-bold tracking-tight text-text ${wide ? "text-[28px]" : "text-[22px]"}`}>{title}</h1>
            <p className={wide ? "mt-1 text-[14px] text-muted" : "text-[12px] text-faint"}>{en}</p>
          </header>
          {children}
        </div>
      </div>
    </Shell>
  );
}
