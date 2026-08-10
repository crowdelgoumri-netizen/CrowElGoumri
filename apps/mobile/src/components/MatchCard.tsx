/**
 * MatchCard — one ranked match result from the scoring engine (board 07).
 *
 * The engine returns { tripId, travelerId, score 0–100, detourKm,
 * estimatedPrice, estimatedArrival, reasons }. We surface the score as a bar,
 * the human reasons as chips, and the estimated price/arrival. The optional
 * CTA is the traveler's "Accepter" (acceptParcel) or a sender's "Voir le trajet".
 */
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { eur, formatDate } from "../lib/format";
import type { Match } from "../lib/matching";

interface MatchCardProps {
  match: Match;
  index?: number;
  ctaLabel?: string;
  onPress?: (match: Match) => void;
}

export function MatchCard({ match, index = 0, ctaLabel, onPress }: MatchCardProps) {
  const score = Math.round(match.score ?? 0);
  const reasons = (match.reasons ?? []).slice(0, 3);

  return (
    <Pressable onPress={() => onPress?.(match)} className="active:opacity-80">
      <Card
        variant={index === 0 ? "light" : "dark"}
        className={index === 0 ? "border-accent gap-2" : "gap-2"}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-violetDeep">
              <Ionicons name="person" size={18} color="#F5F7FA" />
            </View>
            <View>
              <Text className="text-white font-body font-semibold">
                Voyageur #{match.travelerId.slice(-5)}
              </Text>
              {match.estimatedArrival ? (
                <Text className="text-muted text-xs font-body">
                  Arrivée {formatDate(match.estimatedArrival)}
                </Text>
              ) : null}
            </View>
          </View>
          {index === 0 ? (
            <View className="rounded-pill bg-success px-2 py-0.5">
              <Text className="text-white text-xs font-bold">Top match</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {reasons.map((r, i) => (
            <View key={i} className="rounded-pill bg-navySoft/60 px-2 py-1">
              <Text className="text-mist text-xs font-body">{r}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center gap-1.5 flex-1">
            <Ionicons name="sparkles" size={14} color="#FF6A2B" />
            <View className="h-1.5 flex-1 max-w-[80px] rounded-full bg-mist/10 overflow-hidden">
              <View
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, Math.max(8, score))}%` }}
              />
            </View>
            <Text className="text-mist text-xs font-body">{score}%</Text>
          </View>
          {match.estimatedPrice != null ? (
            <Text className="text-accent font-heading font-bold">{eur(match.estimatedPrice)}</Text>
          ) : null}
          {ctaLabel ? (
            <View className="rounded-pill bg-accent px-3 py-1.5 ml-2">
              <Text className="text-white text-xs font-bold">{ctaLabel}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
