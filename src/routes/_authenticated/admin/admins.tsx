import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listAdmins, promoteUser, demoteAdmin, setAdminStatus, searchUsersByEmail,
} from "@/lib/admins.functions";
import { bootstrapPlatformOwner } from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  component: AdminManagement,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  tournament_admin: "Tournament Admin",
  finance_admin: "Finance Admin",
  moderator: "Moderator",
};

function AdminManagement() {
  const { roles } = useAuth();
  const nav = useNavigate();
  const isSuper = roles.includes("super_admin");
  useEffect(() => {
    if (!isSuper) nav({ to: "/admin", replace: true });
  }, [isSuper, nav]);
  if (!isSuper) return null;

  const qc = useQueryClient();
  const fetchAdmins = useServerFn(listAdmins);
  const promote = useServerFn(promoteUser);
  const demote = useServerFn(demoteAdmin);
  const setStatus = useServerFn(setAdminStatus);
  const search = useServerFn(searchUsersByEmail);
  const bootstrap = useServerFn(bootstrapPlatformOwner);

  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () => fetchAdmins(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admins"] });

  const promoteMut = useMutation({
    mutationFn: (args: { userId: string; role: "tournament_admin" | "finance_admin" | "moderator" }) =>
      promote({ data: args }),
    onSuccess: () => { toast.success("User promoted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const demoteMut = useMutation({
    mutationFn: (userId: string) => demote({ data: { userId } }),
    onSuccess: () => { toast.success("Admin demoted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: (args: { userId: string; role: string; status: "active" | "suspended" }) =>
      setStatus({ data: args as never }),
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const bootstrapMut = useMutation({
    mutationFn: () => bootstrap(),
    onSuccess: (r) => {
      if (r.alreadyExists) toast.info("Platform owner already exists");
      else toast.success("Platform owner created");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [q, setQ] = useState("");
  const [pickedUser, setPickedUser] = useState<{ id: string; email: string | null } | null>(null);
  const [pickedRole, setPickedRole] = useState<"tournament_admin" | "finance_admin" | "moderator">("tournament_admin");
  const { data: searchRes, refetch } = useQuery({
    queryKey: ["admin-search", q],
    queryFn: () => search({ data: { query: q } }),
    enabled: false,
  });

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Admin Management</h2>
            <p className="text-sm text-muted-foreground">Super-admin-only console for granting, suspending, and removing admin roles.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => bootstrapMut.mutate()} disabled={bootstrapMut.isPending}>
            Initialize platform owner
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <h3 className="font-bold">Promote user</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Find user (email, username, name)</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search..." />
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={q.length < 2}>Search</Button>
        </div>
        {!!searchRes?.users.length && (
          <ul className="text-sm divide-y divide-border/40">
            {searchRes.users.map((u) => (
              <li key={u.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{u.display_name ?? u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button size="sm" variant={pickedUser?.id === u.id ? "default" : "outline"} onClick={() => setPickedUser({ id: u.id, email: u.email })}>
                  {pickedUser?.id === u.id ? "Selected" : "Select"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {pickedUser && (
          <div className="flex items-end gap-2 pt-2 border-t border-border/40">
            <div className="flex-1">
              <Label>Role to grant</Label>
              <Select value={pickedRole} onValueChange={(v) => setPickedRole(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tournament_admin">Tournament Admin</SelectItem>
                  <SelectItem value="finance_admin">Finance Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => promoteMut.mutate({ userId: pickedUser.id, role: pickedRole })}
              disabled={promoteMut.isPending}
            >
              Promote {pickedUser.email ?? "user"}
            </Button>
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4">
        <h3 className="font-bold mb-3">Current admins</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !data?.admins.length ? (
          <p className="text-sm text-muted-foreground">No admins yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Granted</th>
                  <th className="py-2 pr-3">Last login</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.admins.map((a) => {
                  const isSuperRow = a.role === "super_admin";
                  return (
                    <tr key={`${a.user_id}-${a.role}`} className="border-t border-border/30">
                      <td className="py-2 pr-3">{a.profile?.display_name ?? a.profile?.username ?? a.user_id.slice(0, 8)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{a.profile?.email ?? "—"}</td>
                      <td className="py-2 pr-3">{ROLE_LABEL[a.role] ?? a.role}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>{a.status}</span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{a.granted_at ? new Date(a.granted_at).toLocaleDateString() : "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{a.profile?.last_login_at ? new Date(a.profile.last_login_at).toLocaleString() : "—"}</td>
                      <td className="py-2 flex flex-wrap gap-1">
                        {!isSuperRow && (
                          <>
                            {a.status === "active" ? (
                              <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ userId: a.user_id, role: a.role, status: "suspended" })}>Suspend</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ userId: a.user_id, role: a.role, status: "active" })}>Activate</Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => { if (confirm("Remove all admin roles from this user?")) demoteMut.mutate(a.user_id); }}>Remove</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}