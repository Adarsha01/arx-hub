import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — ARX Hub" }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data: players } = useQuery({
    queryKey: ["lb-players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, wins, kills, total_earnings")
        .order("total_earnings", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3"><Crown className="h-8 w-8 text-primary" /> Global Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Top earners across all ARX Hub tournaments.</p>
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Wins</th>
                <th className="px-4 py-3 text-right">Kills</th>
                <th className="px-4 py-3 text-right">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {(players ?? []).map((p, i) => (
                <tr key={p.id} className="border-t border-border/40 hover:bg-primary/5">
                  <td className="px-4 py-3 font-bold text-primary">{i + 1}</td>
                  <td className="px-4 py-3">{p.display_name || p.username}</td>
                  <td className="px-4 py-3 text-right">{p.wins}</td>
                  <td className="px-4 py-3 text-right">{p.kills}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">₹{Number(p.total_earnings).toLocaleString()}</td>
                </tr>
              ))}
              {!players?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No players ranked yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SiteShell>
  );
}