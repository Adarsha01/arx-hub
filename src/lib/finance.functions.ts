import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertFinanceAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const ok = (data ?? []).some((r) =>
    ["super_admin", "finance_admin"].includes(r.role as string),
  );
  if (!ok) throw new Error("Forbidden: finance admin required");
}

export const getFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinanceAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      paymentsRes,
      escrowRes,
      withdrawalsRes,
      failedRes,
      pendingWdRes,
    ] = await Promise.all([
      supabaseAdmin.from("payments").select("amount, status, created_at"),
      supabaseAdmin.from("tournament_escrow_entries").select("tournament_id, amount, entry_type"),
      supabaseAdmin.from("withdrawals").select("amount, status"),
      supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabaseAdmin.from("withdrawals").select("id, user_id, amount, status, payout_method, created_at").in("status", ["pending", "under_review"]).order("created_at"),
    ]);

    const payments = paymentsRes.data ?? [];
    const escrow = escrowRes.data ?? [];
    const withdrawals = withdrawalsRes.data ?? [];

    const totalRevenue = payments
      .filter((p) => p.status === "success")
      .reduce((s, p) => s + Number(p.amount), 0);

    const escrowByTournament: Record<string, number> = {};
    for (const e of escrow) {
      const sign = e.entry_type === "fee_in" ? 1 : -1;
      escrowByTournament[e.tournament_id] = (escrowByTournament[e.tournament_id] ?? 0) + sign * Number(e.amount);
    }
    const totalEscrow = Object.values(escrowByTournament).reduce((s, v) => s + v, 0);

    return {
      totalRevenue,
      totalEscrow,
      pendingWithdrawalsCount: withdrawals.filter((w) => ["pending", "under_review"].includes(w.status as string)).length,
      pendingWithdrawalsAmount: withdrawals
        .filter((w) => ["pending", "under_review"].includes(w.status as string))
        .reduce((s, w) => s + Number(w.amount), 0),
      completedWithdrawalsAmount: withdrawals
        .filter((w) => w.status === "paid")
        .reduce((s, w) => s + Number(w.amount), 0),
      paymentFailures: failedRes.count ?? 0,
      pendingQueue: pendingWdRes.data ?? [],
      escrowByTournament,
    };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        withdrawalId: z.string().uuid(),
        action: z.enum(["approve", "reject", "mark_paid"]),
        notes: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertFinanceAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: w, error } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (error || !w) throw new Error("Withdrawal not found");

    const nextStatus =
      data.action === "approve" ? "approved"
        : data.action === "reject" ? "rejected"
          : "paid";

    await supabaseAdmin
      .from("withdrawals")
      .update({
        status: nextStatus,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.withdrawalId);

    // Refund hold if rejected
    if (data.action === "reject" && w.status !== "rejected") {
      await supabaseAdmin.from("wallet_ledger").insert({
        user_id: w.user_id,
        amount: Number(w.amount),
        entry_type: "credit",
        category: "REFUND",
        reference_id: w.id,
        notes: "Withdrawal rejected — funds returned",
      } as never);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: w.user_id,
      type: "payment",
      title: `Withdrawal ${nextStatus}`,
      body:
        data.action === "reject"
          ? `Your withdrawal of ₹${w.amount} was rejected.`
          : data.action === "mark_paid"
            ? `Your withdrawal of ₹${w.amount} has been paid.`
            : `Your withdrawal of ₹${w.amount} was approved.`,
    } as never);

    await supabaseAdmin.rpc("log_audit", {
      _action: `withdrawal.${data.action}`,
      _entity_type: "withdrawal",
      _entity_id: data.withdrawalId,
      _metadata: { reviewer: context.userId, notes: data.notes ?? null },
    });
    return { ok: true as const, status: nextStatus };
  });

export const distributePrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tournamentId: z.string().uuid(),
        userId: z.string().uuid(),
        amount: z.number().positive(),
        placement: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertFinanceAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Credit user wallet
    const { error: ledErr } = await supabaseAdmin.from("wallet_ledger").insert({
      user_id: data.userId,
      amount: data.amount,
      entry_type: "credit",
      category: "PRIZE",
      reference_id: data.tournamentId,
      notes: data.placement ? `Prize — placement #${data.placement}` : "Prize payout",
    } as never);
    if (ledErr) throw new Error(ledErr.message);

    // Escrow outflow
    await supabaseAdmin.from("tournament_escrow_entries").insert({
      tournament_id: data.tournamentId,
      user_id: data.userId,
      entry_type: "prize_out",
      amount: data.amount,
      reference_id: data.tournamentId,
      notes: data.placement ? `Placement #${data.placement}` : null,
    } as never);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      type: "payment",
      title: "Prize received",
      body: `₹${data.amount} added to your wallet.`,
      link: "/wallet",
    } as never);

    await supabaseAdmin.rpc("log_audit", {
      _action: "prize.distributed",
      _entity_type: "tournament",
      _entity_id: data.tournamentId,
      _metadata: { user_id: data.userId, amount: data.amount, placement: data.placement ?? null },
    });
    return { ok: true as const };
  });