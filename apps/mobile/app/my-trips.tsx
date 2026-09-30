/**
 * /my-trips — legacy route kept as a redirect.
 *
 * Mes voyages now lives in the tab shell (`/(tabs)/trips`); this route stays
 * so old deep links and notification routes keep working.
 */
import { Redirect } from "expo-router";

export default function MyTripsRedirect() {
  return <Redirect href="/(tabs)/trips" />;
}
