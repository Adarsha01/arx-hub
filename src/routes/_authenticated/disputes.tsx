import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDisputes } from "@/lib/disputes.functions";

export const Route = createFileRoute("/_authenticated/disputes")({
  component: MyDisputes,
});

function MyDisputes() {
  const fetchMine = useServerFn(listMyDisputes);
  const { data } = useQuery({
    queryKey: ["my-disputes"],
    queryFn: () => fetchMine(),
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-black mb-6">My disputes</h1>
      {!data?.disputes.length ? (
        <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">
          You haven't opened any disputes.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.disputes.map((d) => (
            <li key={d.id} className="glass-card rounded-2xl p-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs uppercase tracking-wider text-accent">{d.category ?? "general"}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary">{d.status}</span>
              </div>
              <p className="text-sm">{d.description}</p>
              {d.verdict && (
                <p className="text-xs mt-2 text-emerald-400">Verdict: {d.verdict}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Updated {new Date(d.last_activity_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}