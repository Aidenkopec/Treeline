import type { Difficulty } from "./types";

/**
 * How a difficulty grade is drawn. Shape is the real trail-map vocabulary, so a grade
 * survives being read without color (SPEC §9). Advanced and expert share a color
 * deliberately: both are "black" on a mountain, and the diamond count separates them.
 */
export interface DifficultyStyle {
  /** What a skier calls it. */
  label: string;
  shape: "circle" | "square" | "diamond";
  /** How many markers to draw — two diamonds for expert. */
  count: 1 | 2;
  /** CSS custom property holding the line/marker color. */
  colorVar: string;
  /** Filled, or hollow for an untagged way. */
  filled: boolean;
}

export const DIFFICULTY_STYLES: Record<string, DifficultyStyle> = {
  easy: { label: "Easy", shape: "circle", count: 1, colorVar: "--color-diff-easy", filled: true },
  intermediate: {
    label: "Intermediate",
    shape: "square",
    count: 1,
    colorVar: "--color-diff-intermediate",
    filled: true,
  },
  advanced: {
    label: "Advanced",
    shape: "diamond",
    count: 1,
    colorVar: "--color-diff-advanced",
    filled: true,
  },
  expert: {
    label: "Expert",
    shape: "diamond",
    count: 2,
    colorVar: "--color-diff-expert",
    filled: true,
  },
  untagged: {
    label: "Ungraded",
    shape: "circle",
    count: 1,
    colorVar: "--color-diff-unknown",
    filled: false,
  },
};

/** Ordered as a mountain orders them, gentlest first. Drives legends and filters. */
export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "intermediate", "advanced", "expert", null];

export function difficultyStyle(difficulty: Difficulty): DifficultyStyle {
  return DIFFICULTY_STYLES[difficulty ?? "untagged"];
}
