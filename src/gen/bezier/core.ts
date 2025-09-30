import { GeneratedPoint, Point } from "$utils";

const section = (points: Point[]): [Point, Point, Point, Point][] => {
  const sectionedPoints: ReturnType<typeof section> = [];
  for (let i = 3; i < points.length; i += 3) {
    sectionedPoints.push([points[i - 3], points[i - 2], points[i - 1], points[i]]);
  }

  return sectionedPoints;
};

const evaluate = (sectioned: [Point, Point, Point, Point], t: number): Point => {
  const mt = 1 - t;
  return new Point(
    mt * mt * mt * sectioned[0].x +
      3 * mt * mt * t * sectioned[1].x +
      3 * mt * t * t * sectioned[2].x +
      t * t * t * sectioned[3].x,
    mt * mt * mt * sectioned[0].y +
      3 * mt * mt * t * sectioned[1].y +
      3 * mt * t * t * sectioned[2].y +
      t * t * t * sectioned[3].y
  );
};

const curvature = (sectioned: [Point, Point, Point, Point], t: number): number => {
  const mt = 1 - t;

  // First derivative
  const d1 = {
    x:
      3 * mt * mt * (sectioned[1].x - sectioned[0].x) +
      6 * mt * t * (sectioned[2].x - sectioned[1].x) +
      3 * t * t * (sectioned[3].x - sectioned[2].x),
    y:
      3 * mt * mt * (sectioned[1].y - sectioned[0].y) +
      6 * mt * t * (sectioned[2].y - sectioned[1].y) +
      3 * t * t * (sectioned[3].y - sectioned[2].y),
  };

  // Second derivative
  const d2 = {
    x:
      6 * (1 - t) * (sectioned[2].x - 2 * sectioned[1].x + sectioned[0].x) +
      6 * t * (sectioned[3].x - 2 * sectioned[2].x + sectioned[1].x),
    y:
      6 * (1 - t) * (sectioned[2].y - 2 * sectioned[1].y + sectioned[0].y) +
      6 * t * (sectioned[3].y - 2 * sectioned[2].y + sectioned[1].y),
  };

  const crossProduct = d1.x * d2.y - d1.y * d2.x;
  const denominator = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);

  return denominator === 0 ? 0 : crossProduct / denominator;
};

const length = (p0: Point, p1: Point, p2: Point, p3: Point, n: number = 100): number => {
  // Ensure n is even for Simpson's Rule
  if (n % 2 !== 0) n++;

  // Cubic derivative at t
  const speedAtT = (t: number): number => {
    const u = 1 - t;
    const dx =
      3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
    const dy =
      3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Simpson's Rule integration
  const h = 1 / n;
  let sum = speedAtT(0) + speedAtT(1);

  for (let i = 1; i < n; i++) {
    const t = i * h;
    sum += (i % 2 === 0 ? 2 : 4) * speedAtT(t);
  }

  return (h / 3) * sum;
};

const fill = (
  sectioned: [Point, Point, Point, Point],
  k: number,
  velocity: number
): GeneratedPoint[] => {
  const res: GeneratedPoint[] = [];
  const space = 0.75;
  const numPoints = Math.ceil(
    length(sectioned[0], sectioned[1], sectioned[2], sectioned[3]) / space
  );
  for (let j = 0; j < numPoints; j++) {
    const t = j / numPoints;
    const { x, y } = evaluate(sectioned, t);
    const curve = curvature(sectioned, t);
    const vel = Math.min(velocity, Math.abs(k / curve));
    res.push(new GeneratedPoint(x, y, 0, vel, curve));
  }

  return res;
};

export const bezier = (
  path: Point[],
  k: number,
  velocity: number,
  acceleration: number
): GeneratedPoint[] => {
  const sectioned = section(path);
  const points = sectioned.flatMap((section) => fill(section, k, velocity));
  // deceleration
  for (let j = points.length - 1; j >= 0; j--) {
    const point = points[j];
    if (j === points.length - 1) point.speed = 0;
    else {
      point.speed = Math.min(
        point.speed,
        Math.sqrt(
          2 * acceleration * point.distance(points[j + 1]) +
            Math.pow(points[j + 1].speed, 2)
        )
      );
    }
  }

  // acceleration
  for (let j = 0; j < points.length; j++) {
    const point = points[j];
    if (j === 0) point.speed = 0;
    else {
      point.speed = Math.min(
        point.speed,
        Math.sqrt(
          2 * acceleration * point.distance(points[j - 1]) +
            Math.pow(points[j - 1].speed, 2)
        )
      );
    }
  }

  // time
  let runningTime = 0;
  for (let j = 1; j < points.length; j++) {
    const point = points[j];
    const prev = points[j - 1];
    const dist = point.distance(prev);
    const time = prev.speed === 0 ? dist : dist / prev.speed;
    runningTime += time;
    point.time = runningTime;
  }

  // angular velocity
  if (points.length > 2) {
    // Recompute curvature using geometric finite differences across the entire polyline
    const curvatures: number[] = new Array(points.length).fill(0);
    for (let i = 1; i < points.length - 1; i++) {
      const pPrev = points[i - 1];
      const p = points[i];
      const pNext = points[i + 1];
      const ax = p.x - pPrev.x;
      const ay = p.y - pPrev.y;
      const bx = pNext.x - p.x;
      const by = pNext.y - p.y;
      const aLen = Math.hypot(ax, ay);
      const bLen = Math.hypot(bx, by);
      if (aLen === 0 || bLen === 0) {
        curvatures[i] = 0;
        continue;
      }
      // Normalize
      const anx = ax / aLen;
      const any = ay / aLen;
      const bnx = bx / bLen;
      const bny = by / bLen;
      const cross = anx * bny - any * bnx; // signed
      const dot = anx * bnx + any * bny;
      const angle = Math.atan2(cross, dot); // signed turning angle between segments
      const arcLen = (aLen + bLen) / 2;
      curvatures[i] = arcLen === 0 ? 0 : angle / arcLen; // κ ≈ Δθ / Δs
    }
    // Endpoints inherit neighbor curvature
    curvatures[0] = curvatures[1];
    curvatures[curvatures.length - 1] = curvatures[curvatures.length - 2];

    // Optional light smoothing (moving average window = 3) to reduce residual noise
    for (let i = 1; i < curvatures.length - 1; i++) {
      curvatures[i] = (curvatures[i - 1] + curvatures[i] + curvatures[i + 1]) / 3;
    }

    // Assign angular velocity = curvature * linear speed
    for (let i = 0; i < points.length; i++) {
      points[i].angular = curvatures[i] * points[i].speed;
    }
  } else if (points.length === 2) {
    points[0].angular = 0;
    points[1].angular = 0;
  }

  return points;
};
