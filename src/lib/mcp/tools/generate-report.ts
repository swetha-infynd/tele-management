import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { generateReport } from "@/lib/mock/api";

export default defineTool({
  name: "generate_report",
  title: "Generate report",
  description:
    "Build an operations report (daily, weekly, monthly, team, attendance, sales, revenue, conversion or agent) for a date range.",
  inputSchema: {
    type: z.enum([
      "daily",
      "weekly",
      "monthly",
      "team",
      "attendance",
      "sales",
      "revenue",
      "conversion",
      "agent",
    ]),
    from: z.string().describe("Start date, yyyy-mm-dd"),
    to: z.string().describe("End date, yyyy-mm-dd"),
    team: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, from, to, team }) => {
    const report = await generateReport(type, { from, to, ...(team ? { team } : {}) });
    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      structuredContent: { report },
    };
  },
});
