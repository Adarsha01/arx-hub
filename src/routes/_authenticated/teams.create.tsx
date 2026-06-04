import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/create")({
  head: () => ({ meta: [{ title: "Create Team — ARX Hub" }] }),
  component: CreateTeamPage,
});

function CreateTeamPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name, tag: tag.toUpperCase(), region, description, captain_id: user.id })
      .select()
      .maybeSingle();
    if (error || !team) { setLoading(false); toast.error(error?.message ?? "Failed"); return; }
    await supabase.from("team_members").insert({ team_id: team.id, user_id: user.id, role: "captain" });
    setLoading(false);
    toast.success("Team created");
    nav({ to: "/teams/$id", params: { id: team.id } });
  }

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <h1 className="text-3xl font-black mb-6">Create Team</h1>
        <form className="glass-card rounded-2xl p-6 space-y-4" onSubmit={submit}>
          <div><Label>Team name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Phoenix Esports" /></div>
          <div><Label>Tag (max 6)</Label><Input required maxLength={6} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="PHX" /></div>
          <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="India" /></div>
          <div><Label>About</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button type="submit" disabled={loading} className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold w-full">
            {loading ? "Creating..." : "Create team"}
          </Button>
        </form>
      </div>
    </SiteShell>
  );
}