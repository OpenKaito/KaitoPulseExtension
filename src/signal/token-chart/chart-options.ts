import type { EChartsCoreOption } from "echarts/core";
import type { TokenChartMeta, TokenChartPeriod, TokenChartPoint } from "@/shared/token-chart";

const SENTIMENT_POS_COLOR = "#28af7f";
const SENTIMENT_NEG_COLOR = "#d8494a";

const SENTIMENT_AREA_POS_COLOR = "rgba(22, 211, 143, 0.8)";
const SENTIMENT_AREA_NEG_COLOR = "rgba(216, 73, 74, 0.8)";
const NO_DATA_COLOR = "rgba(255,255,255,0.4)";

const EVENT_DOT_COLOR = "#9FFFEF";
const EVENT_DOT_HOVER_BORDER = "rgba(255, 255, 255, 0.2)";

const TOOLTIP_BORDER_COLOR = "#474F5C";

const EVENT_AI_BADGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="15" viewBox="0 0 96 15" fill="none" style="display:block">' +
  '<rect width="96" height="15" rx="2" fill="white" fill-opacity="0.1"/>' +
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M7.99999 11.8175C8.66216 11.8175 9.79438 10.954 9.79438 7.49982C9.79438 4.04567 8.66216 3.18213 7.99999 3.18213C7.33784 3.18213 6.20562 4.10386 6.20562 7.49982C6.20562 10.8958 7.33784 11.8175 7.99999 11.8175Z" stroke="white" stroke-opacity="0.6" stroke-width="0.666667" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.11509 9.76149C4.44617 10.3397 5.78927 10.8761 8.89721 9.06675C12.0051 7.25744 12.216 5.81642 11.8849 5.23819C11.5538 4.65997 10.1584 4.15408 7.10284 5.93293C4.04725 7.71176 3.78401 9.18327 4.11509 9.76149Z" stroke="white" stroke-opacity="0.6" stroke-width="0.666667" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.11507 5.23819C3.78399 5.81642 3.99487 7.25744 7.10282 9.06675C10.2108 10.8761 11.5538 10.3397 11.8849 9.76149C12.216 9.18327 11.9528 7.71176 8.89717 5.93293C5.8416 4.15408 4.44615 4.65997 4.11507 5.23819Z" stroke="white" stroke-opacity="0.6" stroke-width="0.666667" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M20.07 7.23H22.54V10.73C22.1533 10.8567 21.7633 10.95 21.37 11.01C20.9767 11.07 20.53 11.1 20.03 11.1C19.29 11.1 18.6667 10.9533 18.16 10.66C17.6533 10.36 17.2667 9.93667 17 9.39C16.74 8.83667 16.61 8.18333 16.61 7.43C16.61 6.68333 16.7567 6.03667 17.05 5.49C17.3433 4.94333 17.7633 4.52 18.31 4.22C18.8633 3.91333 19.53 3.76 20.31 3.76C20.71 3.76 21.0867 3.79667 21.44 3.87C21.8 3.94333 22.1333 4.04667 22.44 4.18L22.1 4.96C21.8467 4.84667 21.56 4.75 21.24 4.67C20.9267 4.59 20.6 4.55 20.26 4.55C19.6933 4.55 19.2067 4.66667 18.8 4.9C18.3933 5.13333 18.0833 5.46667 17.87 5.9C17.6567 6.32667 17.55 6.83667 17.55 7.43C17.55 7.99667 17.64 8.5 17.82 8.94C18.0067 9.37333 18.2967 9.71333 18.69 9.96C19.0833 10.2 19.6 10.32 20.24 10.32C20.4533 10.32 20.64 10.3133 20.8 10.3C20.9667 10.28 21.1167 10.2567 21.25 10.23C21.39 10.2033 21.52 10.1767 21.64 10.15V8.03H20.07V7.23ZM26.1954 5.54C26.6554 5.54 27.0487 5.64 27.3754 5.84C27.7087 6.04 27.9621 6.32333 28.1354 6.69C28.3154 7.05 28.4054 7.47333 28.4054 7.96V8.49H24.7354C24.7487 9.09667 24.9021 9.56 25.1954 9.88C25.4954 10.1933 25.9121 10.35 26.4454 10.35C26.7854 10.35 27.0854 10.32 27.3454 10.26C27.6121 10.1933 27.8854 10.1 28.1654 9.98V10.75C27.8921 10.87 27.6221 10.9567 27.3554 11.01C27.0887 11.07 26.7721 11.1 26.4054 11.1C25.8987 11.1 25.4487 10.9967 25.0554 10.79C24.6687 10.5833 24.3654 10.2767 24.1454 9.87C23.9321 9.45667 23.8254 8.95333 23.8254 8.36C23.8254 7.77333 23.9221 7.27 24.1154 6.85C24.3154 6.43 24.5921 6.10667 24.9454 5.88C25.3054 5.65333 25.7221 5.54 26.1954 5.54ZM26.1854 6.26C25.7654 6.26 25.4321 6.39667 25.1854 6.67C24.9454 6.93667 24.8021 7.31 24.7554 7.79H27.4854C27.4854 7.48333 27.4387 7.21667 27.3454 6.99C27.2521 6.76333 27.1087 6.58667 26.9154 6.46C26.7287 6.32667 26.4854 6.26 26.1854 6.26ZM32.3499 5.54C32.9899 5.54 33.4733 5.69667 33.7999 6.01C34.1266 6.31667 34.2899 6.81667 34.2899 7.51V11H33.4199V7.57C33.4199 7.13667 33.3233 6.81333 33.1299 6.6C32.9366 6.38667 32.6333 6.28 32.2199 6.28C31.6266 6.28 31.2166 6.44667 30.9899 6.78C30.7633 7.11333 30.6499 7.59333 30.6499 8.22V11H29.7699V5.64H30.4799L30.6099 6.37H30.6599C30.7799 6.18333 30.9266 6.03 31.0999 5.91C31.2799 5.78333 31.4766 5.69 31.6899 5.63C31.9033 5.57 32.1233 5.54 32.3499 5.54ZM38.0216 5.54C38.4816 5.54 38.8749 5.64 39.2016 5.84C39.5349 6.04 39.7882 6.32333 39.9616 6.69C40.1416 7.05 40.2316 7.47333 40.2316 7.96V8.49H36.5616C36.5749 9.09667 36.7282 9.56 37.0216 9.88C37.3216 10.1933 37.7382 10.35 38.2716 10.35C38.6116 10.35 38.9116 10.32 39.1716 10.26C39.4382 10.1933 39.7116 10.1 39.9916 9.98V10.75C39.7182 10.87 39.4482 10.9567 39.1816 11.01C38.9149 11.07 38.5982 11.1 38.2316 11.1C37.7249 11.1 37.2749 10.9967 36.8816 10.79C36.4949 10.5833 36.1916 10.2767 35.9716 9.87C35.7582 9.45667 35.6516 8.95333 35.6516 8.36C35.6516 7.77333 35.7482 7.27 35.9416 6.85C36.1416 6.43 36.4182 6.10667 36.7716 5.88C37.1316 5.65333 37.5482 5.54 38.0216 5.54ZM38.0116 6.26C37.5916 6.26 37.2582 6.39667 37.0116 6.67C36.7716 6.93667 36.6282 7.31 36.5816 7.79H39.3116C39.3116 7.48333 39.2649 7.21667 39.1716 6.99C39.0782 6.76333 38.9349 6.58667 38.7416 6.46C38.5549 6.32667 38.3116 6.26 38.0116 6.26ZM44.0961 5.54C44.1961 5.54 44.3028 5.54667 44.4161 5.56C44.5361 5.56667 44.6394 5.58 44.7261 5.6L44.6161 6.41C44.5294 6.39 44.4328 6.37333 44.3261 6.36C44.2261 6.34667 44.1294 6.34 44.0361 6.34C43.8294 6.34 43.6328 6.38333 43.4461 6.47C43.2594 6.55667 43.0928 6.68 42.9461 6.84C42.7994 6.99333 42.6828 7.18 42.5961 7.4C42.5161 7.62 42.4761 7.86667 42.4761 8.14V11H41.5961V5.64H42.3161L42.4161 6.62H42.4561C42.5694 6.42 42.7061 6.24 42.8661 6.08C43.0261 5.91333 43.2094 5.78333 43.4161 5.69C43.6228 5.59 43.8494 5.54 44.0961 5.54ZM47.5616 5.55C48.215 5.55 48.6983 5.69333 49.0116 5.98C49.325 6.26667 49.4816 6.72333 49.4816 7.35V11H48.8416L48.6716 10.24H48.6316C48.4783 10.4333 48.3183 10.5967 48.1516 10.73C47.9916 10.8567 47.805 10.95 47.5916 11.01C47.385 11.07 47.1316 11.1 46.8316 11.1C46.5116 11.1 46.2216 11.0433 45.9616 10.93C45.7083 10.8167 45.5083 10.6433 45.3616 10.41C45.215 10.17 45.1416 9.87 45.1416 9.51C45.1416 8.97667 45.3516 8.56667 45.7716 8.28C46.1916 7.98667 46.8383 7.82667 47.7116 7.8L48.6216 7.77V7.45C48.6216 7.00333 48.525 6.69333 48.3316 6.52C48.1383 6.34667 47.865 6.26 47.5116 6.26C47.2316 6.26 46.965 6.30333 46.7116 6.39C46.4583 6.47 46.2216 6.56333 46.0016 6.67L45.7316 6.01C45.965 5.88333 46.2416 5.77667 46.5616 5.69C46.8816 5.59667 47.215 5.55 47.5616 5.55ZM47.8216 8.41C47.155 8.43667 46.6916 8.54333 46.4316 8.73C46.1783 8.91667 46.0516 9.18 46.0516 9.52C46.0516 9.82 46.1416 10.04 46.3216 10.18C46.5083 10.32 46.745 10.39 47.0316 10.39C47.485 10.39 47.8616 10.2667 48.1616 10.02C48.4616 9.76667 48.6116 9.38 48.6116 8.86V8.38L47.8216 8.41ZM52.9271 10.38C53.0604 10.38 53.1971 10.37 53.3371 10.35C53.4771 10.3233 53.5904 10.2967 53.6771 10.27V10.94C53.5838 10.9867 53.4504 11.0233 53.2771 11.05C53.1038 11.0833 52.9371 11.1 52.7771 11.1C52.4971 11.1 52.2371 11.0533 51.9971 10.96C51.7638 10.86 51.5738 10.69 51.4271 10.45C51.2804 10.21 51.2071 9.87333 51.2071 9.44V6.32H50.4471V5.9L51.2171 5.55L51.5671 4.41H52.0871V5.64H53.6371V6.32H52.0871V9.42C52.0871 9.74667 52.1638 9.99 52.3171 10.15C52.4771 10.3033 52.6804 10.38 52.9271 10.38ZM56.8204 5.54C57.2804 5.54 57.6737 5.64 58.0004 5.84C58.3337 6.04 58.5871 6.32333 58.7604 6.69C58.9404 7.05 59.0304 7.47333 59.0304 7.96V8.49H55.3604C55.3737 9.09667 55.5271 9.56 55.8204 9.88C56.1204 10.1933 56.5371 10.35 57.0704 10.35C57.4104 10.35 57.7104 10.32 57.9704 10.26C58.2371 10.1933 58.5104 10.1 58.7904 9.98V10.75C58.5171 10.87 58.2471 10.9567 57.9804 11.01C57.7137 11.07 57.3971 11.1 57.0304 11.1C56.5237 11.1 56.0737 10.9967 55.6804 10.79C55.2937 10.5833 54.9904 10.2767 54.7704 9.87C54.5571 9.45667 54.4504 8.95333 54.4504 8.36C54.4504 7.77333 54.5471 7.27 54.7404 6.85C54.9404 6.43 55.2171 6.10667 55.5704 5.88C55.9304 5.65333 56.3471 5.54 56.8204 5.54ZM56.8104 6.26C56.3904 6.26 56.0571 6.39667 55.8104 6.67C55.5704 6.93667 55.4271 7.31 55.3804 7.79H58.1104C58.1104 7.48333 58.0637 7.21667 57.9704 6.99C57.8771 6.76333 57.7337 6.58667 57.5404 6.46C57.3537 6.32667 57.1104 6.26 56.8104 6.26ZM62.2949 11.1C61.6283 11.1 61.0949 10.87 60.6949 10.41C60.2949 9.94333 60.0949 9.25 60.0949 8.33C60.0949 7.41 60.2949 6.71667 60.6949 6.25C61.1016 5.77667 61.6383 5.54 62.3049 5.54C62.5849 5.54 62.8283 5.57667 63.0349 5.65C63.2416 5.71667 63.4216 5.81 63.5749 5.93C63.7283 6.05 63.8583 6.18333 63.9649 6.33H64.0249C64.0183 6.24333 64.0049 6.11667 63.9849 5.95C63.9716 5.77667 63.9649 5.64 63.9649 5.54V3.4H64.8449V11H64.1349L64.0049 10.28H63.9649C63.8583 10.4333 63.7283 10.5733 63.5749 10.7C63.4216 10.82 63.2383 10.9167 63.0249 10.99C62.8183 11.0633 62.5749 11.1 62.2949 11.1ZM62.4349 10.37C63.0016 10.37 63.3983 10.2167 63.6249 9.91C63.8583 9.59667 63.9749 9.12667 63.9749 8.5V8.34C63.9749 7.67333 63.8649 7.16333 63.6449 6.81C63.4249 6.45 63.0183 6.27 62.4249 6.27C61.9516 6.27 61.5949 6.46 61.3549 6.84C61.1216 7.21333 61.0049 7.71667 61.0049 8.35C61.0049 8.99 61.1216 9.48667 61.3549 9.84C61.5949 10.1933 61.9549 10.37 62.4349 10.37ZM70.0249 5.25C70.0249 5.47667 70.0183 5.69 70.0049 5.89C69.9983 6.08333 69.9883 6.23667 69.9749 6.35H70.0249C70.1783 6.12333 70.3883 5.93333 70.6549 5.78C70.9216 5.62667 71.2649 5.55 71.6849 5.55C72.3516 5.55 72.8849 5.78333 73.2849 6.25C73.6916 6.71 73.8949 7.4 73.8949 8.32C73.8949 8.93333 73.8016 9.44667 73.6149 9.86C73.4349 10.2733 73.1783 10.5833 72.8449 10.79C72.5116 10.9967 72.1249 11.1 71.6849 11.1C71.2649 11.1 70.9216 11.0233 70.6549 10.87C70.3883 10.7167 70.1783 10.5333 70.0249 10.32H69.9549L69.7749 11H69.1449V3.4H70.0249V5.25ZM71.5349 6.28C71.1549 6.28 70.8549 6.35333 70.6349 6.5C70.4149 6.64 70.2583 6.86 70.1649 7.16C70.0716 7.45333 70.0249 7.83 70.0249 8.29V8.33C70.0249 8.99 70.1316 9.49667 70.3449 9.85C70.5649 10.1967 70.9683 10.37 71.5549 10.37C72.0349 10.37 72.3916 10.1933 72.6249 9.84C72.8649 9.48667 72.9849 8.97667 72.9849 8.31C72.9849 7.63667 72.8649 7.13 72.6249 6.79C72.3916 6.45 72.0283 6.28 71.5349 6.28ZM74.262 5.64H75.202L76.362 8.69C76.4286 8.87 76.4886 9.04333 76.542 9.21C76.602 9.37667 76.6553 9.54 76.702 9.7C76.7486 9.85333 76.7853 10.0033 76.812 10.15H76.852C76.892 9.98333 76.9553 9.76667 77.042 9.5C77.1286 9.22667 77.2186 8.95333 77.312 8.68L78.402 5.64H79.352L77.042 11.74C76.9153 12.0733 76.7653 12.3633 76.592 12.61C76.4253 12.8633 76.2186 13.0567 75.972 13.19C75.732 13.33 75.4386 13.4 75.092 13.4C74.932 13.4 74.792 13.39 74.672 13.37C74.552 13.3567 74.4486 13.34 74.362 13.32V12.62C74.4353 12.6333 74.522 12.6467 74.622 12.66C74.7286 12.6733 74.8386 12.68 74.952 12.68C75.1586 12.68 75.3353 12.64 75.482 12.56C75.6353 12.4867 75.7653 12.3767 75.872 12.23C75.9786 12.09 76.0686 11.9233 76.142 11.73L76.422 11.02L74.262 5.64ZM87.3973 11L86.5373 8.79H83.7073L82.8573 11H81.9473L84.7373 3.83H85.5473L88.3273 11H87.3973ZM85.4673 5.83C85.4473 5.77667 85.4139 5.68 85.3673 5.54C85.3206 5.4 85.2739 5.25667 85.2273 5.11C85.1873 4.95667 85.1539 4.84 85.1273 4.76C85.0939 4.89333 85.0573 5.03 85.0173 5.17C84.9839 5.30333 84.9473 5.42667 84.9073 5.54C84.8739 5.65333 84.8439 5.75 84.8173 5.83L84.0073 7.99H86.2673L85.4673 5.83ZM91.314 11H88.734V10.48L89.574 10.29V4.58L88.734 4.38V3.86H91.314V4.38L90.474 4.58V10.29L91.314 10.48V11Z" fill="white" fill-opacity="0.6"/>' +
  "</svg>";

