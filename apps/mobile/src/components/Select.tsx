/**
 * Select — a label + tap-to-open bottom-sheet picker.
 *
 * React Native has no native <select>; this is the lightweight equivalent,
 * used for the corridor (origin country/city, destination wilaya), category,
 * transport mode, and urgency pickers across the post forms. Modal-based so
 * it overlays correctly on both platforms and dismisses on backdrop tap.
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
  const [open, setOpen] = useState(false);

  const opts: SelectOption[] = (options as (SelectOption | string)[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const selected = opts.find((o) => o.value === value);

  return (
    <View className="w-full">
      <Text className="text-mist/70 text-xs font-body mb-1.5 ml-1">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className={clsx(
          "h-14 rounded-card px-md flex-row items-center justify-between",
          "bg-navySoft/60 border",
          error ? "border-danger" : "border-line",
        )}
      >
        <Text
          className={clsx(
            "font-body text-base",
            selected ? "text-white" : "text-muted",
          )}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#8A94A6" />
      </Pressable>
      {error ? (
        <Text className="text-danger text-xs font-body mt-1 ml-1">{error}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end" onPress={() => setOpen(false)}>
          <View className="flex-1 bg-black/50" />
          <View
            className="bg-navySoft border-t border-line rounded-t-card pb-xl"
            onStartShouldSetResponder={() => true}
          >
            <View className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-mist/20" />
            </View>
            <Text className="text-white font-heading font-bold text-lg px-md pb-sm">
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
                    <Text className="text-white font-body text-base">{item.label}</Text>
                    {active ? (
                      <Ionicons name="checkmark" size={20} color="#FF6A2B" />
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
