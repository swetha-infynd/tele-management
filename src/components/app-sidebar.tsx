import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BadgePoundSterling,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronUp,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Megaphone,
  PhoneCall,
  Settings,
  Users,
  Activity,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, isBdeRole, type Permission } from "@/lib/session";
import { api } from "@/lib/mock/api";
import { roleLabel } from "@/lib/format";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
}

const OPERATIONS: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Leads", url: "/leads", icon: PhoneCall },
  { title: "Attendance", url: "/attendance", icon: CalendarDays },
  { title: "Leave", url: "/leave", icon: ClipboardCheck },
];

const AGENT_OPERATIONS: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "My Leads", url: "/leads", icon: PhoneCall },
  { title: "Attendance", url: "/attendance", icon: CalendarDays },
  { title: "Leave", url: "/leave", icon: ClipboardCheck },
];

const INSIGHTS: NavItem[] = [
  { title: "Performance", url: "/performance", icon: BarChart3 },
  { title: "Dial Data", url: "/dial-data", icon: Activity },
  { title: "Leaderboard", url: "/leaderboard", icon: Award },
  { title: "Quality (QA)", url: "/quality", icon: ClipboardCheck, permission: "review_qa" },
  { title: "Incentives", url: "/incentives", icon: BadgePoundSterling },
  { title: "Reports", url: "/reports", icon: FileBarChart, permission: "view_reports" },
  { title: "AI Insights", url: "/ai-insights", icon: Bot },
];

const BDE_INSIGHTS: NavItem[] = [
  { title: "Performance", url: "/performance", icon: BarChart3 },
  { title: "Leaderboard", url: "/leaderboard", icon: Award },
  { title: "Quality (QA)", url: "/quality", icon: ClipboardCheck, permission: "review_qa" },
  { title: "Incentives", url: "/incentives", icon: BadgePoundSterling },
  { title: "Reports", url: "/reports", icon: FileBarChart, permission: "view_reports" },
  { title: "AI Insights", url: "/ai-insights", icon: Bot },
];

const AGENT_INSIGHTS: NavItem[] = [
  { title: "My Performance", url: "/performance", icon: BarChart3 },
  { title: "My Incentives", url: "/incentives", icon: BadgePoundSterling },
];

const ADMIN: NavItem[] = [
  { title: "Employees", url: "/employees", icon: Users, permission: "view_employees" },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings, permission: "manage_settings" },
];

const AGENT_ADMIN: NavItem[] = [{ title: "Notifications", url: "/notifications", icon: Bell }];

export function AppSidebar() {
  const { can, session, signIn } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const isAgent = session.role === "agent";
  const isBde = isBdeRole(session.role);

  const { data: demoAccounts = [] } = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: api.listDemoAccounts,
  });

  const switchRole = (employeeId: string) => {
    const account = demoAccounts.find((a) => a.employeeId === employeeId);
    if (!account) return;
    signIn(account);
    void navigate({ to: "/" });
  };

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((i) => !i.permission || can(i.permission));
    if (!visible.length) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/20 text-gray-700 dark:text-gray-300">
            <PhoneCall className="size-4" />
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Apex CRM</span>
            <span className="truncate text-xs text-muted-foreground">
              {isAgent ? "My Workspace" : isBde ? "BDE Workspace" : "BPO Operations Suite"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operations", isAgent ? AGENT_OPERATIONS : OPERATIONS)}
        {renderGroup("Insights", isAgent ? AGENT_INSIGHTS : isBde ? BDE_INSIGHTS : INSIGHTS)}
        {renderGroup("Account", isAgent ? AGENT_ADMIN : ADMIN)}
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              aria-label="Switch role"
            >
              <Badge variant="secondary" className="shrink-0">
                {roleLabel[session.role] ?? session.role}
              </Badge>
              <ChevronUp className="ml-auto size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch role
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {demoAccounts.map((account) => (
              <DropdownMenuItem
                key={account.employeeId}
                onSelect={() => switchRole(account.employeeId)}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{roleLabel[account.role] ?? account.role}</span>
                <span className="text-xs text-muted-foreground">{account.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
