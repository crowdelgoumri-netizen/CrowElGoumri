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
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ApiError, isDevOtpMode } from "../../src/lib/api";
import * as authApi from "../../src/lib/auth";
import { useAuth } from "../../src/store/auth";

export default function VerifyPhoneScreen() {
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
      const msg = e instanceof ApiError ? e.message : "Code invalide";
      Alert.alert("Vérification impossible", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen variant="dark">
      <View className="mt-xl">
        <Text className="text-white font-heading text-3xl font-bold">
          Vérifiez votre téléphone
        </Text>
        <Text className="text-muted font-body text-base mt-1">
          Entrez le code à 6 chiffres reçu par SMS.
        </Text>
      </View>

      <View className="mt-xl gap-md">
        <Input
          label="Téléphone (E.164)"
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          keyboardType="phone-pad"
        />
        <Input
          label="Code (6 chiffres)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={6}
        />

        {isDevOtpMode() ? (
          <Text className="text-muted font-body text-xs ml-1">
            📱 Dev mode : utilisez le code 000000
          </Text>
        ) : null}

        <Button label="Vérifier" onPress={submit} loading={loading} />
      </View>
    </Screen>
  );
}
