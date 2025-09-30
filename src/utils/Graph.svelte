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
  ] as const;

  let selectedMode = 0;
  const toggleMode = () => {
    selectedMode = (selectedMode + 1) % modes.length;
  };

  // simulation state
  let simActive = false;
  let simStartTime = 0; // seconds along path timeline
  let simPerfStart = 0; // performance.now() reference (ms)

  const stopSimulation = () => {
    simActive = false;
    $state.visible.highlightIndex = -1;
  };

  const startSimulationAt = (time: number) => {
    const points = $state.generatedPoints;
    if (points.length < 2) return;
    const maxTime = points[points.length - 1].time;
    simStartTime = Math.max(0, Math.min(time, maxTime));
    simPerfStart = performance.now();
    simActive = true;
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!canvas) return;
    // right click (button 2) toggles mode
    if (e.button === 2) {
      toggleMode();
      return;
    }
    if (e.button !== 0) return;
    const points = $state.generatedPoints;
    if (points.length < 2) return;
    const maxTime = points[points.length - 1].time;
    if (simActive) {
      stopSimulation();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < margin.left || x > canvas.width - margin.right) return; // outside graph area
    const rel = (x - margin.left) / (canvas.width - margin.left - margin.right);
    const startTime = rel * maxTime;
    startSimulationAt(startTime);
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

      const maxTime = $state.generatedPoints.length > 0 
        ? $state.generatedPoints[$state.generatedPoints.length - 1].time 
        : 0;

      // left number (starting time)
      ctx.fillText("0s", margin.left, canvas.height - margin.bottom + 5);

      // right number (ending time)
      ctx.fillText(
        maxTime.toFixed(2) + "s",
        canvas.width - margin.right,
        canvas.height - margin.bottom + 5
      );

      // GRAPH
      ctx.setLineDash([]);
      // advance simulation if active
      if (simActive) {
        const pts = $state.generatedPoints;
        const maxTime = pts[pts.length - 1].time;
        const elapsed = (performance.now() - simPerfStart) / 1000; // s
        const currentTime = simStartTime + elapsed;
        if (currentTime >= maxTime) {
          stopSimulation();
        } else {
          // find first index with time >= currentTime
            let idx = pts.findIndex((p) => p.time >= currentTime);
            if (idx === -1) idx = pts.length - 1;
            $state.visible.highlightIndex = idx;
        }
      }

      for (let i = 0; i < $state.generatedPoints.length - 1; i++) {
        const start = $state.generatedPoints[i];
        const end = $state.generatedPoints[i + 1];

        const startTime = start.time;
        const endTime = end.time;

        const graphSegment = (
          from: number,
          to: number,
          min: number,
          max: number,
          color: string
        ) => {
          ctx.strokeStyle = color;
          ctx.beginPath();
          const xStart = maxTime > 0 
            ? margin.left + (startTime * (canvas!.width - margin.left - margin.right)) / maxTime
            : margin.left;
          const xEnd = maxTime > 0 
            ? margin.left + (endTime * (canvas!.width - margin.left - margin.right)) / maxTime
            : margin.left;
          
          ctx.moveTo(
            xStart,
            margin.top +
              (canvas!.height - margin.bottom - margin.top) *
                (1 - (from - min) / (max - min))
          );
          ctx.lineTo(
            xEnd,
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

        // MOUSE LINE (disabled during simulation)
        if (!simActive) {
          ctx.strokeStyle = "white";
          if (mouse && mouse > margin.left && mouse < canvas.width - margin.right) {
            ctx.beginPath();
            ctx.moveTo(mouse, margin.top);
            ctx.lineTo(mouse, canvas.height - margin.bottom);
            ctx.stroke();

            const maxTime = $state.generatedPoints[$state.generatedPoints.length - 1].time;
            if (maxTime > 0) {
              const mouseTime = (maxTime * (mouse - margin.left)) /
                (canvas.width - margin.left - margin.right);
              let closestIndex = 0;
              let minTimeDiff = Math.abs($state.generatedPoints[0].time - mouseTime);
              for (let j = 1; j < $state.generatedPoints.length; j++) {
                const timeDiff = Math.abs($state.generatedPoints[j].time - mouseTime);
                if (timeDiff < minTimeDiff) {
                  minTimeDiff = timeDiff;
                  closestIndex = j;
                }
              }
              $state.visible.highlightIndex = closestIndex;
            } else {
              $state.visible.highlightIndex = Math.round(
                (($state.generatedPoints.length - 1) * (mouse - margin.left)) /
                  (canvas.width - margin.left - margin.right)
              );
            }

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
  <canvas bind:this={canvas} {width} height="200" on:mousedown={handleMouseDown} on:contextmenu={(e)=>e.preventDefault()}></canvas>
</div>
