import { PathPoint } from "$utils/pathPoint";
import { catmullRom } from "./catmullRom";
import { cubicSpline } from "./cubicSpline";
import type { GeneratedPoint } from "./utils";

export * from "./catmullRom";
export * from "./cubicSpline";
export * from "./utils";

export type PathAlgorithm = "catmull-rom" | "cubic-spline";
export const pathAlgorithms: {
  [key in PathAlgorithm]: (path: PathPoint[], k: number) => GeneratedPoint[];
} = {
  "catmull-rom": catmullRom,
  "cubic-spline": cubicSpline,
  // "cubic-spline": cubicSplineV2,
};
