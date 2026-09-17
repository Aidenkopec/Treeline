import { Archivo } from "next/font/google";

/**
 * Archivo is variable on both wght and wdth, so one file carries the whole
 * cartographic width system in globals.css with no second family to keep in tune.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});
