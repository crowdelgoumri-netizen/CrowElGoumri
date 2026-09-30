/**
 * Illustrations — decorative SVG art for the DiasporaCart brand surfaces
 * (Home hero card, Search corridors panel). Pure react-native-svg shapes in
 * the palette (olive/sand on deep green), so they theme and scale for free
 * without binary image assets.
 */
import Svg, { Circle, Path } from "react-native-svg";

/**
 * SenderArt — small inline art for the "J'envoie un colis" white card:
 * a parcel box with a soft olive halo. Drawn for a ~84×84 box.
 */
export function SenderArt() {
  return (
    <Svg width={84} height={84} viewBox="0 0 84 84" fill="none">
      <Circle cx={42} cy={42} r={42} fill="#688B5B" opacity={0.14} />
      {/* box */}
      <Path d="M24 36 L42 28 L60 36 L60 54 L42 62 L24 54 Z" fill="#EADCC8" />
      <Path d="M24 36 L42 44 L60 36 L42 28 Z" fill="#D9C6A6" />
      <Path d="M42 44 L42 62 L60 54 L60 36 Z" fill="#C9B48C" />
      {/* tape */}
      <Path d="M40.5 29.2 L40.5 60.8" stroke="#0F5D4A" strokeWidth={2.4} opacity={0.5} />
      <Path d="M31 33.8 L53.5 44.6" stroke="#0F5D4A" strokeWidth={1.4} opacity={0.28} />
      {/* heart badge */}
      <Circle cx={59} cy={57} r={10} fill="#0F5D4A" />
      <Path
        d="M59 61.6 c -3.4 -2.3 -5.2 -4.1 -5.2 -6.2 c 0 -1.5 1.2 -2.7 2.6 -2.7 c 1 0 1.9 0.5 2.6 1.5 c 0.7 -1 1.6 -1.5 2.6 -1.5 c 1.4 0 2.6 1.2 2.6 2.7 c 0 2.1 -1.8 3.9 -5.2 6.2 Z"
        fill="#EADCC8"
      />
    </Svg>
  );
}

/**
 * CorridorMapArt — the Search screen's corridors panel: a soft dotted grid
 * over sand, curved flight arcs converging on Algiers' pin (the star marker),
 * with origin pins for the main diaspora cities. Drawn for a ~320×150 box.
 */
export function CorridorMapArt() {
  // Dotted grid (5×11) — a soft "map paper" texture.
  const dots = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 12; c++) {
      dots.push(
        <Circle
          key={`${r}-${c}`}
          cx={14 + c * 27}
          cy={16 + r * 24}
          r={1.4}
          fill="#688B5B"
          opacity={0.22}
        />,
      );
    }
  }
  // Diaspora origins → Algiers (converging arcs).
  const arcs: { d: string; main?: boolean }[] = [
    { d: "M34 34 C 110 18, 190 44, 268 78", main: true }, // Montréal-ish far left
    { d: "M96 88 C 150 80, 200 82, 268 80" },
    { d: "M150 30 C 190 44, 230 62, 268 79" },
    { d: "M214 108 C 236 100, 252 92, 268 82" },
  ];
  return (
    <Svg width="100%" height={156} viewBox="0 0 328 156" fill="none">
      {dots}
      {arcs.map((a, i) => (
        <Path
          key={i}
          d={a.d}
          stroke={a.main ? "#0F5D4A" : "#688B5B"}
          strokeOpacity={a.main ? 0.9 : 0.55}
          strokeWidth={a.main ? 2 : 1.5}
          strokeDasharray={a.main ? undefined : "1 6"}
          strokeLinecap="round"
        />
      ))}
      {/* plane on the main arc */}
      <Path
        d="M186 47 l 11 -7.5 c 1.7 -1.2 3.9 -0.9 4.6 0.5 c 0.6 1.3 -0.3 3 -2 3.7 L 189 51 Z"
        fill="#0F5D4A"
      />
      <Path
        d="M189.8 49.3 l -9.3 6.4 c -1.5 1 -1.6 2.7 -0.2 3.3 c 1.1 0.5 2.8 0 3.8 -1.2 l 7.2 -7.7 Z"
        fill="#0F5D4A"
      />
      {/* origin pins */}
      {[
        { x: 34, y: 34 },
        { x: 96, y: 88 },
        { x: 150, y: 30 },
        { x: 214, y: 108 },
      ].map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={4.5} fill="#688B5B" />
      ))}
      {[
        { x: 34, y: 34 },
        { x: 96, y: 88 },
        { x: 150, y: 30 },
        { x: 214, y: 108 },
      ].map((p, i) => (
        <Circle key={`w-${i}`} cx={p.x} cy={p.y} r={8.5} fill="#688B5B" opacity={0.25} />
      ))}
      {/* destination pin — Algiers (star) */}
      <Circle cx={268} cy={80} r={13} fill="#0F5D4A" opacity={0.15} />
      <Circle cx={268} cy={80} r={6.5} fill="#0F5D4A" />
      <Circle cx={268} cy={80} r={2.6} fill="#EADCC8" />
    </Svg>
  );
}
