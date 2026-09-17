import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURED, HERO_SLUG, featuredRun, silhouettes, type ResortFeature } from "@/lib/masthead";
import { metres } from "@/lib/format";
import { profileGeometry } from "@/lib/profile-path";
import { runCells } from "@/lib/run-list";
import type { Run, RunsFile } from "@/lib/types";

/**
 * What the home page draws. The featured runs are held by way id, so the risk here is a
 * re-bake that drops or reshapes one: the figure would blank and nothing would fail.
 */

function runs(slug: string): Run[] {
  const file = path.join(process.cwd(), "public", "resorts", slug, "runs.json");
  return (JSON.parse(readFileSync(file, "utf8")) as RunsFile).runs;
}

/** Total metres climbed along a profile; zero for a run that only descends. */
function climb(run: Run): number {
  let total = 0;
  for (let i = 1; i < run.profile.length; i++) {
    const step = run.profile[i].e - run.profile[i - 1].e;
    if (step > 0) total += step;
  }
  return total;
}

function feature(slug: string): ResortFeature {
  const run = featuredRun(slug, runs(slug));
  return {
    resort: null,
    planned: { slug, name: slug, country: "Canada" },
    run,
    runCount: 0,
    liftCount: 0,
  };
}

const SLUGS = Object.keys(FEATURED);

describe("the featured run at each resort", () => {
  it.each(SLUGS)("is still in %s's baked artifact", (slug) => {
    expect(featuredRun(slug, runs(slug))?.id).toBe(FEATURED[slug]);
  });

  it.each(SLUGS)("descends throughout at %s, so it draws as a run and not a valley", (slug) => {
    const run = featuredRun(slug, runs(slug))!;
    expect(climb(run)).toBeLessThanOrEqual(0.08 * run.vertical_m);
  });

  it.each(SLUGS)("has enough samples at %s to draw a shape", (slug) => {
    expect(featuredRun(slug, runs(slug))!.profile.length).toBeGreaterThanOrEqual(8);
  });
});

describe("the masthead run", () => {
  const run = featuredRun(HERO_SLUG, runs(HERO_SLUG))!;

  it("is the one the page was written around", () => {
    expect({
      id: run.id,
      name: run.name,
      difficulty: run.difficulty,
      aspect_label: run.aspect_label,
      vertical_m: run.vertical_m,
      length_m: run.length_m,
      samples: run.profile.length,
    }).toEqual({
      id: "777349974",
      name: "Wild Thing",
      difficulty: "expert",
      aspect_label: "N",
      vertical_m: 782,
      length_m: 2646,
      samples: 101,
    });
  });

  it("prints the same five facts the run detail card prints", () => {
    expect(runCells(run)).toMatchObject({
      pitchAvg: "18°",
      pitchMax: "35°",
      aspect: "N 16°",
      vertical: "782m",
      length: "2.6km",
    });
  });

  it("labels the axis the figure is drawn against", () => {
    const { topM, bottomM } = profileGeometry(run.profile, 1200, 300);
    expect([metres(topM), metres(bottomM)]).toEqual(["2452m", "1671m"]);
    // The profile's own relief rounds a metre off the baked vertical.
    expect(Math.abs(topM - bottomM - run.vertical_m)).toBeLessThanOrEqual(1);
  });
});

describe("silhouettes", () => {
  const features = SLUGS.map(feature);
  const shapes = silhouettes(features, 220, 56);
  const byslug = new Map(shapes.map((s) => [s.slug, s]));

  it("draws one shape per resort", () => {
    expect(shapes).toHaveLength(SLUGS.length);
  });

  it("gives the deepest drop the full frame and a shallower one less of it", () => {
    expect(byslug.get("panorama")!.height).toBe(56);
    expect(byslug.get("kimberley")!.height).toBeCloseTo(56 * (591 / 782), 5);
  });

  it("gives the longest run the full width and a shorter one less of it", () => {
    expect(byslug.get("kimberley")!.width).toBe(220);
    expect(byslug.get("panorama")!.width).toBeCloseTo(220 * (2646 / 5634), 5);
  });

  it("carries no run name, so one the font cannot subset never reaches the page", () => {
    expect(Object.keys(byslug.get("niseko")!).sort()).toEqual([
      "geometry",
      "height",
      "slug",
      "width",
    ]);
    expect(JSON.stringify(shapes)).not.toContain("ホリデーコース");
  });

  it("has nothing to draw for a resort with no featured run", () => {
    expect(silhouettes([{ ...feature("panorama"), run: null }], 220, 56)).toEqual([]);
  });
});

describe("the home page's own words", () => {
  const sources = ["app/page.tsx", "components/masthead-figure.tsx", "components/resort-index.tsx"];

  // Scoped deliberately: `site-footer.tsx` carries "safety decisions" in the §8 disclaimer.
  it.each(sources)("recommends nothing in %s (SPEC §8)", (file) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).not.toMatch(/\b(safest|safely|recommend\w*|best run)\b/i);
  });

  it.each(sources)("shows a visitor no build tooling in %s", (file) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).not.toMatch(/npm run bake|--resort |Overpass/);
  });
});
