/**
 * Select — a label + tap-to-open inline dropdown.
 *
 * Options expand right under the field (no modal/bottom sheet — simpler and
 * stays in flow on small screens). List height is fixed, not maxHeight:
 * maxHeight is ignored on Android inside these unbounded containers, which
 * let long option lists (58 wilayas) grow unbounded.
 */
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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

const ROW_HEIGHT = 56;
const LIST_MAX = 264;

export function Select({
  label,
  value,
  options,
  placeholder,
  onSelect,
  error,
}: SelectProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const opts: SelectOption[] = (options as (SelectOption | string)[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const selected = opts.find((o) => o.value === value);

  return (
    <View className="w-full">
      <Text className="text-text-secondary text-xs font-body mb-1.5 ml-1">{label}</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
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
          {selected?.label ?? placeholder ?? t("select.placeholder")}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {error ? (
        <Text className="text-danger text-xs font-body mt-1 ml-1">{error}</Text>
      ) : null}

      {open ? (
        <View className="mt-2 rounded-field bg-glass-strong border border-hairline overflow-hidden">
          <ScrollView
            nestedScrollEnabled
            style={{ height: Math.min(opts.length * ROW_HEIGHT, LIST_MAX) }}
          >
            {opts.map((o) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onSelect(o.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between px-card-padding py-3"
                >
                  <Text className="text-oncard font-body text-base">{o.label}</Text>
                  {active ? (
                    <Ionicons name="checkmark" size={20} color={colors.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
