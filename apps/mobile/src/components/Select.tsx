/**
 * Select — a label + tap-to-open bottom-sheet picker.
 *
 * Aurora glass surface matching Input. Modal uses chrome background.
 */
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clsx } from "../lib/clsx";
import { useThemeColors } from "../hooks/useThemeColors";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string | null;
  options: readonly SelectOption[] | readonly string[];
  placeholder?: string;
  onSelect: (value: string) => void;
  error?: string | null;
}

export function Select({
  label,
  value,
  options,
  placeholder = "Sélectionner",
  onSelect,
  error,
}: SelectProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  const opts: SelectOption[] = (options as (SelectOption | string)[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const selected = opts.find((o) => o.value === value);

  return (
    <View className="w-full">
      <Text className="text-text-secondary text-xs font-body mb-1.5 ml-1">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className={clsx(
          "h-14 rounded-field px-card-padding flex-row items-center justify-between",
          "bg-glass border",
          error ? "border-danger" : "border-hairline",
        )}
      >
        <Text
          className={clsx(
            "font-body text-base",
            selected ? "text-oncard" : "text-text-muted",
          )}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text className="text-danger text-xs font-body mt-1 ml-1">{error}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end" onPress={() => setOpen(false)}>
          <View className="flex-1 bg-black/50" />
          <View
            className="bg-glass-strong border-t border-hairline rounded-t-card pb-xl"
            onStartShouldSetResponder={() => true}
          >
            <View className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-divider" />
            </View>
            <Text className="text-text-primary font-heading font-bold text-lg px-card-padding pb-sm">
              {label}
            </Text>
            <FlatList
              data={opts}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-lg py-md"
                  >
                    <Text className="text-oncard font-body text-base">{item.label}</Text>
                    {active ? (
                      <Ionicons name="checkmark" size={20} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
              style={{ maxHeight: 420 }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
