import { Point } from "$utils";
import { Bernstein } from "./bernstein";

const calculateCurvature = (
  p_minus1: Point,
  p_0: Point,
  p_1: Point,
  delta_t: number = 1.0
): number => {
  if (delta_t <= 0) {
    return 0; // Fallback to zero if delta_t is invalid
  }

  // Step 1: Calculate first derivatives
  const dx_minus1_0 = (p_0.x - p_minus1.x) / delta_t;
  const dy_minus1_0 = (p_0.y - p_minus1.y) / delta_t;
  const dx_0_1 = (p_1.x - p_0.x) / delta_t;
  const dy_0_1 = (p_1.y - p_0.y) / delta_t;

  // Step 2: Calculate second	 derivatives
  const ddx = (dx_0_1 - dx_minus1_0) / delta_t;
  const ddy = (dy_0_1 - dy_minus1_0) / delta_t;

  // Step 3: Average first derivatives at p_0
  const dx = (dx_minus1_0 + dx_0_1) / 2.0;
  const dy = (dy_minus1_0 + dy_0_1) / 2.0;

  // Step 4: Check for division by zero in angular velocity calculation
  const velocity_squared = Math.pow(dx, 2) + Math.pow(dy, 2);
  if (velocity_squared === 0) {
    return 0; // Fallback to zero if velocity is zero
  }

  // Step 5: Calculate angular velocity
  const angular_velocity = (ddy * dx - ddx * dy) / Math.pow(velocity_squared, 1.5);
  // const angular_velocity = (ddy * dx - ddx * dy) / velocity_squared;

  return angular_velocity;
};

export class BezierSpline {
  points: Point[];
  sectioned: Bernstein[];
  spline: [number, Point, number, number, number][];
  degree: number;

  constructor(
    points: Point[],
    sectioned: Bernstein[] = [],
    spline: [number, Point, number, number, number][] = [],
    degree = 3
  ) {
    this.points = points;
    this.sectioned = sectioned;
    this.spline = spline;
    this.degree = degree;
  }

  section() {
    const sectionedPoints = [];
    for (let i = 3; i < this.points.length; i += 3) {
      const bez = new Bernstein([
        this.points[i - 3],
        this.points[i - 2],
        this.points[i - 1],
        this.points[i],
      ]);
      sectionedPoints.push(bez);
    }

    this.sectioned = sectionedPoints;
  }

  evaluate(t: number) {
    if (t == this.sectioned.length) {
      return this.sectioned[t - 1].evaluate(1);
    }

    // u is the integral part of t
    const u = Math.floor(t);
    const tPrime = t - u;
    return this.sectioned[u].evaluate(tPrime);
  }

  inject(numPoints: number) {
    if (this.sectioned.length == 0) {
      this.section();
    }
    for (let i = 0; i < this.sectioned.length; i++) {
      this.sectioned[i].inject(Math.floor(numPoints / this.sectioned.length));
    }
    return this;
  }

  MultiCumDistLUT() {
    let lastLD = 0;
    for (let i = 0; i < this.sectioned.length; i++) {
      this.sectioned[i].generateCD();
      for (let j = 0; j < this.sectioned[i].cumD.length; j++) {
        this.sectioned[i].cumD[j][1] += lastLD;
        // console.log(this.sectioned[i].cumD[j])
      }
      lastLD = this.sectioned[i].cumD[this.sectioned[i].cumD.length - 1][1];
    }
    return this;
  }

  getT(dist: number) {
    for (let k = 0; k < this.sectioned.length; k++) {
      for (let i = 1; i < this.sectioned[k].cumD.length; i++) {
        if (this.sectioned[k].cumD[i][1] >= dist) {
          const dValue1 = new Point(
            this.sectioned[k].cumD[i - 1][0],
            this.sectioned[k].cumD[i - 1][1]
          );
          const dValue2 = new Point(
            this.sectioned[k].cumD[i][0],
            this.sectioned[k].cumD[i][1]
          );
          const t = (dist - dValue1.y) / (dValue2.y - dValue1.y);
          const findingT = Point.lerp(dValue1, dValue2, t);
          return findingT.x + k;
        }
      }
    }
  }

  spaceInject(distBetween: number) {
    this.section();
    this.inject(50 * this.sectioned.length);
    this.MultiCumDistLUT();

    const path: typeof this.spline = [];
    const curveLength =
      this.sectioned[this.sectioned.length - 1].cumD[
        this.sectioned[this.sectioned.length - 1].cumD.length - 1
      ][1];

    const numPoints = Math.floor(curveLength / distBetween);

    distBetween = curveLength / numPoints;

    for (let i = 0; i < numPoints + 1; i++) {
      const distAtPoint = i * distBetween;
      const rawT = this.getT(distAtPoint);
      const t = typeof rawT === "number" ? rawT : (this.points.length + 2) / 3 - 1;
      const pt = this.evaluate(t!);
      path.push([t!, pt, 0, 0, 0]);
    }
    this.spline = path;
  }

