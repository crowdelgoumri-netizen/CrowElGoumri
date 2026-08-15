/**
 * Root layout — fonts, realtime/push wiring, and the AuthGate.
 *
 * Boots the auth store (hydrates from AsyncStorage), loads the brand fonts,
 * connects the Socket.IO client + registers for push while authenticated
 * (and tears both down on logout), and redirects between the auth flow and
 * the authenticated tab shell based on session state.
 *
 * Splash state: until hydration AND fonts are ready we show a blank navy
 * screen so the user never sees a flash of the wrong route or the system font.
 */
import "../global.css";
import "../src/lib/i18n"; // boot i18next + react-i18next before any screen renders
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { StripeProvider } from "../src/lib/stripe-compat";
import { useAuth } from "../src/store/auth";
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
    if (!tokens && !inAuthGroup) {
      // No session → force into auth flow.
      router.replace("/auth/login");
    } else if (tokens && inAuthGroup) {
      // Session exists but sitting on an auth screen → go to the app.
      router.replace("/(tabs)");
    }
  }, [hydrated, tokens, segments, router]);

  return null;
}

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  const hydrated = useAuth((s) => s.hydrated);
  const tokens = useAuth((s) => s.tokens);
  const [fontsReady, setFontsReady] = useState(false);

  // Boot the auth store once.
  useEffect(() => {
    init();
  }, [init]);

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

  if (!hydrated || !fontsReady) {
    // Avoid a flash of the wrong route / system font while storage + fonts load.
    return <View className="flex-1 bg-navy" />;
  }

  return (
    <StripeProvider publishableKey={STRIPE_PK}>
      <StatusBar style="light" />
      <OfflineBanner />
      {/* Routes (the (tabs) group + auth/* + detail screens) are auto-discovered. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0B1220" },
        }}
      />
      <AuthGate />
    </StripeProvider>
  );
}
