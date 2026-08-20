/**
 * Login screen — email + password → POST /auth/login.
 *
 * Handles the backend's 403 "phone not verified" by navigating to the
 * verify screen (the backend returns the phone in the error body so the
 * user doesn't retype it).
 */
import { useState } from "react";
import { Link, router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ApiError } from "../../src/lib/api";
import * as authApi from "../../src/lib/auth";
import { useAuth } from "../../src/store/auth";

export default function LoginScreen() {
  const { t } = useTranslation();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const session = await authApi.login({ email: email.trim(), password });
      await setSession(
        { accessToken: session.accessToken, refreshToken: session.refreshToken },
        null,
      );
      router.replace("/(tabs)");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        // Backend signals unverified phone; bounce to verify with the phone
        // it returned, so the user doesn't retype it.
        const phone =
          e.body && typeof e.body === "object" && "phone" in e.body
            ? String((e.body as { phone: string }).phone)
            : "";
        router.replace({ pathname: "/auth/verify-phone", params: phone ? { phone } : {} });
        return;
      }
      const msg = e instanceof Error ? e.message : t("login.errorFallback");
      setError(msg);
      Alert.alert(t("login.errorTitle"), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View className="mt-xl">
        <Text className="text-text-primary font-heading text-screen-title font-bold">
          {t("login.title")}
        </Text>
        <Text className="text-text-muted font-body text-base mt-1">
          {t("login.subtitle")}
        </Text>
      </View>

      <View className="mt-xl gap-stack-gap">
        <Input
          label={t("field.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          label={t("field.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          error={error}
        />
        <Button label={t("common.login")} onPress={submit} loading={loading} />
      </View>

      <View className="mt-section-gap flex-row justify-center gap-1">
        <Text className="text-text-muted font-body">{t("login.noAccount")}</Text>
        <Link href="/auth/signup" className="text-accent font-body font-semibold">
          {t("common.signup")}
        </Link>
      </View>

      {/* Guests can always keep browsing the marketplace instead. */}
      <Pressable
        onPress={() => router.replace("/(tabs)")}
        className="mt-stack-gap items-center py-sm"
      >
        <Text className="text-text-secondary font-body text-sm">
          {t("login.explore")}
        </Text>
      </Pressable>
    </Screen>
  );
}
