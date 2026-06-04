import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tournamentStatuses = [
  "draft", "scheduled", "registration_open", "registration_closed",
  "checkin_open", "checkin_closed", "live", "under_review", "completed", "cancelled",
] as const;

/** Capacity + (if signed-in) my registration / waitlist position for a tournament. */
export const getTournamentCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tournamentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("max_teams, status")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (!t) throw new Error("Tournament not found");

    const { count: activeCount } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", data.tournamentId)
      .in("status", ["pending", "confirmed", "checked_in"]);

    const { count: waitlistCount } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", data.tournamentId)
      .eq("status", "waitlisted");

    const { data: mine } = await supabaseAdmin
      .from("tournament_registrations")
      .select("id, status, waitlist_position")
      .eq("tournament_id", data.tournamentId)
      .or(`user_id.eq.${userId},registered_by.eq.${userId}`)
      .maybeSingle();

    const capacity = t.max_teams ?? 0;
    const isFull = (activeCount ?? 0) >= capacity;
    return {
      capacity,
      activeCount: activeCount ?? 0,
      waitlistCount: waitlistCount ?? 0,
      isFull,
      myRegistration: mine ?? null,
    };
  });

/** Add the user or their team to the waitlist when the tournament is full. */
export const joinWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tournamentId: z.string().uuid(),
      teamId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, mode, status, max_teams")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (!t) throw new Error("Tournament not found");
    if (!["registration_open", "scheduled", "registration_closed"].includes(t.status as string)) {
      throw new Error("Waitlist is not available for this tournament");
    }
    if (t.mode !== "solo" && !data.teamId) throw new Error("Team required");

    // Dedupe: any existing reg blocks a duplicate join.
    const existingQ = supabaseAdmin
      .from("tournament_registrations")
      .select("id, status, waitlist_position")
      .eq("tournament_id", t.id);
    const { data: existing } = data.teamId
      ? await existingQ.eq("team_id", data.teamId).maybeSingle()
      : await existingQ.eq("user_id", userId).maybeSingle();
    if (existing) {
      return { id: existing.id, status: existing.status, waitlistPosition: existing.waitlist_position };
    }

    const row: Record<string, unknown> = {
      tournament_id: t.id,
      registered_by: userId,
      status: "waitlisted",
      payment_status: "created",
    };
    if (data.teamId) row.team_id = data.teamId; else row.user_id = userId;

    const { data: ins, error } = await supabaseAdmin
      .from("tournament_registrations")
      .insert(row as never)
      .select("id, status, waitlist_position")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.rpc("log_audit", {
      _action: "registration.waitlisted",
      _entity_type: "tournament_registration",
      _entity_id: ins.id,
      _metadata: { tournament_id: t.id, user_id: userId },
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "tournament",
      title: "You're on the waitlist",
      body: `Position #${ins.waitlist_position ?? "?"}. We'll notify you if a slot opens up.`,
      link: `/tournaments`,
    } as never);
    return { id: ins.id, status: ins.status, waitlistPosition: ins.waitlist_position };
  });

export const adminSetTournamentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tournamentId: z.string().uuid(),
      status: z.enum(tournamentStatuses),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("admin_set_tournament_status", {
      _tournament_id: data.tournamentId,
      _new_status: data.status,
    });
    if (error) throw new Error(error.message);
    return { status: res };
  });

export const adminMarkNoShows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tournamentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await supabaseAdmin.rpc("mark_no_shows", {
      _tournament_id: data.tournamentId,
    });
    if (error) throw new Error(error.message);
    return { markedCount: count ?? 0 };
  });

export const adminPromoteWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tournamentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("promote_from_waitlist", {
      _tournament_id: data.tournamentId,
    });
    if (error) throw new Error(error.message);
    return { promotedRegistrationId: id as string | null };
  });

export const adminUpdateTournamentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tournamentId: z.string().uuid(),
      checkinOpensAt: z.string().datetime().nullable().optional(),
      checkinClosesAt: z.string().datetime().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles ?? []).some((r) =>
      ["tournament_admin", "super_admin"].includes(r.role as string));
    if (!ok) throw new Error("Not authorized");

    const patch: Record<string, unknown> = {};
    if (data.checkinOpensAt !== undefined) patch.checkin_opens_at = data.checkinOpensAt;
    if (data.checkinClosesAt !== undefined) patch.checkin_closes_at = data.checkinClosesAt;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("tournaments")
      .update(patch as never)
      .eq("id", data.tournamentId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("log_audit", {
      _action: "tournament.schedule_updated",
      _entity_type: "tournament",
      _entity_id: data.tournamentId,
      _metadata: patch as never,
    });
    return { ok: true };
  });