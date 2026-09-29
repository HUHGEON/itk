import { Suspense, type ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";
import { GamesRail } from "./GamesRail";

/** The frame every game page shares: the site shell, the games rail, a title. */
export function GamePage({
  title,
  en,
  children,
}: {
  title: string;
  en: string;
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
        <header className="mx-auto mb-5 max-w-[520px]">
          <h1 className="text-[22px] font-bold tracking-tight text-text">{title}</h1>
          <p className="text-[12px] text-faint">{en}</p>
        </header>
        {children}
      </div>
    </Shell>
  );
}
