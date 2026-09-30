/**
 * StatusPill — a compact colored badge for any domain status.
 *
 * Tone→class is a static literal map so NativeWind's JIT sees every class.
 * Uses Aurora semantic tokens (success/info/accent/warning/danger/muted).
 */
import { Text, View } from "react-native";
import { clsx } from "../lib/clsx";
import type { Tone } from "../lib/format";

const TONE_CLASS: Record<Tone, string> = {
  accent: "bg-accent/20 text-accent-text",
  success: "bg-success/20 text-success",
  violet: "bg-info/20 text-info",
  muted: "bg-text-muted/10 text-text-muted",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/20 text-danger",
};

interface StatusPillProps {
  label: string;
  tone?: Tone;
  className?: string;
}

export function StatusPill({
  label,
  tone = "muted",
  className,
}: StatusPillProps) {
  return (
    <View className={clsx("self-start rounded-chip px-2.5 py-1", TONE_CLASS[tone], className)}>
      <Text className="text-xs font-mono font-semibold">{label}</Text>
    </View>
  );
}
