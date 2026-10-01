/**
 * Illustrations — decorative SVG art for the DiasporaCart brand surfaces
 * (Home hero card, Search corridors panel). Pure react-native-svg shapes in
 * the palette (olive/sand on deep green), so they theme and scale for free
 * without binary image assets.
 */
import { ImageBackground, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import mapEarthBg from "../../assets/map-earth-bg.jpg";

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
 * backdrop: a satellite photo of Earth (brand-tinted so it reads as one
 * surface with the rest of the app, not a stock photo), with curved flight
 * paths converging on a central Algiers pin drawn on top, sized tall enough
 * to host the floating destination cards search.tsx positions over it.
 * Drawn for a 328×380 box (stretches to fill its container's width/height).
 */
export function PopularRoutesMapArt() {
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
    <View style={{ width: "100%", height: "100%" }}>
      <ImageBackground
        source={mapEarthBg}
        resizeMode="cover"
        style={{ width: "100%", height: "100%" }}
      >
        {/* brand tint so the photo reads as part of the app, not a stock image */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0F5D3B", opacity: 0.45 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg width="100%" height="100%" viewBox="0 0 328 380" fill="none">
            {arcs.map((a, i) => (
              <Path
                key={i}
                d={a.d}
                stroke="#EADCC8"
                strokeOpacity={a.main ? 0.95 : 0.55}
                strokeWidth={a.main ? 2.2 : 1.4}
                strokeDasharray={a.main ? undefined : "1 6"}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            {/* destination pin — Algiers */}
            <Circle cx={164} cy={300} r={20} fill="#0F5D3B" opacity={0.3} />
            <Circle cx={164} cy={300} r={11} fill="#0F5D3B" stroke="#EADCC8" strokeWidth={1.5} />
            <Circle cx={164} cy={300} r={4.5} fill="#EADCC8" />
          </Svg>
        </View>
      </ImageBackground>
    </View>
  );
}
