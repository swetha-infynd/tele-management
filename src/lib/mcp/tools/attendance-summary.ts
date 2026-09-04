import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { attendanceSummary } from "@/lib/mock/api";

export default defineTool({
  name: "attendance_summary",
  title: "Attendance summary",
  description: "Attendance totals per day for a date range, optionally filtered by team.",
  inputSchema: {
    from: z.string().describe("Start date, yyyy-mm-dd"),
    to: z.string().describe("End date, yyyy-mm-dd"),
    team: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, team }) => {
    const summary = await attendanceSummary({ from, to, ...(team ? { team } : {}) });
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { summary },
    };
  },
});
