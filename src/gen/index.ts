import { PathPoint } from "$utils/pathPoint";
import { catmullRom } from "./catmullRom";
import { bezier } from "./bezier";
import { linear } from "./linear";
import type { GeneratedPoint } from "./utils";

export * from "./catmullRom";
export * from "./utils";

export type PathAlgorithm = "catmull-rom" | "cubic-spline" | "linear";
export const pathAlgorithms: {
  [key in PathAlgorithm]: (path: PathPoint[], k: number) => GeneratedPoint[];
} = {
  "catmull-rom": catmullRom,
  "cubic-spline": bezier,
	"linear": linear,
  // "cubic-spline": cubicSplineV2,
};
