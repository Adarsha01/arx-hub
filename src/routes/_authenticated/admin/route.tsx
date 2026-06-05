import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Shield, Trophy, Swords, LayoutDashboard, IndianRupee, Activity } from "lucide-react";
import { assertAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const verify = useServerFn(assertAdmin);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-verify"],
    queryFn: () => verify(),
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/dashboard", replace: true });
    if (isError) nav({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, isError, nav]);
  if (isLoading || !data?.ok || !isAdmin) {
    return <SiteShell><div className="container mx-auto px-4 py-10">Verifying permissions...</div></SiteShell>;
  }

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-black">Admin Control Center</h1>
        </div>
        <nav className="flex flex-wrap gap-2 mb-6 border-b border-border/40 pb-3">
          <NavTab to="/admin" icon={LayoutDashboard}>Overview</NavTab>
          <NavTab to="/admin/tournaments" icon={Trophy}>Tournaments</NavTab>
          <NavTab to="/admin/matches" icon={Swords}>Matches</NavTab>
          <NavTab to="/admin/operations" icon={Activity}>Operations</NavTab>
          <NavTab to="/admin/finance" icon={IndianRupee}>Finance</NavTab>
        </nav>
        <Outlet />
      </div>
    </SiteShell>
  );
}

function NavTab({ to, icon: Icon, children }: { to: string; icon: any; children: React.ReactNode }) {
  return (
    <Link to={to} className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/10 flex items-center gap-2" activeProps={{ className: "bg-primary/15 text-primary" }}>
      <Icon className="h-4 w-4" />{children}
    </Link>
  );
}