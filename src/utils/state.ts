import {
  writable,
  type Writable,
  type Unsubscriber,
  type Updater,
  get,
} from "svelte/store";
import {
  CONSTANTS,
  FSHandler,
  PathPoint,
  Point,
  type FlagType,
  type PathPointExport,
  type PathPointOptions,
  type PointExport,
} from ".";
import { backgrounds, type Background } from "./background";
import {
  pathAlgorithms,
  GeneratedPoint,
  type GeneratedPointExport,
  type PathAlgorithm,
} from "../gen";

export function customWritable<T>(initialValue: T): Writable<T> & {
  silentSet: (value: T) => void;
  silentUpdate: (updater: Updater<T>) => void;
} {
  let silent = false;
  const store = writable(initialValue);
  return {
    subscribe(run: (value: T) => void, invalidate?: () => void): Unsubscriber {
      return store.subscribe((value: T) => {
        if (!silent) {
          run(value);
        }
      }, invalidate);
    },
    set(value: T): void {
      silent = false;
      store.set(value);
    },
    silentSet(value: T): void {
      silent = true;
      store.set(value);
    },
    update(callback: Updater<T>): void {
      silent = false;
      store.update(callback);
    },
    silentUpdate(callback: Updater<T>): void {
      silent = true;
      store.update(callback);
    },
  };
}

export const points = writable<PathPoint[]>([]);

export type FlagPoint = {
  index: number;
  flags: NonNullable<PathPointOptions["flags"]>;
  flagsAny: { [key: string]: any };
  layers: number[];
};

export const flagPoints = writable<FlagPoint[]>([]);
export const addFlagPoint = (point: number) => {
  if (get(points).length < 2) return;
  flagPoints.update((f) => {
    f.push({
      index: point,
      flags: {},
      get flagsAny() {
        return this.flags as { [key: string]: any };
      },

      set flagsAny(val: any) {
        this.flags = val;
      },
      layers: [0],
    });
    return f;
  });
};

export interface PathConfig {
  algorithm: PathAlgorithm;
  background: Background;
  autosave: boolean;
  flags: { [key: string]: FlagType };
  distanceBetween: number;
  k: number;
  layers: boolean;
  bot: {
    maxVelocity: number;
    maxAcceleration: number;
    width: number;
    length: number;
  };
}

export const config = writable<PathConfig>({
  algorithm: "cubic-spline",
  background: Object.keys(backgrounds)[0] as Background,
  autosave: false,
  flags: {},
  distanceBetween: 0.5,
  k: 3,
  layers: false,
  bot: {
    maxVelocity: 24,
    maxAcceleration: 12,
    width: 14,
    length: 16,
  },
});

config.subscribe((v) => {
  if (v.autosave && !fsHandler.active) {
    alert("Please save the file before enabling autosave");
    config.update((v) => ({ ...v, autosave: false }));
  }
});

export type EditingMode = "pathPoint" | "flagPoint";

export interface PointSelection {
  type: "point";
  point: number;
}
export interface HandleSelection {
  type: "handle";
  point: number;
  handle: number;
}
export interface FlagSelection {
  type: "flag";
  flag: number;
}

export type Selection = PointSelection | HandleSelection | FlagSelection;

export interface AppState {
  selected: Selection | null;
  generatedPoints: GeneratedPoint[];
  fileHandle: FileSystemFileHandle | null;
  editingMode: EditingMode;
  handlesWhenSelected: boolean;
  visible: {
    points: boolean;
    handles: boolean;
    flags: boolean;
    bot: boolean;

    // other stuff related to rendering
    highlightIndex: number;
    coloredPath: boolean;
    layer: number;
  };
}
export const state = writable<AppState>({
  selected: null,
  generatedPoints: [],
  fileHandle: null,
  editingMode: "pathPoint",
  handlesWhenSelected: false,
  visible: {
    points: true,
    handles: true,
    flags: true,
    bot: true,

    highlightIndex: -1,
    coloredPath: true,
    layer: 0,
  },
});

export const lastSelected = writable<Selection | null>(null);

export const updateLastSelected = () => {
  const s = get(state);
  lastSelected.set(JSON.parse(JSON.stringify(s.selected)));
};

points.subscribe((p) => {
  if (p.length < 2) {
    flagPoints.set([]);
    state.update((s) => ({
      ...s,
      generatedPoints: [],
      editingMode: "pathPoint",
    }));
    return;
  }
  const method = get(config).algorithm;
  const algorithm = pathAlgorithms[method];
  const waypoints: PathPoint[] = p.map((point) => point.clone());

  state.update((s) => {
    try {
      s.generatedPoints = algorithm(waypoints, get(config).k);

      flagPoints.update((f) =>
        f.filter((flagPoint) => flagPoint.index < s.generatedPoints.length)
      );

      return s;
    } catch (e) {
      console.error("shit e:", JSON.parse(JSON.stringify(p.map((p) => p.export()))));
      console.error(e);
      return s;
    }
  });
});

config.subscribe((c) => {
  try {
    const p = get(points);
    if (p.length < 2) return state.update((s) => ({ ...s, generatedPoints: [] }));
    const method = get(config).algorithm;
    const algorithm = pathAlgorithms[method];
    const waypoints: PathPoint[] = p.map((point) => point.clone());

    state.update((s) => {
      s.generatedPoints = algorithm(waypoints, c.k);
      return s;
    });
  } catch (e) {
    console.error(e);
  }
});

