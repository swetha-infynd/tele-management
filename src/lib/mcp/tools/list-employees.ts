import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { listEmployees } from "@/lib/mock/api";

export default defineTool({
  name: "list_employees",
  title: "List employees",
  description: "Search and page through the employee directory (agents, BDEs, admins).",
  inputSchema: {
    search: z.string().optional().describe("Match on name, employee ID or email."),
    team: z.string().optional(),
    role: z.enum(["admin", "BDE", "agent"]).optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
    page: z.number().int().optional(),
    pageSize: z.number().int().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const result = await listEmployees(input as Parameters<typeof listEmployees>[0]);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { ...result },
    };
  },
});
