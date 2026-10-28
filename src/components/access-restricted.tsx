import { ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function AccessRestricted({
  title,
  message = "You do not have permission to view this page. Contact your administrator for access.",
}: {
  title: string;
  message?: string;
}) {
  return (
    <AppShell>
      <PageHeader title={title} description="Restricted for your role." />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
