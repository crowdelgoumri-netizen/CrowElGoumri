/**
 * OfflineBanner — amber bar shown when the device has no connectivity.
 *
 * Renders below the status bar via the root layout. When the mutation
 * queue has pending items, shows the count so the user knows their
 * actions will be replayed on reconnect.
 */
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsOffline } from "../hooks/useIsOffline";
import { useMutationQueue } from "../hooks/useMutationQueue";

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOffline } = useIsOffline();
  const { pendingCount } = useMutationQueue();

  if (!isOffline && pendingCount === 0) return null;

  let message: string;
  if (isOffline && pendingCount > 0) {
    message = t("offline.pending", { count: pendingCount });
  } else if (isOffline) {
    message = t("offline.message");
  } else {
    message = t("offline.sending", { count: pendingCount });
  }

  return (
    <View className="bg-amber-700 px-4 py-1.5 items-center">
      <Text className="text-white font-body text-xs">{message}</Text>
    </View>
  );
}
