/**
 * Illustrations — decorative SVG art for the DiasporaCart brand surfaces
 * (Home hero card, Search corridors panel). Pure react-native-svg shapes in
 * the palette (olive/sand on deep green), so they theme and scale for free
 * without binary image assets.
 */
import Svg, { Circle, Path, Rect } from "react-native-svg";

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
 * PopularRoutesMapArt — the Rechercher screen's "Nos trajets populaires"
 * backdrop: a soft mint gradient with a dotted "map paper" texture, curved
 * flight paths converging on a central Algiers pin, sized tall enough to
 * host the floating destination cards search.tsx positions on top of it.
 * Drawn for a 328×380 box (stretches to fill its container's width/height).
 */
export function PopularRoutesMapArt() {
  const dots = [];
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 12; c++) {
      dots.push(
        <Circle
          key={`${r}-${c}`}
          cx={14 + c * 27}
          cy={14 + r * 27}
          r={1.3}
          fill="#688B5B"
          opacity={0.18}
        />,
      );
    }
  }
  // Diaspora origins → Algiers (converging arcs), endpoints matching the
  // floating card anchor points search.tsx positions over this art.
  const arcs: { d: string; main?: boolean }[] = [
    { d: "M50 60 C 110 90, 140 200, 164 300", main: true }, // Montréal
    { d: "M278 100 C 240 160, 200 230, 164 300" }, // Londres
    { d: "M298 185 C 260 220, 210 260, 164 300" }, // Paris
    { d: "M40 235 C 90 250, 130 270, 164 300" }, // New York
    { d: "M298 265 C 250 280, 210 290, 164 300" }, // Genève
  ];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 328 380" fill="none">
      <Rect x={0} y={0} width={328} height={380} fill="#DCECE2" />
      {dots}
      {arcs.map((a, i) => (
        <Path
          key={i}
          d={a.d}
          stroke="#0F5D4A"
          strokeOpacity={a.main ? 0.85 : 0.4}
          strokeWidth={a.main ? 2.2 : 1.4}
          strokeDasharray={a.main ? undefined : "1 6"}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {/* destination pin — Algiers */}
      <Circle cx={164} cy={300} r={20} fill="#0F5D4A" opacity={0.14} />
      <Circle cx={164} cy={300} r={11} fill="#0F5D4A" />
      <Circle cx={164} cy={300} r={4.5} fill="#EADCC8" />
    </Svg>
  );
}
