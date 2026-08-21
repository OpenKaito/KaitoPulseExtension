import { type Component } from 'solid-js';
import type { SharePoint } from './view-model';

const W = 138;
const H = 51;

const MARKER_R = 4;
const HALO_R = 6;
const INSET_X = HALO_R + 1;
const INSET_Y = 4;

export type SparklineVariant = 'gray' | 'color' | 'blue';

const PALETTES: Record<
  SparklineVariant,
  { lineStart: string; lineEnd: string; areaTop: string; areaBottom: string }
> = {
  color: {
    lineStart: '#333BA5',
    lineEnd: '#32FFDC',
    areaTop: 'rgba(50, 253, 141, 0.37)',
    areaBottom: 'rgba(50, 187, 253, 0)',
  },
  gray: {
    lineStart: '#3D4651',
    lineEnd: '#E8EDF2',
    areaTop: 'rgba(232, 237, 242, 0.20)',
    areaBottom: 'rgba(232, 237, 242, 0)',
  },

  blue: {
    lineStart: 'rgba(40, 209, 180, 0.7)',
    lineEnd: '#2A53DF',
    areaTop: 'rgba(42, 83, 223, 0.6)',
    areaBottom: 'rgba(42, 83, 223, 0)',
  },
};

function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

interface SparklineProps {
  data: SharePoint[];
  variant: SparklineVariant;

  idPrefix: string;
}

export const Sparkline: Component<SparklineProps> = (props) => {
  const geometry = () => {
    const data = props.data;

    if (data.length < 2) return null;

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const span = max === min ? 1 : max - min;

    const pts = data.map((d, i) => ({
      x: INSET_X + (i * (W - 2 * INSET_X)) / (data.length - 1),
      y: H - INSET_Y - ((d.value - min) / span) * (H - 2 * INSET_Y),
    }));

    const line = catmullRomPath(pts);

    const area = `${line}L${pts[pts.length - 1].x},${H}L${pts[0].x},${H}Z`;
    return { line, area, last: pts[pts.length - 1] };
  };

  const palette = () => PALETTES[props.variant];

  return (
    <svg class="sc-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {(() => {
        const g = geometry();
        if (!g) return null;
        const lineId = `${props.idPrefix}-spark-line`;
        const areaId = `${props.idPrefix}-spark-area`;
        return (
          <>
            <defs>
              <linearGradient id={lineId} x1={INSET_X} y1="0" x2={W - INSET_X} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color={palette().lineStart} />
                <stop offset="100%" stop-color={palette().lineEnd} />
              </linearGradient>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color={palette().areaTop} />
                <stop offset="100%" stop-color={palette().areaBottom} />
              </linearGradient>
            </defs>
            <path d={g.area} fill={`url(#${areaId})`} />
            <path
              d={g.line}
              fill="none"
              stroke={`url(#${lineId})`}
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx={g.last.x} cy={g.last.y} r={HALO_R} fill="rgba(255,255,255,0.35)" />
            <circle cx={g.last.x} cy={g.last.y} r={MARKER_R} fill="#FFFFFF" />
          </>
        );
      })()}
    </svg>
  );
};
