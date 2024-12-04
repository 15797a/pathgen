import { config, GeneratedPoint, type PathConfig, type PathPoint } from "$utils";
import { get } from "svelte/store";

export const linear = (path: PathPoint[], _: number) => {
  if (path.length < 2) {
    return [];
  }

  let conf = get(config);

  let reverse = !path[0].reverse;
  const points = path.map((point, idx) => {
    if (idx !== 0 && point.reverse) reverse = !reverse;
    return new GeneratedPoint(
      point.x,
      point.y,
      conf.bot.maxVelocity * (reverse ? -1 : 1),
      idx
    );
  });

  return points;
};
