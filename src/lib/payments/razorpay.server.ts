import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import type { PaymentProvider, ParsedWebhookEvent, ProviderOrder } from "./types";

/**
 * Razorpay provider — placeholder.
 *
 * When RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET are
 * present, this file is the single place to wire real HTTP calls + HMAC
 * verification. Until then it operates in mock mode:
 *   - createOrder() returns a deterministic mock order id
 *   - verifyCheckoutSignature() accepts any signature prefixed with "mock_sig_"
 *   - verifyWebhook() accepts any payload (dev only)
 */
function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const razorpayProvider: PaymentProvider = {
  name: "razorpay",
  isLive() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  },

  async createOrder({ amount, currency, receipt }): Promise<ProviderOrder> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return {
        providerOrderId: `mock_order_${randomUUID()}`,
        amount,
        currency,
      };
    }

    // TODO: real Razorpay Orders API call when credentials are provided.
    // const res = await fetch("https://api.razorpay.com/v1/orders", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    //   },
    //   body: JSON.stringify({ amount: Math.round(amount * 100), currency, receipt }),
    // });
    // const json = await res.json();
    // return { providerOrderId: json.id, amount, currency, keyId };

    return {
      providerOrderId: `mock_order_${randomUUID()}`,
      amount,
      currency,
      keyId,
    };
  },

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      // Dev / placeholder mode: accept anything that looks intentional.
      return signature.startsWith("mock_sig_");
    }
    const expected = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    return safeEq(expected, signature);
  },

  verifyWebhook({ rawBody, signature }) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      // Dev / placeholder mode.
      return true;
    }
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEq(expected, signature);
  },

  parseWebhookEvent(payload): ParsedWebhookEvent {
    const p = payload as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            status?: string;
          };
        };
      };
    };
    const entity = p?.payload?.payment?.entity ?? {};
    let status: ParsedWebhookEvent["status"] = "pending";
    if (p?.event === "payment.captured" || entity.status === "captured") status = "success";
    else if (p?.event === "payment.failed" || entity.status === "failed") status = "failed";
    return {
      providerPaymentId: entity.id ?? "",
      providerOrderId: entity.order_id ?? "",
      status,
      amountMinor: entity.amount,
      raw: payload,
    };
  },
};