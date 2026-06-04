import { createFileRoute } from "@tanstack/react-router";

/**
 * Provider-agnostic webhook endpoint.
 *
 * URL: /api/public/payments/webhook/:provider
 *
 * Currently routes through the Razorpay placeholder provider. When real
 * credentials are configured the verifyWebhook + parseWebhookEvent
 * implementations in src/lib/payments/razorpay.server.ts take effect with
 * zero changes to this file.
 */
export const Route = createFileRoute("/api/public/payments/webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { getPaymentProvider } = await import("@/lib/payments/index.server");
        const { finalizePaymentSuccess, finalizePaymentFailure } = await import(
          "@/lib/payments-core.server"
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const providerName = params.provider as "razorpay" | "mock";
        let provider;
        try {
          provider = getPaymentProvider(providerName);
        } catch {
          return new Response("Unknown provider", { status: 404 });
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-razorpay-signature") ??
          request.headers.get("x-webhook-signature");

        if (!provider.verifyWebhook({ rawBody, signature })) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed;
        try {
          parsed = provider.parseWebhookEvent(JSON.parse(rawBody));
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        // Look up payment by provider_order_id
        const { data: pay } = await supabaseAdmin
          .from("payments")
          .select("id")
          .eq("provider_order_id", parsed.providerOrderId)
          .maybeSingle();
        if (!pay) return new Response("Unknown order", { status: 404 });

        if (parsed.status === "success") {
          await finalizePaymentSuccess({
            paymentId: pay.id,
            providerPaymentId: parsed.providerPaymentId,
          });
        } else if (parsed.status === "failed") {
          await finalizePaymentFailure({
            paymentId: pay.id,
            providerPaymentId: parsed.providerPaymentId,
            reason: "Provider reported failure",
          });
        }

        return new Response("ok");
      },
    },
  },
});