/**
 * Server-only payment finalization helpers. Shared by:
 *  - the mock confirmation server fn (dev mode)
 *  - the webhook route handler (live mode)
 *
 * Never import this file from a route, component, or *.functions.ts at
 * module scope — load it inside a `.handler()` via `await import(...)`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function finalizePaymentSuccess(args: {
  paymentId: string;
  providerPaymentId: string;
  actorId?: string | null;
}) {
  const { paymentId, providerPaymentId, actorId } = args;

  // Idempotency: if already succeeded, return early.
  const { data: pay, error: payErr } = await supabaseAdmin
    .from("payments")
    .select("id, status, user_id, tournament_id, amount, registration_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (payErr || !pay) throw new Error("Payment not found");
  if (pay.status === "success") {
    return { ok: true as const, alreadyFinalized: true, paymentId };
  }

  const { error: upErr } = await supabaseAdmin
    .from("payments")
    .update({
      status: "success",
      provider_payment_id: providerPaymentId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "created"); // optimistic guard
  if (upErr) throw new Error(upErr.message);

  // Finalize registration
  if (pay.registration_id) {
    await supabaseAdmin
      .from("tournament_registrations")
      .update({ status: "confirmed", payment_status: "success", payment_ref: providerPaymentId })
      .eq("id", pay.registration_id);
  }

  // Credit escrow
  if (pay.tournament_id) {
    await supabaseAdmin.from("tournament_escrow_entries").insert({
      tournament_id: pay.tournament_id,
      user_id: pay.user_id,
      entry_type: "fee_in",
      amount: Number(pay.amount),
      reference_id: pay.id,
      notes: "Entry fee",
    } as never);
  }

  // Notify user
  await supabaseAdmin.from("notifications").insert({
    user_id: pay.user_id,
    type: "payment",
    title: "Payment successful",
    body: `Your registration is confirmed. ₹${pay.amount} received.`,
    link: pay.tournament_id ? `/dashboard` : null,
  } as never);

  await supabaseAdmin.rpc("log_audit", {
    _action: "payment.success",
    _entity_type: "payment",
    _entity_id: paymentId,
    _metadata: {
      provider_payment_id: providerPaymentId,
      actor_id: actorId ?? null,
    },
  });

  return { ok: true as const, alreadyFinalized: false, paymentId };
}

export async function finalizePaymentFailure(args: {
  paymentId: string;
  providerPaymentId?: string;
  reason?: string;
}) {
  const { paymentId, providerPaymentId, reason } = args;
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("id, status, user_id, registration_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return;
  if (pay.status === "failed" || pay.status === "success") return;

  await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      provider_payment_id: providerPaymentId ?? null,
      notes: reason ?? null,
    })
    .eq("id", paymentId);

  if (pay.registration_id) {
    await supabaseAdmin
      .from("tournament_registrations")
      .update({ payment_status: "failed", status: "cancelled" })
      .eq("id", pay.registration_id);
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: pay.user_id,
    type: "payment",
    title: "Payment failed",
    body: reason ?? "Your payment could not be processed.",
  } as never);

  await supabaseAdmin.rpc("log_audit", {
    _action: "payment.failed",
    _entity_type: "payment",
    _entity_id: paymentId,
    _metadata: { reason: reason ?? null },
  });
}