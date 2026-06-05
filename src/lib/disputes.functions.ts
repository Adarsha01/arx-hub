import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("disputes")
      .select("id, tournament_id, match_id, status, category, description, verdict, verdict_action, created_at, last_activity_at")
      .eq("raised_by", userId)
      .order("last_activity_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { disputes: data ?? [] };
  });

export const listDisputeQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles ?? []).some((r) =>
      ["moderator", "tournament_admin", "super_admin"].includes(r.role as string),
    );
    if (!ok) throw new Error("Not authorized");
    const { data, error } = await supabaseAdmin
      .from("disputes")
      .select("id, tournament_id, match_id, status, category, description, raised_by, assigned_to, verdict, verdict_action, created_at, last_activity_at")
      .in("status", ["open", "under_review", "request_info"])
      .order("last_activity_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { disputes: data ?? [] };
  });

export const getDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ disputeId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dispute, error } = await supabaseAdmin
      .from("disputes")
      .select("*")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: messages } = await supabaseAdmin
      .from("dispute_messages")
      .select("id, author_id, body, internal, created_at")
      .eq("dispute_id", data.disputeId)
      .order("created_at", { ascending: true });
    return { dispute, messages: messages ?? [] };
  });

export const postDisputeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      disputeId: z.string().uuid(),
      body: z.string().min(1).max(2000),
      internal: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.internal) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      const ok = (roles ?? []).some((r) =>
        ["moderator", "tournament_admin", "super_admin"].includes(r.role as string),
      );
      if (!ok) throw new Error("Only moderators can post internal notes");
    }
    const { error } = await supabaseAdmin.from("dispute_messages").insert({
      dispute_id: data.disputeId,
      author_id: userId,
      body: data.body,
      internal: data.internal,
    } as never);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("disputes")
      .update({ last_activity_at: new Date().toISOString() } as never)
      .eq("id", data.disputeId);
    return { ok: true };
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      disputeId: z.string().uuid(),
      verdictAction: z.enum(["accept", "reverse", "rematch", "award_win", "disqualify", "cancel_match"]),
      verdict: z.string().min(1).max(2000),
      newStatus: z.enum(["resolved", "rejected", "request_info"]).default("resolved"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("resolve_dispute", {
      _dispute_id: data.disputeId,
      _verdict_action: data.verdictAction,
      _verdict: data.verdict,
      _new_status: data.newStatus,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ disputeId: z.string().uuid(), assignToSelf: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles ?? []).some((r) =>
      ["moderator", "tournament_admin", "super_admin"].includes(r.role as string),
    );
    if (!ok) throw new Error("Not authorized");
    const { error } = await supabaseAdmin
      .from("disputes")
      .update({
        assigned_to: data.assignToSelf ? userId : null,
        status: "under_review",
        last_activity_at: new Date().toISOString(),
      } as never)
      .eq("id", data.disputeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });