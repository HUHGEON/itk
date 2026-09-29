/**
 * The board: 31 hexes in seven rows of 4-5-4-5-4-5-4.
 *
 * Pointy-top hexes in offset rows, the short rows shifted half a hex to the
 * right - the same shape the original uses (its config ships
 * `rowPattern: [4, 5, 4, 5, 4, 5, 4]`). A cell is addressed by its row `r` and
 * its index `q` within that row.
 */
export const ROWS = [4, 5, 4, 5, 4, 5, 4] as const;

export interface Cell {
  id: string;
  q: number;
  r: number;
}

/** Every cell, minus any slot kept free (The Heatmap puts its score there). */
export function cells(skip?: { q: number; r: number }): Cell[] {
  const out: Cell[] = [];
  ROWS.forEach((n, r) => {
    for (let q = 0; q < n; q++) {
      if (skip && skip.q === q && skip.r === r) continue;
      out.push({ id: `${r}-${q}`, q, r });
    }
  });
  return out;
}

/**
 * The cells touching this one.
 *
 * A short row sits half a hex to the right of the long rows around it, so a
 * cell in a short row touches index q and q+1 above and below, and a cell in a
 * long row touches q-1 and q.
 */
export function neighbours(c: { q: number; r: number }): { q: number; r: number }[] {
  const short = ROWS[c.r] === 4;
  const around = short ? [c.q, c.q + 1] : [c.q - 1, c.q];
  const out = [
    { q: c.q - 1, r: c.r },
    { q: c.q + 1, r: c.r },
    ...around.map((q) => ({ q, r: c.r - 1 })),
    ...around.map((q) => ({ q, r: c.r + 1 })),
  ];
  return out.filter((n) => n.r >= 0 && n.r < ROWS.length && n.q >= 0 && n.q < ROWS[n.r]);
}

export const cellId = (c: { q: number; r: number }) => `${c.r}-${c.q}`;

/**
 * Where a cell sits, as fractions of the board's width and height.
 *
 * The widest row is five hexes, so a hex is a fifth of the width; a pointy-top
 * hex is 2/√3 as tall as it is wide, and rows overlap by a quarter of that.
 */
export const HEX_H_PER_W = 2 / Math.sqrt(3);
export const BOARD_H_PER_W = (HEX_H_PER_W * (1 + 0.75 * (ROWS.length - 1))) / 5;

export function place(c: { q: number; r: number }) {
  const short = ROWS[c.r] === 4;
  const left = (c.q + (short ? 0.5 : 0)) / 5;
  const top = (c.r * 0.75 * HEX_H_PER_W) / 5 / BOARD_H_PER_W;
  return { left, top, width: 1 / 5, height: HEX_H_PER_W / 5 / BOARD_H_PER_W };
}
