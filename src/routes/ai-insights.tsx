import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles, Star, User } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ChatMessage } from "@/lib/mock/api";
import { useTeamScope } from "@/lib/session";

export const Route = createFileRoute("/ai-insights")({
  head: () => ({
    meta: [
      { title: "AI Insights & Performance Assistant | Apex CRM" },
      {
        name: "description",
        content:
          "AI-generated daily floor summaries, strengths, risks, predictions and a conversational assistant for your sales operation.",
      },
      { property: "og:title", content: "AI Insights | Apex CRM" },
      {
        property: "og:description",
        content: "Daily AI summaries, coaching recommendations and an operations assistant.",
      },
    ],
  }),
  component: AiInsightsPage,
});

const SUGGESTIONS = [
  "Why are sales down today?",
  "Which agents need coaching?",
  "Who deserves an incentive this week?",
  "How is attendance looking?",
  "Are we on track for the revenue target?",
];

function AiInsightsPage() {
  const scope = useTeamScope();
  const [team, setTeam] = useState<string>(scope ?? "all");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "seed",
      role: "assistant",
      content:
        "Hello. Ask me about today's performance, attendance, coaching priorities or incentive eligibility.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: api.listTeams });
  const { data: summary, isLoading } = useQuery({
    queryKey: ["ai-summary", team],
    queryFn: () => api.aiDailySummary(team === "all" ? undefined : team),
  });
  const { data: alerts = [] } = useQuery({ queryKey: ["ai-alerts"], queryFn: api.aiAlerts });

  const ask = useMutation({
    mutationFn: (q: string) => api.aiChat(q),
    onSuccess: (m) => setMessages((prev) => [...prev, m]),
  });

  const send = (q: string) => {
    const question = q.trim();
    if (!question || ask.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: question, createdAt: new Date().toISOString() },
    ]);
    setInput("");
    ask.mutate(question);
  };

  const list = (items: string[] | undefined) => (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {(items ?? []).map((b, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <AppShell>
      <PageHeader
        title="AI insights"
        description="Automated analysis of today's floor performance, with a conversational assistant."
        actions={
          <Select value={team} onValueChange={setTeam} disabled={!!scope}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" /> Daily summary
              </CardTitle>
              <CardDescription>
                {isLoading ? "Analysing today's data…" : summary?.headline}
              </CardDescription>
            </div>
            {summary && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${i < Math.round(summary.rating / 2) ? "fill-foreground" : "text-muted-foreground"}`}
                  />
                ))}
                <Badge variant="secondary" className="ml-2">
                  {summary.rating}/10
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            list(summary?.bullets)
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What went well</CardTitle>
          </CardHeader>
          <CardContent>{list(summary?.strengths)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent>{list(summary?.improvements)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Predictions</CardTitle>
          </CardHeader>
          <CardContent>{list(summary?.predictions)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" /> Ask the assistant
            </CardTitle>
            <CardDescription>Natural-language questions about your operation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-80 rounded-md border p-4">
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border">
                      {m.role === "assistant" ? (
                        <Bot className="size-3.5" />
                      ) : (
                        <User className="size-3.5" />
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  </div>
                ))}
                {ask.isPending && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border">
                      <Bot className="size-3.5" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about performance, attendance or leads…"
              />
              <Button type="submit" size="icon" disabled={ask.isPending}>
                <Send className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Smart alerts</CardTitle>
            <CardDescription>Risks detected in the current data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No risks detected.</p>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    <Badge
                      variant={
                        a.severity === "critical"
                          ? "destructive"
                          : a.severity === "warning"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {a.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
