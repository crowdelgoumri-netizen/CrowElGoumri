/**
 * Font loading — Space Grotesk (headings) + Plus Jakarta Sans (body).
 *
 * tailwind.config.ts names these as `font-heading` / `font-body`; without
 * actually loading the files the utilities silently fall back to the system
 * font. This module loads them via expo-google-fonts and expo-font, returning
 * a `ready` flag the root layout gates its splash on so text never flashes in
 * the system face.
 */
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import * as Font from "expo-font";

let loaded = false;

/**
 * Load the brand fonts. Idempotent — safe to call from the root layout on
 * every mount; expo-font no-ops a repeat load of the same family.
 */
export async function loadFonts(): Promise<void> {
  if (loaded) return;
  await Font.loadAsync({
    SpaceGrotesk: SpaceGrotesk_500Medium,
    // Named to match the tailwind fontFamily keys exactly.
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    PlusJakartaSans: PlusJakartaSans_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  loaded = true;
}
