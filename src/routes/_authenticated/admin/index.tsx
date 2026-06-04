import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, teams, tournaments, registrations] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("teams").select("*", { count: "exact", head: true }),
        supabase.from("tournaments").select("*", { count: "exact", head: true }),
        supabase.from("tournament_registrations").select("*", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        teams: teams.count ?? 0,
        tournaments: tournaments.count ?? 0,
        registrations: registrations.count ?? 0,
      };
    },
  });

  return (
    <div className="grid md:grid-cols-4 gap-4">
      {[
        { label: "Users", value: data?.users ?? 0 },
        { label: "Teams", value: data?.teams ?? 0 },
        { label: "Tournaments", value: data?.tournaments ?? 0 },
        { label: "Registrations", value: data?.registrations ?? 0 },
      ].map((s) => (
        <div key={s.label} className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase text-muted-foreground tracking-wider">{s.label}</p>
          <p className="text-3xl font-black mt-1 text-gradient">{s.value}</p>
        </div>
      ))}
    </div>
  );
}