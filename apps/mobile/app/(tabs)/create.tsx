/**
 * Create (tab bar center slot) — never rendered in normal use.
 *
 * The center "Créer un envoi" tab intercepts its own press in
 * (tabs)/_layout.tsx and pushes /post-parcel directly, so this screen is
 * only reached if that interception somehow doesn't fire (e.g.
 * programmatic/accessibility navigation). It immediately redirects rather
 * than showing blank content, using `replace` so it never sits in the
 * back stack.
 */
import { useEffect } from "react";
import { router } from "expo-router";

export default function CreateRedirect() {
  useEffect(() => {
    router.replace("/post-parcel");
  }, []);
  return null;
}
