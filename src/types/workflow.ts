import { z } from "zod";

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  orgId: z.string().optional(),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
