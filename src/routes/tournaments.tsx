import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Trophy, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/tournaments")({
  head: () => ({ meta: [{ title: "Tournaments — ARX Hub" }, { name: "description", content: "Browse all upcoming and live esports tournaments." }] }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id, slug, name, banner_url, prize_pool, entry_fee, mode, status, starts_at, max_teams")
        .neq("status", "draft")
        .order("starts_at", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-black mb-2">Tournaments</h1>
        <p className="text-muted-foreground mb-8">All active and upcoming battles.</p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !data?.length ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Trophy className="h-10 w-10 text-primary mx-auto mb-3" />
            <p>No tournaments yet. An admin needs to create one.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.map((t) => (
              <Link key={t.id} to="/tournaments/$slug" params={{ slug: t.slug }} className="glass-card rounded-2xl p-5 hover:scale-[1.02] transition group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider font-bold text-accent">{t.mode}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary">{t.status.replace(/_/g, " ")}</span>
                </div>
                <h3 className="text-xl font-bold group-hover:text-gradient">{t.name}</h3>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Prize</p><p className="font-bold text-primary">₹{Number(t.prize_pool).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Entry</p><p className="font-bold">{Number(t.entry_fee) > 0 ? `₹${t.entry_fee}` : "FREE"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Slots</p><p className="font-bold flex items-center gap-1"><Users className="h-3 w-3" />{t.max_teams}</p></div>
                </div>
                {t.starts_at && (
                  <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{new Date(t.starts_at).toLocaleString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}