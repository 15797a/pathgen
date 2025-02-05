import type { PathPoint } from "$utils/pathPoint";
import { GeneratedPoint, Point, config as configStore } from "$utils";
import { bezier } from "./core";
import { get } from "svelte/store";

const inner_cubicSpline = (path: Point[], k = 3): GeneratedPoint[] => {
  if (path.length < 4) return [];

  const config = get(configStore);
  return bezier(path, k, config.bot.maxVelocity, config.bot.maxAcceleration);
};

const cubicSpline = (path: PathPoint[], k = 3): GeneratedPoint[] => {
  if (path.length < 2) {
    return [];
  }

  const paths: Point[][] = [];
  let reverse = !path[0].reverse;
  paths.push([Point.from(path[0]), Point.from(path[0].handles[0].add(path[0]))]);

  path.slice(1, path.length - 1).forEach((point) => {
    paths.at(-1)!.push(Point.from(point.handles[0].add(point)), Point.from(point));
    if (point.reverse) {
      paths.push([Point.from(point), Point.from(point.handles[1].add(point))]);
    } else {
      paths.at(-1)!.push(Point.from(point.handles[1].add(point)));
    }
  });

  paths
    .at(-1)
    ?.push(
      Point.from(path.at(-1)!.handles[0].add(path.at(-1)!)),
      Point.from(path.at(-1)!)
    );

  const generatedPaths = paths
    // generation
    .map((p) => inner_cubicSpline(p, k))
    // apply reversing to speeds
    .map((gen) => {
      reverse = !reverse;

      return reverse
        ? gen.map((point) => {
            point.speed *= -1;
            return point;
          })
        : gen;
    })
    // remove duplicate points
    .map((gen, i) => (i === 0 ? gen : gen.slice(1)))
    .map((segment, i, arr) => {
      if (i === 0) return segment;
      const last = arr[i - 1].at(-1);
      return segment.map((point) => {
        point.time += last!.time;
        return point;
      });
    });
  return generatedPaths.flat();
};

export { cubicSpline as bezier };
