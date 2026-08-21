import { createEffect, onCleanup, type JSX } from "solid-js";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent, MarkPointComponent, MarkLineComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { TokenChartMeta, TokenChartPeriod, TokenChartPoint } from "@/shared/token-chart";
import { buildTokenChartOptions } from "./chart-options";

echarts.use([LineChart, GridComponent, TooltipComponent, VisualMapComponent, MarkPointComponent, MarkLineComponent, CanvasRenderer]);

export function SentimentChart(props: {
  points: TokenChartPoint[];
  meta: TokenChartMeta;
  dark: boolean;
  period: TokenChartPeriod;
}): JSX.Element {
  let containerRef!: HTMLDivElement;
  let chart: echarts.ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;

  createEffect(() => {
    if (!chart) {
      chart = echarts.init(containerRef, null, { renderer: "canvas" });
      resizeObserver = new ResizeObserver(() => chart?.resize());
      resizeObserver.observe(containerRef);
    }
    chart.setOption(buildTokenChartOptions(props.points, props.meta, props.dark, props.period), true);
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    chart?.dispose();
    chart = null;
  });

  return <div ref={containerRef} class="token-chart" />;
}
