/**
 * Stepper — step indicator for the multi-step post-parcel / post-trip forms.
 *
 * Shows numbered checkpoints connected by a line; completed steps take the
 * accent, the current step is a solid accent dot, future steps are muted.
 * Step labels use mono font (Aurora eyebrow style).
 */
import { Text, View } from "react-native";

interface StepperProps {
  steps: string[];
  current: number; // 0-based index of the active step
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <View className="flex-row items-center mb-lg">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} className="flex-1 flex-row items-center">
            <View className="items-center">
              <View
                className={
                  "h-7 w-7 items-center justify-center rounded-full " +
                  (active || done ? "bg-accent" : "bg-glass border border-hairline")
                }
              >
                <Text className="text-accent-on font-heading font-bold text-xs">
                  {done ? "✓" : i + 1}
                </Text>
              </View>
              <Text
                className={
                  "text-[10px] font-mono font-medium mt-1 " +
                  (active ? "text-accent" : "text-text-muted")
                }
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View
                className={
                  "flex-1 h-0.5 mx-1 " + (done ? "bg-accent" : "bg-divider")
                }
                style={{ marginTop: -10 }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
