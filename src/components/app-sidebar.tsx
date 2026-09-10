import { Link, useRouterState } from "@tanstack/react-router";
import {
  Award,
  BadgeIndianRupee,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
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
import { useSession, type Permission } from "@/lib/session";

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

const INSIGHTS: NavItem[] = [
  { title: "Performance", url: "/performance", icon: BarChart3 },
  { title: "Dial Data", url: "/dial-data", icon: Activity },
  { title: "Leaderboard", url: "/leaderboard", icon: Award },
  { title: "Quality (QA)", url: "/quality", icon: ClipboardCheck, permission: "review_qa" },
  { title: "Incentives", url: "/incentives", icon: BadgeIndianRupee },
  { title: "Reports", url: "/reports", icon: FileBarChart, permission: "view_reports" },
  { title: "AI Insights", url: "/ai-insights", icon: Bot },
];

const ADMIN: NavItem[] = [
  { title: "Employees", url: "/employees", icon: Users, permission: "manage_employees" },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings, permission: "manage_settings" },
];

export function AppSidebar() {
  const { can, session } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

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
            <span className="truncate text-xs text-muted-foreground">BPO Operations Suite</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operations", OPERATIONS)}
        {renderGroup("Insights", INSIGHTS)}
        {renderGroup("Administration", ADMIN)}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
          <Badge variant="secondary" className="w-full justify-center">
            {session.team}
          </Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
