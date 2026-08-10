/**
 * Root layout — the AuthGate.
 *
 * Boots the auth store (hydrates from AsyncStorage), imports the global
 * stylesheet, and redirects between the auth flow and the authenticated
 * app based on session state. Everything below renders through <Slot/>.
 *
 * Splash state: until hydration finishes we show a blank navy screen so
 * the user never sees a flash of the wrong route.
 */
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useAuth } from "../src/store/auth";

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
      // Session exists but sitting on an auth screen → go home.
      router.replace("/home");
    }
  }, [hydrated, tokens, segments, router]);

  return null;
}

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    init();
  }, [init]);

  if (!hydrated) {
    // Avoid a flash of the wrong route while storage loads.
    return (
      <View className="flex-1 bg-navy" />
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0B1220" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/verify-phone" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="home" />
      </Stack>
      <AuthGate />
    </>
  );
}
