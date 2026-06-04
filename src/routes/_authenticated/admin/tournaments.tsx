import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  adminSetTournamentStatus,
  adminMarkNoShows,
  adminPromoteWaitlist,
  adminUpdateTournamentSchedule,
} from "@/lib/tournaments.functions";

export const Route = createFileRoute("/_authenticated/admin/tournaments")({
  component: AdminTournaments,
});

function AdminTournaments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const setStatusFn = useServerFn(adminSetTournamentStatus);
  const markNoShowsFn = useServerFn(adminMarkNoShows);
  const promoteWaitlistFn = useServerFn(adminPromoteWaitlist);
  const updateScheduleFn = useServerFn(adminUpdateTournamentSchedule);
  const { data: list } = useQuery({
    queryKey: ["admin-tournaments"],
    queryFn: async () => {
      const { data } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    name: "", slug: "", description: "", mode: "squad",
    entry_fee: "0", prize_pool: "0", max_teams: "25",
    starts_at: "", status: "scheduled",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("?");
      const { error } = await supabase.from("tournaments").insert({
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: form.description,
        mode: form.mode as any,
        entry_fee: Number(form.entry_fee),
        prize_pool: Number(form.prize_pool),
        max_teams: Number(form.max_teams),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        status: form.status as any,
        created_by: user.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tournament created"); qc.invalidateQueries({ queryKey: ["admin-tournaments"] }); setForm({ ...form, name: "", slug: "", description: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      setStatusFn({ data: { tournamentId: id, status: status as never } }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["admin-tournaments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const noShowsMut = useMutation({
    mutationFn: (id: string) => markNoShowsFn({ data: { tournamentId: id } }),
    onSuccess: (r) => { toast.success(`Marked ${r.markedCount} no-shows`); qc.invalidateQueries({ queryKey: ["admin-tournaments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoteMut = useMutation({
    mutationFn: (id: string) => promoteWaitlistFn({ data: { tournamentId: id } }),
    onSuccess: (r) => {
      toast.success(r.promotedRegistrationId ? "Promoted next on waitlist" : "Nothing to promote");
      qc.invalidateQueries({ queryKey: ["admin-tournaments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMut = useMutation({
    mutationFn: (vars: { id: string; opens: string | null; closes: string | null }) =>
      updateScheduleFn({
        data: {
          tournamentId: vars.id,
          checkinOpensAt: vars.opens ? new Date(vars.opens).toISOString() : null,
          checkinClosesAt: vars.closes ? new Date(vars.closes).toISOString() : null,
        },
      }),
    onSuccess: () => { toast.success("Check-in window saved"); qc.invalidateQueries({ queryKey: ["admin-tournaments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-lg mb-4">Existing tournaments</h2>
        <ul className="space-y-2">
          {(list ?? []).map((t) => (
            <li key={t.id} className="border border-border/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <Link to="/tournaments/$slug" params={{ slug: t.slug }} className="font-medium truncate block hover:text-primary">{t.name}</Link>
                  <p className="text-xs text-muted-foreground">{t.mode} · ₹{Number(t.prize_pool).toLocaleString()} pool</p>
                </div>
                <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["draft","scheduled","registration_open","registration_closed","checkin_open","checkin_closed","live","under_review","completed","cancelled"].map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Check-in opens</Label>
                  <Input
                    type="datetime-local"
                    defaultValue={t.checkin_opens_at ? toLocalInput(t.checkin_opens_at) : ""}
                    onBlur={(e) => scheduleMut.mutate({ id: t.id, opens: e.target.value || null, closes: t.checkin_closes_at })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Check-in closes</Label>
                  <Input
                    type="datetime-local"
                    defaultValue={t.checkin_closes_at ? toLocalInput(t.checkin_closes_at) : ""}
                    onBlur={(e) => scheduleMut.mutate({ id: t.id, opens: t.checkin_opens_at, closes: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => promoteMut.mutate(t.id)} disabled={promoteMut.isPending}>
                  Promote waitlist
                </Button>
                <Button size="sm" variant="outline" onClick={() => noShowsMut.mutate(t.id)} disabled={noShowsMut.isPending}>
                  Mark no-shows
                </Button>
              </div>
            </li>
          ))}
          {!list?.length && <p className="text-sm text-muted-foreground">No tournaments yet.</p>}
        </ul>
      </div>

      <form className="glass-card rounded-2xl p-5 space-y-3 h-fit" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <h2 className="font-bold text-lg">Create tournament</h2>
        <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Slug (URL)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from name" /></div>
        <div><Label>Mode</Label>
          <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="duo">Duo</SelectItem>
              <SelectItem value="squad">Squad</SelectItem>
              <SelectItem value="clan">Clan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Entry fee (₹)</Label><Input type="number" min={0} value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} /></div>
          <div><Label>Prize pool (₹)</Label><Input type="number" min={0} value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Max teams</Label><Input type="number" min={2} value={form.max_teams} onChange={(e) => setForm({ ...form, max_teams: e.target.value })} /></div>
          <div><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
        </div>
        <div><Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="registration_open">Registration open</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <Button type="submit" disabled={create.isPending} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold">
          {create.isPending ? "Creating..." : "Create"}
        </Button>
      </form>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}