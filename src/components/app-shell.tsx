import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Search, UserCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { usePreferences } from "@/lib/preferences";
import { GlobalSearch } from "@/components/global-search";
import { api } from "@/lib/mock/api";
import { initials, roleLabel, timeAgo } from "@/lib/format";
import { useSession } from "@/lib/session";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  const { prefs } = usePreferences();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
    refetchInterval: prefs.autoRefreshSeconds > 0 ? prefs.autoRefreshSeconds * 1000 : 60000,
  });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <SidebarProvider
      key={prefs.sidebarCollapsed ? "collapsed" : "expanded"}
      defaultOpen={!prefs.sidebarCollapsed}
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground w-56 justify-start gap-2 font-normal"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4" />
            Search leads, agents…
            <kbd className="bg-muted pointer-events-none ml-auto hidden select-none rounded border px-1.5 font-mono text-[10px] sm:inline-block">
              ⌘K
            </kbd>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 flex size-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  {unread > 0 && <Badge variant="secondary">{unread} new</Badge>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-72">
                  {notifications.slice(0, 8).map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex flex-col items-start gap-0.5 py-2"
                      onSelect={() => navigate({ to: "/notifications" })}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        {!n.read && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{n.body}</span>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/notifications" className="justify-center text-sm">
                    View all notifications
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials(session.name)}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left leading-tight sm:grid">
                    <span className="text-xs font-medium">{session.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {roleLabel[session.role]}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="grid">
                    <span className="text-sm">{session.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{session.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/employees/$employeeId" params={{ employeeId: session.employeeId }}>
                    <UserCircle className="mr-2 size-4" /> My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex-1 space-y-6 p-4 md:p-6">{children}</div>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarInset>
    </SidebarProvider>
  );
}
