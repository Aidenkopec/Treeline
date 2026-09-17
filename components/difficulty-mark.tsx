import { difficultyStyle } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";

/**
 * The trail-map marker for a difficulty grade. Carries the grade by shape as well as
 * color, so it holds up in the HTML table, in print, and without hue (SPEC §9).
 */
export function DifficultyMark({
  difficulty,
  size = 10,
}: {
  difficulty: Difficulty;
  size?: number;
}) {
  const style = difficultyStyle(difficulty);
  const color = `var(${style.colorVar})`;
  const marks = Array.from({ length: style.count });

  return (
    <span
      className="inline-flex shrink-0 items-center gap-[2px] align-middle"
      role="img"
      aria-label={style.label}
    >
      {marks.map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 10 10"
          aria-hidden="true"
          fill={style.filled ? color : "none"}
          stroke={color}
          strokeWidth={style.filled ? 0 : 1.4}
        >
          {style.shape === "circle" && <circle cx="5" cy="5" r="4.2" />}
          {style.shape === "square" && <rect x="1.1" y="1.1" width="7.8" height="7.8" />}
          {style.shape === "diamond" && <path d="M5 0.4 9.6 5 5 9.6 0.4 5Z" />}
        </svg>
      ))}
    </span>
  );
}
