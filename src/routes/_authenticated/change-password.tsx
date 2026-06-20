import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { completePasswordChange, getMyAccountFlags } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePassword,
});

function ChangePassword() {
  const nav = useNavigate();
  const fetchFlags = useServerFn(getMyAccountFlags);
  const change = useServerFn(completePasswordChange);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const { data: flags } = useQuery({
    queryKey: ["account-flags"],
    queryFn: () => fetchFlags(),
  });

  const mut = useMutation({
    mutationFn: () => change({ data: { newPassword: pw } }),
    onSuccess: () => {
      toast.success("Password updated");
      nav({ to: "/dashboard", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto max-w-md px-4 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-black">
          {flags?.mustChangePassword ? "Change your password" : "Update password"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {flags?.mustChangePassword
            ? "For security, please choose a new password before continuing."
            : "Set a new password for your account."}
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.length < 8) return toast.error("Use at least 8 characters");
          if (pw !== confirm) return toast.error("Passwords do not match");
          mut.mutate();
        }}
      >
        <div>
          <Label>New password</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        <div>
          <Label>Confirm password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" disabled={mut.isPending} className="w-full">
          {mut.isPending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}