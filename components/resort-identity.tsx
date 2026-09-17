import Link from "next/link";
import { ConditionsStrip } from "@/components/conditions-strip";
import type { Resort } from "@/lib/types";

/** One measured fact about the resort, formatted on the server. */
export interface Fact {
  label: string;
  value: string;
}

/**
 * What mountain this is, over the terrain and not in its way: only the link is clickable,
 * so a drag anywhere else still turns it. Facts read on one line because their height is
 * `inset.top`, and stay plain HTML in full for provenance (SPEC §8) and no-WebGL (§9).
 */
export function ResortIdentity({
  collapsible,
  facts,
  factsShown,
  onToggleFacts,
  resort,
}: {
  /** False without a GPU, where the facts are the page and cannot be folded. */
  collapsible: boolean;
  facts: Fact[];
  /** Whether the fold is open. Only a handheld ever draws it shut. */
  factsShown: boolean;
  onToggleFacts: () => void;
  resort: Resort;
}) {
  return (
    <header className="u-scrim">
      {/* The run-out matters as much as the padding: the scrim feathers over
          its own last fifth, so a line of type inside that is a line with
          nothing behind it. This is what keeps the conditions row out of it. */}
      <div
        className={`u-halo px-6 pt-6 pb-12 handheld:px-5 handheld:pt-3 ${
          factsShown ? "handheld:pb-8" : "handheld:pb-3"
        }`}
      >
        <Link className="u-data pointer-events-auto transition-colors hover:text-snow" href="/">
          ← Treeline
        </Link>

        {/* A row only on a handheld. Everywhere else this stays the block it
            has always been, so the heading is a full-width line rather than a
            flex item sized to its own letters. */}
        <div className="handheld:flex handheld:items-baseline handheld:justify-between handheld:gap-3">
          <h1 className="u-massif mt-2 text-2xl text-snow sm:text-3xl handheld:mt-1 handheld:truncate handheld:text-xl">
            {resort.name}
          </h1>

          {/* Six facts and four readings stood three hundred pixels tall on a
              phone, which is `inset.top` — the mountain had none of the window
              left. Folded here and nowhere else. */}
          {collapsible && (
            <button
              aria-controls="resort-facts"
              aria-expanded={factsShown}
              className="u-data pointer-events-auto hidden shrink-0 cursor-pointer px-2 py-2 transition-colors hover:text-snow handheld:block"
              onClick={onToggleFacts}
              type="button"
            >
              Facts <span aria-hidden="true">{factsShown ? "▴" : "▾"}</span>
            </button>
          )}
        </div>

        {/* The fold is a media query, so with nothing to press the button
            there is nothing to unfold it. The query is the `handheld` variant
            in `app/globals.css`, spelled out a third time here. */}
        <noscript>
          <style>
            {
              "@media (max-width: 47.9375rem), (max-height: 30rem) and (max-width: 79.9375rem) { #resort-facts { display: block } }"
            }
          </style>
        </noscript>

        <div className={factsShown ? "" : "handheld:hidden"} id="resort-facts">
          <dl className="mt-3.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {facts.map((fact) => (
              // Drawn by the pseudo-element so it is a flex item, never alone on a wrap.
              <div
                className="flex items-baseline gap-1.5 after:text-rock-dim after:content-['·'] last:after:content-none"
                key={fact.label}
              >
                <dt className="u-data">{fact.label}</dt>
                <dd className="u-feature text-sm text-snow tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {/* Separate from the facts above: those are terrain, measured once and
              dated; these are somebody else's model, read a moment ago. */}
          <ConditionsStrip slug={resort.slug} />
        </div>
      </div>
    </header>
  );
}
