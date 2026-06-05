import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Submit a match result (captain/participant). */
export const submitMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      matchId: z.string().uuid(),
      teamId: z.string().uuid().nullable().optional(),
      userId: z.string().uuid().nullable().optional(),
      placement: z.number().int().min(1).max(100).nullable().optional(),
      kills: z.number().int().min(0).max(1000).default(0),
      points: z.number().int().min(0).max(100000).default(0),
      screenshotUrl: z.string().url().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("submit_match_result", {
      _match_id: data.matchId,
      _team_id: data.teamId ?? null,
      _user_id: data.userId ?? null,
      _placement: data.placement ?? null,
      _kills: data.kills,
      _points: data.points,
      _screenshot_url: data.screenshotUrl ?? null,
    });
    if (error) throw new Error(error.message);
    return { resultId: id as string };
  });

export const confirmMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ resultId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("confirm_match_result", { _result_id: data.resultId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disputeMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      resultId: z.string().uuid(),
      category: z.enum(["incorrect_result", "missing_evidence", "cheating", "no_show", "misconduct", "other"]),
      description: z.string().min(5).max(2000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("dispute_match_result", {
      _result_id: data.resultId,
      _category: data.category,
      _description: data.description,
    });
    if (error) throw new Error(error.message);
    return { disputeId: id as string };
  });

/** Record evidence row (after client uploads to storage). */
export const recordEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      resultId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
      mimeType: z.string().max(100).optional(),
      caption: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Enforce path is under the user's own folder
    if (!data.storagePath.startsWith(`${userId}/`)) {
      throw new Error("Storage path must be under your user folder");
    }
    const { data: row, error } = await supabaseAdmin
      .from("match_result_evidence")
      .insert({
        match_result_id: data.resultId,
        uploaded_by: userId,
        storage_path: data.storagePath,
        mime_type: data.mimeType ?? null,
        caption: data.caption ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** Signed URLs for a result's evidence (participants/admins only — checked in DB RLS). */
export const getEvidenceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ resultId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("match_result_evidence")
      .select("id, storage_path, mime_type, caption, created_at")
      .eq("match_result_id", data.resultId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const items: Array<{ id: string; url: string; mime_type: string | null; caption: string | null }> = [];
    for (const r of rows ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("match-evidence")
        .createSignedUrl(r.storage_path as string, 60 * 10);
      if (signed?.signedUrl) {
        items.push({ id: r.id as string, url: signed.signedUrl, mime_type: r.mime_type as string | null, caption: r.caption as string | null });
      }
    }
    return { items };
  });

export const listMatchResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("match_results")
      .select("id, match_id, team_id, user_id, placement, kills, points, screenshot_url, status, verified, submitted_by, confirmed_by, confirmed_at, evidence_count, created_at, teams(name, tag), profiles!match_results_user_id_fkey(username, display_name)" as never)
      .eq("match_id", data.matchId)
      .order("created_at", { ascending: false });
    if (error) {
      // fallback without joined profile (FK name may vary)
      const { data: rows2, error: e2 } = await supabaseAdmin
        .from("match_results")
        .select("id, match_id, team_id, user_id, placement, kills, points, screenshot_url, status, verified, submitted_by, confirmed_by, confirmed_at, evidence_count, created_at")
        .eq("match_id", data.matchId)
        .order("created_at", { ascending: false });
      if (e2) throw new Error(e2.message);
      return { results: rows2 ?? [] };
    }
    return { results: rows ?? [] };
  });