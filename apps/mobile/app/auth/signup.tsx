/**
 * Signup screen — POST /auth/signup, then navigate to verify-phone with
 * the phone pre-filled. Account creation doesn't return tokens (phone must
 * be verified first); the verify screen completes the session.
 *
 * E.164 phone hint reflects the Algeria/EUR re-skin: +213 for Algerian
 * diaspora calling home, +33 for France-based senders.
 */
import { useState } from "react";
import { Link, router } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ApiError } from "../../src/lib/api";
import * as authApi from "../../src/lib/auth";

export default function SignupScreen() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+213");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await authApi.signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      // Backend doesn't auto-log-in; head to verify with the phone prefilled.
      router.replace({
        pathname: "/auth/verify-phone",
        params: { phone: res.user.phone },
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t("signup.errorFallback");
      Alert.alert(t("signup.errorTitle"), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View className="mt-xl">
        <Text className="text-text-primary font-heading text-screen-title font-bold">
          {t("common.signup")}
        </Text>
        <Text className="text-text-muted font-body text-base mt-1">
          {t("signup.subtitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="mt-xl gap-stack-gap pb-xl"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-stack-gap">
          <View className="flex-1">
            <Input label={t("field.firstName")} value={firstName} onChangeText={setFirstName} testID="signup-first-name" />
          </View>
          <View className="flex-1">
            <Input label={t("field.lastName")} value={lastName} onChangeText={setLastName} testID="signup-last-name" />
          </View>
        </View>
        <Input
          label={t("field.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          testID="signup-email"
        />
        <Input
          label={t("field.phone")}
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          testID="signup-phone"
        />
        <Input
          label={t("field.passwordHint")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          testID="signup-password"
        />

        <Button label={t("signup.submit")} onPress={submit} loading={loading} />

        <View className="mt-section-gap flex-row justify-center gap-1">
          <Text className="text-text-muted font-body">{t("signup.haveAccount")}</Text>
          <Link href="/auth/login" className="text-accent font-body font-semibold">
            {t("common.login")}
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}
