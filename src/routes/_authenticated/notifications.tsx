import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Inbox — ARX Hub" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifs } = useQuery({
    queryKey: ["notifs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false)
      .then(() => qc.invalidateQueries({ queryKey: ["notif-count", user.id] }));
  }, [user, qc]);

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-2"><Bell className="h-6 w-6 text-primary" />Inbox</h1>
        {!notifs?.length ? (
          <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">No notifications.</div>
        ) : (
          <ul className="space-y-2">
            {notifs.map((n) => (
              <li key={n.id} className="glass-card rounded-xl p-4">
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}