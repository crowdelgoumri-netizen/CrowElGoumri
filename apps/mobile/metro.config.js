/**
 * Metro config — NativeWind + monorepo.
 *
 * No watchFolders override: this widens Metro's server root to the common
 * ancestor of projectRoot and every watchFolders entry, which broke entry
 * file resolution during `expo export:embed` (native release/debug builds)
 * by turning the absolute entry path into "./apps/mobile/..." relative to
 * the repo root instead of apps/mobile. pnpm already symlinks every
 * dependency into apps/mobile/node_modules, so Metro resolves them without
 * this. Revisit only if the app starts importing a workspace package Metro
 * can't reach through those symlinks.
 */
const path = require("node:path");

// Expo Router 57 requires this at module load time so that
// require.context(process.env.EXPO_ROUTER_APP_ROOT, ...) in
// _ctx.*.js resolves to a string during Metro dependency collection.
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, "app");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
