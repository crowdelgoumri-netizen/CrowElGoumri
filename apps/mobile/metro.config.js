/**
 * Metro config — NativeWind + monorepo.
 *
 * watchFolders points at the repo root so Metro picks up changes across
 * the workspace (today the mobile app only fetches the API over HTTP, but
 * if it ever imports a shared package, this is what makes it resolve).
 */
const path = require("node:path");

// Expo Router 57 requires this at module load time so that
// require.context(process.env.EXPO_ROUTER_APP_ROOT, ...) in
// _ctx.*.js resolves to a string during Metro dependency collection.
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, "app");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../..")];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
