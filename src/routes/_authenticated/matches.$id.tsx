import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  submitMatchResult,
  confirmMatchResult,
  disputeMatchResult,
  recordEvidence,
  getEvidenceUrls,
  listMatchResults,
} from "@/lib/results.functions";
import { uploadEvidenceFile } from "@/lib/evidence-upload";
import { getMatchCredentials } from "@/lib/credentials.functions";
import { Lock, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/matches/$id")({
  component: MatchDetail,
});

function MatchDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const listResults = useServerFn(listMatchResults);
  const submit = useServerFn(submitMatchResult);
  const confirm = useServerFn(confirmMatchResult);
  const dispute = useServerFn(disputeMatchResult);
  const record = useServerFn(recordEvidence);

  const { data: match } = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: myTeams } = useQuery({
    enabled: !!user,
    queryKey: ["my-teams-cap", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name, tag").eq("captain_id", user!.id);
      return data ?? [];
    },
  });

  const { data: results } = useQuery({
    queryKey: ["match-results", id],
    queryFn: () => listResults({ data: { matchId: id } }),
  });

  const fetchCreds = useServerFn(getMatchCredentials);
  const { data: creds } = useQuery({
    queryKey: ["match-credentials", id],
    queryFn: () => fetchCreds({ data: { matchId: id } }),
    refetchInterval: 30_000,
  });

  const [form, setForm] = useState({ teamId: "", placement: "1", kills: "0", points: "0" });

  const submitMut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          matchId: id,
          teamId: form.teamId || null,
          userId: form.teamId ? null : user?.id ?? null,
          placement: Number(form.placement),
          kills: Number(form.kills),
          points: Number(form.points),
        },
      }),
    onSuccess: () => {
      toast.success("Result submitted — awaiting confirmation");
      qc.invalidateQueries({ queryKey: ["match-results", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (resultId: string) => confirm({ data: { resultId } }),
    onSuccess: () => {
      toast.success("Result confirmed");
      qc.invalidateQueries({ queryKey: ["match-results", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <h1 className="text-2xl font-black">
          Round {match?.round} · Match {match?.match_number}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {match?.scheduled_at ? new Date(match.scheduled_at).toLocaleString() : "Schedule TBD"} · Status: {match?.status}
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-bold">Room credentials</h2>
        </div>
        {creds?.unlocked ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/40 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Room ID</p>
              <p className="font-mono text-base mt-1 break-all">{creds.roomId}</p>
            </div>
            <div className="rounded-lg border border-border/40 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Password</p>
              <p className="font-mono text-base mt-1 break-all">{creds.roomPassword}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/60 p-4 text-sm">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold">🔒 Match Credentials Locked</p>
              <p className="text-muted-foreground mt-1">
                Complete tournament check-in to unlock room details.
              </p>
            </div>
          </div>
        )}
      </div>

      <form
        className="glass-card rounded-2xl p-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submitMut.mutate();
        }}
      >
        <h2 className="font-bold">Submit result</h2>
        <div>
          <Label>Submitting as</Label>
          <Select value={form.teamId} onValueChange={(v) => setForm({ ...form, teamId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Solo (me)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Solo (me)</SelectItem>
              {(myTeams ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  [{t.tag}] {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Placement</Label>
            <Input type="number" min={1} value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} />
          </div>
          <div>
            <Label>Kills</Label>
            <Input type="number" min={0} value={form.kills} onChange={(e) => setForm({ ...form, kills: e.target.value })} />
          </div>
          <div>
            <Label>Points</Label>
            <Input type="number" min={0} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
          </div>
        </div>
        <Button type="submit" disabled={submitMut.isPending} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold">
          {submitMut.isPending ? "Submitting..." : "Submit result"}
        </Button>
      </form>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold mb-3">Submitted results</h2>
        {!results?.results.length ? (
          <p className="text-sm text-muted-foreground">No results submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {results.results.map((r) => (
              <ResultRow
                key={r.id}
                result={r}
                userId={user?.id}
                onConfirm={() => confirmMut.mutate(r.id as string)}
                onUploaded={async (path) => {
                  await record({ data: { resultId: r.id as string, storagePath: path } });
                  qc.invalidateQueries({ queryKey: ["match-results", id] });
                  qc.invalidateQueries({ queryKey: ["evidence", r.id] });
                  toast.success("Evidence uploaded");
                }}
                onDispute={async (category, description) => {
                  try {
                    await dispute({ data: { resultId: r.id as string, category, description } });
                    toast.success("Dispute opened — moderators have been notified");
                    qc.invalidateQueries({ queryKey: ["match-results", id] });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type ResultRowProps = {
  result: Record<string, unknown>;
  userId: string | undefined;
  onConfirm: () => void;
  onUploaded: (path: string) => Promise<void>;
  onDispute: (category: "incorrect_result" | "missing_evidence" | "cheating" | "no_show" | "misconduct" | "other", description: string) => Promise<void>;
};

function ResultRow({ result, userId, onConfirm, onUploaded, onDispute }: ResultRowProps) {
  const r = result as {
    id: string; status: string; submitted_by: string; placement: number | null; kills: number; points: number; evidence_count: number; verified: boolean;
  };
  const isMine = userId && r.submitted_by === userId;
  const fetchEvidence = useServerFn(getEvidenceUrls);
  const { data: evidence } = useQuery({
    queryKey: ["evidence", r.id],
    queryFn: () => fetchEvidence({ data: { resultId: r.id } }),
  });
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [category, setCategory] = useState<ResultRowProps["onDispute"] extends (c: infer C, ...args: unknown[]) => unknown ? C : never>("incorrect_result" as never);
  const [desc, setDesc] = useState("");

  return (
    <li className="border border-border/40 rounded-lg p-3 text-sm space-y-2">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <span className="font-semibold">Place #{r.placement ?? "?"}</span> · {r.kills} kills · {r.points} pts
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${r.status === "confirmed" ? "bg-emerald-500/15 text-emerald-400" : r.status === "disputed" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{r.status}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {!isMine && r.status === "submitted" && (
          <>
            <Button size="sm" variant="outline" onClick={onConfirm}>Confirm</Button>
            <Button size="sm" variant="outline" onClick={() => setDisputeOpen((v) => !v)}>Dispute</Button>
          </>
        )}
        {isMine && r.status === "submitted" && (
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !userId) return;
                const { path } = await uploadEvidenceFile(userId, f);
                await onUploaded(path);
              }}
            />
            <span className="px-3 py-1.5 rounded-md border border-border/60 hover:bg-primary/10">+ Add screenshot</span>
          </label>
        )}
      </div>
      {disputeOpen && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Select value={category as string} onValueChange={(v) => setCategory(v as never)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["incorrect_result", "missing_evidence", "cheating", "no_show", "misconduct", "other"].map((c) => (
                <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea rows={3} placeholder="Describe the issue (min 5 chars)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button size="sm" onClick={async () => { await onDispute(category as never, desc); setDisputeOpen(false); setDesc(""); }}>
            Submit dispute
          </Button>
        </div>
      )}
      {!!evidence?.items.length && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
          {evidence.items.map((ev) => (
            <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer" className="block">
              {ev.mime_type?.startsWith("image/") ? (
                <img src={ev.url} alt="evidence" className="h-20 w-full object-cover rounded border border-border/40" />
              ) : (
                <div className="h-20 rounded border border-border/40 flex items-center justify-center text-xs">File</div>
              )}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}