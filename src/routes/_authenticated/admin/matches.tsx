import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { regenerateMatchCredentials } from "@/lib/credentials.functions";

export const Route = createFileRoute("/_authenticated/admin/matches")({
  component: AdminMatches,
});

function AdminMatches() {
  const qc = useQueryClient();
  const { data: tournaments } = useQuery({
    queryKey: ["admin-tournaments-pick"],
    queryFn: async () => {
      const { data } = await supabase.from("tournaments").select("id, name").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [selected, setSelected] = useState<string | null>(null);

  const { data: matches } = useQuery({
    enabled: !!selected,
    queryKey: ["matches", selected],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").eq("tournament_id", selected!).order("round").order("match_number");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ round: "1", match_number: "1", scheduled_at: "", room_id: "", room_password: "" });

  const regen = useServerFn(regenerateMatchCredentials);
  const regenMut = useMutation({
    mutationFn: (args: { matchId: string; roomId: string; roomPassword: string }) =>
      regen({ data: args }),
    onSuccess: () => { toast.success("Credentials updated"); qc.invalidateQueries({ queryKey: ["matches", selected] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick a tournament");
      const { error } = await supabase.from("matches").insert({
        tournament_id: selected,
        round: Number(form.round),
        match_number: Number(form.match_number),
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        room_id: form.room_id || null,
        room_password: form.room_password || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Match created"); qc.invalidateQueries({ queryKey: ["matches", selected] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4">
        <Label>Tournament</Label>
        <Select value={selected ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select a tournament..." /></SelectTrigger>
          <SelectContent>
            {(tournaments ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-3">Matches</h2>
            {!matches?.length ? <p className="text-sm text-muted-foreground">No matches scheduled.</p> : (
              <ul className="space-y-2">
                {matches.map((m) => (
                  <li key={m.id} className="border border-border/40 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-semibold">Round {m.round} · Match {m.match_number}</span>
                      <span className="text-xs text-muted-foreground">{m.status}</span>
                    </div>
                    {m.scheduled_at && <p className="text-xs text-muted-foreground">{new Date(m.scheduled_at).toLocaleString()}</p>}
                    {(m.room_id || m.room_password) && (
                      <p className="text-xs mt-1 font-mono">Room: {m.room_id ?? "—"} · Pass: {m.room_password ?? "—"}</p>
                    )}
                    <RegenInline matchId={m.id} onSubmit={(rid, rpw) => regenMut.mutate({ matchId: m.id, roomId: rid, roomPassword: rpw })} disabled={regenMut.isPending} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className="glass-card rounded-2xl p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <h2 className="font-bold">Create match</h2>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Round</Label><Input type="number" min={1} value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} /></div>
              <div><Label>Match #</Label><Input type="number" min={1} value={form.match_number} onChange={(e) => setForm({ ...form, match_number: e.target.value })} /></div>
            </div>
            <div><Label>Scheduled at</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <div><Label>Room ID</Label><Input value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} /></div>
            <div><Label>Room password</Label><Input value={form.room_password} onChange={(e) => setForm({ ...form, room_password: e.target.value })} /></div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function RegenInline({ matchId, onSubmit, disabled }: { matchId: string; onSubmit: (rid: string, rpw: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [rid, setRid] = useState("");
  const [rpw, setRpw] = useState("");
  return (
    <div className="mt-2">
      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Regenerate credentials</Button>
      ) : (
        <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-border/40">
          <div className="flex-1 min-w-[120px]"><Label>Room ID</Label><Input value={rid} onChange={(e) => setRid(e.target.value)} /></div>
          <div className="flex-1 min-w-[120px]"><Label>Password</Label><Input value={rpw} onChange={(e) => setRpw(e.target.value)} /></div>
          <Button size="sm" disabled={disabled || !rid || !rpw} onClick={() => { onSubmit(rid, rpw); setOpen(false); setRid(""); setRpw(""); }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <input type="hidden" value={matchId} />
        </div>
      )}
    </div>
  );
}