/**
 * MatchCard — one ranked match result from the scoring engine (board 07).
 *
 * Aurora glass styling with accent score bar and success tint for best match.
 */
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { eur, formatDate } from "../lib/format";
import { useThemeColors } from "../hooks/useThemeColors";
import type { Match } from "../lib/matching";

interface MatchCardProps {
  match: Match;
  index?: number;
  ctaLabel?: string;
  onPress?: (match: Match) => void;
}

export function MatchCard({ match, index = 0, ctaLabel, onPress }: MatchCardProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const score = Math.round(match.score ?? 0);
  const reasons = (match.reasons ?? []).slice(0, 3);
  const isBest = index === 0;

  return (
    <Pressable onPress={() => onPress?.(match)} className="active:opacity-80">
      <Card
        raised={isBest}
        className={isBest ? "border-accent/40 gap-stack-gap" : "gap-stack-gap"}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-glass border border-hairline">
              <Ionicons name="person" size={18} color={colors.textPrimary} />
            </View>
            <View>
              <Text className="text-oncard font-body font-semibold">
                {t("matchCard.travelerRef", { id: match.travelerId.slice(-5) })}
              </Text>
              {match.estimatedArrival ? (
                <Text className="text-text-muted text-xs font-body">
                  {t("matchCard.arrival", { date: formatDate(match.estimatedArrival) })}
                </Text>
              ) : null}
            </View>
          </View>
          {isBest ? (
            <View className="rounded-chip bg-success/20 px-2 py-0.5">
              <Text className="text-success text-xs font-mono font-semibold">{t("matchCard.bestMatch")}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {reasons.map((r, i) => (
            <View key={i} className="rounded-chip bg-chip-bg px-2 py-1">
              <Text className="text-text-secondary text-xs font-body">{r}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center gap-1.5 flex-1">
            <Ionicons name="sparkles" size={14} color={colors.accent} />
            <View className="h-1.5 flex-1 max-w-[80px] rounded-full bg-chip-bg overflow-hidden">
              <View
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, Math.max(8, score))}%` }}
              />
            </View>
            <Text className="text-text-muted text-xs font-body">{score}%</Text>
          </View>
          {match.estimatedPrice != null ? (
            <Text className="text-accent font-heading font-bold">{eur(match.estimatedPrice)}</Text>
          ) : null}
          {ctaLabel ? (
            <View className="rounded-field bg-accent px-3 py-1.5 ml-2">
              <Text className="text-accent-on text-xs font-body font-bold">{ctaLabel}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
