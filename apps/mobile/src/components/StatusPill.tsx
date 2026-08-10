/**
 * StatusPill — a compact colored badge for any domain status.
 *
 * Tone→class is a static literal map so NativeWind's JIT sees every class.
 * Pass any of the label maps from lib/format (PARCEL_STATUS, TRIP_STATUS,
 * ESCROW_STATUS, KYC_LEVEL) or a raw label+tone.
 */
import { Text, View } from "react-native";
import { clsx } from "../lib/clsx";
import type { Tone } from "../lib/format";

const TONE_CLASS: Record<Tone, string> = {
  accent: "bg-accent/20 text-accent",
  success: "bg-success/20 text-success",
  violet: "bg-violet/25 text-violet",
  muted: "bg-mist/10 text-muted",
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
    <View className={clsx("self-start rounded-pill px-2.5 py-1", TONE_CLASS[tone], className)}>
      <Text className="text-xs font-body font-semibold">{label}</Text>
    </View>
  );
}
