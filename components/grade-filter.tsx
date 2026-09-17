"use client";

import { Chip, ChipGroup, GlyphChip } from "@/components/chip";
import { DifficultyMark } from "@/components/difficulty-mark";
import { DIFFICULTY_ORDER, difficultyStyle } from "@/lib/difficulty";
import { type RunFilter, shownDifficulties, toggleDifficulty } from "@/lib/run-list";

/**
 * Grade, on the mountain rather than in the drawer: its effect is the terrain, so a shut
 * drawer still says why runs are missing. `compact` drops the words and keeps the marks,
 * which only reads where the mountain teaches the shapes. No grade is a better one (§8).
 */
export function GradeFilter({
  compact = false,
  onChange,
  value,
}: {
  /** Marks without words. For the mountain, which is what explains them. */
  compact?: boolean;
  onChange: (next: RunFilter) => void;
  value: RunFilter;
}) {
  const shown = shownDifficulties(value);

  return (
    <ChipGroup compact={compact} label="Grade">
      {DIFFICULTY_ORDER.map((difficulty) => {
        const style = difficultyStyle(difficulty);
        const active = shown.includes(difficulty);

        return compact ? (
          <GlyphChip
            active={active}
            key={style.label}
            label={style.label}
            onClick={() => onChange(toggleDifficulty(value, difficulty))}
          >
            <DifficultyMark difficulty={difficulty} size={11} />
          </GlyphChip>
        ) : (
          <Chip
            active={active}
            key={style.label}
            onClick={() => onChange(toggleDifficulty(value, difficulty))}
          >
            <DifficultyMark difficulty={difficulty} size={9} />
            {style.label}
          </Chip>
        );
      })}
    </ChipGroup>
  );
}
