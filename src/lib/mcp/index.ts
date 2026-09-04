import { defineMcp } from "@lovable.dev/mcp-js";
import aiDailySummaryTool from "./tools/ai-daily-summary";
import attendanceSummaryTool from "./tools/attendance-summary";
import createLeadTool from "./tools/create-lead";
import dashboardStatsTool from "./tools/dashboard-stats";
import generateReportTool from "./tools/generate-report";
import leaderboardTool from "./tools/leaderboard";
import listEmployeesTool from "./tools/list-employees";
import listLeadsTool from "./tools/list-leads";

export default defineMcp({
  name: "project-harmony",
  title: "Project Harmony",
  version: "0.1.0",
  instructions:
    "Tools for the Apex BPO Operations Suite demo CRM. Read floor stats, employees, leads, attendance, leaderboards and reports, and create demo leads. All data is simulated in-memory demo data.",
  tools: [
    dashboardStatsTool,
    listEmployeesTool,
    listLeadsTool,
    createLeadTool,
    leaderboardTool,
    attendanceSummaryTool,
    generateReportTool,
    aiDailySummaryTool,
  ] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
