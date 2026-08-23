/**
 * Screen — the base layout surface every screen renders into.
 *
 * Wraps SafeArea + a consistent Aurora dark gradient background + a scroll
 * container so content never gets cut by keyboards/notches.
 */
import { ScrollView, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
}

export function Screen({
  scroll = true,
  className,
  children,
  ...rest
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerClassName={`px-[20px] pb-xl ${className ?? ""}`}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      {content}
    </SafeAreaView>
  );
}
