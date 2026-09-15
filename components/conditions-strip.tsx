"use client";

import { useEffect, useState } from "react";
import { celsius, centimetres, observedAt, wind } from "@/lib/format";
import type { Conditions } from "@/lib/types";

/**
 * Today's snow, temperature and wind (SPEC §4).
 *
 * A client component because awaiting a runtime fetch in a server component
 * would turn the prerendered resort route dynamic and take the run table out of
 * the served HTML. Fetching after hydration leaves the page static; before it,
 * and without JavaScript, the strip reads as dashes.
 */
export function ConditionsStrip({ slug }: { slug: string }) {
  const [conditions, setConditions] = useState<Conditions | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/conditions/${slug}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<Conditions>) : null))
      .then(setConditions)
      // Including the abort on unmount. The dashes below are already the answer.
      .catch(() => {});

    return () => controller.abort();
  }, [slug]);

  const readings = [
    ["Temperature", celsius(conditions?.temperature_c ?? null)],
    ["Snow 24h", centimetres(conditions?.snowfall_cm_24h ?? null)],
    ["Snow depth", centimetres(conditions?.snow_depth_cm ?? null)],
    ["Wind", wind(conditions?.wind_kph ?? null, conditions?.wind_direction_deg ?? null)],
  ] as const;

  return (
    <section className="mt-6 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="u-data">Conditions</h2>
        {/* "Weather from Open-Meteo" rather than a bare brand name, matching the
            footer: a reader has to be able to tell a source from a reading. */}
        <p className="u-data text-rock-dim">
          Weather from Open-Meteo
          {conditions === null
            ? ""
            : ` · ${observedAt(conditions.observed_at, conditions.timezone)}`}
        </p>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
        {readings.map(([label, value]) => (
          <div key={label}>
            <dt className="u-data">{label}</dt>
            <dd className="u-feature text-sm text-snow tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
