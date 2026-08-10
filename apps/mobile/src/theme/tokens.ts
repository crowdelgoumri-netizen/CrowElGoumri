/**
 * Design tokens — single source of truth for values that aren't utilities.
 *
 * NativeWind covers colors/fonts/radii via tailwind.config.ts (use those as
 * `className` on components). This file holds the *values* needed in JS:
 * gradients (arrays for expo-linear-gradient later), shadows, spacing scale
 * the design board uses, and persona/sample data for placeholders.
 */
export const tokens = {
  // Gradient stops lifted from the design board's ambient blobs.
  gradients: {
    hero: ["#0B1220", "#3B2A5C", "#FF6A2B"] as const,
    accent: ["#FF6A2B", "#E4541C"] as const,
    violet: ["#6D5AA6", "#3B2A5C"] as const,
  },
  // Glass card style — the board's signature frosted surface.
  glass: {
    light: {
      backgroundColor: "rgba(255,255,255,0.55)",
      borderColor: "rgba(255,255,255,0.7)",
    },
    dark: {
      backgroundColor: "rgba(22,33,59,0.55)",
      borderColor: "rgba(255,255,255,0.08)",
    },
  },
  spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 40 } as const,
  radius: { sm: 10, md: 14, lg: 22, pill: 9999 } as const,
} as const;

/**
 * Sample personas for placeholder UI — re-skinned from the board's
 * Lagos/London cast to the Algeria diaspora personas in the blueprint
 * (Karim, Ahmed, Nadia, Youcef, Mehdi, Amina).
 */
export const PERSONAS = [
  { name: "Karim B.", role: "Sender · Paris", initials: "KB" },
  { name: "Ahmed M.", role: "Traveler · ORY→ALG", initials: "AM" },
  { name: "Nadia K.", role: "Traveler · Marseille ferry", initials: "NK" },
  { name: "Youcef D.", role: "Traveler · Orly→Alger", initials: "YD" },
] as const;
