import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dashboardStats } from "@/lib/mock/api";

export default defineTool({
  name: "dashboard_stats",
  title: "Dashboard stats",
  description:
    "Today's floor snapshot: agents logged in, attendance, calls, leads, sales, revenue and day-over-day deltas.",
  inputSchema: {
    team: z.string().optional().describe("Optional team name to filter by."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team }) => {
    const stats = await dashboardStats(team);
    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      structuredContent: { stats },
    };
  },
});
