import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Bell, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ARX Hub" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: myTeams } = useQuery({
    queryKey: ["my-teams-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("teams(id, name, tag, logo_url, wins)")
        .eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.teams).filter(Boolean);
    },
    enabled: !!user,
  });

  const { data: myRegs } = useQuery({
    queryKey: ["my-regs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_registrations")
        .select("id, status, tournaments(id, slug, name, status, starts_at)")
        .or(`user_id.eq.${user!.id},registered_by.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: notifCount } = useQuery({
    queryKey: ["notif-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10">
        <div className="glass-card rounded-2xl p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Welcome back</p>
            <h1 className="text-3xl font-black">{profile?.display_name || profile?.username || "Player"}</h1>
            {profile?.ign && <p className="text-sm text-muted-foreground">IGN: {profile.ign}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/profile"><User className="h-4 w-4 mr-1" />Edit Profile</Link></Button>
            <Button asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Link to="/notifications"><Bell className="h-4 w-4 mr-1" />Inbox {notifCount ? `(${notifCount})` : ""}</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Matches" value={profile?.matches_played ?? 0} />
          <StatCard label="Wins" value={profile?.wins ?? 0} />
          <StatCard label="Kills" value={profile?.kills ?? 0} />
          <StatCard label="Earnings" value={`₹${Number(profile?.total_earnings ?? 0).toLocaleString()}`} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2"><Users className="h-4 w-4 text-primary" />My Teams</h2>
              <Button size="sm" variant="ghost" asChild><Link to="/teams/create">+ New</Link></Button>
            </div>
            {!myTeams?.length ? (
              <p className="text-sm text-muted-foreground">You're not in any team yet.</p>
            ) : (
              <ul className="space-y-2">
                {myTeams.map((t: any) => (
                  <li key={t.id}>
                    <Link to="/teams/$id" params={{ id: t.id }} className="flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 border border-border/40">
                      <span className="font-medium">[{t.tag}] {t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.wins} wins</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Trophy className="h-4 w-4 text-primary" />My Tournaments</h2>
            {!myRegs?.length ? (
              <p className="text-sm text-muted-foreground">No registrations. <Link to="/tournaments" className="text-primary">Browse →</Link></p>
            ) : (
              <ul className="space-y-2">
                {myRegs.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <Link to="/tournaments/$slug" params={{ slug: r.tournaments?.slug }} className="font-medium hover:text-primary">
                      {r.tournaments?.name ?? "—"}
                    </Link>
                    <span className="text-xs text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black mt-1 text-gradient">{value}</p>
    </div>
  );
}