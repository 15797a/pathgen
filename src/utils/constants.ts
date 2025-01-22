import type { Point } from "$utils";

export const CONSTANTS = {
	scale: 72, // grid goes from (-scale, -scale) to (scale, scale)
	barriers: [
		// [new Point(-22.86, 46.77), new Point(22.86, 46.77)],
		// [new Point(0, 46.77), new Point(0, -46.77)],
		// [new Point(-22.86, -46.77), new Point(22.86, -46.77)],
	] as Point[][],
	point: {
		color: "#FF9999",
		hover: "#FFCCCC",
		selected: "#FF0000",
		radius: 1,
		border: {
			color: "white",
			thickness: 0.1,
		},

		handle: {
			color: "#9999FF",
			hover: "#CCCCFF",
			selected: "#0000FF",
			radius: 0.8,
			border: {
				color: "white",
				thickness: 0.1,
			},
			link: {
				color: "#FFFFFF",
				thickness: 0.2,
			},
		},
	},
	path: {
		color: "#00FF00",
		error: "#FF0000",
		thickness: 0.2,
	},
	flag: {
		color: "#B39DDB",
		hover: "#C4AEEC",
		selected: "#673AB7",
		radius: 0.9,
		border: {
			color: "white",
			thickness: 0.1,
		},
	},

	bot: {
		color: "#FFFFFF",
		thickness: 0.2,
	},

	saveTimeout: 1000,
	version: "1.0.0",
} as const;
