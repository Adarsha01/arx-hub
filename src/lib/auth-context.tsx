import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "player"
  | "team_captain"
  | "moderator"
  | "tournament_admin"
  | "finance_admin"
  | "super_admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfileAndRoles(s.user.id), 0);
        if (_event === "SIGNED_IN") {
          setTimeout(() => {
            void supabase
              .from("profiles")
              .update({ last_login_at: new Date().toISOString() })
              .eq("id", s.user.id);
          }, 0);
        }
      } else {
        setRoles([]);
        setMustChangePassword(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfileAndRoles(data.session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfileAndRoles(userId: string) {
    const [{ data: roleRows }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role,status").eq("user_id", userId),
      supabase.from("profiles").select("must_change_password").eq("id", userId).maybeSingle(),
    ]);
    setRoles(
      (roleRows ?? [])
        .filter((r) => (r as { status?: string }).status !== "suspended")
        .map((r) => r.role as AppRole),
    );
    setMustChangePassword(!!(prof as { must_change_password?: boolean } | null)?.must_change_password);
  }

  const isAdmin = roles.some((r) =>
    ["super_admin", "tournament_admin", "finance_admin", "moderator"].includes(r),
  );
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        loading,
        isAdmin,
        isSuperAdmin,
        mustChangePassword,
        refreshProfile: async () => {
          if (session?.user) await loadProfileAndRoles(session.user.id);
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}