/**
 * Font loading — Plus Jakarta Sans (headings/buttons) + Inter (body/UI)
 * + IBM Plex Mono (meta/eyebrow labels) + Caveat (handwritten accents,
 * e.g. the home hero's quote line).
 *
 * tailwind.config.ts names these as `font-heading` / `font-body` / `font-mono`;
 * without actually loading the files the utilities silently fall back to the
 * system font. This module loads them via expo-google-fonts and expo-font,
 * returning a `ready` flag the root layout gates its splash on so text never
 * flashes in the system face.
 */
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from "@expo-google-fonts/ibm-plex-mono";
import { Caveat_600SemiBold } from "@expo-google-fonts/caveat";
import * as Font from "expo-font";

let loaded = false;

/**
 * Load the brand fonts. Idempotent — safe to call from the root layout on
 * every mount; expo-font no-ops a repeat load of the same family.
 */
export async function loadFonts(): Promise<void> {
  if (loaded) return;
  await Font.loadAsync({
    PlusJakartaSans: PlusJakartaSans_400Regular,
    // Named to match the tailwind fontFamily keys exactly.
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter: Inter_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono: IBMPlexMono_500Medium,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    Caveat: Caveat_600SemiBold,
    Caveat_600SemiBold,
  });
  loaded = true;
}
