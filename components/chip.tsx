"use client";

import type { ReactNode } from "react";

/**
 * A filter toggle, and a labelled group of them.
 *
 * Shared because the same selection has to look like itself wherever it is
 * made: grade and aspect stand side by side in the drawer, and grade also goes
 * out on the mountain. `GlyphChip` below is this chip with its label moved into
 * its accessible name — same ring, same pressed state — so the two still read
 * as one control.
 */
export function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`u-data flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
        active
          ? "border-sun bg-sun-dim/40 text-snow"
          : "border-line text-rock hover:border-rock-dim hover:text-snow"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * A chip whose mark is its label.
 *
 * Difficulty is carried by shape (SPEC §9), so on the mountain the words are
 * redundant and the row is five glyphs wide rather than five phrases. Off is
 * drawn by dimming rather than by hollowing the mark: hollow already means
 * untagged, and two meanings on one treatment is one too many.
 *
 * The name a screen reader answers on is `label`. The mark inside is hidden
 * from it because `DifficultyMark` carries its own `role="img"`, which would
 * otherwise say the grade twice.
 */
export function GlyphChip({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`flex cursor-pointer items-center rounded-full border px-2 py-1.5 transition-[background-color,border-color,opacity] ${
        active ? "border-sun bg-sun-dim/40" : "border-line opacity-35 hover:opacity-100"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="flex items-center">
        {children}
      </span>
    </button>
  );
}

/**
 * The legend is the grouping a screen reader answers on, and it is `sr-only`
 * because a `<legend>` in a flex row is laid out inconsistently across
 * browsers. The visible label beside it does the same job for the eye.
 */
export function ChipGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="u-data mr-1 w-16 shrink-0">
        {label}
      </span>
      {children}
    </fieldset>
  );
}
