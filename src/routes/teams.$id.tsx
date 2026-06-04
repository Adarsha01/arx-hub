import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/teams/$id")({
  head: () => ({ meta: [{ title: "Team — ARX Hub" }] }),
  component: TeamDetail,
});

function TeamDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: team } = useQuery({
    queryKey: ["team", id],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["team-members", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id, role, joined_at, profiles(id, username, display_name, avatar_url, ign)")
        .eq("team_id", id);
      return data ?? [];
    },
  });

  const isCaptain = !!user && team?.captain_id === user.id;

  const [inviteUsername, setInviteUsername] = useState("");
  const invite = useMutation({
    mutationFn: async () => {
      if (!user || !team) throw new Error("?");
      const { data: target } = await supabase.from("profiles").select("id").eq("username", inviteUsername).maybeSingle();
      if (!target) throw new Error("User not found");
      const { error } = await supabase.from("team_invitations").insert({
        team_id: team.id, invited_user_id: target.id, invited_by: user.id, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invite sent"); setInviteUsername(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["team-members", id] }); },
  });

  if (!team) return <SiteShell><div className="container mx-auto px-4 py-10">Loading...</div></SiteShell>;

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center font-black text-primary text-xl">
              {team.tag.slice(0, 3)}
            </div>
            <div>
              <h1 className="text-3xl font-black">{team.name}</h1>
              <p className="text-sm text-muted-foreground">[{team.tag}] · {team.region ?? "Global"}</p>
            </div>
          </div>
          {team.description && <p className="mt-4 text-sm text-muted-foreground">{team.description}</p>}
          <div className="mt-4 flex gap-4 text-sm">
            <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-primary" />{team.wins} wins</span>
            <span className="text-muted-foreground">₹{Number(team.total_earnings).toLocaleString()} earned</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Roster ({members?.length ?? 0})</h2>
          <ul className="space-y-2">
            {(members ?? []).map((m: any) => (
              <li key={m.id} className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <p className="font-medium">{m.profiles?.display_name || m.profiles?.username}</p>
                  {m.profiles?.ign && <p className="text-xs text-muted-foreground">IGN: {m.profiles.ign}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary">{m.role}</span>
                  {isCaptain && m.profiles?.id !== team.captain_id && (
                    <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(m.id)}>Remove</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {isCaptain && (
            <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
              <Input placeholder="Invite by username" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} />
              <Button type="submit" disabled={invite.isPending}>Invite</Button>
            </form>
          )}
        </div>
      </div>
    </SiteShell>
  );
}