import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { adminAutoDisqualify, getCheckinMonitor, getStatusHistory } from "@/lib/checkin.functions";
import { listDisputeQueue, assignDispute } from "@/lib/disputes.functions";
import { adminMarkNoShows, adminPromoteWaitlist } from "@/lib/tournaments.functions";

export const Route = createFileRoute("/_authenticated/admin/operations")({
  component: AdminOperations,
});

function AdminOperations() {
  const [tournamentId, setTournamentId] = useState<string>("");
  const { data: tournaments } = useQuery({
    queryKey: ["ops-tournaments"],
    queryFn: async () => {
      const { data } = await supabase.from("tournaments").select("id, name, status").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4">
        <Label>Tournament</Label>
        <Select value={tournamentId} onValueChange={setTournamentId}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select a tournament..." /></SelectTrigger>
          <SelectContent>
            {(tournaments ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name} · {t.status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="checkin">
        <TabsList>
          <TabsTrigger value="checkin">Check-In Monitor</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="disputes">Dispute Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="checkin"><CheckinPanel tournamentId={tournamentId} /></TabsContent>
        <TabsContent value="lifecycle"><LifecyclePanel tournamentId={tournamentId} /></TabsContent>
        <TabsContent value="disputes"><DisputeQueuePanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function CheckinPanel({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient();
  const fetchMonitor = useServerFn(getCheckinMonitor);
  const noShows = useServerFn(adminMarkNoShows);
  const promote = useServerFn(adminPromoteWaitlist);
  const autoDQ = useServerFn(adminAutoDisqualify);
  const [grace, setGrace] = useState("0");

  const { data } = useQuery({
    enabled: !!tournamentId,
    queryKey: ["checkin-monitor", tournamentId],
    queryFn: () => fetchMonitor({ data: { tournamentId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["checkin-monitor", tournamentId] });
  const noShowMut = useMutation({
    mutationFn: () => noShows({ data: { tournamentId } }),
    onSuccess: (r) => { toast.success(`Marked ${r.markedCount} no-shows`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const promoteMut = useMutation({
    mutationFn: () => promote({ data: { tournamentId } }),
    onSuccess: () => { toast.success("Promoted next waitlist entry"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dqMut = useMutation({
    mutationFn: () => autoDQ({ data: { tournamentId, graceMinutes: Number(grace) } }),
    onSuccess: (r) => { toast.success(`Disqualified ${r.disqualifiedCount}`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tournamentId) return <p className="text-sm text-muted-foreground p-4">Pick a tournament.</p>;

  const counts = (data?.registrations ?? []).reduce((acc: Record<string, number>, r) => {
    acc[r.status as string] = (acc[r.status as string] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Checked in: <b>{counts.checked_in ?? 0}</b> · Confirmed: <b>{counts.confirmed ?? 0}</b> · Pending: <b>{counts.pending ?? 0}</b> · Waitlist: <b>{counts.waitlisted ?? 0}</b> · No-show: <b>{counts.no_show ?? 0}</b> · DQ: <b>{counts.disqualified ?? 0}</b>
        </span>
        <div className="flex items-end gap-2 ml-auto">
          <div>
            <Label className="text-xs">Grace (min)</Label>
            <Input type="number" min={0} value={grace} onChange={(e) => setGrace(e.target.value)} className="w-24" />
          </div>
          <Button size="sm" variant="outline" onClick={() => dqMut.mutate()}>Auto-DQ no-shows</Button>
          <Button size="sm" variant="outline" onClick={() => noShowMut.mutate()}>Mark no-shows</Button>
          <Button size="sm" variant="outline" onClick={() => promoteMut.mutate()}>Promote waitlist</Button>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <ul className="text-sm divide-y divide-border/40">
          {(data?.registrations ?? []).map((r) => (
            <li key={r.id} className="py-2 flex justify-between gap-2">
              <span>
                {r.teams ? `[${r.teams.tag}] ${r.teams.name}` : r.profiles?.display_name || r.profiles?.username || r.user_id}
              </span>
              <span className="text-xs text-muted-foreground">{r.status} · {r.payment_status}{r.waitlist_position ? ` · #${r.waitlist_position}` : ""}</span>
            </li>
          ))}
          {!data?.registrations?.length && <li className="py-3 text-muted-foreground">No registrations yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function LifecyclePanel({ tournamentId }: { tournamentId: string }) {
  const fetchHistory = useServerFn(getStatusHistory);
  const { data } = useQuery({
    enabled: !!tournamentId,
    queryKey: ["status-history", tournamentId],
    queryFn: () => fetchHistory({ data: { tournamentId } }),
  });
  if (!tournamentId) return <p className="text-sm text-muted-foreground p-4">Pick a tournament.</p>;
  return (
    <div className="glass-card rounded-2xl p-4">
      <ol className="relative border-l border-border/60 ml-3 space-y-3">
        {(data?.history ?? []).map((h) => (
          <li key={h.id} className="ml-4 text-sm">
            <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
            <p>
              <b>{h.from_status ?? "—"} → {h.to_status}</b>
            </p>
            <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
          </li>
        ))}
        {!data?.history?.length && <li className="text-muted-foreground text-sm">No transitions logged yet.</li>}
      </ol>
    </div>
  );
}

function DisputeQueuePanel() {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(listDisputeQueue);
  const assign = useServerFn(assignDispute);
  const { data } = useQuery({
    queryKey: ["dispute-queue"],
    queryFn: () => fetchQueue(),
  });
  const assignMut = useMutation({
    mutationFn: (id: string) => assign({ data: { disputeId: id, assignToSelf: true } }),
    onSuccess: () => { toast.success("Claimed"); qc.invalidateQueries({ queryKey: ["dispute-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="glass-card rounded-2xl p-4">
      {!data?.disputes.length ? (
        <p className="text-sm text-muted-foreground">Queue empty.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {data.disputes.map((d) => (
            <li key={d.id} className="py-3 flex justify-between gap-3 items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{d.category ?? "general"} · {d.status}</p>
                <p className="text-xs text-muted-foreground truncate">{d.description}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => assignMut.mutate(d.id)} disabled={!!d.assigned_to}>
                  {d.assigned_to ? "Assigned" : "Claim"}
                </Button>
                <Button size="sm" asChild>
                  <a href={`/admin/disputes/${d.id}`}>Review</a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}