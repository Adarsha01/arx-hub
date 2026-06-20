import { createServerFn } from "@tanstack/react-start";

/**
 * Idempotent platform-owner bootstrap. Safe to expose publicly because it
 * no-ops the moment any super_admin already exists.
 */
export const bootstrapPlatformOwner = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing) return { alreadyExists: true as const };

  const email = "adxhub.tourni@gmail.com";
  const password = "adxhub.tourni";

  // Try to create; if the auth user already exists, look them up.
  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Platform Owner" },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else if (created.error) {
    // Look up by listing — the auth admin API has no get-by-email.
    const list = await supabaseAdmin.auth.admin.listUsers();
    const found = list.data?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!found) throw new Error(created.error.message);
    userId = found.id;
  }
  if (!userId) throw new Error("Could not resolve owner user id");

  await supabaseAdmin.from("user_roles").upsert(
    { user_id: userId, role: "super_admin", status: "active", granted_at: new Date().toISOString() },
    { onConflict: "user_id,role" },
  );
  await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: userId,
    action: "platform.owner_bootstrapped",
    entity_type: "user",
    entity_id: userId,
    metadata: { email },
  });

  return { alreadyExists: false as const, userId };
});