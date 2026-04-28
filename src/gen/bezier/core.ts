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
      t * t * t * sectioned[3].y,
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
  velocity: number,
): GeneratedPoint[] => {
  const res: GeneratedPoint[] = [];
  const space = 0.75;
  const numPoints = Math.ceil(
    length(sectioned[0], sectioned[1], sectioned[2], sectioned[3]) / space,
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
  acceleration: number,
  kSlip: number = 0,
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
            Math.pow(points[j + 1].speed, 2),
        ),
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
            Math.pow(points[j - 1].speed, 2),
        ),
      );
    }
  }

  // time
  let runningTime = 0;
  for (let j = 1; j < points.length; j++) {
    const point = points[j];
    const prev = points[j - 1];
    const dist = point.distance(prev);
    const avgSpeed = (Math.abs(prev.speed) + Math.abs(point.speed)) / 2;
    const time = avgSpeed === 0 ? 0 : dist / avgSpeed;
    runningTime += time;
    point.time = runningTime;
  }

  // angular velocity
  for (let j = 1; j < points.length; j++) {
    const point = points[j];
    // const t = j / points.length;
    const curve = point.angular;
    point.angular = curve * point.speed;
  }

  // Shift time so start is 0
  if (points.length > 0) {
    const startTime = points[0].time;
    points.forEach((point) => {
      point.time -= startTime;
    });
  }

  // Lateral Slip & Pose Integration
  // 1. Calculate Lateral Velocity and Store Bezier Geometry
  const bezierGeometry = points.map((p) => ({ x: p.x, y: p.y }));

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    // v_y = k_slip * v * omega
    point.lateral = kSlip * point.speed * point.angular;

    // // Clamp
    // const maxLatRatio = 0.25;
    // const limit = maxLatRatio * Math.abs(point.speed);
    // point.lateral = Math.max(-limit, Math.min(limit, point.lateral));
  }

  // 2. Integrate Pose
  // points[0] stays at original position (or we assume it does)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const p0 = bezierGeometry[i - 1];
    const p1 = bezierGeometry[i];

    // Heading from Bezier tangent
    // Use Math.atan2(dy, dx)
    const heading = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    const dt = cur.time - prev.time;

    // x_dot = v_x * cos(theta) - v_y * sin(theta)
    // y_dot = v_x * sin(theta) + v_y * cos(theta)

    const vx = prev.speed;
    const vy = prev.lateral;

    const dx = vx * Math.cos(heading) - vy * Math.sin(heading);
    const dy = vx * Math.sin(heading) + vy * Math.cos(heading);

    cur.x = prev.x + dx * dt;
    cur.y = prev.y + dy * dt;
  }

  // 3. Endpoint Correction
  if (points.length > 0) {
    const targetPoint = bezierGeometry[bezierGeometry.length - 1];
    const actualEnd = points[points.length - 1];
    const endError = {
      x: targetPoint.x - actualEnd.x,
      y: targetPoint.y - actualEnd.y,
    };

    if (Math.hypot(endError.x, endError.y) > 1e-4) {
      for (let i = 0; i < points.length; i++) {
        const alpha = i / (points.length - 1);
        points[i].x += endError.x * alpha;
        points[i].y += endError.y * alpha;
      }
    }
  }

  return points;
};
