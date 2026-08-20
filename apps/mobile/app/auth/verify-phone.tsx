/**
 * Verify phone — POST /auth/verify-phone, then store the returned session
 * and navigate home. This is the screen that turns an unverified signup
 * into a logged-in user.
 *
 * Dev mode: the backend (TWILIO_VERIFY_SERVICE_SID unset) accepts "000000"
 * and logs the OTP. We surface a hint here so devs aren't stuck guessing.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ApiError, isDevOtpMode } from "../../src/lib/api";
import * as authApi from "../../src/lib/auth";
import { useAuth } from "../../src/store/auth";

export default function VerifyPhoneScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone?: string }>();
  const setSession = useAuth((s) => s.setSession);

  const [phone, setPhone] = useState(params.phone ?? "+213");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const session = await authApi.verifyPhone({
        phone: phone.trim(),
        code: code.trim(),
      });
      await setSession(
        { accessToken: session.accessToken, refreshToken: session.refreshToken },
        null,
      );
      router.replace("/(tabs)");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t("verify.errorFallback");
      Alert.alert(t("verify.errorTitle"), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View className="mt-xl">
        <Text className="text-text-primary font-heading text-screen-title font-bold">
          {t("verify.title")}
        </Text>
        <Text className="text-text-muted font-body text-base mt-1">
          {t("verify.subtitle")}
        </Text>
      </View>

      <View className="mt-xl gap-stack-gap">
        <Input
          label={t("field.phone")}
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          keyboardType="phone-pad"
        />
        <Input
          label={t("field.code")}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={6}
        />

        {isDevOtpMode() ? (
          <Text className="text-text-muted font-body text-xs ml-1">
            {t("verify.devHint")}
          </Text>
        ) : null}

        <Button label={t("verify.submit")} onPress={submit} loading={loading} />
      </View>
    </Screen>
  );
}
