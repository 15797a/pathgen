<script lang="ts">
  import { onMount } from "svelte";
  import { config, state } from "./state";
  import { Point } from "./point";

  let canvas: HTMLCanvasElement | null = null;
  $: width = canvas ? canvas?.parentElement?.offsetWidth! - 0.0001 : 100;

  const modes = [
    {
      name: "speed",
      color: "white",
    },
    {
      name: "angular",
      color: "#fb923c",
    },
    {
      name: "time",
      color: "#22d3ee",
    },
  ] as const;

  let selectedMode = 0;
  const toggleMode = () => {
    selectedMode = (selectedMode + 1) % modes.length;
  };

  $: mode = modes[selectedMode];

  const margin = {
    top: 30,
    left: 60,
    right: 30,
    bottom: 40,
  };
  const lineWidth = 2;
  onMount(() => {
    const removableListeners: [EventTarget, string, Function][] = [];
    const bindRemovable = <T extends EventTarget, K extends keyof HTMLElementEventMap>(
      item: T,
      event: K,
      listener: (this: T, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ) => {
      // @ts-ignore
      item.addEventListener(event, listener, options);

      // Return a function to remove the event listener
      removableListeners.push([item, event, listener]);
    };

    let mouse: number | null = null;

    bindRemovable(window, "mousemove", (e) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse =
        e.clientY > rect.top + margin.top && e.clientY < rect.bottom - margin.bottom
          ? e.clientX - rect.left
          : null;
    });

    let animationId = 0;
    const render = () => {
      if (!canvas || $state.generatedPoints.length < 2) {
        animationId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = ctx.fillStyle = mode.color;
      ctx.setLineDash([10, 10]);

      ctx.lineWidth = lineWidth;

      // CHART LINES
      // left line
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top);
      ctx.lineTo(margin.left, canvas.height - margin.bottom);
      ctx.stroke();

      // bottom line
      ctx.beginPath();
      ctx.moveTo(margin.left, canvas.height - margin.bottom);
      ctx.lineTo(canvas.width - margin.right, canvas.height - margin.bottom);
      ctx.stroke();

      // middle horizontal line
      ctx.setLineDash([3, 17]);
      ctx.beginPath();
      ctx.moveTo(
        margin.left,
        margin.top + (canvas.height - margin.bottom - margin.top) / 2
      );
      ctx.lineTo(
        canvas.width - margin.right,
        margin.top + (canvas.height - margin.bottom - margin.top) / 2
      );
      ctx.stroke();

      // LEFT NUMBERS
      ctx.font = "15px monospace";

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      const max =
        mode.name === "speed"
          ? $config.bot.maxVelocity
          : $state.generatedPoints.reduce(
              (a, b) => Math.max(a, b[mode.name]),
              $state.generatedPoints[0][mode.name]
            );
      const min =
        mode.name === "speed"
          ? -$config.bot.maxVelocity
          : $state.generatedPoints.reduce(
              (a, b) => Math.min(a, b[mode.name]),
              $state.generatedPoints[0][mode.name]
            );

      ctx.fillStyle = mode.color;

      // top number
      ctx.fillText(max.toFixed(2), margin.left - 5, margin.top);

      // middle number
      ctx.fillText(
        ((max + min) / 2).toFixed(2),
        margin.left - 5,
        margin.top + (canvas.height - margin.bottom - margin.top) / 2
      );

      // bottom number
      ctx.fillText(min.toFixed(2), margin.left - 5, canvas.height - margin.bottom);

      // BOTTOM NUMBERS
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // left number
      ctx.fillText("0", margin.left, canvas.height - margin.bottom + 5);

      // right number
      ctx.fillText(
        $state.generatedPoints.length.toString(),
        canvas.width - margin.right,
        canvas.height - margin.bottom + 5
      );

      // GRAPH
      ctx.setLineDash([]);
      for (let i = 0; i < $state.generatedPoints.length - 1; i++) {
        const start = $state.generatedPoints[i];
        const end = $state.generatedPoints[i + 1];

        const graphSegment = (
          from: number,
          to: number,
          min: number,
          max: number,
          color: string
        ) => {
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(
            margin.left +
              (i * (canvas!.width - margin.left - margin.right)) /
                ($state.generatedPoints.length - 1),
            margin.top +
              (canvas!.height - margin.bottom - margin.top) *
                (1 - (from - min) / (max - min))
          );
          ctx.lineTo(
            margin.left +
              ((i + 1) * (canvas!.width - margin.left - margin.right)) /
                ($state.generatedPoints.length - 1),
            margin.top +
              (canvas!.height - margin.bottom - margin.top) *
                (1 - (to - min) / (max - min))
          );
          ctx.stroke();
        };

        graphSegment(
          start.speed,
          end.speed,
          -$config.bot.maxVelocity,
          $config.bot.maxVelocity,
          "white"
        );
        graphSegment(
          start.angular,
          end.angular,
          $state.generatedPoints.reduce(
            (a, b) => Math.min(a, b.angular),
            $state.generatedPoints[0].angular
          ),
          $state.generatedPoints.reduce(
            (a, b) => Math.max(a, b.angular),
            $state.generatedPoints[0].angular
          ),
          "#fb923c"
        );
        graphSegment(
          start.time,
          end.time,
          0,
          $state.generatedPoints.reduce(
            (a, b) => Math.max(a, b.time),
            $state.generatedPoints[0].time
          ),
          "#22d3ee"
        );

        // MOUSE LINE
        ctx.strokeStyle = "white";
        if (mouse && mouse > margin.left && mouse < canvas.width - margin.right) {
          ctx.beginPath();
          ctx.moveTo(mouse, margin.top);
          ctx.lineTo(mouse, canvas.height - margin.bottom);
          ctx.stroke();

          $state.visible.highlightIndex = Math.round(
            (($state.generatedPoints.length - 1) * (mouse - margin.left)) /
              (canvas.width - margin.left - margin.right)
          );

          // write speed value of selected point at top right
          ctx.font = "20px monospace";
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(
            $state.generatedPoints[$state.visible.highlightIndex][mode.name].toFixed(2),
            canvas.width - margin.right - 20,
            margin.top - 3
          );
        } else $state.visible.highlightIndex = -1;
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      removableListeners.forEach((removable) =>
        removable[0].removeEventListener(removable[1], removable[2] as any)
      );

      cancelAnimationFrame(animationId);
    };
  });
</script>

<div class="border-2 border-white rounded-3xl overflow-hidden">
  <canvas bind:this={canvas} {width} height="200" on:mousedown={toggleMode}></canvas>
</div>
