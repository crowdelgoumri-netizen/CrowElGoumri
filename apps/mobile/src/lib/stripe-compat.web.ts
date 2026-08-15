/**
 * Web stub — see stripe-compat.native.ts for why this split exists.
 * The web build has no card-payment surface yet (Phase 10 gated the real
 * payment step behind a native dev build); these stand-ins let the rest of
 * the app render on web without pulling in the native-only Stripe SDK.
 */
import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

export function StripeProvider({ children }: { children?: ReactNode; publishableKey?: string }) {
  return createElement(Fragment, null, children);
}

const NOT_SUPPORTED = { error: { code: "Failed", message: "Le paiement par carte nécessite l'application mobile." } };

export function useStripe() {
  return {
    initPaymentSheet: async () => NOT_SUPPORTED,
    presentPaymentSheet: async () => NOT_SUPPORTED,
  };
}
