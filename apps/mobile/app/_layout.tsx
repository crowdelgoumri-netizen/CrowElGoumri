/**
 * Root layout — fonts, theme, realtime/push wiring, and the AuthGate.
 *
 * Boots the auth store (hydrates from AsyncStorage), the theme store (color
 * mode: system/dark/bright), loads the brand fonts, connects the Socket.IO
 * client + registers for push while authenticated (and tears both down on
 * logout), and sends logged-in users back to the tab shell if they land on
 * an auth screen. Guests stay in the app and browse the public marketplace.
 *
 * Splash state: until hydration AND fonts are ready we show a blank Aurora
 * screen (in the resolved mode's base color) so the user never sees a flash
 * of the wrong route or the system font.
 */
import "../global.css";
import "../src/lib/i18n"; // boot i18next + react-i18next before any screen renders
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { StripeProvider } from "../src/lib/stripe-compat";
import { useAuth } from "../src/store/auth";
import { useTheme } from "../src/store/theme";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { loadFonts } from "../src/lib/fonts";
import { connectSocket, disconnectSocket } from "../src/lib/socket";
import { STRIPE_PK } from "../src/lib/api";
import {
  configurePresentation,
  registerForPush,
} from "../src/lib/push";
import { OfflineBanner } from "../src/components/OfflineBanner";

function AuthGate() {
  const { hydrated, tokens } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === "auth";
    // Guests browse freely (marketplace reads are public); screens that need
    // an account gate themselves with AuthWall. Only bounce logged-in users
    // out of the auth flow once they have a session.
    if (tokens && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [hydrated, tokens, segments, router]);

  return null;
}

function AppShell() {
  const resolvedScheme = useTheme((s) => s.resolvedScheme);
  const colors = useThemeColors();

  return (
    <StripeProvider publishableKey={STRIPE_PK}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      <OfflineBanner />
      {/* Routes (the (tabs) group + auth/* + detail screens) are auto-discovered. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgBase[0] },
        }}
      />
      <AuthGate />
    </StripeProvider>
  );
}

export default function RootLayout() {
  const initAuth = useAuth((s) => s.init);
  const authHydrated = useAuth((s) => s.hydrated);
  const tokens = useAuth((s) => s.tokens);
  const initTheme = useTheme((s) => s.init);
  const themeHydrated = useTheme((s) => s.hydrated);
  const [fontsReady, setFontsReady] = useState(false);

  // Boot the auth + theme stores once.
  useEffect(() => {
    initAuth();
    initTheme();
  }, [initAuth, initTheme]);

  // Load fonts once (idempotent).
  useEffect(() => {
    loadFonts().finally(() => setFontsReady(true));
  }, []);

  // Foreground push presentation — set once at boot.
  useEffect(() => {
    configurePresentation();
  }, []);

  // Connect realtime + register push while authenticated; tear down on logout.
  useEffect(() => {
    if (!tokens?.accessToken) {
      disconnectSocket();
      return;
    }
    connectSocket(tokens.accessToken);
    registerForPush().catch(() => {
      /* best-effort; non-fatal */
    });
    return () => {
      disconnectSocket();
    };
  }, [tokens?.accessToken]);

  if (!authHydrated || !themeHydrated || !fontsReady) {
    // Avoid a flash of the wrong route / system font / mode while storage +
    // fonts load. Still themed (ThemeProvider wraps this too) so the splash
    // itself is in the right mode's base color, not a hardcoded one.
    return (
      <ThemeProvider>
        <View className="flex-1 bg-base" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
