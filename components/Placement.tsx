"use client";

import { createContext, useContext } from "react";

/**
 * Where a header control is being drawn: "inline" in the phone's compact
 * header, "block" filling a column - the search at the top of the widget
 * column and collect under the menu, as Bluesky and X place their search and
 * their main button. The same element is handed over once by each page and
 * drawn in whichever place the screen size shows.
 */
export type Placement = "inline" | "block";
const Ctx = createContext<Placement>("inline");
export const PlacementProvider = Ctx.Provider;
export const usePlacement = () => useContext(Ctx);
