"use client";

import type { ReactNode } from "react";

/**
 * A filter toggle, and a labelled group of them. Shared because the same selection has to
 * look like itself wherever it is made: grade and aspect in the drawer, grade on the map.
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
 * A chip whose mark is its label. Off is drawn by dimming rather than hollowing, because
 * hollow already means untagged. The accessible name is `label`, and the mark inside is
 * hidden from screen readers because `DifficultyMark` carries its own `role="img"`.
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
export function ChipGroup({
  children,
  compact,
  label,
}: {
  children: ReactNode;
  /** On the map, where a handheld has no room for a word column. */
  compact?: boolean;
  label: string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span
        aria-hidden="true"
        className={`u-data mr-1 w-16 shrink-0 ${compact ? "handheld:hidden" : ""}`}
      >
        {label}
      </span>
      {children}
    </fieldset>
  );
}
