"use client";

import { Chip, ChipGroup } from "@/components/chip";
import { DifficultyMark } from "@/components/difficulty-mark";
import { DIFFICULTY_ORDER, difficultyStyle } from "@/lib/difficulty";
import type { RunFilter } from "@/lib/run-list";
import type { Difficulty } from "@/lib/types";

/**
 * Grade, on the mountain rather than in the drawer.
 *
 * It is the one filter whose effect is the terrain: five chips remove and
 * restore lines in front of the reader, and putting them here is what lets a
 * shut drawer still say why runs are missing. Aspect and vertical stay behind
 * the disclosure — fifteen controls on the canvas is the floating filter card
 * phase 3 already took off it.
 *
 * The labels state what they select and nothing more. No grade is presented as
 * a better one (SPEC §8).
 *
 * The count that stands beside these on the map belongs to the explorer rather
 * than to this component: without a GPU the chips fall into the drawer, where
 * the filters already print one and a second would say it twice.
 */
export function GradeFilter({
  onChange,
  value,
}: {
  onChange: (next: RunFilter) => void;
  value: RunFilter;
}) {
  const toggle = (difficulty: Difficulty) =>
    onChange({
      ...value,
      difficulties: value.difficulties.includes(difficulty)
        ? value.difficulties.filter((held) => held !== difficulty)
        : [...value.difficulties, difficulty],
    });

  return (
    <ChipGroup label="Grade">
      {DIFFICULTY_ORDER.map((difficulty) => (
        <Chip
          active={value.difficulties.includes(difficulty)}
          key={difficultyStyle(difficulty).label}
          onClick={() => toggle(difficulty)}
        >
          <DifficultyMark difficulty={difficulty} size={9} />
          {difficultyStyle(difficulty).label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
