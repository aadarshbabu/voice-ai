import { z } from "zod";

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  orgId: z.string().optional(),
});

export const UpdateWorkflowSchema = z.object({
  id: z.string(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;
