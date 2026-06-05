import { supabase } from "@/integrations/supabase/client";

/** Upload a file to the user's own folder in match-evidence. Returns storage path. */
export async function uploadEvidenceFile(userId: string, file: File): Promise<{ path: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from("match-evidence").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return { path };
}