import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/mock/types";
import { createLead } from "@/lib/mock/api";

export default defineTool({
  name: "create_lead",
  title: "Create lead",
  description: "Add a new lead to the demo sales pipeline.",
  inputSchema: {
    customerName: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().optional(),
    businessName: z.string().optional(),
    campaign: z.string().optional(),
    source: z.string().optional(),
    assignedAgentId: z.string().describe("Employee id of the agent who owns the lead."),
    status: z.enum(LEAD_STATUSES).optional(),
    followUpDate: z.string().optional().describe("yyyy-mm-dd"),
    saleAmount: z.number().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input) => {
    try {
      const lead = await createLead({
        customerName: input.customerName,
        phone: input.phone,
        email: input.email ?? "",
        businessName: input.businessName ?? "",
        campaign: input.campaign ?? "General",
        source: input.source ?? "Manual",
        assignedAgentId: input.assignedAgentId,
        status: input.status ?? "New",
        followUpDate: input.followUpDate ?? null,
        saleAmount: input.saleAmount ?? 0,
      } as never);
      return {
        content: [{ type: "text", text: JSON.stringify(lead, null, 2) }],
        structuredContent: { lead },
      };
    } catch (error) {
      throw new ToolError((error as Error).message);
    }
  },
});
