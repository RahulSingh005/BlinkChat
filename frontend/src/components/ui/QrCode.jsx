import { memo, useMemo } from "react";
import { encode } from "uqr";

/**
 * QR code as crisp SVG with soft rounded modules. Always dark-on-white so
 * any phone camera can scan it, whatever the app theme.
 */
function QrCode({ value, size = 216, ecc = "M", className = "" }) {
  const { data, size: n } = useMemo(() => encode(value, { ecc, border: 0 }), [value, ecc]);

  const inFinder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const modules = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (data[y][x] && !inFinder(x, y)) modules.push(<rect key={`${x}-${y}`} x={x + 0.07} y={y + 0.07} width={0.86} height={0.86} rx={0.32} />);
    }
  }
  const finder = (fx, fy) => (
    <g key={`f${fx}-${fy}`}>
      <rect x={fx + 0.5} y={fy + 0.5} width={6} height={6} rx={1.6} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={fx + 2} y={fy + 2} width={3} height={3} rx={0.9} />
    </g>
  );

  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} className={`rounded-2xl bg-white text-[#111317] ${className}`} role="img" aria-label="QR code">
      <g fill="currentColor">
        {modules}
        {finder(0, 0)}
        {finder(n - 7, 0)}
        {finder(0, n - 7)}
      </g>
    </svg>
  );
}

export default memo(QrCode);
