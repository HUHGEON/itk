"use client";

import { useEffect, useMemo, useState } from "react";
import { loadGrid, type Grid, type GridPlayer } from "@/lib/games/data";
import type { PickerItem } from "./PlayerPicker";

export type GridPick = GridPlayer & PickerItem;

const POSITION: Record<string, string> = { G: "골키퍼", D: "수비수", M: "미드필더", F: "공격수" };

/**
 * The line beside a name. The birth year always; the position only where two
 * players share the name (665 names in the pool, 펠레 and 박지성 among them),
 * since it is the thing that tells them apart at a glance and anywhere else it
 * would only be a hint towards a position hex.
 */
function sub(p: GridPlayer, shared: boolean): string | undefined {
  const pos = shared ? p.pos.split("").map((c) => POSITION[c]).join("·") : "";
  return [p.born ? `${p.born}년생` : "", pos].filter(Boolean).join(" · ") || undefined;
}

/** The grid's players shaped for the picker. */
export function pickItems(grid: Grid): GridPick[] {
  const count = new Map<string, number>();
  for (const p of grid.players) count.set(p.ko, (count.get(p.ko) ?? 0) + 1);
  return grid.players.map((p) => ({ ...p, key: p.id, sub: sub(p, count.get(p.ko)! > 1) }));
}

/** The grid data, and the same players shaped for the picker. */
export function useGrid() {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadGrid().then(setGrid, () => setError(true));
  }, []);
  const items = useMemo(() => (grid ? pickItems(grid) : []), [grid]);
  return { grid, items, error };
}
