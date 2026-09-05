// 8bitインベーダー風ピクセルアート。currentColorで塗るのでCSSの color で配色を変えられる。
const PIXELS = [
  [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
  [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
];

interface Props {
  size?: number;
  className?: string;
}

export default function SpaceInvader({ size = 24, className = "" }: Props) {
  return (
    <svg
      className={`space-invader ${className}`.trim()}
      width={size}
      height={(size * 8) / 11}
      viewBox="0 0 11 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {PIXELS.flatMap((row, y) =>
        row.map((cell, x) => (cell ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null))
      )}
    </svg>
  );
}
