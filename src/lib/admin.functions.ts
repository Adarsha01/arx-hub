import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const assertAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const adminRoles = new Set([
      "super_admin",
      "tournament_admin",
      "finance_admin",
      "moderator",
    ]);
    const isAdmin = (data ?? []).some((r) => adminRoles.has(r.role as string));
    if (!isAdmin) throw new Error("Forbidden: admin access required");
    return { ok: true as const };
  });