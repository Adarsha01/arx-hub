import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Create (or fetch existing) tournament order.
 *
 * Flow:
 *  1. Validate tournament + capacity + dedupe registration.
 *  2. Insert pending registration (if not already there).
 *  3. If entry_fee = 0 → mark registration confirmed, no payment.
 *  4. Else → create payment row + provider order, return order details to client.
 *     When provider is in mock mode (no Razorpay keys), the same call
 *     auto-finalizes the payment + registration + escrow so end-to-end
 *     flows work without real credentials.
 */
export const createTournamentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tournamentId: z.string().uuid(),
        teamId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPaymentProvider } = await import("@/lib/payments/index.server");

    const { data: t, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .select("id, entry_fee, max_teams, status, mode")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (tErr || !t) throw new Error("Tournament not found");

    if (!["registration_open", "scheduled"].includes(t.status as string)) {
      throw new Error("Registration is not open");
    }

    const isSolo = t.mode === "solo";
    if (!isSolo && !data.teamId) throw new Error("Team required");

    // Dedupe
    const dedupeQuery = supabaseAdmin
      .from("tournament_registrations")
      .select("id, status, payment_status")
      .eq("tournament_id", t.id);
    const { data: existing } = data.teamId
      ? await dedupeQuery.eq("team_id", data.teamId).maybeSingle()
      : await dedupeQuery.eq("user_id", userId).maybeSingle();

    let registrationId = existing?.id as string | undefined;

    if (!registrationId) {
      const row: Record<string, unknown> = {
        tournament_id: t.id,
        registered_by: userId,
        status: "pending",
        payment_status: Number(t.entry_fee) > 0 ? "created" : "success",
      };
      if (data.teamId) row.team_id = data.teamId;
      else row.user_id = userId;
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("tournament_registrations")
        .insert(row as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      registrationId = ins.id;
    }

    // Free tournament → confirm and exit
    if (Number(t.entry_fee) === 0) {
      await supabaseAdmin
        .from("tournament_registrations")
        .update({ status: "confirmed", payment_status: "success" })
        .eq("id", registrationId!);
      await supabaseAdmin.rpc("log_audit", {
        _action: "registration.confirmed_free",
        _entity_type: "tournament_registration",
        _entity_id: registrationId,
        _metadata: { tournament_id: t.id, user_id: userId },
      });
      return { kind: "free" as const, registrationId };
    }

    // Paid → create provider order + payment row
    const provider = getPaymentProvider("razorpay");
    const order = await provider.createOrder({
      amount: Number(t.entry_fee),
      currency: "INR",
      receipt: `reg_${registrationId}`,
      notes: { tournament_id: t.id, user_id: userId },
    });

    const idempotencyKey = `tournament:${t.id}:reg:${registrationId}`;
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .upsert(
        {
          tournament_id: t.id,
          user_id: userId,
          provider: provider.name,
          amount: Number(t.entry_fee),
          currency: "INR",
          status: "created",
          provider_order_id: order.providerOrderId,
          idempotency_key: idempotencyKey,
          registration_id: registrationId,
        } as never,
        { onConflict: "idempotency_key" },
      )
      .select("id, provider_order_id, amount, status")
      .single();
    if (payErr) throw new Error(payErr.message);

    await supabaseAdmin.rpc("log_audit", {
      _action: "payment.order_created",
      _entity_type: "payment",
      _entity_id: payment.id,
      _metadata: {
        tournament_id: t.id,
        amount: Number(t.entry_fee),
        live: provider.isLive(),
      },
    });

    return {
      kind: "paid" as const,
      live: provider.isLive(),
      registrationId,
      paymentId: payment.id,
      provider: provider.name,
      providerOrderId: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
    };
  });

/**
 * Simulate a successful payment confirmation. Used by the mock provider when
 * Razorpay keys are not configured. In live mode this is rejected — payment
 * confirmation must arrive via the verified webhook.
 */
