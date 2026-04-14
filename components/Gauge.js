'use client';

function gaugeColor(t) {
  const stops = [
    [0,    [220,38,38]],
    [0.25, [249,115,22]],
    [0.50, [234,179,8]],
    [0.75, [163,230,53]],
    [1.0,  [34,197,94]],
  ];
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 2 && stops[i+1][0] <= t) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i+1];
  const f = (t - t0) / (t1 - t0);
  return `rgb(${Math.round(c0[0]+f*(c1[0]-c0[0]))},${Math.round(c0[1]+f*(c1[1]-c0[1]))},${Math.round(c0[2]+f*(c1[2]-c0[2]))})`;
}

function buildSegments(N, activeNorm) {
  const activeIdx = Math.round((activeNorm / 100) * (N - 1));
  return Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    const θ = Math.PI * (1 - t);
    const dist = Math.abs(i - activeIdx);
    return { t, θ, dist, isActive: dist === 0 };
  });
}

export function Gauge({ value = 68, label = 'Active Buying', size = 210, pillColor = '#22c55e' }) {
  const _hex2rgba = (h, a) => {
    try {
      const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    } catch(_) { return `rgba(34,197,94,${a})`; }
  };
  const cx = size / 2;
  const cy = Math.round(size * 0.60);
  const r  = Math.round(size * 0.40);
  const arcD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const N = 20;
  const segW = Math.round(size * 0.046);
  const segH = Math.round(size * 0.086);
  const segs = buildSegments(N, value);
  const pillW = 118, pillH = 22;
  const pillX = cx - pillW / 2;
  const pillY = cy + 14;

  return (
    <svg viewBox={`0 0 ${size} ${cy + 48}`} width="100%" style={{ overflow: 'visible' }} suppressHydrationWarning>
      {segs.map((seg, i) => {
        const sx = Math.round((cx + r * Math.cos(seg.θ)) * 1000) / 1000;
        const sy = Math.round((cy - r * Math.sin(seg.θ)) * 1000) / 1000;
        const rot = Math.round(((Math.PI / 2 - seg.θ) * (180 / Math.PI)) * 1000) / 1000;
        const col = gaugeColor(seg.t);
        const sOp = seg.isActive ? 0 : 0.65;
        return (
          <g key={i}>
            <rect x={sx - segW/2} y={sy - segH/2} width={segW} height={segH} rx={Math.round(segW * 0.38)}
              fill={seg.isActive ? col : '#0c0c1a'} stroke={col}
              strokeWidth={seg.isActive ? 0 : 1.4} strokeOpacity={sOp}
              transform={`rotate(${rot},${sx},${sy})`}
              />
            {seg.isActive && <circle cx={sx} cy={sy} r={segW * 0.22} fill="white" opacity={0.95}/>}
          </g>
        );
      })}
      <text x={cx} y={cy - r * 0.36} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={size * 0.15} fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="-1">
        {value}
      </text>
      <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={pillH/2}
        fill={_hex2rgba(pillColor, 0.14)} stroke={_hex2rgba(pillColor, 0.40)} strokeWidth={0.8}/>
      <text x={cx} y={pillY + pillH/2 + 0.5} textAnchor="middle" dominantBaseline="middle"
        fill={pillColor} fontSize={11} fontWeight="600" fontFamily="Inter, sans-serif">
        {label}
      </text>
    </svg>
  );
}

export function CorrGauge({ value = -5, size = 155 }) {
  const cx = size / 2;
  const cy = Math.round(size * 0.60);
  const r  = Math.round(size * 0.40);
  const arcD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const N = 10;
  const segW = Math.round(size * 0.078);
  const segH = Math.round(size * 0.132);
  const norm = (value + 100) / 2;
  const segs = buildSegments(N, norm);
  const vc = value < -50 ? '#f87171' : value < 50 ? '#fbbf24' : '#4ade80';
  const pillFill   = value < -50 ? 'rgba(239,68,68,0.14)'  : value < 50 ? 'rgba(234,179,8,0.14)'  : 'rgba(34,197,94,0.14)';
  const pillStroke = value < -50 ? 'rgba(239,68,68,0.40)'  : value < 50 ? 'rgba(234,179,8,0.40)'  : 'rgba(34,197,94,0.40)';
  const corrLabel  = value <= -50 ? 'Strong Inverse' : value < -20 ? 'Inverse' : value < 20 ? 'Neutral' : value < 50 ? 'Positive' : 'Strong Positive';
  const pillW = 90, pillH = 20;
  const pillX = cx - pillW / 2;
  const pillY = cy + 12;

  return (
    <svg viewBox={`0 0 ${size} ${cy + 44}`} width="100%" style={{ overflow: 'visible' }} suppressHydrationWarning>
      {segs.map((seg, i) => {
        const sx = Math.round((cx + r * Math.cos(seg.θ)) * 1000) / 1000;
        const sy = Math.round((cy - r * Math.sin(seg.θ)) * 1000) / 1000;
        const rot = Math.round(((Math.PI / 2 - seg.θ) * (180 / Math.PI)) * 1000) / 1000;
        const col = gaugeColor(seg.t);
        const sOp = seg.isActive ? 0 : 0.65;
        return (
          <g key={i}>
            <rect x={sx - segW/2} y={sy - segH/2} width={segW} height={segH} rx={Math.round(segW * 0.38)}
              fill={seg.isActive ? col : '#0c0c1a'} stroke={col}
              strokeWidth={seg.isActive ? 0 : 1.4} strokeOpacity={sOp}
              transform={`rotate(${rot},${sx},${sy})`}
              />
            {seg.isActive && <circle cx={sx} cy={sy} r={segW * 0.22} fill="white" opacity={0.95}/>}
          </g>
        );
      })}
      <text x={cx} y={cy - r * 0.36} textAnchor="middle" dominantBaseline="middle"
        fill={vc} fontSize={size * 0.145} fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="-0.5">
        {value > 0 ? '+' : ''}{value}%
      </text>
      <rect x={pillX} y={pillY} width={pillW} height={pillH} rx={pillH/2} fill={pillFill} stroke={pillStroke} strokeWidth={0.8}/>
      <text x={cx} y={pillY + pillH/2 + 0.5} textAnchor="middle" dominantBaseline="middle"
        fill={vc} fontSize={10} fontWeight="600" fontFamily="Inter, sans-serif">
        {corrLabel}
      </text>
    </svg>
  );
}