function paletteFor(dark: boolean) {
  return {

    price: dark ? "rgba(255, 255, 255, 0.4)" : "#71767b",

    axisLabel: dark ? "rgba(255, 255, 255, 0.6)" : "#536471",

    axisLine: dark ? "#262A30" : "rgba(15, 20, 25, 0.1)",
    crosshair: dark ? "rgba(255, 255, 255, 0.4)" : "rgba(15, 20, 25, 0.4)",
  };
}

function pricePrecision(values: number[]): number {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) return 2;
  const min = Math.min(...positive);
  if (min >= 10) return 2;
  if (min >= 1) return 3;

  const magnitude = Math.floor(Math.log10(min));
  return Math.min(10, Math.max(4, -magnitude + 2));
}

function formatPrice(v: number, digits: number): string {
  return v.toFixed(digits);
}

function numFormat(value: number | string): string {
  return `${value}`.replace(/\d+/, (n) => n.replace(/(\d)(?=(\d{3})+$)/g, "$1,"));
}

const PRICE_ABBREVIATIONS = [
  { value: 1e3, symbol: "k", min: 1e4 },
  { value: 1e6, symbol: "M" },
  { value: 1e9, symbol: "B" },
];

function formatPriceLabel(num: number, digits: number): string {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const item = [...PRICE_ABBREVIATIONS].reverse().find((entry) => abs >= (entry.min ?? entry.value));
  if (item) return `${sign}${numFormat(formatPrice(abs / item.value, digits))}${item.symbol}`;
  return `${sign}${numFormat(formatPrice(abs, digits))}`;
}

