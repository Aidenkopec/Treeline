import Link from "next/link";
import { ConditionsStrip } from "@/components/conditions-strip";
import type { Resort } from "@/lib/types";

/** One measured fact about the resort, formatted on the server. */
export interface Fact {
  label: string;
  value: string;
}

/**
 * What mountain this is, over the terrain and deliberately not in its way.
 *
 * Only the link is clickable, so a drag anywhere else still turns the mountain.
 *
 * The scrim is a veil rather than a panel (`.u-scrim`), and what actually holds
 * the letterforms is the halo on them — the way a map halos a name instead of
 * boxing it, so a ridge can come up behind the words without taking them with
 * it.
 *
 * Every fact reads on one line with its label beside it rather than above it.
 * Stacked, six facts and four readings stood three hundred pixels tall, and
 * that height is `inset.top`: the camera composes the massif below it, so the
 * masthead was costing the mountain a quarter of the window.
 *
 * The facts are here in full rather than behind a disclosure. SPEC §8 requires
 * provenance and age visible, which is what `Vertical scale` and `Baked` are,
 * and they are also the whole of the page without WebGL — so they stay plain
 * HTML served with the document (SPEC §9).
 */
export function ResortIdentity({ facts, resort }: { facts: Fact[]; resort: Resort }) {
  return (
    <header className="u-scrim">
      {/* The run-out matters as much as the padding: the scrim feathers over
          its own last fifth, so a line of type inside that is a line with
          nothing behind it. This is what keeps the conditions row out of it. */}
      <div className="u-halo px-6 pt-6 pb-12">
        <Link className="u-data pointer-events-auto transition-colors hover:text-snow" href="/">
          ← Treeline
        </Link>
        <h1 className="u-massif mt-2 text-2xl text-snow sm:text-3xl">{resort.name}</h1>

        <dl className="mt-3.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {facts.map((fact) => (
            // The interpunct is the separator a map legend uses. Drawn by the
            // pseudo-element so it is a flex item in the same gap as the pairs
            // and never lands alone at the end of a wrapped row.
            <div
              className="flex items-baseline gap-1.5 after:text-rock-dim after:content-['·'] last:after:content-none"
              key={fact.label}
            >
              <dt className="u-data">{fact.label}</dt>
              <dd className="u-feature text-sm text-snow tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {/* Separate from the facts above on purpose: those are terrain, measured
            once and dated; these are somebody else's model, read a moment ago.
            Merging them into one list would blur which is which. */}
        <ConditionsStrip slug={resort.slug} />
      </div>
    </header>
  );
}
