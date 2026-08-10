/**
 * Tailwind / NativeWind config — the design board's tokens.
 *
 * The palette, fonts, and radii are lifted directly from the "Crowshi"
 * design board (Crowshi App.dc.html) and re-skinned for the Algeria/EUR
 * market. Every value here maps to a utility class (bg-navy, text-accent,
 * font-heading…) so screens stay declarative.
 *
 * Font files load via expo-google-fonts in the root layout; this config
 * only names them so utilities resolve.
 */
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Surfaces
        navy: "#0B1220", // primary background (board's base)
        navySoft: "#16213B", // elevated surface
        ink: "#0B1220", // primary text on light
        // Accents
        accent: "#FF6A2B", // orange — primary actions
        accentDeep: "#E4541C",
        violet: "#6D5AA6", // purple — secondary
        violetDeep: "#3B2A5C",
        // Neutrals
        mist: "#F5F7FA", // light surface
        haze: "#E9ECF4",
        muted: "#8A94A6", // secondary text
        line: "rgba(255,255,255,0.08)", // dividers on dark
        success: "#22C55E",
        danger: "#EF4444",
      },
      fontFamily: {
        heading: ["SpaceGrotesk", "Space Grotesk", "system-ui"],
        body: ["PlusJakartaSans", "Plus Jakarta Sans", "system-ui"],
      },
      borderRadius: {
        card: "16px",
        pill: "9999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
