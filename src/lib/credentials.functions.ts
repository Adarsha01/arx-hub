import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Read room id/password via the SECURITY DEFINER gate (checked-in or admin). */
export const getMatchCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("get_match_credentials", {
      _match_id: data.matchId,
    });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] as { room_id: string | null; room_password: string | null } | undefined;
    if (!row?.room_id) return { unlocked: false as const };
    return { unlocked: true as const, roomId: row.room_id, roomPassword: row.room_password };
  });

export const regenerateMatchCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      matchId: z.string().uuid(),
      roomId: z.string().min(1).max(64),
      roomPassword: z.string().min(1).max(64),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("regenerate_match_credentials", {
      _match_id: data.matchId,
      _room_id: data.roomId,
      _room_password: data.roomPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });