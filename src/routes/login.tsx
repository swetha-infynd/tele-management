import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/format";
import { api } from "@/lib/mock/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | Apex CRM" },
      {
        name: "description",
        content:
          "Sign in to Apex CRM to manage leads, attendance, quality and performance for your BPO team.",
      },
      { property: "og:title", content: "Sign in | Apex CRM" },
      { property: "og:description", content: "Access your BPO sales and workforce workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = useState("charlotte@apexbpo.co.uk");
  const [password, setPassword] = useState("demo1234");

  const { data: demo = [] } = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: api.listDemoAccounts,
  });

  const login = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      api.login(creds.email, creds.password),
    onSuccess: (session) => {
      signIn(session);
      toast.success(`Welcome back, ${session.name.split(" ")[0]}`);
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PhoneCall className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Apex CRM</h1>
            <p className="text-xs text-muted-foreground">BPO Operations Suite</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>Use a demo account below or enter your credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate({ email, password });
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">Demo accounts</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-2">
              {demo.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    login.mutate({ email: d.email, password: "demo1234" });
                  }}
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.email}</p>
                  </div>
                  <Badge variant="secondary">{roleLabel[d.role] ?? d.role}</Badge>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Demo password for every account: demo1234
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
