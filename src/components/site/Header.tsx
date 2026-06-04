import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Gamepad2, LayoutDashboard, Shield, LogOut, Wallet } from "lucide-react";

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <Gamepad2 className="h-7 w-7 text-primary" />
            <div className="absolute inset-0 blur-md bg-primary/40 group-hover:bg-primary/60 transition" />
          </div>
          <span className="text-xl font-black tracking-tight text-gradient">ARX HUB</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/tournaments" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition">
            Tournaments
          </Link>
          <Link to="/teams" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition">
            Teams
          </Link>
          <Link to="/leaderboard" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition">
            Leaderboard
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin"><Shield className="h-4 w-4 mr-1" />Admin</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link to="/wallet"><Wallet className="h-4 w-4 mr-1" />Wallet</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard"><LayoutDashboard className="h-4 w-4 mr-1" />Dashboard</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[var(--shadow-neon)] hover:opacity-90">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}