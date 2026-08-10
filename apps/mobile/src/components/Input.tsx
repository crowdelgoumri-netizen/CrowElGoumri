/**
 * Input — labeled text field with error state.
 *
 * The auth screens (email/phone/password/code) all share this shape. The
 * frosted-glass look comes from the bg/border tokens; the label sits above
 * and the error below, so layout never jumps when validation fires.
 */
import { useState } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";
import { clsx } from "../lib/clsx";

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function Input({ label, error, className, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="w-full">
      <Text className="text-mist/70 text-xs font-body mb-1.5 ml-1">{label}</Text>
      <TextInput
        placeholderTextColor="#8A94A6"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={clsx(
          "h-14 rounded-card px-md text-base text-white font-body",
          "bg-navySoft/60 border",
          focused ? "border-accent" : "border-line",
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
