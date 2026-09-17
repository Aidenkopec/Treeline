"use client";

import { Chip, ChipGroup, GlyphChip } from "@/components/chip";
import { DifficultyMark } from "@/components/difficulty-mark";
import { DIFFICULTY_ORDER, difficultyStyle } from "@/lib/difficulty";
import { type RunFilter, shownDifficulties, toggleDifficulty } from "@/lib/run-list";

/**
 * Grade, on the mountain rather than in the drawer.
 *
 * It is the one filter whose effect is the terrain: five chips remove and
 * restore lines in front of the reader, and putting them here is what lets a
 * shut drawer still say why runs are missing. Aspect and vertical stay behind
 * the disclosure — fifteen controls on the canvas is the floating filter card
 * phase 3 already took off it.
 *
 * `compact` drops the words and keeps the marks, which is what makes the row
 * fit an edge strip. It is only right where the mountain is: five toggles that
 * add and remove lines in front of a reader teach their own shapes. In the
 * drawer nothing teaches them, and unlabelled marks beside the aspect chips'
 * words would read as decoration — so that call site keeps the labels.
 *
 * Either way the name states what it selects and nothing more. No grade is
 * presented as a better one (SPEC §8).
 *
 * The count that stands beside these on the map belongs to the explorer rather
 * than to this component: without a GPU the chips fall into the drawer, where
 * the filters already print one and a second would say it twice.
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
