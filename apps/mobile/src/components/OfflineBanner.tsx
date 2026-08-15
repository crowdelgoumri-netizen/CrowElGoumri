/**
 * OfflineBanner — amber bar shown when the device has no connectivity.
 *
 * Renders below the status bar via the root layout. When the mutation
 * queue has pending items, shows the count so the user knows their
 * actions will be replayed on reconnect.
 */
import { Text, View } from "react-native";
import { useIsOffline } from "../hooks/useIsOffline";
import { useMutationQueue } from "../hooks/useMutationQueue";

export function OfflineBanner() {
  const { isOffline } = useIsOffline();
  const { pendingCount } = useMutationQueue();

  if (!isOffline && pendingCount === 0) return null;

  let message: string;
  if (isOffline && pendingCount > 0) {
    message = `Hors connexion — ${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente`;
  } else if (isOffline) {
    message = "Hors connexion — les actions seront envoyées automatiquement";
  } else {
    message = `${pendingCount} action${pendingCount > 1 ? "s" : ""} en cours d'envoi…`;
  }

  return (
    <View className="bg-amber-700 px-4 py-1.5 items-center">
      <Text className="text-white font-body text-xs">{message}</Text>
    </View>
  );
}
