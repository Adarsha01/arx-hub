import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Shield, Trophy, Swords, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard", replace: true }); }, [isAdmin, loading, nav]);
  if (!isAdmin) return <SiteShell><div className="container mx-auto px-4 py-10">Checking permissions...</div></SiteShell>;

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