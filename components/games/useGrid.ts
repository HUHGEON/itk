"use client";

import { useEffect, useMemo, useState } from "react";
import { loadGrid, type Grid, type GridPlayer } from "@/lib/games/data";
import type { PickerItem } from "./PlayerPicker";

export type GridPick = GridPlayer & PickerItem;

/** The grid data, and the same players shaped for the picker. */
export function useGrid() {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadGrid().then(setGrid, () => setError(true));
  }, []);
  const items = useMemo<GridPick[]>(
    () =>
      grid?.players.map((p) => ({
        ...p,
        key: p.id,
        sub: p.born ? `${p.born}년생` : undefined,
      })) ?? [],
    [grid],
  );
  return { grid, items, error };
}
