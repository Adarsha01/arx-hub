import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getDispute, postDisputeMessage, resolveDispute } from "@/lib/disputes.functions";
import { getEvidenceUrls } from "@/lib/results.functions";

export const Route = createFileRoute("/_authenticated/admin/disputes/$id")({
  component: DisputeDetail,
});

function DisputeDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchDispute = useServerFn(getDispute);
  const postMsg = useServerFn(postDisputeMessage);
  const resolve = useServerFn(resolveDispute);

  const { data } = useQuery({
    queryKey: ["dispute", id],
    queryFn: () => fetchDispute({ data: { disputeId: id } }),
  });

  const [msg, setMsg] = useState("");
  const [internal, setInternal] = useState(true);
  const [verdict, setVerdict] = useState("");
  const [verdictAction, setVerdictAction] = useState<
    "accept" | "reverse" | "rematch" | "award_win" | "disqualify" | "cancel_match"
  >("accept");
  const [newStatus, setNewStatus] = useState<"resolved" | "rejected" | "request_info">("resolved");

  const msgMut = useMutation({
    mutationFn: () => postMsg({ data: { disputeId: id, body: msg, internal } }),
    onSuccess: () => { setMsg(""); qc.invalidateQueries({ queryKey: ["dispute", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolveMut = useMutation({
    mutationFn: () => resolve({ data: { disputeId: id, verdictAction, verdict, newStatus } }),
    onSuccess: () => { toast.success("Updated"); nav({ to: "/admin/operations" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = data?.dispute;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="glass-card rounded-2xl p-4">
        <p className="text-xs uppercase tracking-wider text-accent">{d?.category ?? "general"} · {d?.status}</p>
        <h1 className="text-xl font-black mt-1">Dispute review</h1>
        <p className="text-sm mt-2">{d?.description}</p>
      </div>

      <EvidenceForDispute disputeMatchId={d?.match_id as string | null | undefined} />

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <h2 className="font-bold">Timeline</h2>
        <ul className="space-y-2 text-sm">
          {(data?.messages ?? []).map((m) => (
            <li key={m.id} className={`rounded-lg p-2 ${m.internal ? "bg-accent/10 border border-accent/30" : "bg-background/40 border border-border/40"}`}>
              <p className="text-xs text-muted-foreground">
                {m.internal ? "Internal · " : ""}{new Date(m.created_at).toLocaleString()}
              </p>
              <p>{m.body}</p>
            </li>
          ))}
          {!data?.messages.length && <li className="text-muted-foreground">No messages yet.</li>}
        </ul>
        <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a message..." />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} /> Internal note
          </label>
          <Button size="sm" onClick={() => msg.trim() && msgMut.mutate()} disabled={msgMut.isPending}>Post</Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <h2 className="font-bold">Resolution</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <div>
            <Label>Action</Label>
            <Select value={verdictAction} onValueChange={(v) => setVerdictAction(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["accept", "reverse", "rematch", "award_win", "disqualify", "cancel_match"].map(a => (
                  <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>New status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["resolved", "rejected", "request_info"].map(a => (
                  <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea rows={3} value={verdict} onChange={(e) => setVerdict(e.target.value)} placeholder="Final verdict (visible to parties)" />
        <Button onClick={() => verdict.trim() && resolveMut.mutate()} disabled={resolveMut.isPending} className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold">
          {resolveMut.isPending ? "Saving..." : "Submit resolution"}
        </Button>
      </div>
    </div>
  );
}

function EvidenceForDispute({ disputeMatchId }: { disputeMatchId: string | null | undefined }) {
  // The dispute is tied to a match; mods see all evidence via RLS by looking up result IDs.
  // Simple version: skip; the per-result evidence is shown on the match page.
  if (!disputeMatchId) return null;
  return (
    <div className="glass-card rounded-2xl p-4 text-sm">
      <a className="text-primary underline" href={`/matches/${disputeMatchId}`} target="_blank" rel="noreferrer">
        Open match page to review submitted results & evidence →
      </a>
    </div>
  );
}