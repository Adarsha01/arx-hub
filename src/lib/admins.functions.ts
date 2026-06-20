import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_ROLES = ["tournament_admin", "finance_admin", "moderator"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role,status")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, status, granted_by, granted_at, created_at")
      .in("role", [...ADMIN_ROLES, "super_admin"])
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id as string)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, email, last_login_at, created_at")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    return {
      admins: (roleRows ?? []).map((r) => ({
        user_id: r.user_id as string,
        role: r.role as string,
        status: r.status as string,
        granted_at: r.granted_at as string,
        granted_by: r.granted_by as string | null,
        profile: map.get(r.user_id as string) ?? null,
      })),
    };
  });

export const promoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(ADMIN_ROLES),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: data.userId,
        role: data.role as AdminRole,
        status: "active",
        granted_by: context.userId,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.promoted",
      entity_type: "user_role",
      entity_id: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

export const demoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot demote yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", [...ADMIN_ROLES]);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.demoted",
      entity_type: "user_role",
      entity_id: data.userId,
      metadata: {},
    });
    return { ok: true };
  });

export const setAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum([...ADMIN_ROLES, "super_admin"] as const),
      status: z.enum(["active", "suspended"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId && data.status === "suspended") {
      throw new Error("You cannot suspend yourself");
    }
    if (data.role === "super_admin" && data.status === "suspended") {
      throw new Error("Super admin cannot be suspended");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ status: data.status })
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.status === "active" ? "admin.activated" : "admin.suspended",
      entity_type: "user_role",
      entity_id: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

export const searchUsersByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().min(2).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, username")
      .or(`email.ilike.%${data.query}%,username.ilike.%${data.query}%,display_name.ilike.%${data.query}%`)
      .limit(10);
    if (error) throw new Error(error.message);
    return { users: rows ?? [] };
  });