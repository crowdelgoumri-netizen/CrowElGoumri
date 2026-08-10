/**
 * Screen — the base layout surface every screen renders into.
 *
 * Wraps SafeArea + a consistent dark background (navy per the design board)
 * + a scroll container so content never gets cut by keyboards/notches.
 * Variants pick the surface treatment: `dark` (default, the board's navy)
 * or `light` (the frosted haze used on auth screens).
 */
import { ScrollView, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps extends ScrollViewProps {
  variant?: "dark" | "light";
  scroll?: boolean;
}

export function Screen({
  variant = "dark",
  scroll = true,
  className,
  children,
  ...rest
}: ScreenProps) {
  const bg = variant === "dark" ? "bg-navy" : "bg-haze";
  const content = scroll ? (
    <ScrollView
      contentContainerClassName={`px-md pb-xl ${className ?? ""}`}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView className={`flex-1 ${bg}`} edges={["top"]}>
      {content}
    </SafeAreaView>
  );
}
