export type PaymentProviderName = "razorpay" | "mock";

export interface ProviderOrder {
  providerOrderId: string;
  amount: number; // in major units (INR rupees)
  currency: string;
  keyId?: string;
}

export interface ParsedWebhookEvent {
  providerOrderId: string;
  providerPaymentId: string;
  status: "success" | "failed" | "pending";
  amountMinor?: number;
  raw: unknown;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  /** Whether real credentials are configured. When false, providers operate in dev/mock mode. */
  isLive(): boolean;
  createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<ProviderOrder>;
  /** Verify the client-side checkout callback signature. */
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  /** Verify a webhook HTTP request. */
  verifyWebhook(input: { rawBody: string; signature: string | null }): boolean;
  parseWebhookEvent(payload: unknown): ParsedWebhookEvent;
}