const DAY_MONTH_PERIODS = new Set<TokenChartPeriod>(["7D", "30D", "3M"]);

function formatAxisDate(t: number, period: TokenChartPeriod): string {
  const d = new Date(t);
  const month = d.toLocaleString("en-US", { month: "short" });
  if (DAY_MONTH_PERIODS.has(period)) return `${d.getDate()} ${month}`;

  return d.getMonth() === 0 && d.getDate() === 1 ? `${d.getFullYear()}` : month;
}

function makeAxisIntervalFn(period: TokenChartPeriod, timestamps: number[]): (index: number) => boolean {

  if (period === "6M" || period === "12M") {
    return (index: number) => new Date(timestamps[index] ?? 0).getDate() === 1;
  }

  const stepDays: Record<"7D" | "30D" | "3M", number> = { "7D": 1, "30D": 2, "3M": 14 };
  const step = stepDays[period];
  const lastIndex = timestamps.length - 1;
  return (index: number) => (lastIndex - index) % step === 0;
}

function formatTooltipDate(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTokenChartOptions(
  points: TokenChartPoint[],
  meta: TokenChartMeta,
  dark: boolean,
  period: TokenChartPeriod,
): EChartsCoreOption {
  const palette = paletteFor(dark);
  const timestamps = points.map((p) => p.t);
  const xAxisIntervalFn = makeAxisIntervalFn(period, timestamps);
  const priceValues = points.map((p) => p.price);
  const sentimentValues = points.map((p) => p.sentiment);

  const hasPrice = meta.priceAvailable;
  const hasSentiment = meta.sentimentAvailable;

  const numericPrices = priceValues.filter((v): v is number => v !== null);
  const priceDigits = pricePrecision(numericPrices);

  const numericSentiments = sentimentValues.filter((v): v is number => v !== null);

  const sentimentMin = Math.min(0, -1, ...numericSentiments);
  const sentimentMax = Math.max(0, 1, ...numericSentiments);

  const eventTargetSeries: "sentiment" | "price" | null = hasSentiment ? "sentiment" : hasPrice ? "price" : null;
  const eventMarkPoints: Array<{ coord: [number, number] }> =
    eventTargetSeries === "sentiment"
      ? points
          .map((p, index): { coord: [number, number] } | null =>
            p.event !== null && p.sentiment !== null ? { coord: [index, p.sentiment] } : null,
          )
          .filter((d): d is { coord: [number, number] } => d !== null)
      : eventTargetSeries === "price"
        ? points
            .map((p, index): { coord: [number, number] } | null =>
              p.event !== null && p.price !== null ? { coord: [index, p.price] } : null,
            )
            .filter((d): d is { coord: [number, number] } => d !== null)
        : [];
  const eventMarkPoint = eventMarkPoints.length
    ? {
        symbol: "circle",
        symbolSize: 6,
        label: { show: false },
        itemStyle: { color: EVENT_DOT_COLOR },
        emphasis: { disabled: false, itemStyle: { color: EVENT_DOT_COLOR, borderWidth: 6, borderColor: EVENT_DOT_HOVER_BORDER } },
        data: eventMarkPoints,
      }
    : undefined;

  const series: Array<Record<string, unknown>> = [];
  if (hasPrice) {
    series.push({
      name: "Price",
      type: "line",
      yAxisIndex: 0,
      data: priceValues,
      showSymbol: false,
      smooth: false,

      lineStyle: { width: 2.5, color: palette.price },
      itemStyle: { color: palette.price },
      z: 3,
      markPoint: eventTargetSeries === "price" ? eventMarkPoint : undefined,
    });
  }
  let sentimentSeriesIndex = -1;
  if (hasSentiment) {
    sentimentSeriesIndex = series.length;
    series.push({
      name: "Sentiment",
      type: "line",
      yAxisIndex: 1,
      data: sentimentValues,
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 1.5 },
      areaStyle: { opacity: 1 },
      markPoint: eventTargetSeries === "sentiment" ? eventMarkPoint : undefined,

      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: palette.axisLine, width: 1, type: "solid" },
        label: { show: false },
        data: [{ yAxis: 0 }],
      },
    });
  }

  return {
    tooltip: {
      trigger: "axis",

      confine: true,
      appendToBody: false,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "line",
        lineStyle: { color: palette.crosshair },
        label: {
          show: true,

          backgroundColor: "#2A3242",
          color: "#ffffff",
          formatter: (p: unknown) => formatTooltipDate(timestamps[(p as { seriesData?: Array<{ dataIndex: number }> }).seriesData?.[0]?.dataIndex ?? 0]),
        },
      },
      formatter: (paramsIn: unknown) => {
        const list = (Array.isArray(paramsIn) ? paramsIn : [paramsIn]) as Array<{
          dataIndex: number;
          seriesName: string;
          data: unknown;
          color: string;
        }>;
        const dataIndex = list[0]?.dataIndex ?? 0;
        const priceEntry = list.find((p) => p.seriesName === "Price");
        const sentimentEntry = list.find((p) => p.seriesName === "Sentiment");
        const priceValue = typeof priceEntry?.data === "number" ? priceEntry.data : null;
        const sentimentValue = typeof sentimentEntry?.data === "number" ? sentimentEntry.data : null;
        const event = points[dataIndex]?.event ?? null;

        const row = (color: string, name: string, value: string, valueColor: string) =>
          `<div style="display:flex;align-items:center;height:20px;">` +
          `<span style="display:inline-flex;width:8px;height:8px;border-radius:9999px;background:${color};flex-shrink:0;"></span>` +
          `<span style="margin-left:6px;margin-right:8px;color:rgba(255,255,255,0.8);">${name}</span>` +
          `<span style="margin-left:auto;color:${valueColor};">${value}</span>` +
          `</div>`;

        const rows = [
          priceEntry
            ? row(
                priceValue === null ? NO_DATA_COLOR : palette.price,
                "Price",
                priceValue === null ? "No data" : formatPriceLabel(priceValue, priceDigits),
                priceValue === null ? NO_DATA_COLOR : "rgba(255,255,255,0.8)",
              )
            : "",
          sentimentEntry
            ? row(
                sentimentValue === null ? NO_DATA_COLOR : sentimentValue < 0 ? SENTIMENT_NEG_COLOR : SENTIMENT_POS_COLOR,
                "Sentiment",

                sentimentValue === null ? "No data" : formatPriceLabel(sentimentValue, 2),
                sentimentValue === null ? NO_DATA_COLOR : sentimentValue < 0 ? SENTIMENT_NEG_COLOR : SENTIMENT_POS_COLOR,
              )
            : "",
        ].join("");

        const card =
          `<div style="background:rgba(42,50,66,0.95);border:1px solid ${TOOLTIP_BORDER_COLOR};` +
          `border-radius:4px;padding:8px 16px;min-width:200px;width:max-content;">` +
          `<div style="display:flex;flex-direction:column;gap:4px;">${rows}</div></div>`;

        const isNearRightEdge = dataIndex > points.length / 2;
        const eventBlock = event
          ? `<div style="position:absolute;top:100%;${isNearRightEdge ? "right:0;" : "left:0;"}` +
            `margin-top:2px;width:max-content;max-width:388px;display:flex;flex-direction:column;gap:10px;` +
            `background:#2A3242;border:1px solid ${TOOLTIP_BORDER_COLOR};border-radius:4px;` +
            `padding:10px 16px;color:rgba(255,255,255,0.6);` +
            `white-space:pre-wrap;word-break:break-word;">${EVENT_AI_BADGE_SVG}${escapeHtml(event)}</div>`
          : "";

        return `<div style="position:relative;">${card}${eventBlock}</div>`;
      },
    },

    textStyle: { fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    grid: { left: 44, right: 40, top: 12, bottom: 26 },
    xAxis: {
      type: "category",
      data: timestamps,
      boundaryGap: false,
      axisLine: { lineStyle: { color: palette.axisLine } },

      axisTick: { show: true, alignWithLabel: true, interval: xAxisIntervalFn },
      splitLine: { show: false },
      axisLabel: {
        color: palette.axisLabel,
        fontSize: 10,

        align: "center",
        alignMinLabel: "left",
        alignMaxLabel: "right",
        interval: xAxisIntervalFn,
        formatter: (value: string) => formatAxisDate(Number(value), period),
      },
    },
    yAxis: [
      {
        type: "value",
        scale: true,
        position: "left",
        show: hasPrice,
        axisLine: { show: true, lineStyle: { color: palette.axisLine } },
        splitLine: { show: false },
        axisLabel: { color: palette.axisLabel, fontSize: 10, formatter: (value: number) => formatPriceLabel(value, priceDigits) },
      },
      {
        type: "value",
        scale: true,
        position: "right",
        show: hasSentiment,
        axisLine: { show: true, lineStyle: { color: palette.axisLine } },
        splitLine: { show: false },
        axisLabel: {

          color: (value: number) => (Number(value) >= 0 ? SENTIMENT_POS_COLOR : SENTIMENT_NEG_COLOR),
          fontSize: 10,

          formatter: (value: number) => formatPriceLabel(Number(value), 2),
        },
      },
    ],
    visualMap: hasSentiment
      ? {
          type: "piecewise",
          show: false,
          seriesIndex: sentimentSeriesIndex,
          dimension: 1,
          pieces: [
            { gte: 0, lte: sentimentMax, color: SENTIMENT_AREA_POS_COLOR },
            { gte: sentimentMin, lt: 0, color: SENTIMENT_AREA_NEG_COLOR },
          ],
        }
      : undefined,
    series,
  } as EChartsCoreOption;
}
