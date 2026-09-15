import { Archivo } from "next/font/google";

/**
 * One superfamily, loaded once, with its width axis live.
 *
 * Archivo is variable on both wght (100–900) and wdth (62–125), so a single
 * file gives the whole cartographic width system in globals.css — wide for a
 * massif, normal for a feature, narrow for a dense readout — with no second
 * request and no second family to keep in tune.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});