const exportData = () => {
  const rawPoints = get(state).generatedPoints.map((point) => point.export());
  const generated = rawPoints.map((point) => ({ ...point, flags: {} }));
  // add flags from points
  get(points).forEach((point) => {
    if (generated.length === 0) return;
    const closest = generated.reduce((prev, curr) => {
      const prevDist = Math.hypot(prev.x - point.x, prev.y - point.y);
      const currDist = Math.hypot(curr.x - point.x, curr.y - point.y);
      return prevDist < currDist ? prev : curr;
    });
    closest.flags = point.flags;
  });

  get(flagPoints).forEach((flagPoint) => {
    if (flagPoint.index < generated.length) {
      generated[flagPoint.index].flags = flagPoint.flags;
    }
  });

  return {
    config: get(config),
    points: get(points)
      .map((point) => point.export()),
    flagPoints: get(flagPoints),
    generated: generated
      .map((point) => ({
        x: Math.round(point.x * 100),
        y: Math.round(point.y * 100),
				time: Math.round(point.time * 100),
				speed: Math.round(point.speed * 100),
				angular: Math.round(point.angular * 100),
				flags: point.flags
      })),
    version: CONSTANTS.version,
  };
};

const importData = (data: any) => {
  if (!data.config || !data.points || !data.version)
    throw alert("invalid file" + (!data.version ? " (no version)" : ""));
  if (
    data.version !== CONSTANTS.version &&
    !confirm(
      "This file was created with a different version of the app. Some features may not work as expected. Do you want to continue?"
    )
  )
    return;
  points.set(
    data.points.map(
      (point: any) =>
        new PathPoint(point.x, point.y, {
          flags: point.flags,
          handles: point.handles,
          reverse: point.reverse,
          layers: point.layers,
        })
    )
  );
  flagPoints.set(data.flagPoints);

  config.set(data.config);
  clearHistory();
};

export interface HistoryState {
  points: PathPointExport[];
  flagPoints: FlagPoint[];
  state: Omit<AppState, "generatedPoints"> & {
    generatedPoints: GeneratedPointExport[];
  };
  config: PathConfig;
}

export const history = writable<HistoryState[]>([]);
const initialState = writable<HistoryState>();

export const undo = (extra = 0) => {
  history.update((h) => {
    h.pop();
    for (let i = 0; i < extra; i++) h.pop();
    const last = h[h.length - 1];
    if (last) {
      points.set(last.points.map((point) => PathPoint.from(point)));
      // state.set({
      //   ...last.state,
      //   generatedPoints: last.state.generatedPoints.map((point) =>
      //     GeneratedPoint.from(point)
      //   ),
      // });
      config.set(last.config);
      flagPoints.set(last.flagPoints);
    } else {
      history.set([get(initialState)]);
    }
    return h;
  });
};

export const clearHistory = () => {
  history.set([]);
};

export const pushHistory = (isInitial = false) => {
  const p = get(points);
  const s = get(state);
  const c = get(config);
  const f = get(flagPoints);

  if (isInitial) {
    initialState.set({
      points: p.map((point) => point.export()),
      flagPoints: f,
      state: {
        ...JSON.parse(JSON.stringify(s)),
        generatedPoints: s.generatedPoints.map((point) => point.export()),
      },
      config: JSON.parse(JSON.stringify(c)),
    });
  }

  history.update((h) => {
    h.push({
      points: p.map((point) => point.export()),
      flagPoints: get(flagPoints),
      state: {
        ...JSON.parse(JSON.stringify(s)),
        generatedPoints: s.generatedPoints.map((point) => point.export()),
      },
      config: JSON.parse(JSON.stringify(c)),
    });
    return h;
  });
};

if (get(history).length === 0) pushHistory(true);

const fsHandler = new FSHandler();

export const load = () => {
  fsHandler.open().then((content) => {
    const data = JSON.parse(content);
    try {
      importData(data);
    } catch {}
  });
};

export const saveState = writable(-1);

const write =
  (newFile = false) =>
  () => {
    fsHandler.write(JSON.stringify(exportData()), newFile);
    saveState.set(-1);
  };

export const save = () => {
  const cur = get(saveState);
  if (cur >= 0) clearTimeout(cur);
  saveState.set(setTimeout(write(false), CONSTANTS.saveTimeout));
};

export const saveAs = () => {
  const cur = get(saveState);
  if (cur >= 0) clearTimeout(cur);
  saveState.set(setTimeout(write(true), CONSTANTS.saveTimeout));
};

points.subscribe(() => {
  if (get(config).autosave) save();
});

config.subscribe(() => {
  if (get(config).autosave) save();
});

export const addFlag = (flag: string, type: FlagType, overWrite = false) => {
  if (flag in get(config).flags && !overWrite) throw new Error("Flag already exists");
  config.update((c) => {
    c.flags[flag] = type;
    return c;
  });
};

export const removeFlag = (flag: string) => {
  config.update((c) => {
    delete c.flags[flag];
    return c;
  });
};
