import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { leaderboard } from "@/lib/mock/api";

export default defineTool({
  name: "leaderboard",
  title: "Agent leaderboard",
  description: "Ranked agents for a period by sales, revenue, conversion, calls or quality score.",
  inputSchema: {
    period: z.enum(["daily", "weekly", "monthly"]).optional(),
    metric: z.enum(["sales", "revenue", "conversion", "calls", "qualityScore"]).optional(),
    team: z.string().optional(),
    limit: z.number().int().optional().describe("How many rows to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ period, metric, team, limit }) => {
    const rows = (await leaderboard(period ?? "daily", metric ?? "sales", team)).slice(
      0,
      limit ?? 10,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { rows },
    };
  },
});
