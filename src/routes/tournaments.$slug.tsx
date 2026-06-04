import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Calendar, Users, Coins, Shield } from "lucide-react";

export const Route = createFileRoute("/tournaments/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — ARX Hub` }] }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: t, isLoading } = useQuery({
    queryKey: ["tournament", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: registrations } = useQuery({
    enabled: !!t,
    queryKey: ["registrations", t?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_registrations")
        .select("id, status, team_id, user_id, teams(name, tag, logo_url), profiles(username, display_name, avatar_url)")
        .eq("tournament_id", t!.id);
      return data ?? [];
    },
  });

  const { data: myTeams } = useQuery({
    enabled: !!user,
    queryKey: ["my-teams", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name, tag").eq("captain_id", user!.id);
      return data ?? [];
    },
  });

  const register = useMutation({
    mutationFn: async (payload: { teamId?: string }) => {
      if (!user || !t) throw new Error("Not authenticated");
      const row: Record<string, unknown> = {
        tournament_id: t.id,
        registered_by: user.id,
        status: "pending",
        payment_status: Number(t.entry_fee) > 0 ? "pending" : "success",
      };
      if (payload.teamId) row.team_id = payload.teamId;
      else row.user_id = user.id;
      const { error } = await supabase.from("tournament_registrations").insert(row as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registered! Awaiting confirmation.");
      qc.invalidateQueries({ queryKey: ["registrations", t?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <SiteShell><div className="container mx-auto px-4 py-12">Loading...</div></SiteShell>;
  if (!t) return <SiteShell><div className="container mx-auto px-4 py-12">Tournament not found.</div></SiteShell>;

  const isSolo = t.mode === "solo";
  const canRegister = ["registration_open", "scheduled"].includes(t.status);

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="glass-card rounded-3xl p-8 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "var(--gradient-glow)" }} />
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-wider font-bold text-accent">{t.mode}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary">{t.status.replace(/_/g, " ")}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black">{t.name}</h1>
          {t.description && <p className="mt-3 text-muted-foreground max-w-3xl">{t.description}</p>}

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={Trophy} label="Prize Pool" value={`₹${Number(t.prize_pool).toLocaleString()}`} highlight />
            <Stat icon={Coins} label="Entry Fee" value={Number(t.entry_fee) > 0 ? `₹${t.entry_fee}` : "FREE"} />
            <Stat icon={Users} label="Max Teams" value={String(t.max_teams)} />
            <Stat icon={Calendar} label="Starts" value={t.starts_at ? new Date(t.starts_at).toLocaleDateString() : "TBD"} />
          </div>

          {canRegister && (
            <div className="mt-8 flex flex-wrap gap-3">
              {!user ? (
                <Button onClick={() => navigate({ to: "/auth", search: { redirect: `/tournaments/${slug}` } })}
                  className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[var(--shadow-neon)]">
                  Sign in to register
                </Button>
              ) : isSolo ? (
                <Button onClick={() => register.mutate({})} disabled={register.isPending}
                  className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[var(--shadow-neon)]">
                  Register solo
                </Button>
              ) : myTeams?.length ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Register with team:</span>
                  {myTeams.map((tm) => (
                    <Button key={tm.id} variant="outline" onClick={() => register.mutate({ teamId: tm.id })} disabled={register.isPending}>
                      [{tm.tag}] {tm.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button variant="outline" asChild><Link to="/teams/create">Create a team first</Link></Button>
              )}
            </div>
          )}
        </div>

        {t.rules && (
          <div className="glass-card rounded-2xl p-6 mb-6">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Rules</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{t.rules}</p>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">Registered participants ({registrations?.length ?? 0})</h2>
          {!registrations?.length ? (
            <p className="text-sm text-muted-foreground">No one's signed up yet. Be the first.</p>
          ) : (
            <ul className="space-y-2">
              {registrations.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-sm">
                    {r.teams ? `[${r.teams.tag}] ${r.teams.name}` : r.profiles?.display_name || r.profiles?.username || "Player"}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-background/40 p-4 border border-border/40">
      <Icon className={`h-4 w-4 mb-2 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-bold ${highlight ? "text-primary text-lg" : ""}`}>{value}</p>
    </div>
  );
}