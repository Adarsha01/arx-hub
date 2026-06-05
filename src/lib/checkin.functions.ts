import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkInSelfOrTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tournamentId: z.string().uuid(),
      teamId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("checkin_self", {
      _tournament_id: data.tournamentId,
      _team_id: data.teamId ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { registrationId: id as string };
  });

export const adminAutoDisqualify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tournamentId: z.string().uuid(),
      graceMinutes: z.number().int().min(0).max(360).default(0),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await supabaseAdmin.rpc("auto_disqualify_no_shows", {
      _tournament_id: data.tournamentId,
      _grace_minutes: data.graceMinutes,
    } as never);
    if (error) throw new Error(error.message);
    return { disqualifiedCount: (count as number) ?? 0 };
  });

export const getCheckinMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tournamentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles ?? []).some((r) =>
      ["moderator", "tournament_admin", "super_admin"].includes(r.role as string),
    );
    if (!ok) throw new Error("Not authorized");

    const { data: regs } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id, status, payment_status, user_id, team_id, checked_in_at, dq_reason, waitlist_position, teams(name, tag)")
      .eq("tournament_id", data.tournamentId)
      .order("status");
    return { registrations: regs ?? [] };
  });

export const getStatusHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tournamentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tournament_status_history")
      .select("id, from_status, to_status, changed_by, reason, created_at")
      .eq("tournament_id", data.tournamentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });