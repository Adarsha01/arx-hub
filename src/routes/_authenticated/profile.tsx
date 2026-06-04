import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ARX Hub" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        ign: profile.ign ?? "",
        game_uid: profile.game_uid ?? "",
        region: profile.region ?? "",
        country: profile.country ?? "",
        discord_handle: profile.discord_handle ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form as never).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile", user?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-3xl font-black mb-6">Edit Profile</h1>
        <form className="glass-card rounded-2xl p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div><Label>Display name</Label><Input value={form.display_name ?? ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>In-game name</Label><Input value={form.ign ?? ""} onChange={(e) => setForm({ ...form, ign: e.target.value })} /></div>
            <div><Label>Game UID</Label><Input value={form.game_uid ?? ""} onChange={(e) => setForm({ ...form, game_uid: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Region</Label><Input value={form.region ?? ""} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          </div>
          <div><Label>Discord</Label><Input value={form.discord_handle ?? ""} onChange={(e) => setForm({ ...form, discord_handle: e.target.value })} /></div>
          <div><Label>Bio</Label><Textarea rows={3} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <Button type="submit" disabled={save.isPending} className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold">
            {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </div>
    </SiteShell>
  );
}