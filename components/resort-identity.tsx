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
 * The scrim is a veil rather than a panel. Held at full strength it reads as a
 * block sitting on the page and crowds the type it is meant to carry, so it is
 * mixed light and let go by just past half its height. What actually holds the
 * letterforms is the halo on them, the way a map halos a name instead of boxing
 * it — so a ridge can come up behind the words without taking them with it.
 *
 * The facts are here in full rather than behind a disclosure. They are also the
 * whole of the page without WebGL, so they stay plain HTML served with the
 * document (SPEC §9).
 */
export function ResortIdentity({ facts, resort }: { facts: Fact[]; resort: Resort }) {
  return (
    <header className="bg-gradient-to-b from-shadow-deep/80 via-shadow-deep/35 via-55% to-transparent">
      <div className="u-halo px-6 pt-8 pb-12">
        <Link className="u-data pointer-events-auto transition-colors hover:text-snow" href="/">
          ← Treeline
        </Link>
        <h1 className="u-massif mt-3 text-2xl text-snow sm:text-3xl">{resort.name}</h1>

        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
          {facts.map((fact) => (
            <div key={fact.label}>
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
