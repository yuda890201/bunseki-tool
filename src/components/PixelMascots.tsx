// ドット絵のお肉とおにぎり。中食(お惣菜・おにぎり・米飯など)を扱うアプリの
// テイストに合わせたマスコット。SpaceInvaderと同じく座標グリッドから描画する。

interface Props {
  size?: number;
  className?: string;
}

const MEAT_COLOR = "#ffb454"; // 肉
const BONE_COLOR = "#fdf6e3"; // 骨

// 9(幅) x 10(高さ)グリッド。0=透明、1=肉、2=骨
const MEAT_PIXELS = [
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 2, 2, 2, 0, 0, 0],
  [0, 0, 0, 2, 2, 2, 0, 0, 0],
  [0, 0, 2, 2, 2, 2, 2, 0, 0],
];

const RICE_COLOR = "#fdf6e3"; // ごはん
const NORI_COLOR = "#3a3a34"; // のり(背景に沈みすぎない明るさ)

// 11(幅) x 9(高さ)グリッド。0=透明、1=ごはん、2=のり
// 三角形の一番広い行(9マス)にベースの幅を合わせ、おにぎりらしいシルエットにする。
const ONIGIRI_PIXELS = [
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0],
  [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
];

function PixelSprite({
  pixels,
  colorMap,
  size,
  className,
}: {
  pixels: number[][];
  colorMap: Record<number, string>;
  size: number;
  className?: string;
}) {
  const cols = pixels[0].length;
  const rows = pixels.length;
  return (
    <svg
      className={`pixel-mascot ${className ?? ""}`.trim()}
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {pixels.flatMap((row, y) =>
        row.map((cell, x) =>
          cell ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colorMap[cell]} /> : null
        )
      )}
    </svg>
  );
}

export function MeatSprite({ size = 24, className }: Props) {
  return (
    <PixelSprite
      pixels={MEAT_PIXELS}
      colorMap={{ 1: MEAT_COLOR, 2: BONE_COLOR }}
      size={size}
      className={`mascot-meat ${className ?? ""}`.trim()}
    />
  );
}

export function OnigiriSprite({ size = 24, className }: Props) {
  return (
    <PixelSprite
      pixels={ONIGIRI_PIXELS}
      colorMap={{ 1: RICE_COLOR, 2: NORI_COLOR }}
      size={size}
      className={`mascot-onigiri ${className ?? ""}`.trim()}
    />
  );
}
