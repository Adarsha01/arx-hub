import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Users, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/teams")({
  head: () => ({ meta: [{ title: "Teams — ARX Hub" }] }),
  component: TeamsPage,
});

function TeamsPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["teams-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, tag, logo_url, region, wins, total_earnings, is_recruiting")
        .order("wins", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black">Teams</h1>
            <p className="text-muted-foreground mt-1">The squads dominating ARX Hub.</p>
          </div>
          {user && (
            <Button asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Link to="/teams/create">Create team</Link>
            </Button>
          )}
        </div>
        {!data?.length ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Users className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">No teams yet. Be the first.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.map((t) => (
              <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="glass-card rounded-2xl p-5 hover:scale-[1.02] transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center font-black text-primary">
                    {t.tag.slice(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">[{t.tag}] · {t.region ?? "Global"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-primary" />{t.wins} W</span>
                  <span className="text-muted-foreground">₹{Number(t.total_earnings).toLocaleString()}</span>
                  {t.is_recruiting && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">Recruiting</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}