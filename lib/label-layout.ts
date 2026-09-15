/**
 * Which labels on the mountain get drawn, and where.
 *
 * Screen space, not ground space. The camera orbits freely, so "close together
 * on the mountain" and "close together in front of the reader" are different
 * questions, and only the second is the one a crowded label is asking. Deciding
 * from baked coordinates answers the first, and holds for exactly one framing.
 *
 * Pure, so the decisions are settled by `npm test` rather than by a screenshot
 * taken at one camera angle — which is how the tiering this replaces was tuned.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

export interface Cluster {
  /** Every point in the group, in input order. */
  ids: string[];
  /**
   * The member the group's mark hangs on: the one nearest the group's centre.
   *
   * A real point on the mountain rather than the averaged centre, which is a
   * spot where nothing stands — and which drifts as the camera turns, so the
   * mark would creep across the snow while the buildings under it held still.
   */
  anchorId: string;
}

/**
 * Points closer together on screen than `radius`, merged into one group.
 *
 * Single-link: a chain of near points is one group, because a row of base-area
 * lodges is a chain, and splitting it at the first gap wider than the radius
 * would put two marks where a reader sees one building.
 */
export function clusterPoints(points: ScreenPoint[], radius: number): Cluster[] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) [parent[i], i] = [root, parent[i]];
    return root;
  };

  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      if (Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y) >= radius) continue;
      // The lower index wins, so a group is always rooted at its first member
      // and the output order follows the input's.
      const [ra, rb] = [find(a), find(b)];
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < points.length; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }

  return [...groups.values()].map((members) => {
    const cx = members.reduce((sum, i) => sum + points[i].x, 0) / members.length;
    const cy = members.reduce((sum, i) => sum + points[i].y, 0) / members.length;
    let anchor = members[0];
    let best = Infinity;
    for (const i of members) {
      const distance = Math.hypot(points[i].x - cx, points[i].y - cy);
      if (distance < best) [best, anchor] = [distance, i];
    }
    return { ids: members.map((i) => points[i].id), anchorId: points[anchor].id };
  });
}

export interface PlateCandidate {
  id: string;
  width: number;
  height: number;
  /**
   * Plate centres to try, best first. The first that lands clear wins; a
   * candidate where none does is not drawn at all.
   *
   * Absolute rather than offsets from one anchor, because the good answer to a
   * crowded label is usually to move it somewhere else entirely. A cartographer
   * given a name that will not fit beside the middle of a line slides it up the
   * line until it does, and only gives up when the whole line is busy.
   */
  spots: { x: number; y: number }[];
}

export interface Placement {
  id: string;
  /** Index into that candidate's `spots`. */
  spot: number;
  /** Where the plate landed, so a later pass can reserve it without re-deriving it. */
  rect: Rect;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Plates placed greedily in the order given, which is the order of importance.
 *
 * Greedy rather than optimal on purpose: an optimal packing would reshuffle
 * every label the moment the camera nudged, and a name that jumps to the far
 * side of its lift while you are reading it is worse than a name that is
 * missing. Taking them in a fixed order means a plate only moves when the thing
 * above it in the order moves onto it.
 *
 * `reserved` is what is already standing there — the place marks, which are
 * pinned to real points and cannot give way.
 */
export function placePlates(candidates: PlateCandidate[], reserved: Rect[]): Placement[] {
  const taken = [...reserved];
  const placed: Placement[] = [];

  for (const candidate of candidates) {
    for (let spot = 0; spot < candidate.spots.length; spot++) {
      const { x, y } = candidate.spots[spot];
      const rect = {
        x: x - candidate.width / 2,
        y: y - candidate.height / 2,
        width: candidate.width,
        height: candidate.height,
      };
      if (taken.some((other) => overlaps(other, rect))) continue;
      taken.push(rect);
      placed.push({ id: candidate.id, spot, rect });
      break;
    }
  }

  return placed;
}
