import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/mock/types";
import { listLeads } from "@/lib/mock/api";

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description: "Search the sales pipeline for leads by text, status, campaign, source or agent.",
  inputSchema: {
    search: z.string().optional().describe("Match on customer, business, phone or email."),
    status: z.enum(LEAD_STATUSES).optional(),
    campaign: z.string().optional(),
    source: z.string().optional(),
    agentId: z.string().optional(),
    team: z.string().optional(),
    page: z.number().int().optional(),
    pageSize: z.number().int().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const result = await listLeads(input as Parameters<typeof listLeads>[0]);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { ...result },
    };
  },
});
