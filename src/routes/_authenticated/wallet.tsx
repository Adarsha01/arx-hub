import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWalletSnapshot } from "@/lib/payments.functions";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — ARX Hub" }] }),
  component: WalletPage,
});

function WalletPage() {
  const fetchWallet = useServerFn(getWalletSnapshot);
  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => fetchWallet(),
  });

  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="glass-card rounded-3xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black">Wallet</h1>
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Available balance</p>
          <p className="text-5xl font-black text-gradient mt-2">
            ₹{Number(data?.balance ?? 0).toLocaleString()}
          </p>
          <div className="mt-6 flex gap-2">
            <Button asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Link to="/withdrawals">Request withdrawal</Link>
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">Transaction history</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !data?.ledger.length ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {data.ledger.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {l.entry_type === "credit" ? (
                      <ArrowDownRight className="h-5 w-5 text-green-400" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-orange-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{l.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.notes ?? ""} · {new Date(l.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold ${l.entry_type === "credit" ? "text-green-400" : "text-orange-400"}`}>
                    {l.entry_type === "credit" ? "+" : "-"}₹{Number(l.amount).toLocaleString()}
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