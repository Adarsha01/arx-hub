import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getFinanceOverview, reviewWithdrawal } from "@/lib/finance.functions";
import { Button } from "@/components/ui/button";
import { IndianRupee, AlertTriangle, Vault, Coins } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  head: () => ({ meta: [{ title: "Finance — ARX Admin" }] }),
  component: AdminFinancePage,
});

function AdminFinancePage() {
  const fetchOverview = useServerFn(getFinanceOverview);
  const reviewFn = useServerFn(reviewWithdrawal);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["finance-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const mutate = useMutation({
    mutationFn: (vars: { withdrawalId: string; action: "approve" | "reject" | "mark_paid" }) =>
      reviewFn({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["finance-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading finance...</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={IndianRupee} label="Total revenue" value={`₹${data.totalRevenue.toLocaleString()}`} />
        <Kpi icon={Vault} label="Escrow held" value={`₹${data.totalEscrow.toLocaleString()}`} />
        <Kpi icon={Coins} label="Pending withdrawals" value={`${data.pendingWithdrawalsCount} · ₹${data.pendingWithdrawalsAmount.toLocaleString()}`} />
        <Kpi icon={AlertTriangle} label="Payment failures" value={String(data.paymentFailures)} />
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Withdrawal queue</h2>
        {!data.pendingQueue.length ? (
          <p className="text-sm text-muted-foreground">Nothing to review.</p>
        ) : (
          <ul className="space-y-2">
            {data.pendingQueue.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 border border-border/40 rounded-lg p-3">
                <div>
                  <p className="font-medium">₹{Number(w.amount).toLocaleString()} · {w.payout_method}</p>
                  <p className="text-xs text-muted-foreground">{w.user_id.slice(0, 8)} · {new Date(w.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => mutate.mutate({ withdrawalId: w.id, action: "approve" })}>Approve</Button>
                  <Button size="sm" onClick={() => mutate.mutate({ withdrawalId: w.id, action: "mark_paid" })}>Mark paid</Button>
                  <Button size="sm" variant="destructive" onClick={() => mutate.mutate({ withdrawalId: w.id, action: "reject" })}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Escrow by tournament</h2>
        {!Object.keys(data.escrowByTournament).length ? (
          <p className="text-sm text-muted-foreground">No escrow balances.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {Object.entries(data.escrowByTournament).map(([id, bal]) => (
              <li key={id} className="flex justify-between border-b border-border/30 py-1">
                <span className="text-muted-foreground">{id.slice(0, 8)}…</span>
                <span className="font-medium">₹{Number(bal).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black mt-1 text-gradient">{value}</p>
    </div>
  );
}