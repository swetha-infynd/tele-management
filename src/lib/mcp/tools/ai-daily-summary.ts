import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { aiDailySummary } from "@/lib/mock/api";

export default defineTool({
  name: "ai_daily_summary",
  title: "AI daily summary",
  description: "Simulated AI briefing of the floor: highlights, risks and recommended actions.",
  inputSchema: {
    team: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team }) => {
    const summary = await aiDailySummary(team);
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { summary },
    };
  },
});
