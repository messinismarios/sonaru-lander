/**
 * The mark's geometry, as one set of pure functions.
 *
 * This module exists so the mark and the lab cannot disagree. Until now the path data
 * lived as literal strings inside the component while the numbers that produced it lived
 * in throwaway scripts - which meant the only way to try a variation was to ask me to
 * re-run a generator. Both the shipped mark and `/logo/lab` now call these functions, so
 * anything the lab draws is exactly what the component would draw given the same numbers.
 *
 * **The construction.** Two tangent circles on a horizontal axis. The stroke runs most of
 * the way round the large one (the C, and the sonar wavefront's trajectory), crosses the
 * tangent point, then runs most of the way round the small one in the opposite rotational
 * direction. Reversing the bend at the tangent is what makes it an S rather than a C with
 * a hook. Because tangency puts the second centre at `cx + r1 + r2`, shrinking `tailRadius`
 * moves the tail *left* as well as making it smaller - that is the lever that narrows the
 * mark without tilting or spiralling it.
 *
 * The sonar is a separate arc whose centre sits `sonarOffset` to the left of the C's.
 * With an offset it clears the C on the outside; **at zero it is concentric with the C
 * and, being the larger radius, crosses it** - which is where the preset stands since
 * 2026-09-07. `minGap` returns the signed distance either way, so it reports the overlap
 * rather than failing to describe it.
 */

export interface MarkParams {
  /** Radius of the C. */
  readonly radius: number;
  /** Radius of the second bowl. Smaller pulls the tail left and narrows the mark. */
  readonly tailRadius: number;
  /** Angle on the C where the stroke begins, degrees, 0 = due right. */
  readonly startAngle: number;
  /** Angle on the tail circle where the stroke ends. Larger = shorter tail. */
  readonly endAngle: number;
  /** Stroke weight of the S. */
  readonly stroke: number;
  readonly sonarRadius: number;
  /** Arc length of the sonar, in degrees, centred on due left. */
  readonly sonarSpan: number;
  /** How far left of the C's centre the sonar's centre sits. */
  readonly sonarOffset: number;
  readonly sonarStroke: number;
  readonly sonarOpacity: number;
}

/**
 * The mark, **final** as of 2026-09-08.
 *
 * Chosen by the owner in `/logo/lab` on 2026-08-31 and carried as explicitly provisional
 * until they supplied this parameter block and confirmed it is finished. The optical
 * correction that was open while it was provisional - teasing the joins, modulating the
 * stroke, cutting the terminals, outlining the wordmark - is **dropped rather than done**;
 * "final" retired the list. `/logo/lab` still stays out of 8.13's route cleanup.
 *
 * Everything downstream derives from here - the rendered mark, the favicon, the three app
 * icons and the OG template - so there is exactly one copy of the geometry and `npm run
 * brand` is what propagates a change to the rest.
 */
export const PRESET: MarkParams = {
  radius: 12,
  tailRadius: 11.5,
  startAngle: 94,
  endAngle: 277,
  stroke: 9.5,
  sonarRadius: 20,
  sonarSpan: 118,
  /*
   * Zero since 2026-09-07, where it was 11.15. The sonar is now **concentric** with the C
   * rather than pushed left of it, which changes the construction the module header
   * describes: the wave no longer clears the C, it crosses it. `minGap` returns -1.75,
   * and that is the geometry the owner selected, not a slip - see `sonarOpacity`.
   */
  sonarOffset: 0,
  sonarStroke: 10,
  /*
   * 0.34, where it was 0.85, and the two numbers belong to each other. With the sonar
   * concentric it overlaps the S's stroke by 1.75 units, so at 0.85 it would read as a
   * bar drawn across the mark; at 0.34 it reads as a wave passing behind it. The
   * clearance `minGap` measures is no longer a constraint this preset satisfies - it is
   * the quantity that has to stay small and negative for the overlap to read as depth.
   */
  sonarOpacity: 0.34,
};

/** The C's centre. Arbitrary but fixed; the fitted viewBox makes it irrelevant. */
const CX = 38;
const CY = 50;

const round = (n: number): string => n.toFixed(2);

/** SVG's y axis points down, so a maths angle maps to (cos, −sin). */
function pointOn(cx: number, cy: number, r: number, degrees: number): readonly [number, number] {
  const t = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy - r * Math.sin(t)];
}

/** The S: most of the C, then most of the tail circle turning the other way. */
export function sPath(p: MarkParams): string {
  const tailCx = CX + p.radius + p.tailRadius;
  const [ax, ay] = pointOn(CX, CY, p.radius, p.startAngle);
  const [bx, by] = pointOn(tailCx, CY, p.tailRadius, p.endAngle);
  const cTravel = (360 - p.startAngle) % 360;
  const tailTravel = (180 - p.endAngle + 360) % 360;
  return (
    `M ${round(ax)} ${round(ay)} ` +
    `A ${p.radius} ${p.radius} 0 ${cTravel > 180 ? 1 : 0} 0 ${round(CX + p.radius)} ${round(CY)} ` +
    `A ${p.tailRadius} ${p.tailRadius} 0 ${tailTravel > 180 ? 1 : 0} 1 ${round(bx)} ${round(by)}`
  );
}

