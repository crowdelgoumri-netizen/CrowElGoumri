/**
 * Metro config — NativeWind + monorepo.
 *
 * watchFolders points at the repo root so Metro picks up changes across
 * the workspace (today the mobile app only fetches the API over HTTP, but
 * if it ever imports a shared package, this is what makes it resolve).
 */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../..")];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
