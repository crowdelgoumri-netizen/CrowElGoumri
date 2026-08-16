/**
 * Input — labeled text field with error state.
 *
 * Glass surface + hairline border per Aurora design. Focus border = accent.
 * Label sits above and the error below, so layout never jumps when validation fires.
 */
import { useState } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";
import { clsx } from "../lib/clsx";
import { useThemeColors } from "../hooks/useThemeColors";

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function Input({ label, error, className, ...rest }: InputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View className="w-full">
      <Text className="text-text-secondary text-xs font-body mb-1.5 ml-1">{label}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={clsx(
          "h-14 rounded-field px-card-padding text-base text-oncard font-body",
          "bg-glass border",
          focused ? "border-accent" : "border-hairline",
          error ? "border-danger" : "",
          className,
        )}
        {...rest}
      />
      {error ? (
        <Text className="text-danger text-xs font-body mt-1 ml-1">{error}</Text>
      ) : null}
    </View>
  );
}