export function sonarPath(p: MarkParams): string {
  const cx = CX - p.sonarOffset;
  const [ax, ay] = pointOn(cx, CY, p.sonarRadius, 180 - p.sonarSpan / 2);
  const [bx, by] = pointOn(cx, CY, p.sonarRadius, 180 + p.sonarSpan / 2);
  const large = p.sonarSpan > 180 ? 1 : 0;
  return `M ${round(ax)} ${round(ay)} A ${p.sonarRadius} ${p.sonarRadius} 0 ${large} 0 ${round(bx)} ${round(by)}`;
}

/**
 * Smallest clear distance between the sonar's inner edge and the C's outer edge.
 *
 * Sampled rather than solved because the closest approach is at the arc's *tips*, not its
 * midpoint - the difference is about a third, so eyeballing the middle gap consistently
 * overstates the clearance.
 */
export function minGap(p: MarkParams): number {
  let gap = Infinity;
  for (let t = 180 - p.sonarSpan / 2; t <= 180 + p.sonarSpan / 2; t += 0.5) {
    const [x, y] = pointOn(CX - p.sonarOffset, CY, p.sonarRadius, t);
    const distance = Math.hypot(x - CX, y - CY);
    gap = Math.min(gap, distance - p.sonarStroke / 2 - (p.radius + p.stroke / 2));
  }
  return gap;
}

/**
 * A square viewBox fitted to whatever the parameters actually draw, padded by half the
 * heaviest stroke. A fixed box silently clipped the sonar's left edge and the tail's right
 * edge for several revisions - an SVG crops without warning, so this is computed, never
 * assumed.
 */
export function fitViewBox(p: MarkParams): string {
  const points: Array<readonly [number, number]> = [];
  const sweep = (cx: number, r: number, from: number, to: number): void => {
    for (let t = from; t <= to; t += 1) points.push(pointOn(cx, CY, r, t));
  };
  sweep(CX, p.radius, p.startAngle, 360);
  const tailTravel = (180 - p.endAngle + 360) % 360;
  sweep(CX + p.radius + p.tailRadius, p.tailRadius, p.endAngle, p.endAngle + tailTravel);
  sweep(CX - p.sonarOffset, p.sonarRadius, 180 - p.sonarSpan / 2, 180 + p.sonarSpan / 2);

  const pad = Math.max(p.stroke, p.sonarStroke) / 2 + 0.5;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const width = maxX - minX;
  const height = maxY - minY;
  const side = Math.max(width, height);
  return `${round(minX - (side - width) / 2)} ${round(minY - (side - height) / 2)} ${round(side)} ${round(side)}`;
}

/**
 * A circle the construction is built from, in the same units as the paths.
 *
 * `cx`/`cy` are the centre in viewBox coordinates - the same space `sPath` and
 * `sonarPath` emit, so a figure can draw a guide straight over a rendered mark without a
 * transform between them.
 */
export interface Guide {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/**
 * The construction, as geometry rather than as prose.
 *
 * **Added at 8.10c because `CX` and `CY` are module-private and a construction figure
 * cannot draw a centre line without them.** `/brand` documents how the mark is built, and
 * the whole value of that chapter is that its figures are drawn by the functions the mark
 * itself is drawn by. A figure that restated `38` and `50` as literals would be a diagram
 * of a mark we used to have the moment either moved.
 *
 * Everything here is derived from `p`. Nothing is stored, so there is still exactly one
 * copy of the geometry and `PRESET` is still the only place a number is chosen.
 */
export function guides(p: MarkParams): {
  /** The C - the large circle the stroke runs most of the way round. */
  readonly bowl: Guide;
  /** The second bowl, tangent to the first. Its centre is fixed by tangency. */
  readonly tail: Guide;
  /** The sonar wavefront's circle. Concentric with `bowl` while `sonarOffset` is 0. */
  readonly sonar: Guide;
  /** Where the two bowls touch, and where the stroke reverses its bend. */
  readonly tangent: readonly [number, number];
  /** The stroke's two terminals: the start on the C, the end on the tail. */
  readonly terminals: readonly [readonly [number, number], readonly [number, number]];
  /** The C's outer edge and the sonar's inner edge - the two radii `minGap` compares. */
  readonly edges: { readonly bowlOuter: number; readonly sonarUnner: number };
} {
  const tailCx = CX + p.radius + p.tailRadius;
  return {
    bowl: { cx: CX, cy: CY, r: p.radius },
    tail: { cx: tailCx, cy: CY, r: p.tailRadius },
    sonar: { cx: CX - p.sonarOffset, cy: CY, r: p.sonarRadius },
    tangent: [CX + p.radius, CY],
    terminals: [
      pointOn(CX, CY, p.radius, p.startAngle),
      pointOn(tailCx, CY, p.tailRadius, p.endAngle),
    ],
    edges: {
      bowlOuter: p.radius + p.stroke / 2,
      sonarUnner: p.sonarRadius - p.sonarStroke / 2,
    },
  };
}
