"use client";

import type { ReactNode } from "react";

/**
 * A filter toggle, and a labelled group of them.
 *
 * Shared because grade sits on the mountain and aspect sits in the drawer, and
 * two controls that select the same way have to look like they do.
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