export const confirmMockPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ paymentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPaymentProvider } = await import("@/lib/payments/index.server");
    const provider = getPaymentProvider("razorpay");
    if (provider.isLive()) {
      throw new Error("Mock confirmation disabled when provider is live");
    }
    const { finalizePaymentSuccess } = await import("@/lib/payments-core.server");
    return finalizePaymentSuccess({
      paymentId: data.paymentId,
      providerPaymentId: `mock_pay_${Date.now()}`,
      actorId: userId,
    });
  });

export const getWalletSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: wallet }, { data: ledger }, { data: balRpc }] = await Promise.all([
      supabaseAdmin.from("wallets").select("balance, currency, updated_at").eq("user_id", userId).maybeSingle(),
      supabaseAdmin
        .from("wallet_ledger")
        .select("id, amount, entry_type, category, notes, reference_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin.rpc("get_wallet_balance", { _user_id: userId }),
    ]);
    return {
      balance: Number(balRpc ?? wallet?.balance ?? 0),
      currency: wallet?.currency ?? "INR",
      updatedAt: wallet?.updated_at ?? null,
      ledger: ledger ?? [],
    };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().positive().max(1_000_000),
        payoutMethod: z.enum(["upi", "bank"]),
        payoutDetails: z.record(z.string(), z.string().max(255)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: balRpc, error: balErr } = await supabaseAdmin.rpc("get_wallet_balance", {
      _user_id: userId,
    });
    if (balErr) throw new Error(balErr.message);
    if (Number(balRpc) < data.amount) throw new Error("Insufficient balance");

    // Hold funds via ledger debit + create withdrawal in pending
    const { data: ins, error: insErr } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        user_id: userId,
        amount: data.amount,
        payout_method: data.payoutMethod,
        payout_details: data.payoutDetails,
        status: "pending",
      } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { error: ledErr } = await supabaseAdmin.from("wallet_ledger").insert({
      user_id: userId,
      amount: data.amount,
      entry_type: "debit",
      category: "WITHDRAWAL",
      reference_id: ins.id,
      notes: "Withdrawal hold",
    } as never);
    if (ledErr) throw new Error(ledErr.message);

    await supabaseAdmin.rpc("log_audit", {
      _action: "withdrawal.requested",
      _entity_type: "withdrawal",
      _entity_id: ins.id,
      _metadata: { amount: data.amount, method: data.payoutMethod },
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "payment",
      title: "Withdrawal requested",
      body: `Your withdrawal of ₹${data.amount} is under review.`,
    } as never);

    return { id: ins.id };
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("withdrawals")
      .select("id, amount, status, payout_method, created_at, reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const checkInRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ registrationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg, error } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id, user_id, team_id, status, payment_status, tournament_id, tournaments(status, checkin_opens_at, checkin_closes_at)")
      .eq("id", data.registrationId)
      .maybeSingle();
    if (error || !reg) throw new Error("Registration not found");

    // Authorization: registrant, solo user, or team captain
    const isOwner = reg.user_id === userId;
    let isCaptain = false;
    if (reg.team_id) {
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("captain_id")
        .eq("id", reg.team_id)
        .maybeSingle();
      isCaptain = team?.captain_id === userId;
    }
    if (!isOwner && !isCaptain) throw new Error("Not allowed to check in this registration");

    const tournament = (reg as { tournaments?: { status?: string; checkin_opens_at?: string | null; checkin_closes_at?: string | null } }).tournaments;
    const now = new Date();
    if (tournament?.status !== "checkin_open") throw new Error("Check-in is not open");
    if (tournament.checkin_opens_at && now < new Date(tournament.checkin_opens_at))
      throw new Error("Check-in has not started yet");
    if (tournament.checkin_closes_at && now > new Date(tournament.checkin_closes_at))
      throw new Error("Check-in window has closed");
    if (reg.payment_status !== "success") throw new Error("Payment not verified");

    const { error: upErr } = await supabaseAdmin
      .from("tournament_registrations")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", data.registrationId);
    if (upErr) throw new Error(upErr.message);
    await supabaseAdmin.rpc("log_audit", {
      _action: "registration.checked_in",
      _entity_type: "tournament_registration",
      _entity_id: data.registrationId,
      _metadata: { user_id: userId },
    });
    return { ok: true as const };
  });