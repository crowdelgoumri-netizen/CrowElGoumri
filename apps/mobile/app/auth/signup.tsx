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
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Screen } from "../../src/components/Screen";
import { ApiError } from "../../src/lib/api";
import * as authApi from "../../src/lib/auth";

export default function SignupScreen() {
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
      const msg = e instanceof ApiError ? e.message : "Inscription impossible";
      Alert.alert("Inscription impossible", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen variant="dark">
      <View className="mt-xl">
        <Text className="text-white font-heading text-3xl font-bold">
          Créer un compte
        </Text>
        <Text className="text-muted font-body text-base mt-1">
          Rejoignez le réseau Crowshi — Europe → Algérie.
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="mt-xl gap-md pb-xl"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-md">
          <View className="flex-1">
            <Input label="Prénom" value={firstName} onChangeText={setFirstName} />
          </View>
          <View className="flex-1">
            <Input label="Nom" value={lastName} onChangeText={setLastName} />
          </View>
        </View>
        <Input
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          label="Téléphone (E.164)"
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
        <Input
          label="Mot de passe (≥ 8 caractères)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        <Button label="Créer mon compte" onPress={submit} loading={loading} />

        <View className="mt-lg flex-row justify-center gap-1">
          <Text className="text-muted font-body">Déjà un compte ?</Text>
          <Link href="/auth/login" className="text-accent font-body font-semibold">
            Se connecter
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}
