import type { PaymentProvider, PaymentProviderName } from "./types";
import { razorpayProvider } from "./razorpay.server";

const providers: Record<PaymentProviderName, PaymentProvider> = {
  razorpay: razorpayProvider,
  mock: razorpayProvider, // alias — same placeholder behavior
};

export function getPaymentProvider(name: PaymentProviderName = "razorpay"): PaymentProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown payment provider: ${name}`);
  return p;
}