/** @type {import('jest').Config} */
// jest-expo's default transformIgnorePatterns assumes a flat (npm/yarn) node_modules
// layout: "/node_modules/(?!react-native|expo|...)". Under pnpm, real packages live
// nested inside "node_modules/.pnpm/<name>@<version>/node_modules/<name>/...", so the
// first "/node_modules/" segment (immediately followed by ".pnpm/...") never matches
// an allowed name and the whole file gets marked ignored before the regex ever reaches
// the real package segment. Re-declare the same allow-list but tolerant of the
// ".pnpm/<scope>+<name>@<version>" encoding (pnpm replaces "/" with "+" in scoped names).
const RN_TRANSFORM_ALLOWLIST =
  "(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-svg|react-native-css-interop|nativewind";
const RN_TRANSFORM_ALLOWLIST_PNPM = RN_TRANSFORM_ALLOWLIST.replace(/@([\w.-]+)\//g, "@$1\\+").replace(
  /\//g,
  "\\+",
);

module.exports = {
  preset: "jest-expo",
  // Only test files under __tests__/ (+ *.test.ts) so config/asset files the
  // Expo preset pulls in don't get picked up as suites.
  testMatch: ["<rootDir>/src/**/*.{test,spec}.{ts,tsx}"],
  transformIgnorePatterns: [
    `node_modules/(?!\\.pnpm/(${RN_TRANSFORM_ALLOWLIST_PNPM})|(${RN_TRANSFORM_ALLOWLIST}))`,
    "node_modules/react-native-reanimated/plugin/",
  ],
};
