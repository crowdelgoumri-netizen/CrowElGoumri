import { useState } from "react";
import { Link, router } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Select } from "../../src/components/Select";
import { Screen } from "../../src/components/Screen";
import { ApiError } from "../../src/lib/api";
import * as authApi from "../../src/lib/auth";

const COUNTRY_CODES = [
  { value: "+33",  label: "🇫🇷 +33"  },
  { value: "+213", label: "🇩🇿 +213" },
  { value: "+32",  label: "🇧🇪 +32"  },
  { value: "+41",  label: "🇨🇭 +41"  },
  { value: "+49",  label: "🇩🇪 +49"  },
  { value: "+44",  label: "🇬🇧 +44"  },
  { value: "+34",  label: "🇪🇸 +34"  },
  { value: "+39",  label: "🇮🇹 +39"  },
  { value: "+31",  label: "🇳🇱 +31"  },
  { value: "+351", label: "🇵🇹 +351" },
  { value: "+352", label: "🇱🇺 +352" },
  { value: "+212", label: "🇲🇦 +212" },
  { value: "+216", label: "🇹🇳 +216" },
  { value: "+46",  label: "🇸🇪 +46"  },
  { value: "+45",  label: "🇩🇰 +45"  },
  { value: "+47",  label: "🇳🇴 +47"  },
  { value: "+43",  label: "🇦🇹 +43"  },
  { value: "+48",  label: "🇵🇱 +48"  },
  { value: "+1",   label: "🇺🇸 +1"   },
];

export default function SignupScreen() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+33");
  const [nationalNumber, setNationalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const phone = countryCode + nationalNumber.trim();
      const res = await authApi.signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone,
        password,
      });
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
        <View className="flex-row gap-stack-gap">
          <View style={{ width: 112 }}>
            <Select
              label={t("field.countryCode")}
              value={countryCode}
              options={COUNTRY_CODES}
              onSelect={setCountryCode}
            />
          </View>
          <View className="flex-1">
            <Input
              label={t("field.phone")}
              value={nationalNumber}
              onChangeText={setNationalNumber}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              testID="signup-phone"
            />
          </View>
        </View>
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
