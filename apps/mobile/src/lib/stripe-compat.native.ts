/**
 * Native passthrough — @stripe/stripe-react-native ships no web build (its
 * CardField/PaymentSheet components rely on native TurboModule codegen), so
 * any file importing it directly breaks the Metro web bundle even when the
 * screen is never rendered on web. This split keeps the real SDK confined to
 * iOS/Android builds; see stripe-compat.web.ts for the web-side stub.
 */
export { StripeProvider, useStripe } from "@stripe/stripe-react-native";
