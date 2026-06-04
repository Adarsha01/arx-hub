import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Shield, Users, Target, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ARX Hub — Compete. Win. Dominate." },
      { name: "description", content: "Enterprise-grade esports tournaments for Free Fire and beyond. Real prizes, real competition." },
      { property: "og:title", content: "ARX Hub" },
      { property: "og:description", content: "Compete in esports tournaments and win real prizes." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: featured } = useQuery({
    queryKey: ["featured-tournaments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id, slug, name, banner_url, prize_pool, entry_fee, mode, status, starts_at")
        .in("status", ["scheduled", "registration_open"])
        .order("starts_at", { ascending: true })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-60" style={{ background: "var(--gradient-glow)" }} />
        <div className="container mx-auto px-4 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-6">
            <Radio className="h-3 w-3 animate-pulse" />
            Season 1 · Free Fire tournaments live now
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            Compete. Win. <span className="text-gradient">Dominate.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            The enterprise-grade esports platform for Free Fire and beyond. Real tournaments, real prizes, real competition.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[var(--shadow-neon)]">
              <Link to="/tournaments">Browse tournaments</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Create account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Trophy, title: "Real Prize Pools", desc: "Entry fees flow into an escrowed prize pool. Winners get paid out automatically." },
            { icon: Shield, title: "Anti-Cheat Built In", desc: "Screenshot verification, dispute resolution, and a moderator review queue." },
            { icon: Zap, title: "Live Match Engine", desc: "Brackets, room IDs, real-time leaderboards. Mobile-first PWA experience." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card rounded-2xl p-6">
              <Icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured tournaments */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Featured tournaments</h2>
            <p className="text-muted-foreground mt-1">Jump into a battle starting soon.</p>
          </div>
          <Button variant="ghost" asChild><Link to="/tournaments">View all →</Link></Button>
        </div>

        {!featured?.length ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Target className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">No upcoming tournaments yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((t) => (
              <Link key={t.id} to="/tournaments/$slug" params={{ slug: t.slug }} className="glass-card rounded-2xl p-5 hover:scale-[1.02] transition group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider font-bold text-accent">{t.mode}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary">{t.status.replace("_", " ")}</span>
                </div>
                <h3 className="text-xl font-bold group-hover:text-gradient transition">{t.name}</h3>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Prize Pool</p>
                    <p className="font-bold text-primary">₹{Number(t.prize_pool).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Entry</p>
                    <p className="font-bold">{Number(t.entry_fee) > 0 ? `₹${Number(t.entry_fee)}` : "FREE"}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="glass-card rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "var(--gradient-glow)" }} />
          <Users className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-bold">Form your squad. Climb the ranks.</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Create a team, invite your players, and start grinding for the top of the global leaderboard.</p>
          <Button size="lg" className="mt-8 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[var(--shadow-neon)]" asChild>
            <Link to="/auth">Get started — it's free</Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}
