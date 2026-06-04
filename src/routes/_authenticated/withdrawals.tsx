import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listMyWithdrawals, requestWithdrawal, getWalletSnapshot } from "@/lib/payments.functions";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — ARX Hub" }] }),
  component: WithdrawalsPage,
});

function WithdrawalsPage() {
  const fetchWallet = useServerFn(getWalletSnapshot);
  const fetchList = useServerFn(listMyWithdrawals);
  const requestFn = useServerFn(requestWithdrawal);
  const qc = useQueryClient();

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });
  const { data: history } = useQuery({ queryKey: ["my-withdrawals"], queryFn: () => fetchList() });

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [upi, setUpi] = useState("");
  const [acct, setAcct] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [name, setName] = useState("");

  const mutate = useMutation({
    mutationFn: () =>
      requestFn({
        data: {
          amount: Number(amount),
          payoutMethod: method,
          payoutDetails:
            method === "upi"
              ? { upi_id: upi }
              : { account_number: acct, ifsc, account_name: name },
        },
      }),
    onSuccess: () => {
      toast.success("Withdrawal requested");
      setAmount(""); setUpi(""); setAcct(""); setIfsc(""); setName("");
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10 max-w-4xl grid md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black">Request withdrawal</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Available: ₹{Number(wallet?.balance ?? 0).toLocaleString()}
          </p>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as "upi" | "bank")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {method === "upi" ? (
              <div>
                <Label>UPI ID</Label>
                <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="user@bank" />
              </div>
            ) : (
              <>
                <div><Label>Account name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Account number</Label><Input value={acct} onChange={(e) => setAcct(e.target.value)} /></div>
                <div><Label>IFSC</Label><Input value={ifsc} onChange={(e) => setIfsc(e.target.value)} /></div>
              </>
            )}
            <Button
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
              disabled={mutate.isPending || !amount}
              onClick={() => mutate.mutate()}
            >
              {mutate.isPending ? "Submitting..." : "Submit request"}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">Your withdrawals</h2>
          {!history?.length ? (
            <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((w) => (
                <li key={w.id} className="flex items-center justify-between border border-border/40 rounded-lg p-3">
                  <div>
                    <p className="font-medium">₹{Number(w.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.payout_method} · {new Date(w.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary uppercase">
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SiteShell>
  );
}