  static project(projected: Point, p1: Point, p2: Point) {
    const aVector = Point.subtract(projected, p1);
    const bVector = Point.subtract(p2, p1);
    return Point.sum(
      p1,
      bVector.multiply(
        Point.dotProduct(aVector, bVector) / Point.dotProduct(bVector, bVector)
      )
    );
  }

  adjust3k_0() {
    for (let i = 3; i < this.points.length - 1; i += 3) {
      this.points[i] = BezierSpline.project(
        this.points[i],
        this.points[i - 1],
        this.points[i + 1]
      );
    }
    return this;
  }

  adjust3k_1() {
    for (let i = 4; i < this.points.length; i += 3) {
      this.points[i] = BezierSpline.project(
        this.points[i],
        this.points[i - 2],
        this.points[i - 1]
      );
    }
    return this;
  }

  adjust3k_2() {
    for (let i = 2; i < this.points.length - 2; i += 3) {
      this.points[i] = BezierSpline.project(
        this.points[i],
        this.points[i + 1],
        this.points[i + 2]
      );
    }
    return this;
  }

  // fix tmrw
  // curvature(t: number) {
  //   const u = Math.floor(t);
  //   const tPrime = t - u;
  //   return this.sectioned[u].evaluate(tPrime);
  // }

  generateVelocities(maxVel: number, maxAccel: number, k = 3) {
    // time, velocity and angular velocity of last point to be 0
    this.spline[this.spline.length - 1][2] = 0; // time
    this.spline[this.spline.length - 1][3] = 0; // velocity
    this.spline[this.spline.length - 1][4] = 0; // angular velocity

    const altDists = [];

    for (let i = 0; i < this.sectioned.length; i++) {
      const bez = new Bernstein(this.sectioned[i].points);
      // console.log(bez);

      bez.inject(50);
      bez.generateCD();
      altDists.push(bez);
    }

    for (let i = 0; i < this.spline.length - 1; i++) {
      let u = Math.floor(this.spline[i][0]);
      let cur = Math.abs(altDists[u].curvature(this.spline[i][0] - u));
      let vel = Math.min(maxVel, k / cur);
      this.spline[i][2] = 0; // time
      this.spline[i][3] = vel; // velocity
      this.spline[i][4] = 0; // angular velocity
    }

    // velocity of all the other points
    for (let i = this.spline.length - 1; i > 0; i--) {
      const dist = Point.distance(this.spline[i][1], this.spline[i - 1][1]);
      let newVel = Math.sqrt(2 * maxAccel * dist + Math.pow(this.spline[i][3], 2));
      this.spline[i - 1][3] = Math.min(this.spline[i - 1][3], newVel);
    }

    // compute time for all points
    let runningTime = 0;
    for (let i = 0; i < this.spline.length - 1; i++) {
      const dist = Point.distance(this.spline[i][1], this.spline[i + 1][1]);
      const time = dist / this.spline[i][3];
      runningTime += time;
      this.spline[i + 1][2] = runningTime;
    }

    // compute angular velocity for all points
    for (let i = 1; i < this.spline.length - 1; i++) {
      const angularVelocity =
        calculateCurvature(
          this.spline[i - 1][1],
          this.spline[i][1],
          this.spline[i + 1][1],
          this.spline[i][2] - this.spline[i - 1][2]
        ) * this.spline[i][3];
      this.spline[i][4] = angularVelocity;
    }

    this.spline[0][4] = this.spline[1][4];
    this.spline[this.spline.length - 1][4] = this.spline[this.spline.length - 2][4];

    return this;
  }
  // returns complete spline
  // k is a value measuring how fast the bot should move at turns.
  generateSpline(distBetween: number, maxVel: number, maxAccel: number, k = 3) {
    this.spaceInject(distBetween);
    this.generateVelocities(maxVel, maxAccel, k);
    const path: [Point, number, number, number][] = [];

    // first index is point, second part is speed
    for (let i = 0; i < this.spline.length; i++) {
      path.push([
        this.spline[i][1],
        this.spline[i][2],
        this.spline[i][3],
        this.spline[i][4],
      ]);
      // console.log(this.spline[i][2]);
    }
    return path;
  }
}
