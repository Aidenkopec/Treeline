import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Manifest, Resort, RunsFile } from "./types";
import resortsInput from "@/resorts.json";

/**
 * Reading baked artifacts.
 *
 * These are plain files on disk, read at build time — there is no database
 * (SPEC §5). Before a resort has been baked it simply is not in the manifest,
 * and the UI says so rather than pretending it is loading.
 */

const PUBLIC_RESORTS = path.join(process.cwd(), "public", "resorts");

export interface ResortInput {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  zoom: number;
  texture_quality: number;
  vertical_exaggeration: number;
}

/** Every resort the project intends to ship, baked or not. */
export function plannedResorts(): ResortInput[] {
  return resortsInput.resorts as ResortInput[];
}

export async function readManifest(): Promise<Manifest> {
  try {
    const raw = await readFile(path.join(PUBLIC_RESORTS, "manifest.json"), "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    // Nothing baked yet. An empty manifest is a valid state, not an error.
    return { generated_at: new Date().toISOString(), resorts: [] };
  }
}

export async function readResort(slug: string): Promise<Resort | null> {
  const manifest = await readManifest();
  return manifest.resorts.find((r) => r.slug === slug) ?? null;
}

export async function readRuns(slug: string): Promise<RunsFile | null> {
  try {
    const raw = await readFile(path.join(PUBLIC_RESORTS, slug, "runs.json"), "utf8");
    return JSON.parse(raw) as RunsFile;
  } catch {
    return null;
  }
}
