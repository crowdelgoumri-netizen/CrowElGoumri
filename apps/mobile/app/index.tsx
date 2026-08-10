/**
 * Splash / index — the AuthGate in the layout handles all redirects, so
 * this screen just renders the navy base while that resolves.
 *
 * Expo Router requires an index route; making it a near-empty shell keeps
 * the redirect logic centralized in _layout.tsx.
 */
import { View } from "react-native";

export default function Index() {
  return <View className="flex-1 bg-navy" />;
}
